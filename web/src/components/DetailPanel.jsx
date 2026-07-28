import { useEffect } from 'react';
import { CaretLeft, CaretRight, PencilSimple, X } from '@phosphor-icons/react';
import { Halftone, Spine } from './CoverPlate.jsx';
import { coverFor, money, muted } from '../lib/cover.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "1992-10-01" / "1992-10" / "1992" → "Oct 1992" / "1992". */
function formatCoverDate(cd) {
  const m = String(cd || '').match(/^(\d{4})(?:-(\d{2}))?/);
  if (!m) return null;
  const month = m[2] ? MONTHS[parseInt(m[2], 10) - 1] : null;
  return month ? `${month} ${m[1]}` : m[1];
}

/** Record detail slide-over: backdrop + right-anchored panel (lb-in). */
export default function DetailPanel({
  sel,
  summary,
  valueLoading,
  position,
  onStep,
  onClose,
  onEdit,
}) {
  // Arrow keys page through the wall; Escape closes. (Hook runs before the
  // early return, per the rules of hooks.)
  useEffect(() => {
    if (!sel) return undefined;
    const onKey = (e) => {
      if (e.target.closest?.('input, textarea, select')) return;
      if (e.key === 'ArrowRight') onStep?.(1);
      else if (e.key === 'ArrowLeft') onStep?.(-1);
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, onStep, onClose]);

  if (!sel) return null;
  const showSynopsis =
    summary && (summary.state === 'loading' || (summary.state === 'done' && summary.text));
  const isEstimate = sel.priceSource === 'ebay-estimate';
  const valueDisplay = valueLoading
    ? 'Checking…'
    : sel.price > 0
      ? (isEstimate ? '≈ ' : '') + money(sel.price)
      : '—';

  const specs = [
    { label: 'Cover date', value: formatCoverDate(sel.coverDate) || (sel.year > 0 ? sel.year : '—') },
    { label: 'Issue', value: '#' + sel.issue },
    { label: 'Grade', value: sel.grade > 0 ? 'CGC ' + Number(sel.grade).toFixed(1) : 'Ungraded' },
    { label: 'Market value', value: valueDisplay },
    { label: 'Era', value: sel.era || '—' },
    { label: 'Genre', value: sel.genre },
  ];
  if (sel.character) specs.splice(2, 0, { label: 'Character', value: sel.character });
  if (sel.variant) specs.push({ label: 'Variant', value: sel.variant });

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
              color: muted(50),
              marginRight: 'auto',
            }}
          >
            Record {sel.ref}
          </span>
          {position && (
            <>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.08em',
                  color: muted(42),
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {position.index.toLocaleString()} / {position.total.toLocaleString()}
              </span>
              <button
                className="btn btn-icon btn-secondary"
                onClick={() => onStep(-1)}
                disabled={!position.hasPrev}
                title="Previous book (←)"
              >
                <CaretLeft size={15} />
              </button>
              <button
                className="btn btn-icon btn-secondary"
                onClick={() => onStep(1)}
                disabled={!position.hasNext}
                title="Next book (→)"
              >
                <CaretRight size={15} />
              </button>
            </>
          )}
          <button className="btn btn-icon btn-secondary" onClick={onClose} title="Close (Esc)">
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '20px 20px 34px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 132,
                flex: 'none',
                aspectRatio: '2/3',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                boxShadow: 'var(--shadow-md)',
                background: coverFor(sel.publisher, sel.year),
              }}
            >
              {sel.image && (
                <div
                  role="img"
                  aria-label={`${sel.title} cover`}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundImage: `url("${sel.image}")`,
                  }}
                />
              )}
              <Halftone />
              <Spine />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: 'var(--color-accent)',
                }}
              >
                {sel.publisher}
                {sel.era ? ` · ${sel.era}` : ''}
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
                {sel.title}
              </h3>
              <div className="text-muted" style={{ fontSize: 13 }}>
                {sel.creators || 'Credits unrecorded'}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 2 }}>
                <span className="tag tag-neutral" style={{ whiteSpace: 'nowrap' }}>
                  {sel.genre}
                </span>
                {sel.grade > 0 && (
                  <span className="tag tag-accent" style={{ whiteSpace: 'nowrap' }}>
                    CGC {Number(sel.grade).toFixed(1)}
                  </span>
                )}
                {sel.variant && (
                  <span className="tag tag-neutral" style={{ whiteSpace: 'nowrap' }}>
                    {sel.variant}
                  </span>
                )}
                {sel.isKey && <span className="tag tag-outline">Key</span>}
              </div>
            </div>
          </div>

          {sel.isKey && (
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
                Key significance
              </div>
              <div style={{ fontSize: 14, lineHeight: 1.5 }}>{sel.keyNote}</div>
            </div>
          )}

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
            {specs.map((s) => (
              <div key={s.label} style={{ background: 'var(--color-surface)', padding: '11px 13px' }}>
                <div
                  style={{
                    fontSize: 9,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: muted(45),
                    marginBottom: 4,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {sel.priceNote && (
            <div style={{ fontSize: 11, color: muted(40), marginTop: -10 }}>
              {sel.priceNote} — asking prices, not sales; set an exact value in the CMS.
            </div>
          )}

          {showSynopsis && (
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
              {summary.state === 'loading' ? (
                <div style={{ fontSize: 13, color: muted(40), fontStyle: 'italic' }}>
                  Looking up this issue…
                </div>
              ) : (
                <div style={{ fontSize: 14, lineHeight: 1.55, textWrap: 'pretty' }}>
                  {summary.text}
                </div>
              )}
            </div>
          )}

          {sel.census && sel.grade > 0 && (
            <div>
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                  color: muted(45),
                  marginBottom: 9,
                }}
              >
                Census by grade
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 74 }}>
                {sel.census.map((b) => (
                  <div
                    key={b.grade}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        borderRadius: '3px 3px 0 0',
                        background: b.isRecordGrade
                          ? 'var(--color-accent)'
                          : 'var(--color-accent-800)',
                        height: b.height,
                      }}
                    />
                    <span style={{ fontSize: 9, color: muted(40) }}>{b.grade.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 2 }}>
            <button className="btn btn-primary" onClick={() => onEdit(sel)}>
              <PencilSimple size={14} />
              Edit in CMS
            </button>
            <button className="btn btn-secondary" onClick={onClose}>
              Back to wall
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
