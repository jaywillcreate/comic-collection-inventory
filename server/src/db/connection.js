import { seedRecords } from './seed-data.js';
import { createSqliteDriver } from './drivers/sqlite.js';
import { createPostgresDriver } from './drivers/postgres.js';

const INSERT = `
INSERT INTO comics (id, series, issue, issue_sort, publisher, year, genre, grade, price, key_note, creators, image, added, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

export function insertParams(rec) {
  const now = new Date().toISOString();
  return [
    rec.id,
    rec.series,
    rec.issue,
    Number.parseFloat(rec.issue) || 0,
    rec.publisher,
    rec.year,
    rec.genre,
    rec.grade,
    rec.price,
    rec.keyNote,
    rec.creators,
    rec.image,
    rec.added,
    now,
    now,
  ];
}

/**
 * Open the database behind a dialect-neutral driver.
 *
 * - POSTGRES_URL / DATABASE_URL set → Postgres (production: Vercel + Neon).
 * - Otherwise → Node's built-in SQLite at DB_PATH (local dev and tests).
 *
 * Seeds the design handoff's 30-record catalog when the table is empty.
 */
export async function createDatabase(dbPath = process.env.DB_PATH || 'data/longbox.db') {
  const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!pgUrl && process.env.VERCEL) {
    throw new Error(
      'No POSTGRES_URL configured. SQLite is dev-only — on Vercel, connect a ' +
        'Postgres database (Storage → Create Database → Neon) so POSTGRES_URL is set.'
    );
  }
  const driver = pgUrl
    ? await createPostgresDriver(pgUrl)
    : await createSqliteDriver(dbPath);

  await driver.migrate();
  const row = await driver.get('SELECT COUNT(*) AS n FROM comics');
  if (Number(row.n) === 0) await insertSeed(driver);
  return driver;
}

export async function insertSeed(db) {
  await db.transaction(async (tx) => {
    for (const rec of seedRecords()) await tx.run(INSERT, insertParams(rec));
  });
}

/** "Restore seed data" (CMS header action): wipe and re-seed atomically. */
export async function resetToSeed(db) {
  await db.transaction(async (tx) => {
    await tx.run('DELETE FROM comics');
    for (const rec of seedRecords()) await tx.run(INSERT, insertParams(rec));
  });
}

export const INSERT_SQL = INSERT;
