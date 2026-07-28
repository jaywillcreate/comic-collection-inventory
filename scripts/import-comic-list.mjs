/**
 * Import a "Comic List" workbook into a Longbox Archive deployment.
 *
 * Expected layout (the Williams Collection format): one sheet per publisher,
 * header row `Company | Character | Title | Issue | Cover [| Artist]`.
 * Blank rows are skipped; blank Company cells fall back to the sheet name.
 *
 * Usage:
 *   node scripts/import-comic-list.mjs "/path/to/Comic List.xlsx" \
 *     [--target https://your-app.vercel.app] [--key ADMIN_API_KEY] \
 *     [--replace] [--dry-run]
 *
 *   --replace   wipe the existing catalog (e.g. the demo seed) first
 *   --dry-run   parse and summarize without sending anything
 *
 * ADMIN_API_KEY may also come from the environment (or .env via
 * `node --env-file-if-exists=.env …`).
 */
import { readFileSync } from 'node:fs';
import xlsx from 'xlsx';

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith('--'));
const flag = (name) => args.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

if (!file) {
  console.error('Usage: node scripts/import-comic-list.mjs <file.xlsx> [--target URL] [--key KEY] [--replace] [--dry-run]');
  process.exit(1);
}

const target = opt('target', 'http://localhost:4000').replace(/\/$/, '');
const apiKey = opt('key', process.env.ADMIN_API_KEY || '');
const replaceAll = flag('replace');
const dryRun = flag('dry-run');

const clean = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();

const wb = xlsx.read(readFileSync(file));
const records = [];
const perPublisher = new Map();

for (const sheetName of wb.SheetNames) {
  const rows = xlsx.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' });
  if (!rows.length) continue;

  const header = rows[0].map((h) => clean(h).toLowerCase());
  const col = (name, fallback) => {
    const i = header.findIndex((h) => h.startsWith(name));
    return i === -1 ? fallback : i;
  };
  const cCompany = col('company', 0);
  const cCharacter = col('character', 1);
  const cTitle = col('title', 2);
  const cIssue = col('issue', 3);
  const cCover = col('cover', -1);
  const cArtist = col('artist', -1);

  for (const row of rows.slice(1)) {
    const series = clean(row[cTitle]);
    if (!series) continue; // blank spreadsheet row
    const publisher = clean(row[cCompany]) || clean(sheetName);
    const rec = {
      series,
      issue: clean(row[cIssue]) || '1',
      publisher,
      character: clean(row[cCharacter]),
      variant: cCover !== -1 ? clean(row[cCover]) : '',
      creators: cArtist !== -1 ? clean(row[cArtist]) : '',
    };
    records.push(rec);
    perPublisher.set(publisher, (perPublisher.get(publisher) || 0) + 1);
  }
}

console.log(`Parsed ${records.length} records from ${wb.SheetNames.length} sheets:`);
for (const [pub, n] of [...perPublisher.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(4)}  ${pub}`);
}

if (dryRun) {
  console.log('\nDry run — nothing sent. Sample record:');
  console.log(records[0]);
  process.exit(0);
}

console.log(`\nImporting to ${target} (replaceAll: ${replaceAll})…`);
const res = await fetch(`${target}/api/admin/import`, {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    ...(apiKey ? { 'x-api-key': apiKey } : {}),
  },
  body: JSON.stringify({ records, replaceAll }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error(`Import failed (${res.status}):`, body.error || body);
  process.exit(1);
}
console.log(`Imported ${body.imported} records; catalog now holds ${body.total}.`);
if (body.skipped?.length) {
  console.warn(`Skipped ${body.skipped.length} invalid rows:`);
  body.skipped.slice(0, 10).forEach((s) => console.warn(`  row ${s.index}: ${s.error}`));
}
