import { randomUUID } from 'node:crypto';
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
 */
const HAYSTACK =
  "lower(series || ' #' || issue || ' ' || publisher || ' ' || genre || ' ' || creators || ' ' || key_note || ' ' || CAST(year AS TEXT))";

const ORDER_BY = {
  'year-asc': 'year ASC, added DESC',
  'year-desc': 'year DESC, added DESC',
  'value-desc': 'price DESC, added DESC',
  'grade-desc': 'grade DESC, added DESC',
  'title-asc': "series COLLATE NOCASE ASC, CAST(issue AS INTEGER) ASC, issue ASC",
  'added-desc': 'added DESC',
};

/** Row (snake_case) → API record (the design's state shape + derived fields). */
export function serialize(row) {
  return {
    id: row.id,
    ref: recordRef(row.id),
    series: row.series,
    issue: row.issue,
    title: `${row.series} #${row.issue}`,
    publisher: row.publisher,
    year: row.year,
    era: eraFor(row.year),
    genre: row.genre,
    grade: row.grade,
    price: row.price,
    keyNote: row.key_note,
    isKey: row.key_note !== '',
    creators: row.creators,
    image: row.image,
    added: row.added,
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
        clauses.push(`instr(${HAYSTACK}, ?) > 0`);
        params.push(term);
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
  search(rawQuery) {
    const f = this.parseFilters(rawQuery);
    const { sql: where, params } = this.buildWhere(f);

    const rows = this.db
      .prepare(
        `SELECT * FROM comics ${where} ORDER BY ${ORDER_BY[f.sort]} LIMIT ? OFFSET ?`
      )
      .all(...params, f.limit, f.offset);

    const { n: total } = this.db
      .prepare(`SELECT COUNT(*) AS n FROM comics ${where}`)
      .get(...params);
    const { n: collectionTotal } = this.db
      .prepare('SELECT COUNT(*) AS n FROM comics')
      .get();

    return {
      data: rows.map(serialize),
      meta: {
        total,
        collectionTotal,
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
      facets: this.facetCounts(f),
    };
  }

  /**
   * Facet counts for the filter rail. Each group is counted against the other
   * active filters, excluding its own — per the handoff's interaction spec.
   */
  facetCounts(f) {
    const countBy = (skipGroup, valueExpr) => {
      const { sql: where, params } = this.buildWhere(f, skipGroup);
      const rows = this.db
        .prepare(
          `SELECT ${valueExpr} AS value, COUNT(*) AS count FROM comics ${where} GROUP BY value`
        )
        .all(...params);
      return new Map(rows.map((r) => [r.value, r.count]));
    };

    const eraExpr = `CASE
      WHEN year < 1956 THEN 'Golden Age'
      WHEN year < 1971 THEN 'Silver Age'
      WHEN year < 1986 THEN 'Bronze Age'
      WHEN year < 2000 THEN 'Modern Age'
      ELSE 'Contemporary' END`;

    const pubCounts = countBy('publisher', 'publisher');
    const eraCounts = countBy('era', eraExpr);
    const genreCounts = countBy('genre', 'genre');

    const allPublishers = this.db
      .prepare('SELECT DISTINCT publisher FROM comics ORDER BY publisher')
      .all()
      .map((r) => r.publisher);
    const genresPresent = GENRES.filter((g) =>
      this.db.prepare('SELECT 1 FROM comics WHERE genre = ? LIMIT 1').get(g)
    );

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

  getById(id) {
    const row = this.db.prepare('SELECT * FROM comics WHERE id = ?').get(id);
    if (!row) return null;
    const record = serialize(row);
    return { ...record, census: censusFor(record.grade) };
  }

  /**
   * Accession a book. Series is required; everything else falls back to the
   * design's submit defaults (issue 1, Independent, current year, Indie, 9.0, 0).
   */
  create(body) {
    const rec = this.coerce(body, { applyDefaults: true });
    if (!rec.series) {
      const err = new Error('Series is required');
      err.status = 400;
      throw err;
    }
    rec.id = 'u' + randomUUID();
    rec.added = Date.now();

    this.db
      .prepare(
        `INSERT INTO comics (id, series, issue, publisher, year, genre, grade, price, key_note, creators, image, added)
         VALUES (:id, :series, :issue, :publisher, :year, :genre, :grade, :price, :keyNote, :creators, :image, :added)`
      )
      .run(rec);
    return this.getById(rec.id);
  }

  /** Patch a record in place — only the provided fields change. */
  update(id, body) {
    const existing = this.db.prepare('SELECT * FROM comics WHERE id = ?').get(id);
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
    if (sets.length) {
      sets.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`);
      this.db
        .prepare(`UPDATE comics SET ${sets.join(', ')} WHERE id = ?`)
        .run(...params, id);
    }
    return this.getById(id);
  }

  remove(id) {
    const { changes } = this.db.prepare('DELETE FROM comics WHERE id = ?').run(id);
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
      out.issue = str(body.issue).slice(0, 20) || (applyDefaults ? '1' : '');
      if (!applyDefaults && out.issue === '') out.issue = '1';
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
  stats() {
    const row = this.db
      .prepare(
        `SELECT
           COUNT(*) AS records,
           SUM(CASE WHEN key_note <> '' THEN 1 ELSE 0 END) AS keyIssues,
           COUNT(DISTINCT publisher) AS publishers,
           SUM(CASE WHEN image = '' THEN 1 ELSE 0 END) AS missingScans,
           COALESCE(SUM(price), 0) AS cataloguedValue
         FROM comics`
      )
      .get();
    return {
      records: row.records,
      keyIssues: row.keyIssues ?? 0,
      publishers: row.publishers,
      missingScans: row.missingScans ?? 0,
      cataloguedValue: row.cataloguedValue,
    };
  }

  /** Option lists + ticker feed for the catalog chrome. */
  meta() {
    const publishers = this.db
      .prepare('SELECT DISTINCT publisher FROM comics ORDER BY publisher')
      .all()
      .map((r) => r.publisher);
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
