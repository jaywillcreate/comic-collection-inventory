# Longbox Archive API

Backend for the **Williams Comic Collection** — the server side of the *Longbox Archive*
design handoff: a public comic-book catalog (search, faceted filtering, cover wall,
record detail) paired with a connected CMS that writes to the same store.

The prototype in `design/` persisted to `localStorage`; this service replaces that with a
real REST API, exactly along the seams the handoff specifies:

> **Replace with your API**: `GET /comics` (query + facets + sort server-side),
> `POST /comics`, `PATCH /comics/:id`, `DELETE /comics/:id`, plus an upload endpoint for
> cover scans. Facet counts should come from the search backend.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js ≥ 22.5 | modern, single-language with the frontend |
| HTTP | Express 5 | async-aware routing, minimal surface |
| Storage | SQLite via built-in `node:sqlite` | zero native deps, file-based, right-sized for a single collection; swap for Postgres behind `ComicsService` when needed |
| Uploads | Multer (disk) | replaces the prototype's data-URL drop with real files |
| Hardening | Helmet, CORS allow-list, rate limit, optional API key on writes | sane defaults for a small public API |

## Layout

```
src/
  server.js               entry point (PORT, graceful shutdown)
  app.js                  express wiring — injectable db path / upload dir for tests
  db/
    connection.js         schema, WAL, auto-seed, seed reset
    seed-data.js          the 30-issue catalog from the design handoff
    seed-cli.js           `npm run seed`
  services/
    comics-service.js     search/facets/sort query builder, CRUD, stats, validation
  routes/
    comics.js             /api/comics CRUD + search
    uploads.js            /api/uploads/covers (multipart)
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
design/                   the original design handoff (source of truth for the UI)
```

## Quick start

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

Copy `.env.example` and adjust. Everything has a dev-friendly default.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `4000` | listen port |
| `DB_PATH` | `data/longbox.db` | SQLite file (`:memory:` for ephemeral) |
| `UPLOAD_DIR` | `uploads` | cover-scan storage, served at `/uploads` |
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

Any Node host works (Render, Railway, Fly.io, a VPS). The checklist:

1. `npm ci --omit=dev`
2. Set `PORT`, `DB_PATH` (a persistent volume), `UPLOAD_DIR` (persistent volume),
   `CORS_ORIGIN` (your frontend's origin) and `ADMIN_API_KEY`.
3. `npm start`
4. Point the frontend's API base URL at the deployment; cover-scan URLs returned by the
   upload endpoint are host-relative (`/uploads/covers/…`), so serve frontend and API
   from the same origin or prefix them client-side.

SQLite runs in WAL mode; for multi-instance scale-out, move `ComicsService` onto
Postgres — the SQL in it is deliberately portable.

## Provenance

- Seed figures come from the design handoff and are **illustrative** — verify values
  before presenting them as market fact.
- The census-by-grade distribution is the handoff's illustrative curve; swap in real
  census data when a source is integrated.
