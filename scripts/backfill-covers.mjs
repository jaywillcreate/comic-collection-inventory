/**
 * Backfill cover images for every record without one, using Comic Vine.
 *
 * Runs locally (no serverless time limits), throttled to Comic Vine's
 * ~200 requests/resource/hour, and resumable: records that already have an
 * image are skipped, and volume lookups are cached in data/cover-cache.json,
 * so re-running continues where it stopped.
 *
 * Usage:
 *   node --env-file-if-exists=.env scripts/backfill-covers.mjs \
 *     [--target https://your-app.vercel.app] [--key ADMIN_API_KEY] \
 *     [--cv-key COMICVINE_API_KEY] [--limit N] [--dry-run]
 *
 * Keys fall back to ADMIN_API_KEY / COMICVINE_API_KEY in the environment.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { CoverLookup } from '../server/src/services/cover-lookup.js';

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const target = opt('target', 'http://localhost:4000').replace(/\/$/, '');
const adminKey = opt('key', process.env.ADMIN_API_KEY || '');
const cvKey = opt('cv-key', process.env.COMICVINE_API_KEY || '');
const limit = Number(opt('limit', 'Infinity'));
const dryRun = flag('dry-run');

if (!cvKey) {
  console.error('Missing Comic Vine API key: pass --cv-key or set COMICVINE_API_KEY (free at https://comicvine.gamespot.com/api/)');
  process.exit(1);
}

const CACHE_PATH = 'data/cover-cache.json';
const cache = new Map();
try {
  for (const [k, v] of Object.entries(JSON.parse(readFileSync(CACHE_PATH, 'utf8')))) {
    cache.set(k, v);
  }
  console.log(`Loaded ${cache.size} cached volume lookups.`);
} catch {}

const saveCache = () => {
  mkdirSync('data', { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(Object.fromEntries(cache), null, 1));
};

const lookup = new CoverLookup(cvKey, { cache });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pull the whole catalog (paged) and keep the coverless records.
const pending = [];
for (let offset = 0; ; offset += 200) {
  const page = await (await fetch(`${target}/api/comics?limit=200&offset=${offset}&sort=title-asc`)).json();
  if (!page.data) {
    console.error('Could not list records:', page.error || page);
    process.exit(1);
  }
  pending.push(...page.data.filter((r) => !r.image));
  if (offset + 200 >= page.meta.total) break;
}
console.log(`${pending.length} records need covers${Number.isFinite(limit) ? `; processing up to ${limit}` : ''}.`);

let matched = 0;
let missed = 0;
let patched = 0;
const todo = pending.slice(0, Number.isFinite(limit) ? limit : pending.length);

for (const [i, rec] of todo.entries()) {
  let url = null;
  try {
    url = await lookup.resolve(rec);
  } catch (err) {
    if (err.rateLimited) {
      console.warn(`\nComic Vine rate limit hit after ${i} records — re-run later to continue (progress is cached).`);
      break;
    }
    console.warn(`  ! ${rec.title}: ${err.message}`);
  }

  if (url) {
    matched++;
    if (dryRun) {
      console.log(`  ✓ ${rec.title} → ${url.slice(0, 80)}…`);
    } else {
      const res = await fetch(`${target}/api/comics/${rec.id}`, {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...(adminKey ? { 'x-api-key': adminKey } : {}),
        },
        body: JSON.stringify({ image: url }),
      });
      if (res.ok) patched++;
      else console.warn(`  ! PATCH failed for ${rec.title} (${res.status})`);
    }
  } else {
    missed++;
  }

  if ((i + 1) % 25 === 0) {
    saveCache();
    console.log(`  … ${i + 1}/${todo.length} processed (${matched} matched, ${missed} no confident match)`);
  }
  await sleep(1100); // stay under Comic Vine's hourly velocity limits
}

saveCache();
console.log(`\nDone: ${matched} matched (${dryRun ? 'dry run — nothing written' : `${patched} saved`}), ${missed} left on generated plates.`);
console.log('Re-run any time — records with covers are skipped, volume lookups are cached.');
