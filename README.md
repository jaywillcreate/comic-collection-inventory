# Longbox Archive

The **Williams Comic Collection** app — a public comic-book database (search, faceted
filtering, cover-wall browse, record detail) paired with a connected CMS that writes to
the same store. Recreated at high fidelity from the Nocturne design handoff in
[`design/`](design/README.md). Built to deploy on **Vercel**.

```
api/      Vercel serverless entry (wraps the Express app)
server/   Express API — SQLite locally, Neon Postgres + Vercel Blob in production
web/      React + Vite frontend (catalog + CMS)
design/   the original design handoff (source of truth for the UI)
```

## Run locally

Two terminals from the repo root (local dev uses built-in SQLite + disk uploads —
no external services needed):

```bash
npm install && npm run dev          # API on http://localhost:4000
```

```bash
cd web && npm install && npm run dev   # UI on http://localhost:5173
```

Open http://localhost:5173 — the catalog seeds itself with the handoff's 30 records on
first run. The Vite dev server proxies `/api` and `/uploads` to port 4000.

```bash
npm test    # 21 end-to-end API tests (node --test, in-memory SQLite)
```

## Deploy to Vercel

The repo is pre-configured ([vercel.json](vercel.json)): the Vite app is served as
static assets and the whole Express API runs as one serverless function
(`api/index.js`), so everything ships as a single Vercel project.

1. **Push this repo to GitHub**, then in Vercel: **Add New… → Project → Import** the
   repo. Build settings come from `vercel.json` — no changes needed.
2. **Database** — serverless functions have no persistent disk, so SQLite is dev-only.
   In the project's **Storage** tab: **Create Database → Neon (Postgres)** and connect
   it. This injects `POSTGRES_URL`; the API detects it, switches to the Postgres
   driver, creates the schema and seeds the 30-record catalog on first request.
3. **Cover uploads** — **Storage → Create → Blob** and connect it. This injects
   `BLOB_READ_WRITE_TOKEN`; uploads then go to Vercel Blob and records store absolute
   public URLs. (Without a Blob store, uploads return a clear 501; the rest of the app
   works.)
4. **Protect CMS writes** — in **Settings → Environment Variables** add:
   - `ADMIN_API_KEY` = a long random string (server-side gate for POST/PATCH/DELETE)
   - `VITE_ADMIN_KEY` = the same value (baked into the web build so the CMS can write)

   Note: `VITE_ADMIN_KEY` is visible in the client bundle — this is a simple shared
   gate that keeps strangers from writing to your index, not real user auth. Skip both
   only if you accept a publicly writable CMS.
5. **Deploy.** Verify `https://<your-app>.vercel.app/api/health` returns
   `{"ok":true,…,"db":"postgres","covers":"blob"}`.

Redeploys are automatic on every push to `main`.

## What's where

- **API contract & endpoint reference**: [server/docs/API.md](server/docs/API.md) —
  includes the mapping from each design feature to its endpoint.
- **Backend architecture & config**: [server/README.md](server/README.md)
- **Design tokens / spec**: [design/README.md](design/README.md) — the Nocturne token
  sheet is ported to [web/src/styles/nocturne.css](web/src/styles/nocturne.css).

## Cover images

Records without a cover URL render a generated typographic plate. To populate real
covers from the web (matched per issue via the **Comic Vine** API):

1. Get a free API key at https://comicvine.gamespot.com/api/ and set it as
   `COMICVINE_API_KEY` — in Vercel (enables auto-matching whenever a book is
   accessioned without a cover) and in the local `.env` (used by the backfill).
2. Backfill the whole catalog (throttled to Comic Vine's ~200 req/hr, resumable —
   re-running skips finished records):

   ```bash
   node --env-file-if-exists=.env scripts/backfill-covers.mjs --target https://your-app.vercel.app --key <ADMIN_API_KEY>
   ```

Matching is conservative: fuzzy title + publisher scoring with a confidence
threshold, so unmatched books keep their plates rather than getting wrong covers.
Fix any individual record through the CMS cover module. Attribution to Comic Vine
is shown in the site footer, per their API terms.

## Notes

- Local and production use the same dialect-neutral SQL through a two-driver adapter
  ([sqlite.js](server/src/db/drivers/sqlite.js) /
  [postgres.js](server/src/db/drivers/postgres.js)).
- Cover uploads are capped at 4 MB (Vercel's request-body limit is ~4.5 MB).
- Seed figures are illustrative, from the design handoff — verify before shipping as fact.
