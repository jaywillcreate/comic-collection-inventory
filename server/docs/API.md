# Longbox Archive API — Reference

Base URL: `http://localhost:4000` (configurable via `PORT`). All responses are JSON.
Errors use `{ "error": "message" }` with an appropriate 4xx/5xx status.

When `ADMIN_API_KEY` is configured, every **write** endpoint (POST/PATCH/DELETE,
uploads, seed reset) requires the header `x-api-key: <key>`. Reads are always public.

---

## Record shape

```jsonc
{
  "id": "c21",
  "ref": "LB-01584",            // stable public reference (slide-over header)
  "series": "The Sandman",
  "issue": "1",
  "title": "The Sandman #1",
  "publisher": "Vertigo",
  "character": "Morpheus",       // primary character ("" when unrecorded)
  "variant": "",                 // cover variant, e.g. "Cover B"
  "year": 1989,                  // 0 = unknown (renders as "—", belongs to no era)
  "era": "Modern Age",           // derived: <1956 Golden, <1971 Silver, <1986 Bronze, <2000 Modern, else Contemporary; null when year is 0
  "genre": "Fantasy",
  "grade": 9.4,                  // 0 = ungraded (grade chips and census hide)
  "price": 480,
  "keyNote": "First appearance of Morpheus",
  "isKey": true,                 // keyNote non-empty
  "creators": "Gaiman & Kieth",
  "image": "",                   // "" = frontend renders the generated cover plate
  "added": 21,                   // epoch ms for user adds; drives "Recently added"
  "createdAt": "2026-07-27T…Z",
  "updatedAt": "2026-07-27T…Z"
}
```

---

## `GET /api/comics` — catalog search

Powers the header search, filter rail, sort select, wall/ledger, and the CMS inventory
table (use `sort=added-desc` + pagination there).

### Query parameters

| Param | Type | Notes |
| --- | --- | --- |
| `q` | string | live search; **AND-matches every whitespace-separated term** against series, `#issue`, publisher, character, variant, genre, creators, key note and year |
| `publisher` | string, repeatable | multi-select within the group |
| `era` | string, repeatable | one of the five eras |
| `genre` | string, repeatable | one of the eight genres |
| `keyOnly` | `true`/`false` | records with a key note only |
| `priceCap` | 0–100 | value-ceiling slider position, mapped to `round(10^(1 + p/100 × 5.6))` dollars; `100` (default) = no cap |
| `sort` | enum | `year-asc`, `year-desc`, `value-desc` *(default)*, `grade-desc`, `title-asc`, `added-desc` |
| `limit` | 1–200 | page size, default 60 |
| `offset` | ≥ 0 | page start, default 0 |

Facet groups AND across each other; repeating a param ORs within its group.

### Response

```jsonc
{
  "data": [ /* records, sorted, paged */ ],
  "meta": {
    "total": 12,               // matches after filtering → "12 books of 30"
    "collectionTotal": 30,
    "limit": 60, "offset": 0,
    "sort": "value-desc",
    "priceCapValue": 6310,     // dollar value of the cap, null when uncapped
    "filters": { /* the normalized filters that were applied */ }
  },
  "facets": {
    // counts computed against the OTHER active filters, excluding each
    // group's own selection — an option you could pick never shows 0
    "publisher": [ { "value": "DC Comics", "count": 9, "active": false }, … ],
    "era":       [ { "value": "Golden Age", "count": 6, "active": false }, … ],
    "genre":     [ { "value": "Superhero", "count": 10, "active": false }, … ]
  }
}
```

---

## `GET /api/comics/:id` — record sheet

The slide-over detail. Returns the record plus:

```jsonc
{
  …record,
  "census": [                      // 8 illustrative bars: 9.8 … 6.0
    { "grade": 9.8, "height": 58, "isRecordGrade": false },
    { "grade": 9.4, "height": 70, "isRecordGrade": true },
    …
  ]
}
```

`height` is the handoff's formula `max(8, round(70·e^(−dist²·1.1)))` in px.
`404` if the id is unknown.

---

## `POST /api/comics` — accession a book *(write)*

Body: any subset of `series, issue, publisher, character, variant, year, genre, grade,
price, keyNote, creators, image`.

- `series` is **required** → `400 { "error": "Series is required" }` (the CMS flash).
- Defaults applied to blank fields: issue `"1"`, publisher `"Independent"`, genre
  `"Indie"` (unknown genres also fall back), price `0` (clamped ≥ 0). Blank **year**
  becomes `0` (unknown) and blank **grade** becomes `0` (ungraded) — real inventories
  often lack these, and the UI renders "—" rather than fabricating values.
