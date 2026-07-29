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

/** Score a volume against any of several candidate readings of the title. */
function scoreVolumeAgainst(rec, vol, candidates) {
  let score = Math.max(...candidates.map((c) => similarity(c, vol.name)));

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

/**
 * Candidate readings of a collection title: the full text, the part before
 * a colon, the part after it ("She-devil with a sword: Red Sonja" → "Red
 * Sonja"), and the record's character name.
 */
export function titleCandidates(rec) {
  const list = [rec.series];
  const ix = rec.series.indexOf(':');
  if (ix > 0) {
    list.push(rec.series.slice(0, ix));
    list.push(rec.series.slice(ix + 1));
  }
  if (rec.character) list.push(rec.character);
  const seen = new Set();
  const out = [];
  for (const c of list) {
    const n = normalize(c);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(c.trim());
    }
  }
  return out;
}

/** Score a Comic Vine volume against a record; exported for tests. */
export function scoreVolume(rec, vol) {
  return scoreVolumeAgainst(rec, vol, [rec.series, rec.series.split(':')[0]]);
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
    /** 'q|<normalized query>' → slim volume list (shared across records) */
    this.searchCache = cache;
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

  async searchVolumes(query) {
    const key = 'q|' + normalize(query);
    if (this.searchCache.has(key)) return this.searchCache.get(key);

    const results = await this.api('/search/', {
      resources: 'volume',
      query,
      limit: '10',
      field_list: 'id,name,publisher,count_of_issues,start_year',
    });
    const slim = (results || []).map((v) => ({
      id: v.id,
      name: v.name,
      publisher: v.publisher,
      count_of_issues: v.count_of_issues,
    }));
    this.searchCache.set(key, slim);
    return slim;
  }

  /**
   * Rank confident volume candidates across every reading of the title.
   * Returns up to three, best first — the issue lookup falls through them
   * (reprint volumes often hold the issue numbers the original doesn't).
   */
  async rankVolumes(rec) {
    const candidates = titleCandidates(rec);
    const pool = new Map();
    for (const q of candidates) {
      for (const v of await this.searchVolumes(q)) {
        if (!pool.has(v.id)) pool.set(v.id, v);
      }
    }
    return [...pool.values()]
      .map((v) => ({ v, s: scoreVolumeAgainst(rec, v, candidates) }))
      .filter((x) => x.s >= MATCH_THRESHOLD)
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((x) => x.v);
  }

  /**
   * Fetch the matched issue's details (cover image, story name, synopsis).
   * Returns null when there is no confident match — never guesses.
   */
  async issueDetails(rec) {
    const issueNum = Number.parseFloat(rec.issue);
    if (!Number.isFinite(issueNum)) return null;

    for (const vol of await this.rankVolumes(rec)) {
      const issues = await this.api('/issues/', {
        filter: `volume:${vol.id},issue_number:${issueNum}`,
        field_list: 'issue_number,image,name,deck,description,site_detail_url,cover_date',
        limit: '5',
      });
      if (!issues || !issues.length) continue;
      const withImage = issues.find((i) => i.image) || issues[0];
      return {
        name: withImage.name || '',
        deck: withImage.deck || '',
        description: withImage.description || '',
        coverDate: withImage.cover_date || '',
        siteUrl: withImage.site_detail_url || '',
        imageUrl: withImage.image
          ? withImage.image.super_url || withImage.image.medium_url || withImage.image.original_url
          : null,
      };
    }
    return null;
  }

  /** Resolve just the cover image URL for {series, issue, publisher}. */
  async resolve(rec) {
    const details = await this.issueDetails(rec);
    return details?.imageUrl || null;
  }
}

/** Comic Vine descriptions are HTML — flatten to plain text. */
export function htmlToText(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<\/(p|div|li|h\d|br|tr)>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&#8220;|&rdquo;|&#8221;/g, '"')
    .replace(/&mdash;|&#8212;/g, '—')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build a drawer-sized synopsis from issue details: the story title plus the
 * deck (Comic Vine's one-line summary) or a sentence-truncated description.
 */
export function buildSummary(details, max = 700) {
  if (!details) return '';
  const deck = htmlToText(details.deck);
  const desc = htmlToText(details.description);
  let body = deck.length >= 60 ? deck : desc || deck;
  if (!body) return '';
  if (body.length > max) {
    const cut = body.slice(0, max);
    const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
    body = end > max * 0.4 ? cut.slice(0, end + 1) : cut.trimEnd() + '…';
  }
  const name = htmlToText(details.name);
  return name && !body.toLowerCase().startsWith(name.toLowerCase())
    ? `“${name}” — ${body}`
    : body;
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
