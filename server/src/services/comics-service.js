import { randomUUID } from 'node:crypto';
import {
  INSERT_COLUMNS,
  INSERT_PLACEHOLDERS,
  INSERT_SQL,
  insertParams,
} from '../db/connection.js';
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
  "lower(series || ' #' || issue || ' ' || publisher || ' ' || character_name || ' ' || variant || ' ' || genre || ' ' || creators || ' ' || key_note || ' ' || CAST(year AS TEXT))";

// Unknown years (0) sort to the end of both year orders.
const ORDER_BY = {
  'year-asc': 'CASE WHEN year = 0 THEN 1 ELSE 0 END, year ASC, added DESC',
  'year-desc': 'CASE WHEN year = 0 THEN 1 ELSE 0 END, year DESC, added DESC',
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
    character: row.character_name,
    variant: row.variant,
    year: Number(row.year),
    era: Number(row.year) > 0 ? eraFor(Number(row.year)) : null,
    genre: row.genre,
    grade: Number(row.grade),
    price: Number(row.price),
    keyNote: row.key_note,
    isKey: row.key_note !== '',
    creators: row.creators,
    image: row.image,
    summary: row.summary || '',
    coverDate: row.cover_date || '',
    priceSource: row.price_source || '',
    priceNote: row.price_note || '',
    added: Number(row.added),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class ComicsService {
  constructor(db, { coverLookup = null, valueLookup = null } = {}) {
    this.db = db;
    this.coverLookup = coverLookup;
    this.valueLookup = valueLookup;
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
      // year 0 = unknown and belongs to no era
      const ors = f.era.map((era) => {
        const { min, max } = ERA_RANGES[era];
        if (min == null) return `(year > 0 AND year <= ${max})`;
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
      WHEN year <= 0 THEN NULL
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
   * Issue synopsis for the record drawer. Fetched from Comic Vine on first
   * request, then cached on the record — each book costs at most one lookup.
   * Returns null for an unknown id; `summary` is null when no confident
   * match or synopsis exists (the drawer simply omits the section).
   */
  async getSummary(id) {
    const row = await this.db.get('SELECT * FROM comics WHERE id = ?', [id]);
    if (!row) return null;
    if (row.summary) return { id, summary: row.summary, source: 'cached' };
    if (!this.coverLookup) return { id, summary: null, source: null };

    const { buildSummary } = await import('./cover-lookup.js');
    let details = null;
    try {
      details = await this.coverLookup.issueDetails(serialize(row));
    } catch {
      return { id, summary: null, source: null }; // rate-limited or unreachable
    }
    const summary = buildSummary(details);
    if (!summary && !details) return { id, summary: null, source: 'comicvine' };

    // Enrich in one pass: synopsis, plus cover date / year / cover image
    // when the record lacks them (all remain admin-overridable).
    const sets = [];
    const params = [];
    if (summary) {
      sets.push('summary = ?');
      params.push(summary);
    }
    if (details?.coverDate && !row.cover_date) {
      sets.push('cover_date = ?');
      params.push(details.coverDate);
      const cdYear = parseInt(details.coverDate, 10);
      if (cdYear && Number(row.year) === 0) {
        sets.push('year = ?');
        params.push(cdYear);
      }
    }
    if (details?.imageUrl && !row.image) {
      sets.push('image = ?');
      params.push(details.imageUrl);
    }
    if (sets.length) {
      await this.db.run(
        `UPDATE comics SET ${sets.join(', ')} WHERE id = ?`,
        [...params, id]
      );
    }
    return { id, summary: summary || null, source: 'comicvine' };
  }

  /**
   * Acquisition suggestions: gaps in runs the collection already commits to.
   * Two kinds — missing issues inside a mostly-complete run, and the missing
   * #1 opener of a collected series (typically the run's key issue, so the
   * strongest lever on the set's market value).
   *
   * Value estimates come from the eBay median engine, cached in
   * suggestion_values (up to `enrich` fresh lookups per call so the request
   * stays fast; repeat visits progressively fill the rest).
   */
  async getSuggestions({ enrichValues = 3, enrichCovers = 4 } = {}) {
    const rows = await this.db.all(
      'SELECT series, issue, publisher, character_name FROM comics'
    );
    const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

    const groups = new Map();
    for (const r of rows) {
      const key = norm(r.series);
      if (!groups.has(key)) {
        groups.set(key, {
          series: r.series,
          publisher: r.publisher,
          character: r.character_name || '',
          owned: new Set(),
        });
      }
      const g = groups.get(key);
      if (!g.character && r.character_name) g.character = r.character_name;
      const n = Number.parseFloat(r.issue);
      if (Number.isFinite(n) && Number.isInteger(n)) g.owned.add(n);
    }

    const openers = [];
    const gaps = [];
    for (const g of groups.values()) {
      const nums = [...g.owned].sort((a, b) => a - b);
      if (nums.length < 2) continue; // one issue isn't a run
      const min = nums[0];
      const max = nums[nums.length - 1];
      const base = { series: g.series, publisher: g.publisher, character: g.character };

      if (!g.owned.has(1) && min > 1 && min <= 20) {
        openers.push({
          ...base,
          issue: 1,
          reason: `Series opener — you collect ${g.series} from #${min}`,
          ownedCount: nums.length,
        });
      }
      if (max - min <= 30) {
        const missing = [];
        for (let n = min + 1; n < max; n++) if (!g.owned.has(n)) missing.push(n);
        if (missing.length && missing.length <= 6) {
          for (const n of missing.slice(0, 3)) {
            gaps.push({
              ...base,
              issue: n,
              reason: `Completes your ${g.series} run (#${min}–#${max})`,
              ownedCount: nums.length,
            });
          }
        }
      }
    }
    openers.sort((a, b) => b.ownedCount - a.ownedCount);
    gaps.sort((a, b) => b.ownedCount - a.ownedCount);
    const picked = [...openers, ...gaps].slice(0, 18);

    let freshValues = 0;
    let freshCovers = 0;
    let pendingValues = 0;
    const suggestions = [];
    for (const s of picked) {
      const skey = norm(s.series) + '|' + s.issue;
      const row = (await this.db.get(
        'SELECT * FROM suggestion_values WHERE skey = ?',
        [skey]
      )) || {
        price: 0,
        note: '',
        checked_at: '',
        image: '',
        summary: '',
        cover_date: '',
        cover_checked_at: '',
      };
      let dirty = false;

      // Cover art + synopsis + cover date from Comic Vine (once per prospect)
      if (!row.cover_checked_at && this.coverLookup && freshCovers < enrichCovers) {
        freshCovers++;
        try {
          const { buildSummary } = await import('./cover-lookup.js');
          const details = await this.coverLookup.issueDetails({
            series: s.series,
            issue: String(s.issue),
            publisher: s.publisher,
            character: s.character,
          });
          row.image = details?.imageUrl || '';
          row.summary = details ? buildSummary(details) : '';
          row.cover_date = details?.coverDate || '';
          row.cover_checked_at = new Date().toISOString();
          dirty = true;
        } catch (err) {
          console.error(`Suggestion cover lookup failed for ${s.series} #${s.issue}:`, err.message);
        }
      }

      // Market value from the eBay median engine (once per prospect)
      if (!row.checked_at && this.valueLookup && freshValues < enrichValues) {
        freshValues++;
        try {
          const est = await this.valueLookup.estimate({
            series: s.series,
            issue: String(s.issue),
            grade: 0,
          });
          row.price = est ? est.value : 0;
          row.note = est
            ? `Est. — median of ${est.sampleSize} eBay listings`
            : 'No confident listing sample';
          row.checked_at = new Date().toISOString();
          dirty = true;
        } catch (err) {
          console.error(`Suggestion value lookup failed for ${s.series} #${s.issue}:`, err.message);
        }
      }

      if (dirty) {
        await this.db.run(
          `INSERT INTO suggestion_values (skey, price, note, checked_at, image, summary, cover_date, cover_checked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT (skey) DO UPDATE SET
             price = excluded.price, note = excluded.note, checked_at = excluded.checked_at,
             image = excluded.image, summary = excluded.summary,
             cover_date = excluded.cover_date, cover_checked_at = excluded.cover_checked_at`,
          [skey, row.price, row.note, row.checked_at, row.image, row.summary, row.cover_date, row.cover_checked_at]
        );
      }

      s.estPrice = row.checked_at ? Number(row.price) || 0 : 0;
      s.estNote = row.note || '';
      s.valueChecked = !!row.checked_at;
      if (!row.checked_at) pendingValues++;
      s.image = row.image || '';
      s.summary = row.summary || '';
      s.coverDate = row.cover_date || '';

      const q = encodeURIComponent(`${s.series} #${s.issue} comic`);
      s.ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${q}`;
      s.midtownUrl = `https://www.midtowncomics.com/search?q=${encodeURIComponent(
        `${s.series} ${s.issue}`
      )}`;
      delete s.ownedCount;
      suggestions.push(s);
    }
    return { suggestions, pendingValues };
  }

  /** Site settings (title, tagline, logo) — a whitelisted key/value store. */
  static SETTINGS_DEFAULTS = {
    siteTitle: 'LONGBOX',
    siteTagline: 'Archive & Index',
    logoUrl: '',
  };

  async getSettings() {
    const rows = await this.db.all('SELECT key, value FROM settings');
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    return { ...ComicsService.SETTINGS_DEFAULTS, ...stored };
  }

  async saveSettings(body) {
    if (typeof body !== 'object' || body === null) {
      const err = new Error('Request body must be a JSON object');
      err.status = 400;
      throw err;
    }
    for (const key of Object.keys(ComicsService.SETTINGS_DEFAULTS)) {
      if (!(key in body)) continue;
      const value = String(body[key] ?? '').trim().slice(0, 300);
      if (key === 'logoUrl' && value) this.validateImage(value);
      await this.db.run(
        `INSERT INTO settings (key, value) VALUES (?, ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
        [key, value]
      );
    }
    return this.getSettings();
  }

  /**
   * Market value for the record drawer. Manual prices (or already-estimated
   * ones) return cached; otherwise a labeled estimate is computed from live
   * eBay listings and stored. Estimates never overwrite manual prices.
   */
  async getValue(id) {
    const row = await this.db.get('SELECT * FROM comics WHERE id = ?', [id]);
    if (!row) return null;
    if (Number(row.price) > 0) {
      return {
        id,
        price: Number(row.price),
        priceSource: row.price_source || 'manual',
        priceNote: row.price_note || '',
        source: 'cached',
      };
    }
    if (!this.valueLookup) return { id, price: 0, priceSource: '', priceNote: '', source: null };

    let est = null;
    try {
      est = await this.valueLookup.estimate(serialize(row));
    } catch (err) {
      console.error(`Value lookup failed for ${row.series} #${row.issue}:`, err.message);
      return { id, price: 0, priceSource: '', priceNote: '', source: null };
    }
    if (!est) return { id, price: 0, priceSource: '', priceNote: '', source: 'ebay' };

    const note = `Est. — median of ${est.sampleSize} eBay listings, ${new Date().toISOString().slice(0, 10)}`;
    await this.db.run(
      `UPDATE comics SET price = ?, price_source = 'ebay-estimate', price_note = ?, updated_at = ? WHERE id = ?`,
      [est.value, note, new Date().toISOString(), id]
    );
    return { id, price: est.value, priceSource: 'ebay-estimate', priceNote: note, source: 'ebay' };
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

    // Default cover: best-effort web match when none was supplied.
    if (!rec.image && this.coverLookup) {
      const { resolveWithTimeout } = await import('./cover-lookup.js');
      rec.image = (await resolveWithTimeout(this.coverLookup, rec)) || '';
    }

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
      character: 'character_name',
      variant: 'variant',
      year: 'year',
      genre: 'genre',
      grade: 'grade',
      price: 'price',
      keyNote: 'key_note',
      creators: 'creators',
      image: 'image',
      summary: 'summary',
      coverDate: 'cover_date',
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
    if ('price' in patch) {
      // A hand-entered price is authoritative — clear any estimate labeling.
      sets.push("price_source = ?", "price_note = ''");
      params.push(patch.price > 0 ? 'manual' : '');
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
   * Bulk import — one transaction, chunked multi-row inserts. With
   * `replaceAll`, the existing catalog (e.g. the demo seed) is wiped first;
   * a failure anywhere rolls the whole import back. Invalid rows are skipped
   * and reported, never silently dropped.
   */
  async importMany(records, { replaceAll = false } = {}) {
    if (!Array.isArray(records) || records.length === 0) {
      const err = new Error('Body must be { records: [...] } with at least one record');
      err.status = 400;
      throw err;
    }
    if (records.length > 5000) {
      const err = new Error('At most 5000 records per import');
      err.status = 400;
      throw err;
    }

    const base = Date.now();
    const prepared = [];
    const skipped = [];
    records.forEach((body, index) => {
      try {
        const rec = this.coerce(body, { applyDefaults: true });
        if (!rec.series) throw new Error('Series is required');
        rec.id = 'u' + randomUUID();
        rec.added = base + index;
        prepared.push(rec);
      } catch (e) {
        skipped.push({ index, error: e.message });
      }
    });
    if (!prepared.length) {
      const err = new Error('No valid records in import');
      err.status = 400;
      throw err;
    }

    const CHUNK = 200;
    await this.db.transaction(async (tx) => {
      if (replaceAll) await tx.run('DELETE FROM comics');
      for (let i = 0; i < prepared.length; i += CHUNK) {
        const chunk = prepared.slice(i, i + CHUNK);
        await tx.run(
          `INSERT INTO comics ${INSERT_COLUMNS} VALUES ${chunk
            .map(() => INSERT_PLACEHOLDERS)
            .join(', ')}`,
          chunk.flatMap(insertParams)
        );
      }
    });

    const { n } = await this.db.get('SELECT COUNT(*) AS n FROM comics');
    return { imported: prepared.length, skipped, total: Number(n), replaceAll };
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
    if (has('character') || applyDefaults) out.character = str(body.character).slice(0, 120);
    if (has('variant') || applyDefaults) out.variant = str(body.variant).slice(0, 80);
    if (has('year') || applyDefaults) {
      // 0 = unknown year (blank field); shows as "—" and belongs to no era
      const y = parseInt(body.year, 10);
      out.year = Number.isFinite(y) && y >= 1800 && y <= 2100 ? y : 0;
    }
    if (has('genre') || applyDefaults) {
      const g = str(body.genre);
      out.genre = GENRES.includes(g) ? g : 'Indie';
    }
    if (has('grade') || applyDefaults) {
      // 0 = ungraded (blank field); grade chips and census hide
      const g = parseFloat(body.grade);
      out.grade =
        Number.isFinite(g) && g > 0 ? Math.min(10, Math.max(0.5, g)) : 0;
    }
    if (has('price') || applyDefaults) {
      const p = parseFloat(body.price);
      out.price = Number.isFinite(p) && p >= 0 ? p : 0;
    }
    if (has('keyNote') || applyDefaults) out.keyNote = str(body.keyNote).slice(0, 500);
    if (has('creators') || applyDefaults) out.creators = str(body.creators).slice(0, 300);
    if (has('image') || applyDefaults) out.image = this.validateImage(str(body.image));
    if (has('summary') || applyDefaults) out.summary = str(body.summary).slice(0, 2000);
    if (has('coverDate') || applyDefaults) {
      const cd = str(body.coverDate);
      out.coverDate = /^\d{4}(-\d{2})?(-\d{2})?$/.test(cd) ? cd : '';
      // A valid cover date fills an unknown year unless the year was set explicitly
      const cdYear = parseInt(out.coverDate, 10);
      if (cdYear && !has('year') && (!out.year || out.year === 0)) out.year = cdYear;
    }

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
