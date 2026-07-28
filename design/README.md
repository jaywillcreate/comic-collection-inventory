# Handoff: Longbox Archive — comic database + connected CMS

## Overview
A public comic-book database (search, faceted filtering, cover-wall browse, record detail) paired with an
admin CMS that writes to the same store (accession new books, edit/delete records, look up cover art and
market value on the web). Two views of one app, switched from the header.

## About the Design Files
The files in this bundle are **design references created in HTML** — a working prototype showing intended
look and behavior, **not production code to copy directly**. The task is to **recreate these designs in your
codebase's existing environment** (React/Next, Vue, SwiftUI, native, etc.) using its established patterns,
router, data layer and component library. If the project has no environment yet, pick the most appropriate
framework and implement there. The prototype's local-storage persistence stands in for your real API.

## Fidelity
**High fidelity.** Final colors, typography, spacing, states and interactions. Recreate pixel-faithfully
using your own primitives. All values below are exact.

---

## Design tokens (Nocturne)

`nocturne/styles.css` is the source of truth — it declares the CSS custom properties below and a small
component layer (`.btn`, `.input`, `.field`, `.seg`, `.card`, `.tag`, `.table`, `.dialog`). Port the tokens
into your theme system rather than hard-coding hexes.

### Color
| Token | Value | Use |
| --- | --- | --- |
| `--color-bg` | `#161826` | page ground |
| `--color-surface` | `#232532` | cards, panels, inputs |
| `--color-text` | `#e9e9ed` | body text |
| `--color-accent` | `#9184d9` | the single accent (lines, marks, outlines — never a flood) |
| `--color-divider` | `color-mix(in srgb, #e9e9ed 16%, transparent)` | hairlines |

Neutral ramp `--color-neutral-100…900`: `#f3f5fe #e4e7f5 #cfd3e5 #b2b6ca #9397ab #75798c #595d6c #3f424d #292b31`
Accent ramp `--color-accent-100…900`: `#f5f4ff #e7e5fe #d2cefd #b5abfc #968ae0 #796cbf #5d5294 #423a6a #2b2741`

Muted text = `color-mix(in srgb, var(--color-text) 45–55%, transparent)`.
Accent body-size text must use `--color-accent-300` (`#d2cefd`), not the base accent (contrast).

Page background is a soft radial, not a flat fill:
`radial-gradient(120% 60% at 12% -10%, #1e2136 0%, #161826 55%, #131522 100%)`

### Elevation
| Token | Value |
| --- | --- |
| `--shadow-sm` | `0 0 0 1px #3f424d` |
| `--shadow-md` | `0 0 0 1px #595d6c, 0 6px 18px rgba(0,0,0,.55)` |
| `--shadow-lg` | `0 0 0 1px #9397ab, 0 16px 40px rgba(0,0,0,.65)` |

### Spacing / radius
`--space-1..8` = `2.8 5.6 8.4 11.2 16.8 22.4` px (0.70× density scale).
`--radius-sm/md/lg` = `4 / 8 / 14` px. Panels use 10–14px, cover plates 8px, chips 6px.

### Typography — the brand's primary expression
**Inter, loaded as a variable font**: `https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,100..900&display=swap`.
Weight is a design axis; set it with `font-variation-settings: 'wght' N`, not `font-weight` keywords.

| Role | Spec |
| --- | --- |
| Hero headline | `clamp(52px,12.5vw,168px)` / line-height `0.8` / tracking `-0.055em` / uppercase, three stacked lines |
| Hero line 1 & 3 | `'wght' 760`, solid `--color-text` |
| Hero "issue" | `'wght' 300`, `color: transparent; -webkit-text-stroke: 1.4px var(--color-accent)` |
| Hero inline aside | `0.2em` of the hero size, `'wght' 500`, sentence case, muted 45% |
| Section heading (CMS) | `clamp(38px,6.6vw,86px)` / `0.8` / `-0.055em` / uppercase; line 1 solid `'wght' 720`, line 2 outlined `1.2px var(--color-accent)` at `'wght' 300` |
| Stat numerals | `clamp(28px,4.4vw,52px)` / `0.82` / `-0.05em` / `'wght' 620` / `font-variant-numeric: tabular-nums` |
| Stat labels & eyebrows | `9–11px` / tracking `0.20–0.26em` / uppercase / muted 38–45% |
| Card title | `14px` / `1.1` / `-0.035em` / `'wght' 620` / uppercase |
| Detail title | `clamp(24px,4.6vw,34px)` / `0.92` / `-0.045em` / uppercase / `'wght' 700` |
| Body | `15px` / `1.55` / weight 400; small copy `13px`; micro `11px` |
| Cover plate series | `20px` / `0.9` / `-0.045em` / `'wght' 780` / uppercase |
| Cover plate issue no. | `46px` / `0.72` / `-0.07em` / `'wght' 300` / `-webkit-text-stroke: 1.1px rgba(233,233,237,.85)`, transparent fill |

