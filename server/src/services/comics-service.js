import { randomUUID } from 'node:crypto';
import { INSERT_SQL, insertParams } from '../db/connection.js';
import {
  DEFAULT_SORT,
  ERA_RANGES,
  ERAS,
  GENRES,
  SORTS,
  censusFor,
  eraFor,
  priceCapValue,
  recordRef,
} from '../utils/domain.js';

/**
 * The searchable haystack — identical composition to the prototype:
 * series, "#issue", publisher, genre, creators, key note and year.
 * Dialect-neutral: works on both SQLite and Postgres.
 */
const HAYSTACK =
  "lower(series || ' #' || issue || ' ' || publisher || ' ' || genre || ' ' || creators || ' ' || key_note || ' ' || CAST(year AS TEXT))";

const ORDER_BY = {
  'year-asc': 'year ASC, added DESC',
  'year-desc': 'year DESC, added DESC',
  'value-desc': 'price DESC, added DESC',
  'grade-desc': 'grade DESC, added DESC',
  'title-asc': 'lower(series) ASC, issue_sort ASC, issue ASC',
  'added-desc': 'added DESC',
};

/** Escape LIKE wildcards in a search term (we add our own % around it). */
function likeTerm(term) {
  return '%' + term.replace(/[\\%_]/g, (m) => '\\' + m) + '%';
}

