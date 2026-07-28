/**
 * Market-value estimation via the eBay Browse API (free developer keyset).
 *
 * Honest framing: eBay's free tier exposes CURRENT ASKING PRICES, not sold
 * prices (sold data sits behind restricted/paid APIs everywhere). So this
 * computes a robust median of live listings for the exact series + issue —
 * lot/reprint listings filtered out, outliers trimmed — and stores it as a
 * clearly-labeled ESTIMATE. Manually entered prices are never overwritten.
 */

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const COMICS_CATEGORY = '63'; // Collectibles > Comics
const MIN_SAMPLE = 3;

/** Listings that are not a single copy of the actual issue. */
const REJECT_TITLE =
  /\b(lots?|set|bundle|run|reprint|facsimile|replica|photocopy|digital|foreign|german|italian|custom|sketch cover blank)\b/i;

export function listingMatches(rec, title) {
  if (REJECT_TITLE.test(title)) return false;
  const issueNum = Number.parseFloat(rec.issue);
  if (Number.isFinite(issueNum)) {
    // The issue number must appear as its own token ("318", "#318", "no. 318")
    const re = new RegExp(`(^|[^0-9])${issueNum}([^0-9]|$)`);
    if (!re.test(title)) return false;
  }
  return true;
}

/** Median after IQR outlier trimming; null when the sample is too thin. */
export function robustMedian(values) {
  if (values.length < MIN_SAMPLE) return null;
  const s = [...values].sort((a, b) => a - b);
  const q = (p) => s[Math.floor((s.length - 1) * p)];
  const iqr = q(0.75) - q(0.25);
  const kept = s.filter((v) => v >= q(0.25) - 1.5 * iqr && v <= q(0.75) + 1.5 * iqr);
  if (kept.length < MIN_SAMPLE) return null;
  const m = Math.floor(kept.length / 2);
  const median = kept.length % 2 ? kept[m] : (kept[m - 1] + kept[m]) / 2;
  return Math.round(median);
}

export class ValueLookup {
  constructor(clientId, clientSecret, { fetchImpl = fetch } = {}) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.fetch = fetchImpl;
    this.token = null;
    this.tokenExpiry = 0;
  }

  async getToken() {
    if (this.token && Date.now() < this.tokenExpiry - 60_000) return this.token;
    const res = await this.fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        authorization:
          'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64'),
      },
      body: 'grant_type=client_credentials&scope=' +
        encodeURIComponent('https://api.ebay.com/oauth/api_scope'),
    });
    if (!res.ok) throw new Error(`eBay auth failed (${res.status})`);
    const body = await res.json();
    this.token = body.access_token;
    this.tokenExpiry = Date.now() + (body.expires_in || 7200) * 1000;
    return this.token;
  }

  /**
   * Estimate a record's market value from live eBay listings.
   * Returns { value, sampleSize, query } or null when no confident sample.
   */
  async estimate(rec) {
    const query =
      `${rec.series} #${rec.issue}` +
      (rec.grade > 0 ? ` CGC ${rec.grade}` : ' comic');

    const token = await this.getToken();
    const url = new URL(SEARCH_URL);
    url.searchParams.set('q', query);
    url.searchParams.set('category_ids', COMICS_CATEGORY);
    url.searchParams.set('limit', '50');
    const res = await this.fetch(url, {
      headers: {
        authorization: `Bearer ${token}`,
        'x-ebay-c-marketplace-id': 'EBAY_US',
      },
    });
    if (res.status === 429) {
      const err = new Error('eBay rate limit reached');
      err.rateLimited = true;
      throw err;
    }
    if (!res.ok) throw new Error(`eBay search failed (${res.status})`);
    const body = await res.json();

    const prices = (body.itemSummaries || [])
      .filter(
        (item) =>
          item.price?.currency === 'USD' &&
          listingMatches(rec, item.title || '')
      )
      .map((item) => Number(item.price.value))
      .filter((v) => Number.isFinite(v) && v >= 1 && v <= 500_000);

    const value = robustMedian(prices);
    if (!value) return null;
    return { value, sampleSize: prices.length, query };
  }
}