Icons: **Phosphor** (`@phosphor-icons/web` regular). Used at 11–17px, accent or muted.

### Motion
| Name | Spec |
| --- | --- |
| `lb-reveal` | headline lines: `opacity 0→1`, `translateY(.22em) scaleY(.94)`, `blur(6px)→0`; `.8s cubic-bezier(.2,.8,.25,1)`, staggered `0 / .1s / .2s` |
| `lb-wght` | hero period: `'wght' 340 ⇄ 780`, `5.5s ease-in-out infinite`, `1.2s` delay |
| `lb-marquee` | ticker: `translateX(0 → -50%)`, `42s linear infinite` (list duplicated once) |
| `lb-in` | detail panel: `translateX(28px)+fade`, `.26s cubic-bezier(.2,.7,.3,1)` |
| `lb-rise` | disclosure panels: `translateY(10px)+fade`, `.18s ease` |
| Card hover | `transform: translateY(-6px)`, `.26s cubic-bezier(.2,.7,.3,1)` |

Respect `prefers-reduced-motion` in production — disable `lb-wght` and `lb-marquee`.

---

## Screens / views

### 1. App header (persistent)
Sticky, `z-index 40`, `background: color-mix(in srgb,#161826 84%, transparent)` + `backdrop-filter: blur(16px)`,
1px bottom divider. Inner row: `max-width 1580px`, padding `9px clamp(14px,3vw,34px)`, flex, `gap 14px`, wraps.
- **Brand**: 24×32px spine block, `radius 3px`, `linear-gradient(160deg,#968ae0,#423a6a 60%,#232532)`,
  `inset 3px 0 0 rgba(0,0,0,.45)` + `0 0 0 1px #3f424d`. Beside it "LONGBOX" (16px, wght 600) over
  "ARCHIVE & INDEX" (9px, tracking .22em, muted 45%).
- **Search**: `.input`, height 38px, `flex 1 1 300px`, `max-width 520px`, magnifier icon inset 11px left,
  placeholder "Search title, creator, character, key note…". Filters as you type.
- **View switch**: `.seg` segmented control — Catalog / CMS.

### 2. Catalog
**Hero** — eyebrow row ("PUBLIC INDEX" accent · fading rule · "EST. 1938 — PRESENT" muted), the three-line
stacked headline ("EVERY / *issue* ever printed / INDEXED."), then a row of the intro paragraph (`max-width 52ch`)
and four oversized stats: Records indexed, Key issues, Publishers, Catalogued value.

**Ticker band** — 1px rules top and bottom, 9px padding, horizontally masked at both edges
(`mask-image: linear-gradient(to right,transparent,#000 6%,#000 94%,transparent)`); scrolling list of eras,
publishers and "Key issues / CGC census / First appearances / Provenance", 11px uppercase tracking .24em,
3px accent dot between items.

**Two-column body** — flex, wraps, `gap clamp(18px,2.4vw,36px)`:
- **Filter rail**: `flex 1 1 236px`, `min-width 224px`, sticky `top 70px`, `gap 20px`.
  Header "Refine" (20px, wght 620) + ghost "Reset". Then a bordered "Key issues only" checkbox row
  (`radius 8px`, 1px divider, hover `accent 10%` tint, pennant icon). Then three facet groups —
  **Publisher, Era, Genre** — each a micro uppercase label plus option rows: 13px square mark
  (`radius 3px`; unchecked 1px `text 28%` border, checked filled accent), label (accent-200 when on),
  right-aligned tabular count. Hover `text 7%` tint. Finally a **value ceiling** slider (0–100 mapped
  logarithmically to `10^(1+p/100*5.6)`; 100 = "No cap"), labelled with the current cap.
