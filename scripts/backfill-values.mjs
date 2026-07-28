/**
 * Backfill market-value estimates for every record without a price.
 *
 * The estimation itself runs server-side (GET /api/comics/:id/value computes
 * a labeled median-of-live-eBay-listings estimate and caches it), so this
 * script just walks the catalog and triggers each lookup, throttled under
 * the API's rate limit. Resumable: priced records are skipped.
 *
 * Usage:
 *   node --env-file-if-exists=.env scripts/backfill-values.mjs \
 *     [--target https://your-app.vercel.app] [--limit N] [--dry-run]
 *
 * The target deployment must have EBAY_CLIENT_ID / EBAY_CLIENT_SECRET set.
 */
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const target = opt('target', 'http://localhost:4000').replace(/\/$/, '');
const limit = Number(opt('limit', 'Infinity'));
const dryRun = flag('dry-run');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const health = await (await fetch(`${target}/api/health`)).json();
if (health.valueLookup !== 'ebay') {
  console.error(
    `Target reports valueLookup: ${health.valueLookup} — set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET on the deployment first.`
  );
  process.exit(1);
}

const pending = [];
for (let offset = 0; ; offset += 200) {
  const page = await (
    await fetch(`${target}/api/comics?limit=200&offset=${offset}&sort=title-asc`)
  ).json();
  pending.push(...page.data.filter((r) => !r.price));
  if (offset + 200 >= page.meta.total) break;
}
console.log(`${pending.length} records need values.`);
if (dryRun) {
  console.log('Dry run — nothing fetched.');
  process.exit(0);
}

let estimated = 0;
let unpriced = 0;
const todo = pending.slice(0, Number.isFinite(limit) ? limit : pending.length);
for (const [i, rec] of todo.entries()) {
  try {
    const v = await (await fetch(`${target}/api/comics/${rec.id}/value`)).json();
    if (v.price > 0) estimated++;
    else unpriced++;
  } catch (err) {
    console.warn(`  ! ${rec.title}: ${err.message}`);
    unpriced++;
  }
  if ((i + 1) % 25 === 0) {
    console.log(`  … ${i + 1}/${todo.length} (${estimated} estimated, ${unpriced} no confident sample)`);
  }
  await sleep(700); // stay under the API's 300 req/min limit + be kind to eBay
}

console.log(`\nDone: ${estimated} values estimated, ${unpriced} left unvalued (thin/no listing sample).`);
console.log('Re-run any time — priced records are skipped.');
