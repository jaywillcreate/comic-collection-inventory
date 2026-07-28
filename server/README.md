# Longbox Archive API

Backend for the **Williams Comic Collection** — the server side of the *Longbox Archive*
design handoff: a public comic-book catalog (search, faceted filtering, cover wall,
record detail) paired with a connected CMS that writes to the same store.

The prototype in [`../design/`](../design/README.md) persisted to `localStorage`; this service replaces that with a
real REST API, exactly along the seams the handoff specifies:

> **Replace with your API**: `GET /comics` (query + facets + sort server-side),
> `POST /comics`, `PATCH /comics/:id`, `DELETE /comics/:id`, plus an upload endpoint for
> cover scans. Facet counts should come from the search backend.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js ≥ 22.9 | modern, single-language with the frontend; runs as one Vercel function via `../api/index.js` |
| HTTP | Express 5 | async-aware routing (rejected handlers hit the error middleware), minimal surface |
| Storage | Two-driver adapter: built-in `node:sqlite` locally, Postgres (`pg`, e.g. Neon) when `POSTGRES_URL` is set | zero-setup dev + durable serverless production behind one dialect-neutral SQL layer |
| Uploads | Multer (memory) → Vercel Blob in production, local disk in dev | replaces the prototype's data-URL drop with real files |
| Hardening | Helmet, CORS allow-list, rate limit, optional API key on writes | sane defaults for a small public API |

## Layout

```
src/
  server.js               entry point (PORT, graceful shutdown)
  app.js                  express wiring — injectable db path / upload dir for tests
  db/
    connection.js         driver selection, auto-seed, seed reset
    drivers/sqlite.js     local driver (node:sqlite, WAL)
    drivers/postgres.js   production driver (pg pool, ?→$n placeholders)
    seed-data.js          the 30-issue catalog from the design handoff
    seed-cli.js           `npm run seed`
  services/
    comics-service.js     search/facets/sort query builder, CRUD, stats, validation
  storage/
    covers.js             cover-scan storage: Vercel Blob / local disk
  routes/
    comics.js             /api/comics CRUD + search
    uploads.js            /api/uploads/covers (multipart, ≤4 MB)
    meta.js               /api/stats, /api/meta, /api/admin/seed-reset
  middleware/
    auth.js               optional x-api-key guard on all writes
    errors.js             uniform JSON errors
  utils/
    domain.js             design rules: eras, genres, sorts, price-cap curve,
                          LB-##### refs, census bars
tests/
  api.test.js             21 end-to-end tests over a live in-memory instance
docs/
  API.md                  endpoint reference + design-feature mapping
```

The design handoff itself lives at the repo root in `../design/`; the React frontend
that consumes this API is in `../web/`.

## Quick start

From the **repo root** (dependencies live in the root `package.json` so Vercel can
bundle the function):

```bash
npm install
npm run dev        # http://localhost:4000, auto-seeds 30 records on first run
```

```bash
curl "http://localhost:4000/api/comics?q=first+appearance&publisher=Marvel&sort=value-desc"
```

Run the test suite:

```bash
npm test
```

Reset the catalog to the handoff's seed data:

```bash
npm run seed       # or: POST /api/admin/seed-reset
```

## Configuration

Copy `../.env.example` to `../.env` and adjust (`npm run dev` loads it via
`--env-file-if-exists`). Everything has a dev-friendly default.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | listen port (local server only) |
| `DB_PATH` | `data/longbox.db` | SQLite file (`:memory:` for ephemeral); dev-only |
| `POSTGRES_URL` | *(unset)* | switches to the Postgres driver — set automatically when a Neon database is connected on Vercel (`DATABASE_URL` also honored) |
| `UPLOAD_DIR` | `uploads` | local cover-scan storage, served at `/uploads` |
| `BLOB_READ_WRITE_TOKEN` | *(unset)* | switches uploads to Vercel Blob — set automatically when a Blob store is connected |
| `CORS_ORIGIN` | `*` | comma-separated frontend origins |
| `ADMIN_API_KEY` | *(unset)* | when set, all writes require `x-api-key` |

**Production note:** set `ADMIN_API_KEY` (or put real auth in front of the CMS routes)
before exposing this anywhere public — without it, anyone can write to the index. The
server logs a warning on boot when writes are open.

## API at a glance

Full reference with request/response shapes: [docs/API.md](docs/API.md).

| Design feature | Endpoint |
| --- | --- |
| Header search, filter rail, sort, wall/ledger | `GET /api/comics` (query params; returns page + facet counts) |
| Record detail slide-over (specs, census bars) | `GET /api/comics/:id` |
| CMS "Accession a book" | `POST /api/comics` |
| CMS edit / "Edit in CMS" | `PATCH /api/comics/:id` |
| CMS delete | `DELETE /api/comics/:id` |
| Cover image module (drop / paste → real file) | `POST /api/uploads/covers` → `{ url }` |
| Hero stats + CMS stat cards | `GET /api/stats` |
| Genre/publisher options, ticker band | `GET /api/meta` |
| "Restore seed data" | `POST /api/admin/seed-reset` |

## Deploying

**Vercel** is the primary target — see the [root README](../README.md#deploy-to-vercel)
for the full walkthrough (import repo → connect Neon Postgres + Blob store → set
`ADMIN_API_KEY`/`VITE_ADMIN_KEY` → deploy). `GET /api/health` reports which drivers are
active: `{"db":"postgres","covers":"blob"}` in production.

Any long-running Node host (Render, Railway, Fly.io, a VPS) also works: `npm ci`,
set the env vars above (SQLite + disk uploads are fine there since disks persist),
`npm start`.

## Provenance

- Seed figures come from the design handoff and are **illustrative** — verify values
  before presenting them as market fact.
- The census-by-grade distribution is the handoff's illustrative curve; swap in real
  census data when a source is integrated.
