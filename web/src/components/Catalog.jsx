import { FlagPennant, GridNine, Rows, X } from '@phosphor-icons/react';
import CoverPlate, { CoverSwatch } from './CoverPlate.jsx';
import { money, muted, priceCapValue } from '../lib/cover.js';

const SORT_OPTIONS = [
  ['year-asc', 'Oldest first'],
  ['year-desc', 'Newest first'],
  ['value-desc', 'Highest value'],
  ['grade-desc', 'Highest grade'],
  ['title-asc', 'Title A–Z'],
  ['added-desc', 'Recently added'],
];

export default function Catalog({
  catalog,
  stats,
  ticker,
  filters,
  setFilters,
  clearAll,
  openRecord,
  loadMore,
}) {
  const { q, pub, era, genre, keyOnly, priceCap, sort, layout } = filters;
  const set = (patch) => setFilters((f) => ({ ...f, ...patch }));
  const toggle = (group, value) =>
    set({
      [group]: filters[group].includes(value)
        ? filters[group].filter((v) => v !== value)
        : [...filters[group], value],
    });

  const data = catalog?.data ?? [];
  const meta = catalog?.meta;
  const facets = catalog?.facets;
  const capValue = priceCapValue(priceCap);

  const chips = [
    ...pub.map((v) => ({ label: v, clear: () => toggle('pub', v) })),
    ...era.map((v) => ({ label: v, clear: () => toggle('era', v) })),
    ...genre.map((v) => ({ label: v, clear: () => toggle('genre', v) })),
    ...(keyOnly ? [{ label: 'Key issues', clear: () => set({ keyOnly: false }) }] : []),
    ...(q ? [{ label: `“${q}”`, clear: () => set({ q: '' }) }] : []),
  ];

  const heroStats = stats
    ? [
        { value: stats.records.toLocaleString(), label: 'Records indexed' },
        { value: stats.keyIssues, label: 'Key issues' },
        { value: stats.publishers, label: 'Publishers' },
        { value: money(stats.cataloguedValue), label: 'Catalogued value' },
      ]
    : [];

  const facetGroups = facets
    ? [
        { key: 'pub', label: 'Publisher', options: facets.publisher },
        { key: 'era', label: 'Era', options: facets.era },
        { key: 'genre', label: 'Genre', options: facets.genre },
      ]
    : [];

  return (
    <main style={{ maxWidth: 1580, margin: '0 auto', padding: '0 clamp(14px,3vw,34px) 96px' }}>
      {/* Hero */}
      <section style={{ padding: 'clamp(26px,4.6vw,56px) 0 clamp(16px,2.6vw,26px)' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 'clamp(14px,2vw,22px)',
          }}
        >
          <span style={eyebrow('var(--color-accent)')}>Public index</span>
          <span
            style={{
              flex: 1,
              height: 1,
              background: 'linear-gradient(to right,var(--color-divider),transparent)',
            }}
          />
          <span style={eyebrow(muted(38))}>Est. 1938 — present</span>
        </div>

        <h1
          style={{
            margin: '0 0 clamp(16px,2.4vw,26px)',
            fontSize: 'clamp(52px,12.5vw,168px)',
            lineHeight: 0.8,
            letterSpacing: '-0.055em',
            textTransform: 'uppercase',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <span className="lb-reveal" style={{ fontVariationSettings: "'wght' 760" }}>
            Every
          </span>
          <span style={{ display: 'flex', alignItems: 'baseline', gap: '0.14em', flexWrap: 'wrap' }}>
            <span
              className="lb-reveal"
              style={{
                color: 'transparent',
                WebkitTextStroke: '1.4px var(--color-accent)',
                fontVariationSettings: "'wght' 300",
                animationDelay: '.1s',
              }}
            >
              issue
            </span>
            <span
              style={{
                fontSize: '0.2em',
                letterSpacing: '0.1em',
                fontVariationSettings: "'wght' 500",
                textTransform: 'none',
                color: muted(45),
                alignSelf: 'center',
              }}
            >
              ever printed
            </span>
          </span>
          <span
            className="lb-reveal"
            style={{ fontVariationSettings: "'wght' 760", animationDelay: '.2s' }}
          >
            indexed<span className="lb-dot">.</span>
          </span>
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 'clamp(18px,3vw,44px)' }}>
          <p
            className="text-muted"
            style={{ flex: '1 1 320px', maxWidth: '52ch', fontSize: 15, textWrap: 'pretty', margin: 0 }}
          >
            Grades, key appearances, creator credits and provenance for{' '}
            {stats ? stats.records.toLocaleString() : '…'} catalogued books. Filter the wall,
            or open a record for the full sheet.
          </p>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 'clamp(16px,2.4vw,36px)',
              alignItems: 'flex-end',
            }}
          >
            {heroStats.map((s) => (
              <div key={s.label} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'clamp(28px,4.4vw,52px)',
                    lineHeight: 0.82,
                    letterSpacing: '-0.05em',
                    fontVariationSettings: "'wght' 620",
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {s.value}
                </span>
                <span
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    color: muted(42),
                  }}
                >
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ticker band */}
      <div
        style={{
          overflow: 'hidden',
          borderBlock: '1px solid var(--color-divider)',
          padding: '9px 0',
          marginBottom: 'clamp(20px,3vw,32px)',
          maskImage: 'linear-gradient(to right,transparent,#000 6%,#000 94%,transparent)',
          WebkitMaskImage: 'linear-gradient(to right,transparent,#000 6%,#000 94%,transparent)',
        }}
      >
        <div className="lb-marquee">
          {[...ticker, ...ticker].map((t, i) => (
            <span
              key={i}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 22,
                paddingRight: 22,
                fontSize: 11,
                letterSpacing: '0.24em',
                textTransform: 'uppercase',
                color: muted(40),
                whiteSpace: 'nowrap',
              }}
            >
              {t}
              <span
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: '50%',
                  background: 'var(--color-accent)',
                }}
              />
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(18px,2.4vw,36px)', alignItems: 'flex-start' }}>
        {/* Filter rail */}
        <aside
          style={{
            flex: '1 1 236px',
            minWidth: 224,
            position: 'sticky',
            top: 70,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <h6
              style={{
                margin: 0,
                fontSize: 20,
                letterSpacing: '-0.03em',
                textTransform: 'none',
                fontVariationSettings: "'wght' 620",
              }}
            >
              Refine
            </h6>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={clearAll}>
              Reset
            </button>
          </div>

          <label
            className="lb-keyonly"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
              padding: '9px 11px',
              borderRadius: 8,
              border: '1px solid var(--color-divider)',
            }}
          >
            <input
              type="checkbox"
              checked={keyOnly}
              onChange={() => set({ keyOnly: !keyOnly })}
              style={{ width: 15, height: 15, margin: 0 }}
            />
            <span style={{ fontSize: 13, flex: 1 }}>Key issues only</span>
            <FlagPennant size={14} style={{ color: 'var(--color-accent)' }} />
          </label>

          {facetGroups.map((g) => (
            <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: muted(45),
                  marginBottom: 8,
                }}
              >
                {g.label}
              </div>
              {g.options.map((o) => (
                <button
                  key={o.value}
                  className="lb-facet-row"
                  onClick={() => toggle(g.key, o.value)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 0,
                    padding: '5px 7px',
                    marginLeft: -7,
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      flex: 'none',
                      borderRadius: 3,
                      border: `1px solid ${o.active ? 'var(--color-accent)' : muted(28)}`,
                      background: o.active ? 'var(--color-accent)' : 'transparent',
                    }}
                  />
                  <span style={{ flex: 1, color: o.active ? 'var(--color-accent-200)' : 'inherit' }}>
                    {o.value}
                  </span>
                  <span style={{ fontSize: 11, color: muted(38), fontVariantNumeric: 'tabular-nums' }}>
                    {o.count}
                  </span>
                </button>
              ))}
            </div>
          ))}

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              borderTop: '1px solid var(--color-divider)',
              paddingTop: 16,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: muted(45),
                }}
              >
                Ceiling
              </span>
              <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--color-accent)' }}>
                {capValue == null ? 'No cap' : 'up to ' + money(capValue)}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={priceCap}
              onChange={(e) => set({ priceCap: Number(e.target.value) })}
              style={{ width: '100%' }}
            />
          </div>
        </aside>

        {/* Results */}
        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 12,
              paddingBottom: 14,
              borderBottom: '1px solid var(--color-divider)',
            }}
          >
            <div className="text-muted" style={{ marginRight: 'auto', fontSize: 13 }}>
              {meta
                ? `${meta.total} ${meta.total === 1 ? 'book' : 'books'} of ${meta.collectionTotal}`
                : 'Loading…'}
            </div>
            <div className="seg">
              <label className="seg-opt">
                <input
                  type="radio"
                  name="lb-layout"
                  checked={layout === 'wall'}
                  onChange={() => set({ layout: 'wall' })}
                />
                <GridNine size={14} />
                Wall
              </label>
              <label className="seg-opt">
                <input
                  type="radio"
                  name="lb-layout"
                  checked={layout === 'list'}
                  onChange={() => set({ layout: 'list' })}
                />
                <Rows size={14} />
                Ledger
              </label>
            </div>
            <select
              className="input"
              style={{ width: 'auto', minWidth: 168, height: 34 }}
              value={sort}
              onChange={(e) => set({ sort: e.target.value })}
            >
              {SORT_OPTIONS.map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {chips.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '14px 0 0' }}>
              {chips.map((c, i) => (
                <button key={i} className="tag tag-outline lb-chip" onClick={c.clear}>
                  {c.label}
                  <X size={11} />
                </button>
              ))}
            </div>
          )}

          {layout === 'wall' && data.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill,minmax(172px,1fr))',
                gap: 'clamp(14px,1.6vw,24px)',
                paddingTop: 22,
              }}
            >
              {data.map((c) => (
                <button
                  key={c.id}
                  className="lb-card"
                  onClick={() => openRecord(c.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    background: 'transparent',
                    border: 0,
                    padding: 0,
                    textAlign: 'left',
                    cursor: 'pointer',
                    color: 'inherit',
                    font: 'inherit',
                  }}
                >
                  <CoverPlate rec={c} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-heading)',
                        fontSize: 14,
                        fontVariationSettings: "'wght' 620",
                        lineHeight: 1.1,
                        letterSpacing: '-0.035em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {c.title}
                    </div>
                    <div style={{ fontSize: 11, color: muted(48) }}>
                      {c.publisher}
                      {c.year > 0 ? ` · ${c.year}` : ''}
                      {c.character ? ` · ${c.character}` : ''}
                    </div>
                    {c.price > 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: 'var(--color-accent-300)',
                          fontVariantNumeric: 'tabular-nums',
                          marginTop: 1,
                        }}
                      >
                        {money(c.price)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}

          {layout === 'list' && data.length > 0 && (
            <div style={{ overflowX: 'auto', paddingTop: 14 }}>
              <table className="table" style={{ minWidth: 660 }}>
                <thead>
                  <tr>
                    <th style={{ width: 44 }}></th>
                    <th>Issue</th>
                    <th>Publisher</th>
                    <th>Year</th>
                    <th>Genre</th>
                    <th>Grade</th>
                    <th style={{ textAlign: 'right' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((c) => (
                    <tr key={c.id} onClick={() => openRecord(c.id)} style={{ cursor: 'pointer' }}>
                      <td>
                        <CoverSwatch rec={c} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {c.title}
                          {c.variant ? ` · ${c.variant}` : ''}
                        </div>
                        <div style={{ fontSize: 11, color: muted(45) }}>
                          {c.keyNote || c.character || c.creators}
                        </div>
                      </td>
                      <td className="text-muted">{c.publisher}</td>
                      <td className="text-muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {c.year > 0 ? c.year : '—'}
                      </td>
                      <td className="text-muted">{c.genre}</td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {c.grade > 0 ? c.grade : '—'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          color: 'var(--color-accent-300)',
                        }}
                      >
                        {money(c.price)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {meta && data.length < meta.total && (
            <div style={{ paddingTop: 18, textAlign: 'center' }}>
              <button className="btn btn-secondary" onClick={loadMore}>
                Show more ({data.length} of {meta.total})
              </button>
            </div>
          )}

          {meta && data.length === 0 && (
            <div
              style={{
                padding: '64px 20px 70px',
                textAlign: 'center',
                border: '1px dashed var(--color-divider)',
                borderRadius: 14,
                marginTop: 22,
              }}
            >
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 'clamp(44px,9vw,104px)',
                  lineHeight: 0.82,
                  letterSpacing: '-0.06em',
                  textTransform: 'uppercase',
                  color: 'transparent',
                  WebkitTextStroke: `1.2px ${muted(26)}`,
                }}
              >
                Empty box
              </div>
              <h4 style={{ margin: '16px 0 6px' }}>No books match that pull list</h4>
              <p className="text-muted" style={{ fontSize: 13, margin: '0 0 14px' }}>
                Loosen a filter or clear the search.
              </p>
              <button className="btn btn-primary" onClick={clearAll}>
                Reset filters
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const eyebrow = (color) => ({
  fontSize: 10,
  letterSpacing: '0.26em',
  textTransform: 'uppercase',
  color,
});