- **Results column**: `flex 999 1 560px`, `min-width 0`.
  - Toolbar: "N books of M" muted; `.seg` Wall / Ledger; sort `<select>` — Oldest first, Newest first,
    Highest value, Highest grade, Title A–Z, Recently added (default **Highest value**).
  - Active-filter chips (`.tag-outline`, clickable, ✕ icon) when any filter or query is set.
  - **Wall**: `grid-template-columns: repeat(auto-fill, minmax(172px,1fr))`, `gap clamp(14px,1.6vw,24px)`.
    Each card = cover plate + 3-line meta (uppercase title, "Publisher · Year" muted 48%, accent-300 price).
  - **Ledger**: `.table`, `min-width 660px`, horizontal scroll — 26×38 cover swatch, Issue (+ key line),
    Publisher, Year, Genre, Grade, right-aligned Value. Whole row opens the record.
  - **Empty state**: dashed 1px border, `radius 14px`; outline wordmark "EMPTY BOX"
    (`clamp(44px,9vw,104px)`, `-webkit-text-stroke: 1.2px` of `text 26%`), h4 "No books match that pull list",
    muted line, primary "Reset filters".

**Cover plate** (the core object, `aspect-ratio 2/3`, `radius 8px`, `--shadow-sm`):
1. Ground: `linear-gradient(155deg, oklch(L C H) 0%, oklch(0.27 C*0.7 H+16) 58%, oklch(0.165 0.045 H+28) 100%)`
   where `H` is a per-publisher hue (DC 262, Marvel 292, Timely 232, Image 318, Mirage 196, Vertigo 276,
   Aardvark-Vanaheim 340; unknown publishers hash into 190–350), `t = clamp((year-1938)/84)`,
   `L = 0.44 - 0.06t`, `C = 0.135 - 0.045t`. Older books read warmer and heavier; newer ones cooler and flatter.
2. If a cover scan URL exists it fills the plate as a `background-image` (`cover`, centered) — **not** an
   `<img>` with a templated `src`.
3. Otherwise the generated plate: publisher (8px, tracking .18em) top-left, year top-right, uppercase series
   name, outline issue number with the genre beside it, 5px halftone dot field
   (`radial-gradient(rgba(255,255,255,.10) 1px, transparent 1.1px)`, `mix-blend-mode: soft-light`),
   7px black spine gradient down the left edge, and a soft diagonal sheen (`rotate(-18deg)`).
4. Overlays on every plate: bottom 34% scrim `linear-gradient(transparent, rgba(0,0,0,.5))`;
   grade pill bottom-right (`CGC 9.4`, 10px tabular, accent-200 on `#161826 62%`, `radius 4px`);
   key-issue badge top-right (22px circle, 1px accent border, blurred `#161826 70%` ground, pennant icon).

### 3. Record detail (slide-over)
Backdrop `#0c0d16 62%` + `blur(3px)`, `z 60`, click to dismiss. Panel `z 61`, right-anchored,
`width min(470px,100%)`, full height, `--color-surface`, `--shadow-lg`, `lb-in` entrance, scrolls internally.
- Sticky sub-header: "RECORD LB-#####" micro-uppercase + `.btn-icon.btn-secondary` ✕.
- Head: 132px cover plate; beside it "PUBLISHER · ERA" accent eyebrow, uppercase title, creators muted,
  tags — genre (`.tag-neutral`), `CGC x.x` (`.tag-accent`), `Key` (`.tag-outline`) — all `white-space: nowrap`.
- **Key significance** callout when the record has a key note: `accent 11%` ground, 2px left accent border,
  `radius 10px`.
- **Spec grid**: `repeat(auto-fit,minmax(120px,1fr))`, 1px gaps over `--color-divider` (hairline grid effect),
  `radius 10px`, cells on `--color-surface` — Cover date, Issue, Grade, Market value, Era, Genre.
- **Census by grade**: 8 bars (9.8, 9.6, 9.4, 9.2, 9.0, 8.5, 8.0, 6.0), height
  `max(8, round(70 * exp(-dist² * 1.1)))` px where `dist = |bar - record grade|`; the record's own bar is
  `--color-accent`, others `--color-accent-800`. Illustrative distribution — swap for real census data.
- Actions: primary "Edit in CMS" (jumps to the CMS with the record loaded), secondary "Back to wall".

### 4. CMS
Header: accent eyebrow "CONNECTED CMS · WRITES TO THE LIVE INDEX", the oversized solid/outline
"CATALOG MANAGEMENT" lockup, a one-line description, and a secondary "Restore seed data".

**Stat cards**: `repeat(auto-fit,minmax(180px,1fr))`, `gap 12px`, `.card.elev-sm` — Records, Key issues,
Missing scans, Book value; each = icon + micro label, 26px value, 11px note.

