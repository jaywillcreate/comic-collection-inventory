import { useEffect, useState } from 'react';
import { ArrowSquareOut, Storefront } from '@phosphor-icons/react';
import { api } from '../api.js';
import { coverFor, money, muted } from '../lib/cover.js';

/**
 * Acquisition targets — the catalog's closing section. Suggests missing
 * issues inside runs the collection already commits to (and missing #1
 * openers), each with a labeled eBay-median value estimate and purchase
 * links, per the collection's "find opportunities to buy" workflow.
 */
export default function Suggestions() {
  const [data, setData] = useState(null);

  useEffect(() => {
    let live = true;
    api
      .suggestions()
      .then((d) => live && setData(d))
      .catch(() => live && setData(null));
    return () => {
      live = false;
    };
  }, []);

  if (!data || !data.suggestions.length) return null;

  return (
    <section style={{ paddingTop: 'clamp(40px,6vw,72px)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 'clamp(12px,1.6vw,18px)',
        }}
      >
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: 'var(--color-accent)',
          }}
        >
          Acquisition targets
        </span>
        <span
          style={{
            flex: 1,
            height: 1,
            background: 'linear-gradient(to right,var(--color-divider),transparent)',
          }}
        />
      </div>

      <h2
        style={{
          margin: '0 0 8px',
          fontSize: 'clamp(28px,4.6vw,54px)',
          lineHeight: 0.85,
          letterSpacing: '-0.05em',
          textTransform: 'uppercase',
          fontVariationSettings: "'wght' 720",
        }}
      >
        Complete{' '}
        <span
          style={{
            color: 'transparent',
            WebkitTextStroke: '1.2px var(--color-accent)',
            fontVariationSettings: "'wght' 300",
          }}
        >
          the runs
        </span>
      </h2>
      <p className="text-muted" style={{ margin: '0 0 18px', fontSize: 14, maxWidth: '62ch' }}>
        Issues missing from series you already collect. Filling a run — especially its #1 —
        is the surest way to lift the set's market value. Estimates are medians of live
        eBay listings, not sold prices; verify before you buy.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(250px,1fr))',
          gap: 12,
        }}
      >
        {data.suggestions.map((s) => (
          <div
            key={`${s.series}#${s.issue}`}
            className="card elev-sm"
            style={{ flexDirection: 'row', gap: 12, padding: '12px 13px', alignItems: 'stretch' }}
          >
            <div
              style={{
                width: 46,
                flex: 'none',
                borderRadius: 4,
                background: coverFor(s.publisher, 0),
                boxShadow: 'inset 2px 0 0 rgba(0,0,0,.5)',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 18,
                  fontVariationSettings: "'wght' 300",
                  letterSpacing: '-0.05em',
                  color: 'transparent',
                  WebkitTextStroke: '1px rgba(233,233,237,.8)',
                }}
              >
                #{s.issue}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 13,
                  fontVariationSettings: "'wght' 620",
                  letterSpacing: '-0.03em',
                  textTransform: 'uppercase',
                  lineHeight: 1.15,
                }}
              >
                {s.series} #{s.issue}
              </div>
              <div style={{ fontSize: 11, color: muted(48), lineHeight: 1.4 }}>{s.reason}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 4, flexWrap: 'wrap' }}>
                <span
                  title={s.estNote || ''}
                  style={{
                    fontSize: 12,
                    fontVariantNumeric: 'tabular-nums',
                    color: s.estPrice > 0 ? 'var(--color-accent-300)' : muted(38),
                  }}
                >
                  {s.estPrice > 0 ? `~${money(s.estPrice)}` : 'est. pending'}
                </span>
                <span style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
                  <a
                    className="btn btn-secondary"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    href={s.ebayUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ArrowSquareOut size={11} />
                    eBay
                  </a>
                  <a
                    className="btn btn-secondary"
                    style={{ fontSize: 11, padding: '3px 8px' }}
                    href={s.midtownUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Storefront size={11} />
                    Midtown
                  </a>
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