/** Row (snake_case) → API record (the design's state shape + derived fields). */
export function serialize(row) {
  return {
    id: row.id,
    ref: recordRef(row.id),
    series: row.series,
    issue: row.issue,
    title: `${row.series} #${row.issue}`,
    publisher: row.publisher,
    year: Number(row.year),
    era: eraFor(Number(row.year)),
    genre: row.genre,
    grade: Number(row.grade),
    price: Number(row.price),
    keyNote: row.key_note,
    isKey: row.key_note !== '',
    creators: row.creators,
    image: row.image,
    added: Number(row.added),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ComicsService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Normalize raw query-string input into a filter object.
   * Facets are multi-select within a group (repeat the param) and AND across groups.
   */
  parseFilters(query) {
    const list = (v) =>
      (Array.isArray(v) ? v : v != null ? [v] : [])
        .map((s) => String(s).trim())
        .filter(Boolean);

    const sort = SORTS.includes(query.sort) ? query.sort : DEFAULT_SORT;
    const priceCap =
      query.priceCap != null && query.priceCap !== ''
        ? Math.min(100, Math.max(0, Number(query.priceCap) || 0))
        : 100;

    const limit = Math.min(200, Math.max(1, parseInt(query.limit, 10) || 60));
    const offset = Math.max(0, parseInt(query.offset, 10) || 0);

    return {
      q: typeof query.q === 'string' ? query.q.trim() : '',
      publisher: list(query.publisher),
      era: list(query.era).filter((e) => ERAS.includes(e)),
      genre: list(query.genre),
      keyOnly: query.keyOnly === 'true' || query.keyOnly === '1',
      priceCap,
      sort,
      limit,
      offset,
    };
  }

  /**
   * Build the WHERE clause. `skipGroup` omits one facet group's own filter —
   * that is how facet counts stay non-zero for options you could still pick.
   */
  buildWhere(f, skipGroup = null) {
    const clauses = [];
    const params = [];

    if (f.q) {
      for (const term of f.q.toLowerCase().split(/\s+/).filter(Boolean)) {
        clauses.push(`${HAYSTACK} LIKE ? ESCAPE '\\'`);
        params.push(likeTerm(term));
      }
    }
    if (skipGroup !== 'publisher' && f.publisher.length) {
      clauses.push(`publisher IN (${f.publisher.map(() => '?').join(',')})`);
      params.push(...f.publisher);
    }
    if (skipGroup !== 'era' && f.era.length) {
      const ors = f.era.map((era) => {
        const { min, max } = ERA_RANGES[era];
        if (min == null) return `year <= ${max}`;
        if (max == null) return `year >= ${min}`;
        return `(year BETWEEN ${min} AND ${max})`;
      });
      clauses.push(`(${ors.join(' OR ')})`);
    }
    if (skipGroup !== 'genre' && f.genre.length) {
      clauses.push(`genre IN (${f.genre.map(() => '?').join(',')})`);
      params.push(...f.genre);
    }
    if (f.keyOnly) clauses.push(`key_note <> ''`);

    const cap = priceCapValue(f.priceCap);
    if (cap != null) {
      clauses.push('price <= ?');
      params.push(cap);
    }

    return {
      sql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
      params,
    };
  }

  /** Search the catalog: filtered page + total + facet counts. */
  async search(rawQuery) {
    const f = this.parseFilters(rawQuery);
    const { sql: where, params } = this.buildWhere(f);

    const rows = await this.db.all(
      `SELECT * FROM comics ${where} ORDER BY ${ORDER_BY[f.sort]} LIMIT ? OFFSET ?`,
      [...params, f.limit, f.offset]
    );
    const totalRow = await this.db.get(
      `SELECT COUNT(*) AS n FROM comics ${where}`,
      params
    );
    const allRow = await this.db.get('SELECT COUNT(*) AS n FROM comics');

    return {
      data: rows.map(serialize),
      meta: {
        total: Number(totalRow.n),
        collectionTotal: Number(allRow.n),
        limit: f.limit,
        offset: f.offset,
        sort: f.sort,
        priceCapValue: priceCapValue(f.priceCap),
        filters: {
          q: f.q,
          publisher: f.publisher,
          era: f.era,
          genre: f.genre,
          keyOnly: f.keyOnly,
          priceCap: f.priceCap,
        },
      },
      facets: await this.facetCounts(f),
    };
  }

  /**
   * Facet counts for the filter rail. Each group is counted against the other
   * active filters, excluding its own — per the handoff's interaction spec.
   */
  async facetCounts(f) {
    const countBy = async (skipGroup, valueExpr) => {
      const { sql: where, params } = this.buildWhere(f, skipGroup);
      const rows = await this.db.all(
        `SELECT ${valueExpr} AS value, COUNT(*) AS count FROM comics ${where} GROUP BY 1`,
        params
      );
      return new Map(rows.map((r) => [r.value, Number(r.count)]));
    };

    const eraExpr = `CASE
      WHEN year < 1956 THEN 'Golden Age'
      WHEN year < 1971 THEN 'Silver Age'
      WHEN year < 1986 THEN 'Bronze Age'
      WHEN year < 2000 THEN 'Modern Age'
      ELSE 'Contemporary' END`;

    const [pubCounts, eraCounts, genreCounts, pubRows, genreRows] =
      await Promise.all([
        countBy('publisher', 'publisher'),
        countBy('era', eraExpr),
        countBy('genre', 'genre'),
        this.db.all('SELECT DISTINCT publisher FROM comics ORDER BY publisher'),
        this.db.all('SELECT DISTINCT genre FROM comics'),
      ]);

    const allPublishers = pubRows.map((r) => r.publisher);
    const present = new Set(genreRows.map((r) => r.genre));
    const genresPresent = GENRES.filter((g) => present.has(g));

    const shape = (values, counts, active) =>
      values.map((value) => ({
        value,
        count: counts.get(value) ?? 0,
        active: active.includes(value),
      }));

    return {
      publisher: shape(allPublishers, pubCounts, f.publisher),
      era: shape(ERAS, eraCounts, f.era),
      genre: shape(genresPresent, genreCounts, f.genre),
    };
  }

  async getById(id) {
    const row = await this.db.get('SELECT * FROM comics WHERE id = ?', [id]);
    if (!row) return null;
    const record = serialize(row);
    return { ...record, census: censusFor(record.grade) };
  }

  /**
   * Accession a book. Series is required; everything else falls back to the
   * design's submit defaults (issue 1, Independent, current year, Indie, 9.0, 0).
   */
  async create(body) {
    const rec = this.coerce(body, { applyDefaults: true });
    if (!rec.series) {
      const err = new Error('Series is required');
      err.status = 400;
      throw err;
    }
    rec.id = 'u' + randomUUID();
    rec.added = Date.now();

    await this.db.run(INSERT_SQL, insertParams(rec));
    return this.getById(rec.id);
  }

  /** Patch a record in place — only the provided fields change. */
  async update(id, body) {
    const existing = await this.db.get('SELECT id FROM comics WHERE id = ?', [id]);
    if (!existing) return null;

    const patch = this.coerce(body, { applyDefaults: false });
    if ('series' in patch && !patch.series) {
      const err = new Error('Series is required');
      err.status = 400;
      throw err;
    }

    const columns = {
      series: 'series',
      issue: 'issue',
      publisher: 'publisher',
      year: 'year',
      genre: 'genre',
      grade: 'grade',
      price: 'price',
      keyNote: 'key_note',
      creators: 'creators',
      image: 'image',
    };
    const sets = [];
    const params = [];
    for (const [field, column] of Object.entries(columns)) {
      if (field in patch) {
        sets.push(`${column} = ?`);
        params.push(patch[field]);
      }
    }
    if ('issue' in patch) {
      sets.push('issue_sort = ?');
      params.push(Number.parseFloat(patch.issue) || 0);
    }
    if (sets.length) {
      sets.push('updated_at = ?');
      params.push(new Date().toISOString());
      await this.db.run(
        `UPDATE comics SET ${sets.join(', ')} WHERE id = ?`,
        [...params, id]
      );
    }
    return this.getById(id);
  }

  async remove(id) {
    const { changes } = await this.db.run('DELETE FROM comics WHERE id = ?', [id]);
    return changes > 0;
  }

  /**
   * Coerce/sanitize input. With applyDefaults (create), absent or blank fields
   * take the design's accession defaults; without (patch), only supplied keys
   * are returned.
   */
  coerce(body, { applyDefaults }) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      const err = new Error('Request body must be a JSON object');
      err.status = 400;
      throw err;
    }
    const out = {};
    const str = (v) => String(v ?? '').trim();
    const has = (k) => k in body;

    if (has('series') || applyDefaults) out.series = str(body.series).slice(0, 200);
    if (has('issue') || applyDefaults) {
      out.issue = str(body.issue).slice(0, 20) || '1';
    }
    if (has('publisher') || applyDefaults) {
      out.publisher = str(body.publisher).slice(0, 120) || 'Independent';
    }
    if (has('year') || applyDefaults) {
      const y = parseInt(body.year, 10);
      out.year =
        Number.isFinite(y) && y >= 1800 && y <= 2100
          ? y
          : new Date().getFullYear();
    }
    if (has('genre') || applyDefaults) {
      const g = str(body.genre);
      out.genre = GENRES.includes(g) ? g : 'Indie';
    }
    if (has('grade') || applyDefaults) {
      const g = parseFloat(body.grade);
      out.grade = Number.isFinite(g) ? Math.min(10, Math.max(0.5, g)) : 9.0;
    }
    if (has('price') || applyDefaults) {
      const p = parseFloat(body.price);
      out.price = Number.isFinite(p) && p >= 0 ? p : 0;
    }
    if (has('keyNote') || applyDefaults) out.keyNote = str(body.keyNote).slice(0, 500);
    if (has('creators') || applyDefaults) out.creators = str(body.creators).slice(0, 300);
    if (has('image') || applyDefaults) out.image = this.validateImage(str(body.image));

    return out;
  }

  validateImage(url) {
    if (!url) return '';
    if (url.startsWith('data:')) {
      const err = new Error(
        'Data URLs are not accepted — upload the file to POST /api/uploads/covers and use the returned URL'
      );
      err.status = 400;
      throw err;
    }
    const ok =
      url.startsWith('/uploads/') ||
      url.startsWith('https://') ||
      url.startsWith('http://');
    if (!ok || url.length > 2048) {
      const err = new Error(
        'Cover image must be an http(s) URL or an /uploads/ path'
      );
      err.status = 400;
      throw err;
    }
    return url;
  }

  /** Aggregates behind the hero stats and the CMS stat cards. */
  async stats() {
    const row = await this.db.get(
      `SELECT
         COUNT(*) AS records,
         SUM(CASE WHEN key_note <> '' THEN 1 ELSE 0 END) AS key_issues,
         COUNT(DISTINCT publisher) AS publishers,
         SUM(CASE WHEN image = '' THEN 1 ELSE 0 END) AS missing_scans,
         COALESCE(SUM(price), 0) AS catalogued_value
       FROM comics`
    );
    return {
      records: Number(row.records),
      keyIssues: Number(row.key_issues ?? 0),
      publishers: Number(row.publishers),
      missingScans: Number(row.missing_scans ?? 0),
      cataloguedValue: Number(row.catalogued_value),
    };
  }

  /** Option lists + ticker feed for the catalog chrome. */
  async meta() {
    const rows = await this.db.all(
      'SELECT DISTINCT publisher FROM comics ORDER BY publisher'
    );
    const publishers = rows.map((r) => r.publisher);
    return {
      genres: GENRES,
      eras: ERAS,
      sorts: SORTS,
      defaultSort: DEFAULT_SORT,
      publishers,
      ticker: [
        ...ERAS,
        ...publishers,
        'Key issues',
        'CGC census',
        'First appearances',
        'Provenance',
      ],
    };
  }
}