**Accession form** (`flex 1 1 336px`, sticky `top 70px`, surface, `radius 14px`, `padding 18px`, `gap 12px`):
- Heading "Accession a book" / "Edit record" (22px, wght 640).
- 74px live cover preview (same plate logic, updates as publisher/year/image change) beside Series, Issue, Year.
- Publisher (with a `<datalist>` of existing publishers) and Genre `<select>`.
- **Grade & value module** — bordered `radius 10px` group holding Grade (CGC) and Market value plus a
  "Look up value" disclosure: query auto-filled as `Series #Issue CGC Grade`, launch buttons to
  eBay sold listings, GoCollect and Heritage (new tab), a comps entry field (Enter or ＋ adds), comp chips
  showing **exact** currency (`$1,200` — never abbreviated), the median of N comps, and "Use median" which
  writes the median into the value field.
- Creators; Key note (textarea); then the **Cover image module** — bordered group with a "Find on the web"
  disclosure: auto-filled query (`Series #Issue Publisher cover`), launch buttons to image search,
  Comic Vine and GCD, a drop zone accepting a dragged image (`text/uri-list` → URL, or a `File` → data URL),
  a paste-URL row, a candidate thumbnail tray (`repeat(auto-fill,minmax(52px,1fr))`, 2:3, selected gets a
  `0 0 0 2px accent` ring), and the plain "Cover scan URL" field with a clear button.
- Footer: primary submit ("Add to index" / "Save changes"), "Cancel" while editing, and a transient
  accent-300 flash message (auto-clears after 2.6s).

**Inventory**: heading + inline filter input; `.table`, `min-width 700px` — 24×34 cover swatch, Issue
(+ key/creator line), Publisher, Year, Grade, right-aligned Value, and ghost icon buttons Edit / Delete.
Capped at 40 rows in the prototype — paginate or virtualize against a real API.

---

## Interactions & behavior
- Search is live and AND-matches every whitespace-separated term against series, issue, publisher, genre,
  creators, key note and year.
- Facets are multi-select within a group and AND across groups. **Counts are computed against the other
  active filters, excluding the group being counted**, so a facet never shows 0 for something you could pick.
- Value ceiling and "Key issues only" apply on top; "Reset" clears facets, query, key flag and the ceiling.
- Clicking any card or ledger row opens the slide-over; backdrop click or ✕ closes it.
- "Edit in CMS" switches view, loads the record into the form, closes the panel.
- Form validation: Series required (flash "Series is required"). Defaults on submit — issue `1`,
  publisher `Independent`, year = current year, genre `Indie`, grade `9.0`, price `0`.
- Adds prepend to the list and appear in the catalog immediately; edits patch in place; delete is immediate.
- Responsive with **no media queries** — intrinsic sizing only: `auto-fill/auto-fit` grids, `flex-wrap`
  with `flex-basis` targets, `clamp()` type and padding, `min(470px,100%)` panel, tables in
  `overflow-x: auto`. The filter rail wraps above the results below ~770px and goes full width.

## State
| State | Type | Notes |
| --- | --- | --- |
| `view` | `'catalog' \| 'admin'` | header switch |
| `comics[]` | records | `{id, series, issue, publisher, year, genre, grade, price, keyNote, creators, image, added}` |
| `q`, `adminQ` | string | live queries |
| `sort` | enum | see toolbar |
| `layout` | `'wall' \| 'list'` | |
| `pub[]`, `era[]`, `genre[]` | string[] | facet selections |
| `keyOnly` | bool | |
| `priceCap` | 0–100 | log-mapped ceiling |
| `selectedId` | id \| null | drives the slide-over |
| `form`, `editingId`, `flash` | | CMS form; `editingId` null = create |
| `coverSearchOpen`, `coverQuery`, `coverPaste`, `candidates[]` | | cover lookup |
| `compSearchOpen`, `compQuery`, `compEntry`, `comps[]` | | value lookup |

Persistence in the prototype is `localStorage` under `longbox.archive.v1`. **Replace with your API**:
`GET /comics` (query + facets + sort server-side), `POST /comics`, `PATCH /comics/:id`, `DELETE /comics/:id`,
plus an upload endpoint for cover scans (the prototype's data-URL drop should become a real upload).
Facet counts should come from the search backend rather than being computed client-side.

## Assets
- **Fonts**: Inter variable (Google Fonts). No other typeface.
- **Icons**: Phosphor regular, via CDN in the prototype — install `@phosphor-icons/react` (or your icon set)
  in production.
- **Cover art**: none bundled. Every cover in the prototype is a **generated typographic plate** standing in
  for real scans; supply real cover images (rights permitting) and they replace the plate automatically.
- **Seed data**: 30 well-known issues with year/publisher/grade/value/key-note metadata, for layout realism
  only — verify any figure before it ships.

## Files
- `Longbox Archive.dc.html` — the complete prototype (markup + logic + seed data). Open it in a browser.
- `nocturne/styles.css` — the Nocturne token sheet and component layer the design is built on.