- `image` must be `http(s)://…` or an `/uploads/…` path. **Data URLs are rejected** —
  upload the file instead.

Returns `201` with the full record. New records surface first under
`sort=added-desc` ("adds prepend to the list").

## `PATCH /api/comics/:id` — edit record *(write)*

Same fields, all optional; only supplied keys change ("edits patch in place").
Setting `series` to blank is a `400`. Returns the updated record; `404` if unknown.

## `DELETE /api/comics/:id` *(write)*

`204` on success, `404` if unknown. Immediate, no soft delete.

---

## `POST /api/uploads/covers` — cover scan upload *(write)*

`multipart/form-data`, single file in field **`cover`**.
JPEG/PNG/WebP/GIF/AVIF, ≤ 4 MB (Vercel's request-body ceiling is ~4.5 MB).
Anything else → `415`.

```jsonc
// 201 — local dev (disk): host-relative path
{ "url": "/uploads/covers/mdqk3f-9f2a01bc44d0e7aa.png", "bytes": 68, "mimeType": "image/png" }
// 201 — production (Vercel Blob): absolute public URL
{ "url": "https://<store>.public.blob.vercel-storage.com/covers/…png", "bytes": 68, "mimeType": "image/png" }
```

Store `url` in the record's `image`. On Vercel without a connected Blob store this
endpoint returns `501` with remediation. Local files are served at `/uploads/…` with
immutable caching (names are opaque and never reused).

This is the production replacement for the prototype's drag-and-drop **data-URL**
behavior: drop a `File` in the CMS → upload it here → save the returned URL.
Dragged *image addresses* (`text/uri-list`) can be saved to `image` directly.

---

## `GET /api/stats`

Hero stats and CMS stat cards in one call:

```jsonc
{
  "records": 30,            // Records indexed / Records
  "keyIssues": 22,          // Key issues
  "publishers": 7,          // Publishers
  "missingScans": 30,       // CMS: records using generated plates
  "cataloguedValue": 9855010 // Catalogued value / Book value (sum, USD)
}
```

Display formatting (`$9.9M`, `$42K`) stays client-side per the design's `money()` rule;
comps in the CMS always show exact currency.

## `GET /api/meta`

Option lists and chrome feed:

```jsonc
{
  "genres": ["Superhero", …],       // Genre <select>
  "eras": ["Golden Age", …],
  "sorts": ["year-asc", …],
  "defaultSort": "value-desc",
  "publishers": ["Aardvark-Vanaheim", …],  // datalist for the Publisher field
  "ticker": ["Golden Age", …, "Key issues", "CGC census", "First appearances", "Provenance"]
}
```

## `POST /api/admin/import` *(write)*

Bulk import. Body `{ "records": [ …up to 5000 record objects… ], "replaceAll": bool }`.
One transaction: with `replaceAll`, the existing catalog is wiped first; a failure
anywhere rolls everything back. Rows failing validation are skipped and reported.
Returns `201 { imported, skipped: [{index, error}], total, replaceAll }`.

Companion script: `node scripts/import-comic-list.mjs <file.xlsx> --target <url>
--key <ADMIN_API_KEY> --replace` parses the Williams Collection workbook format
(`Company | Character | Title | Issue | Cover [| Artist]`, one sheet per publisher).

## `POST /api/admin/seed-reset` *(write)*

Dev/testing endpoint — atomically replaces the catalog with the 30 demo records from
the design handoff. Returns `{ ok: true, …stats }`. **The CMS button for this was
removed once real inventory replaced the demo seed; don't call it in production
unless you mean to erase the live catalog.**

## `GET /api/health`

`{ "ok": true, "service": "longbox-archive-api", "db": "sqlite|postgres", "covers": "disk|blob|disabled" }`
— for uptime checks and for confirming which drivers a deployment is running.

---

## Not the backend's job (by design)

- **Value lookup / comps** — the CMS's eBay/GoCollect/Heritage buttons open external
  tabs; comp entries and the median calculation are client-side form state. Only the
  final `price` is persisted.
- **Cover web-search candidates** — candidate tray state is client-side; only the
  chosen URL (or uploaded file's URL) is persisted in `image`.
- **Cover plate generation** — the publisher-hue OKLCH gradient is presentational and
  derives from `publisher` + `year`, both served here.
