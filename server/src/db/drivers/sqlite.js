import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS comics (
  id             TEXT PRIMARY KEY,
  series         TEXT NOT NULL,
  issue          TEXT NOT NULL DEFAULT '1',
  issue_sort     REAL NOT NULL DEFAULT 0,
  publisher      TEXT NOT NULL DEFAULT 'Independent',
  character_name TEXT NOT NULL DEFAULT '',
  variant        TEXT NOT NULL DEFAULT '',
  year           INTEGER NOT NULL DEFAULT 0,
  genre          TEXT NOT NULL DEFAULT 'Indie',
  grade          REAL NOT NULL DEFAULT 0,
  price          REAL NOT NULL DEFAULT 0,
  price_source   TEXT NOT NULL DEFAULT '',
  price_note     TEXT NOT NULL DEFAULT '',
  key_note       TEXT NOT NULL DEFAULT '',
  creators       TEXT NOT NULL DEFAULT '',
  image          TEXT NOT NULL DEFAULT '',
  summary        TEXT NOT NULL DEFAULT '',
  cover_date     TEXT NOT NULL DEFAULT '',
  added          INTEGER NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_comics_publisher ON comics(publisher);
CREATE INDEX IF NOT EXISTS idx_comics_year      ON comics(year);
CREATE INDEX IF NOT EXISTS idx_comics_genre     ON comics(genre);
CREATE INDEX IF NOT EXISTS idx_comics_price     ON comics(price);
CREATE INDEX IF NOT EXISTS idx_comics_added     ON comics(added);
`;

/**
 * Zero-dependency local driver on Node's built-in SQLite. Used whenever no
 * POSTGRES_URL is configured — dev machines and the test suite.
 */
export async function createSqliteDriver(dbPath) {
  const { DatabaseSync } = await import('node:sqlite');
  if (dbPath !== ':memory:') {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  if (dbPath !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');

  const driver = {
    dialect: 'sqlite',
    async all(sql, params = []) {
      return db.prepare(sql).all(...params);
    },
    async get(sql, params = []) {
      return db.prepare(sql).get(...params);
    },
    async run(sql, params = []) {
      const r = db.prepare(sql).run(...params);
      return { changes: r.changes };
    },
    async migrate() {
      db.exec(SCHEMA);
      // Databases created before the character/variant columns existed
      const cols = new Set(
        db.prepare('PRAGMA table_info(comics)').all().map((c) => c.name)
      );
      if (!cols.has('character_name')) {
        db.exec("ALTER TABLE comics ADD COLUMN character_name TEXT NOT NULL DEFAULT ''");
      }
      if (!cols.has('variant')) {
        db.exec("ALTER TABLE comics ADD COLUMN variant TEXT NOT NULL DEFAULT ''");
      }
      if (!cols.has('summary')) {
        db.exec("ALTER TABLE comics ADD COLUMN summary TEXT NOT NULL DEFAULT ''");
      }
      if (!cols.has('price_source')) {
        db.exec("ALTER TABLE comics ADD COLUMN price_source TEXT NOT NULL DEFAULT ''");
      }
      if (!cols.has('price_note')) {
        db.exec("ALTER TABLE comics ADD COLUMN price_note TEXT NOT NULL DEFAULT ''");
      }
      if (!cols.has('cover_date')) {
        db.exec("ALTER TABLE comics ADD COLUMN cover_date TEXT NOT NULL DEFAULT ''");
      }
    },
    async transaction(fn) {
      db.exec('BEGIN');
      try {
        await fn(driver);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
  return driver;
}
