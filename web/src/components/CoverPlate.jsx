import { FlagPennant } from '@phosphor-icons/react';
import { coverFor } from '../lib/cover.js';

/**
 * The core object of the catalog: a 2:3 cover plate. A real scan fills the
 * plate as a background image; otherwise a generated typographic plate stands
 * in (publisher, year, series, outlined issue number, halftone, spine, sheen).
 * Overlays on every plate: bottom scrim, CGC grade pill, key-issue badge.
 */
export default function CoverPlate({ rec, radius = 8, overlays = true, plate = true }) {
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '2/3',
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: 'var(--shadow-sm)',
        background: coverFor(rec.publisher, rec.year),
      }}
    >
      {rec.image ? (
        <div
          role="img"
          aria-label={`${rec.series} #${rec.issue} cover`}
          style={{
            position: 'absolute',
            inset: 0,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundImage: `url("${rec.image}")`,
          }}
        />
      ) : (
        <>
          {plate && (
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
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 8,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                    opacity: 0.72,
                    lineHeight: 1.3,
                  }}
                >
                  {rec.publisher}
                </span>
                <span style={{ fontSize: 8, letterSpacing: '0.14em', opacity: 0.55 }}>
                  {rec.year > 0 ? rec.year : ''}
                </span>
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontSize: 20,
                  fontVariationSettings: "'wght' 780",
                  lineHeight: 0.9,
                  letterSpacing: '-0.045em',
                  textTransform: 'uppercase',
                  textWrap: 'balance',
                  textShadow: '0 1px 12px rgba(0,0,0,.5)',
                }}
              >
                {rec.series}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: 6,
                  paddingBottom: 20,
                }}
              >
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
                  #{rec.issue}
                </span>
                <span
                  style={{
                    fontSize: 8,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    opacity: 0.5,
                    lineHeight: 1.3,
                    paddingBottom: 3,
                  }}
                >
                  {rec.genre}
                </span>
              </div>
            </div>
          )}
          <Halftone />
          <Spine />
          <div
            style={{
              position: 'absolute',
              left: '-30%',
              top: '38%',
              width: '160%',
              height: '34%',
              background:
                'linear-gradient(90deg,transparent,rgba(255,255,255,.07),transparent)',
              transform: 'rotate(-18deg)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {overlays && (
        <>
          {rec.isKey && (
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
                border: '1px solid var(--color-accent)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <FlagPennant size={11} style={{ color: 'var(--color-accent-300)' }} />
            </div>
          )}
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
          {rec.grade > 0 && (
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
              CGC {Number(rec.grade).toFixed(1)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function Halftone() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        backgroundImage:
          'radial-gradient(rgba(255,255,255,.10) 1px, transparent 1.1px)',
        backgroundSize: '5px 5px',
        mixBlendMode: 'soft-light',
        pointerEvents: 'none',
      }}
    />
  );
}

export function Spine() {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 7,
        background: 'linear-gradient(90deg,rgba(0,0,0,.55),rgba(0,0,0,0))',
        pointerEvents: 'none',
      }}
    />
  );
}

/** Tiny table swatch (26×38 in the ledger, 24×34 in the CMS inventory). */
export function CoverSwatch({ rec, width = 26, height = 38 }) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 3,
        background: rec.image
          ? `url("${rec.image}") center/cover, ${coverFor(rec.publisher, rec.year)}`
          : coverFor(rec.publisher, rec.year),
        boxShadow: 'inset 2px 0 0 rgba(0,0,0,.5)',
      }}
    />
  );
}
