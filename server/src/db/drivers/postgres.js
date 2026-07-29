import pg from 'pg';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS comics (
  id             TEXT PRIMARY KEY,
  series         TEXT NOT NULL,
  issue          TEXT NOT NULL DEFAULT '1',
  issue_sort     DOUBLE PRECISION NOT NULL DEFAULT 0,
  publisher      TEXT NOT NULL DEFAULT 'Independent',
  character_name TEXT NOT NULL DEFAULT '',
  variant        TEXT NOT NULL DEFAULT '',
  year           INTEGER NOT NULL DEFAULT 0,
  genre          TEXT NOT NULL DEFAULT 'Indie',
  grade          DOUBLE PRECISION NOT NULL DEFAULT 0,
  price          DOUBLE PRECISION NOT NULL DEFAULT 0,
  price_source   TEXT NOT NULL DEFAULT '',
  price_note     TEXT NOT NULL DEFAULT '',
  key_note       TEXT NOT NULL DEFAULT '',
  creators       TEXT NOT NULL DEFAULT '',
  image          TEXT NOT NULL DEFAULT '',
  summary        TEXT NOT NULL DEFAULT '',
  cover_date     TEXT NOT NULL DEFAULT '',
  added          DOUBLE PRECISION NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS suggestion_values (
  skey       TEXT PRIMARY KEY,
  price      DOUBLE PRECISION NOT NULL DEFAULT 0,
  note       TEXT NOT NULL DEFAULT '',
  checked_at TEXT NOT NULL DEFAULT ''
);
ALTER TABLE comics ADD COLUMN IF NOT EXISTS character_name TEXT NOT NULL DEFAULT '';
ALTER TABLE comics ADD COLUMN IF NOT EXISTS variant TEXT NOT NULL DEFAULT '';
ALTER TABLE comics ADD COLUMN IF NOT EXISTS summary TEXT NOT NULL DEFAULT '';
ALTER TABLE comics ADD COLUMN IF NOT EXISTS price_source TEXT NOT NULL DEFAULT '';
ALTER TABLE comics ADD COLUMN IF NOT EXISTS price_note TEXT NOT NULL DEFAULT '';
ALTER TABLE comics ADD COLUMN IF NOT EXISTS cover_date TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_comics_publisher ON comics(publisher);
CREATE INDEX IF NOT EXISTS idx_comics_year      ON comics(year);
CREATE INDEX IF NOT EXISTS idx_comics_genre     ON comics(genre);
CREATE INDEX IF NOT EXISTS idx_comics_price     ON comics(price);
CREATE INDEX IF NOT EXISTS idx_comics_added     ON comics(added);
`;

/** Rewrite '?' placeholders (our house style) to Postgres $1…$n. */
function positional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => '$' + ++i);
}

/**
 * Production driver for Vercel + Neon (or any Postgres). Reads the pooled
 * connection string; keep the pool small — serverless instances multiply.
 */
export async function createPostgresDriver(connectionString) {
  const local = /localhost|127\.0\.0\.1/.test(connectionString);
  const pool = new pg.Pool({
    connectionString,
    ssl: local ? undefined : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
  });

  const wrap = (query) => ({
    all: async (sql, params = []) => (await query(positional(sql), params)).rows,
    get: async (sql, params = []) => (await query(positional(sql), params)).rows[0],
    run: async (sql, params = []) => {
      const r = await query(positional(sql), params);
      return { changes: r.rowCount ?? 0 };
    },
  });

  const driver = {
    dialect: 'postgres',
    ...wrap((sql, params) => pool.query(sql, params)),
    async migrate() {
      await pool.query(SCHEMA);
    },
    async transaction(fn) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await fn(wrap((sql, params) => client.query(sql, params)));
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
  };
  return driver;
}
