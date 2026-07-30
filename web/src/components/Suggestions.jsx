import { useEffect, useState } from 'react';
import {
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  FlagPennant,
  Storefront,
  X,
} from '@phosphor-icons/react';
import { Halftone, Spine } from './CoverPlate.jsx';
import { api } from '../api.js';
import { coverFor, formatCoverDate, money, muted } from '../lib/cover.js';

const clamp2 = {
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

/**
 * Acquisition targets — the catalog's closing section. Suggests missing
 * issues inside runs the collection already commits to (and missing #1
 * openers), each with dynamically-fetched cover art, a labeled eBay-median
 * value estimate, and purchase links. Cards mirror the wall's cover-plate
 * module and open a prospect drawer with the same slide-over behavior.
 */
export default function Suggestions() {
  const [data, setData] = useState(null);
  const [selIndex, setSelIndex] = useState(null);

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

  const list = data?.suggestions ?? [];
  const sel = selIndex != null ? list[selIndex] : null;

  // Same keyboard behavior as the record drawer: arrows step, Esc closes.
  useEffect(() => {
    if (!sel) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') setSelIndex((i) => Math.min(list.length - 1, i + 1));
      else if (e.key === 'ArrowLeft') setSelIndex((i) => Math.max(0, i - 1));
      else if (e.key === 'Escape') setSelIndex(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, list.length]);

  if (!list.length) return null;

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
        <span
          style={{
            fontSize: 10,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: muted(38),
          }}
        >
          {list.length} prospects
        </span>
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
          gridTemplateColumns: 'repeat(auto-fill,minmax(172px,1fr))',
          gap: 'clamp(14px,1.6vw,24px)',
        }}
      >
        {list.map((s, i) => (
          <button
            key={`${s.series}#${s.issue}`}
            className="lb-card"
            onClick={() => setSelIndex(i)}
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
            <ProspectPlate s={s} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, width: '100%' }}>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 14,
                  fontVariationSettings: "'wght' 620",
                  lineHeight: 1.1,
                  letterSpacing: '-0.035em',
                  textTransform: 'uppercase',
                  minHeight: 31,
                  ...clamp2,
                }}
              >
                {s.series} #{s.issue}
              </div>
              <div style={{ fontSize: 11, color: muted(48), lineHeight: 1.35, minHeight: 30, ...clamp2 }}>
                {s.reason}
              </div>
              <div
                style={{
                  fontSize: 12,
                  fontVariantNumeric: 'tabular-nums',
                  marginTop: 1,
                  color: s.estPrice > 0 ? 'var(--color-accent-300)' : muted(38),
                }}
              >
                {s.estPrice > 0 ? `~${money(s.estPrice)}` : s.valueChecked ? 'no est.' : 'est. pending'}
              </div>
            </div>
          </button>
        ))}
      </div>

      {sel && (
        <ProspectDrawer
          s={sel}
          index={selIndex}
          total={list.length}
          onStep={(dir) => setSelIndex((i) => Math.min(list.length - 1, Math.max(0, i + dir)))}
          onClose={() => setSelIndex(null)}
        />
      )}
    </section>
  );
}

/** 2:3 plate matching the wall's cover module — real scan or generated. */
function ProspectPlate({ s, width }) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '2/3',
        width: width || '100%',
        flex: width ? 'none' : undefined,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        background: coverFor(s.publisher, 0),
      }}
    >
      {s.image ? (
        <div
          role="img"
          aria-label={`${s.series} #${s.issue} cover`}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundImage: `url("${s.image}")`,
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '12px 11px',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 8,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              opacity: 0.72,
            }}
          >
            {s.publisher}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 46,
              fontVariationSettings: "'wght' 300",
              lineHeight: 0.72,
              letterSpacing: '-0.07em',
              color: 'transparent',
              WebkitTextStroke: '1.1px rgba(233,233,237,.85)',
            }}
          >
            #{s.issue}
          </span>
        </div>
      )}
      <Halftone />
      <Spine />
      {/* Wanted badge — mirrors the wall's key-issue badge position */}
      <div
        style={{
          position: 'absolute',
          right: 8,
          top: 8,
          width: 22,
          height: 22,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          background: 'color-mix(in srgb,#161826 70%,transparent)',
          border: '1px dashed var(--color-accent)',
          backdropFilter: 'blur(4px)',
        }}
        title="Not in collection"
      >
        <FlagPennant size={11} style={{ color: 'var(--color-accent-300)' }} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: '34%',
          background: 'linear-gradient(transparent,rgba(0,0,0,.5))',
          pointerEvents: 'none',
        }}
      />
      {s.estPrice > 0 && (
        <div
          style={{
            position: 'absolute',
            right: 8,
            bottom: 8,
            whiteSpace: 'nowrap',
            fontSize: 10,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '0.06em',
            color: 'var(--color-accent-200)',
            background: 'color-mix(in srgb,#161826 62%,transparent)',
            padding: '1px 6px',
            borderRadius: 4,
          }}
        >
          ~{money(s.estPrice)}
        </div>
      )}
    </div>
  );
}

