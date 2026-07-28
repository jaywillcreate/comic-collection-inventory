import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedRecords } from './seed-data.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS comics (
  id         TEXT PRIMARY KEY,
  series     TEXT NOT NULL,
  issue      TEXT NOT NULL DEFAULT '1',
  publisher  TEXT NOT NULL DEFAULT 'Independent',
  year       INTEGER NOT NULL,
  genre      TEXT NOT NULL DEFAULT 'Indie',
  grade      REAL NOT NULL DEFAULT 9.0,
  price      REAL NOT NULL DEFAULT 0,
  key_note   TEXT NOT NULL DEFAULT '',
  creators   TEXT NOT NULL DEFAULT '',
  image      TEXT NOT NULL DEFAULT '',
  added      INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_comics_publisher ON comics(publisher);
CREATE INDEX IF NOT EXISTS idx_comics_year      ON comics(year);
CREATE INDEX IF NOT EXISTS idx_comics_genre     ON comics(genre);
CREATE INDEX IF NOT EXISTS idx_comics_price     ON comics(price);
CREATE INDEX IF NOT EXISTS idx_comics_added     ON comics(added);
`;

const INSERT = `
INSERT INTO comics (id, series, issue, publisher, year, genre, grade, price, key_note, creators, image, added)
VALUES (:id, :series, :issue, :publisher, :year, :genre, :grade, :price, :keyNote, :creators, :image, :added)
`;

/**
 * Open (and initialize) the SQLite database.
 * Seeds the design handoff's 30-record catalog when the table is empty.
 */
export function openDatabase(dbPath = process.env.DB_PATH || 'data/longbox.db') {
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);

  const { n } = db.prepare('SELECT COUNT(*) AS n FROM comics').get();
  if (n === 0) insertSeed(db);
  return db;
}

export function insertSeed(db) {
  const stmt = db.prepare(INSERT);
  db.exec('BEGIN');
  try {
    for (const rec of seedRecords()) stmt.run(rec);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

/** "Restore seed data" (CMS header action): wipe and re-seed atomically. */
export function resetToSeed(db) {
  db.exec('BEGIN');
  try {
    db.exec('DELETE FROM comics');
    const stmt = db.prepare(INSERT);
    for (const rec of seedRecords()) stmt.run(rec);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
