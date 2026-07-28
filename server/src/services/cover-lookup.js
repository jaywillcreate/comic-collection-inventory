/**
 * Cover resolution via the Comic Vine API (https://comicvine.gamespot.com/api).
 *
 * The collection's titles are descriptive ("Superman in Action Comics",
 * "She-devil with a sword: Red Sonja"), so volumes are matched with fuzzy
 * token scoring — title and its pre-colon prefix both tried, publisher as a
 * tiebreaker, and volumes that can't contain the issue number penalized.
 * Below MATCH_THRESHOLD we return nothing and the generated plate stays.
 *
 * Comic Vine limits: ~200 requests/resource/hour. The backfill script
 * throttles; the accession hook makes at most 2 requests per create.
 */

const BASE = 'https://comicvine.gamespot.com/api';
const MATCH_THRESHOLD = 0.5;

export function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[’'`]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|a|an|of|in|and|vol|volume)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Token overlap in [0,1]: weighted Jaccard + containment. */
export function similarity(a, b) {
  const A = new Set(normalize(a).split(' ').filter(Boolean));
  const B = new Set(normalize(b).split(' ').filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return (inter / Math.max(A.size, B.size)) * 0.7 + (inter / Math.min(A.size, B.size)) * 0.3;
}

/** Score a Comic Vine volume against a record; exported for tests. */
export function scoreVolume(rec, vol) {
  const prefix = rec.series.split(':')[0];
  let score = Math.max(similarity(rec.series, vol.name), similarity(prefix, vol.name));

  const volPub = normalize(vol.publisher?.name || '');
  const recPub = normalize(rec.publisher || '');
  if (recPub && volPub) {
    const overlap = recPub.split(' ').some((t) => t && volPub.includes(t));
    score += overlap ? 0.15 : -0.05;
  }

  const issueNum = Number.parseFloat(rec.issue);
  if (Number.isFinite(issueNum) && vol.count_of_issues != null) {
    if (issueNum > vol.count_of_issues) score -= 0.25; // volume can't contain it
  }
  return score;
}

export function pickBestVolume(rec, volumes) {
  let best = null;
  let bestScore = -Infinity;
  for (const vol of volumes || []) {
    const s = scoreVolume(rec, vol);
    if (s > bestScore) {
      best = vol;
      bestScore = s;
    }
  }
  return best && bestScore >= MATCH_THRESHOLD ? best : null;
}

export class CoverLookup {
  constructor(apiKey, { fetchImpl = fetch, cache = new Map() } = {}) {
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    /** normalized series+publisher → volume (or null for known misses) */
    this.volumeCache = cache;
  }

  async api(path, params = {}) {
    const url = new URL(BASE + path);
    url.searchParams.set('api_key', this.apiKey);
    url.searchParams.set('format', 'json');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await this.fetch(url, {
      headers: { 'user-agent': 'LongboxArchive/1.0 (comic collection catalog)' },
    });
    if (res.status === 420 || res.status === 429) {
      const err = new Error('Comic Vine rate limit reached');
      err.rateLimited = true;
      throw err;
    }
    if (!res.ok) throw new Error(`Comic Vine ${path} failed (${res.status})`);
    const body = await res.json();
    if (body.error !== 'OK') throw new Error(`Comic Vine error: ${body.error}`);
    return body.results;
  }

  cacheKey(rec) {
    return normalize(rec.series) + '|' + normalize(rec.publisher);
  }

  async findVolume(rec) {
    const key = this.cacheKey(rec);
    if (this.volumeCache.has(key)) return this.volumeCache.get(key);

    const query = rec.series.split(':')[0].trim() || rec.series;
    const results = await this.api('/search/', {
      resources: 'volume',
      query,
      limit: '10',
      field_list: 'id,name,publisher,count_of_issues,start_year',
    });
    const best = pickBestVolume(rec, results);
    this.volumeCache.set(key, best);
    return best;
  }

  /**
   * Resolve a cover image URL for {series, issue, publisher}.
   * Returns null when there is no confident match — never guesses.
   */
  async resolve(rec) {
    const issueNum = Number.parseFloat(rec.issue);
    if (!Number.isFinite(issueNum)) return null;

    const vol = await this.findVolume(rec);
    if (!vol) return null;

    const issues = await this.api('/issues/', {
      filter: `volume:${vol.id},issue_number:${issueNum}`,
      field_list: 'issue_number,image',
      limit: '5',
    });
    const issue = (issues || []).find((i) => i.image);
    if (!issue) return null;
    return issue.image.super_url || issue.image.medium_url || issue.image.original_url || null;
  }
}

/** Best-effort resolve with a deadline — used by the accession hook. */
export async function resolveWithTimeout(lookup, rec, ms = 4000) {
  try {
    return await Promise.race([
      lookup.resolve(rec),
      new Promise((r) => setTimeout(() => r(null), ms)),
    ]);
  } catch {
    return null;
  }
}