/** Prospect slide-over — same shell and behavior as the record drawer. */
function ProspectDrawer({ s, index, total, onStep, onClose }) {
  const specs = [
    { label: 'Est. value', value: s.estPrice > 0 ? '~' + money(s.estPrice) : '—' },
    { label: 'Issue', value: '#' + s.issue },
    { label: 'Publisher', value: s.publisher },
    { label: 'Cover date', value: formatCoverDate(s.coverDate) || '—' },
  ];
  if (s.character) specs.splice(2, 0, { label: 'Character', value: s.character });

  return (
    <>
      <div
        className="lb-backdrop"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          background: 'color-mix(in srgb,#0c0d16 62%,transparent)',
          backdropFilter: 'blur(3px)',
        }}
      />
      <aside
        className="lb-panel"
        style={{
          position: 'fixed',
          zIndex: 61,
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(470px,100%)',
          overflowY: 'auto',
          background: 'var(--color-surface)',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            position: 'sticky',
            top: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 16px',
            background: 'color-mix(in srgb,#232532 90%,transparent)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid var(--color-divider)',
          }}
        >
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-accent-300)',
              marginRight: 'auto',
            }}
          >
            Prospect · not in collection
          </span>
          <span
            style={{
              fontSize: 10,
              letterSpacing: '0.08em',
              color: muted(42),
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {index + 1} / {total}
          </span>
          <button
            className="btn btn-icon btn-secondary"
            onClick={() => onStep(-1)}
            disabled={index <= 0}
            title="Previous prospect (←)"
          >
            <CaretLeft size={15} />
          </button>
          <button
            className="btn btn-icon btn-secondary"
            onClick={() => onStep(1)}
            disabled={index >= total - 1}
            title="Next prospect (→)"
          >
            <CaretRight size={15} />
          </button>
          <button className="btn btn-icon btn-secondary" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 20px 34px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <ProspectPlate s={s} width={132} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-accent)',
                }}
              >
                {s.publisher}
              </div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'clamp(24px,4.6vw,34px)',
                  letterSpacing: '-0.045em',
                  lineHeight: 0.92,
                  textTransform: 'uppercase',
                  fontVariationSettings: "'wght' 700",
                  textWrap: 'balance',
                }}
              >
                {s.series} #{s.issue}
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                <span className="tag tag-outline" style={{ whiteSpace: 'nowrap' }}>
                  Wanted
                </span>
                {s.character && (
                  <span className="tag tag-neutral" style={{ whiteSpace: 'nowrap' }}>
                    {s.character}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '13px 15px',
              borderRadius: 10,
              background: 'color-mix(in srgb,var(--color-accent) 11%, transparent)',
              borderLeft: '2px solid var(--color-accent)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'var(--color-accent-300)',
                marginBottom: 5,
              }}
            >
              Why it's suggested
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>{s.reason}</div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))',
              gap: 1,
              background: 'var(--color-divider)',
              borderRadius: 10,
              overflow: 'hidden',
            }}
          >
            {specs.map((sp) => (
              <div key={sp.label} style={{ background: 'var(--color-surface)', padding: '11px 13px' }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: muted(45),
                    marginBottom: 4,
                  }}
                >
                  {sp.label}
                </div>
                <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{sp.value}</div>
              </div>
            ))}
          </div>

          {s.estNote && (
            <div style={{ fontSize: 11, color: muted(42) }}>{s.estNote}</div>
          )}

          {s.summary && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: muted(45),
                  marginBottom: 7,
                }}
              >
                Synopsis
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.55, textWrap: 'pretty' }}>{s.summary}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
            <a
              className="btn btn-primary"
              href={s.ebayUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ArrowSquareOut size={14} />
              Find on eBay
            </a>
            <a
              className="btn btn-secondary"
              href={s.midtownUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Storefront size={14} />
              Midtown Comics
            </a>
            <button className="btn btn-secondary" onClick={onClose} style={{ marginLeft: 'auto' }}>
              Back to wall
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
