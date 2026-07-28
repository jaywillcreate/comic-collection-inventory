# Longbox Archive

The **Williams Comic Collection** app — a public comic-book database (search, faceted
filtering, cover-wall browse, record detail) paired with a connected CMS that writes to
the same store. Recreated at high fidelity from the Nocturne design handoff in
[`design/`](design/README.md).

```
server/   Node + Express + SQLite REST API           → server/README.md
web/      React + Vite frontend (catalog + CMS)      → talks to the API
design/   the original design handoff (source of truth for the UI)
```

## Run it

Two terminals from the repo root:

```bash
cd server && npm install && npm run dev     # API on http://localhost:4000
```

```bash
cd web && npm install && npm run dev        # UI on http://localhost:5173
```

Open http://localhost:5173 — the catalog seeds itself with the handoff's 30 records on
first run. The Vite dev server proxies `/api` and `/uploads` to port 4000.

## What's where

- **API contract & endpoint reference**: [server/docs/API.md](server/docs/API.md) —
  includes the mapping from each design feature to its endpoint.
- **Backend architecture, config, deploy checklist**: [server/README.md](server/README.md)
- **Design tokens / spec**: [design/README.md](design/README.md) — the Nocturne token
  sheet is ported to [web/src/styles/nocturne.css](web/src/styles/nocturne.css).

## Tests

```bash
cd server && npm test     # 21 end-to-end API tests (node --test, in-memory SQLite)
```

The frontend builds with `cd web && npm run build`; output lands in `web/dist/`.

## Production notes

- Set `ADMIN_API_KEY` on the server (and `VITE_ADMIN_KEY` at build time for the web
  app) so CMS writes require a key — without it, anyone can write to the index.
- Serve `web/dist` and the API from one origin (or set `VITE_API_BASE` and
  `CORS_ORIGIN` for a split deployment).
- Seed figures are illustrative, from the design handoff — verify before shipping as fact.
