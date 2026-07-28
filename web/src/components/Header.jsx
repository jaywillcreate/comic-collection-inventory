import { MagnifyingGlass, SquaresFour, SlidersHorizontal } from '@phosphor-icons/react';
import { muted } from '../lib/cover.js';

export default function Header({ view, setView, q, setQ, settings }) {
  const title = settings?.siteTitle || 'LONGBOX';
  const tagline = settings?.siteTagline || 'Archive & Index';
  const logoUrl = settings?.logoUrl || '';
  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 40,
        background: 'color-mix(in srgb, #161826 84%, transparent)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid var(--color-divider)',
      }}
    >
      <div
        style={{
          maxWidth: 1580,
          margin: '0 auto',
          padding: '9px clamp(14px,3vw,34px)',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 'auto' }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              style={{
                width: 24,
                height: 32,
                borderRadius: 3,
                objectFit: 'cover',
                boxShadow: '0 0 0 1px #3f424d',
              }}
            />
          ) : (
            <div
              style={{
                width: 24,
                height: 32,
                borderRadius: 3,
                background: 'linear-gradient(160deg,#968ae0,#423a6a 60%,#232532)',
                boxShadow: 'inset 3px 0 0 rgba(0,0,0,.45), 0 0 0 1px #3f424d',
              }}
            />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
            <span
              style={{
                fontFamily: 'var(--font-heading)',
                fontWeight: 600,
                fontSize: 16,
                letterSpacing: '-0.01em',
                textTransform: 'uppercase',
              }}
            >
              {title}
            </span>
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: muted(45),
                marginTop: 3,
              }}
            >
              {tagline}
            </span>
          </div>
        </div>

        <label style={{ position: 'relative', flex: '1 1 300px', maxWidth: 520, display: 'block' }}>
          <MagnifyingGlass
            size={15}
            style={{
              position: 'absolute',
              left: 11,
              top: '50%',
              transform: 'translateY(-50%)',
              color: muted(45),
              pointerEvents: 'none',
            }}
          />
          <input
            className="input"
            type="search"
            placeholder="Search title, creator, character, key note…"
            style={{ paddingLeft: 32, height: 38 }}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>

        <div className="seg" role="tablist">
          <label className="seg-opt">
            <input
              type="radio"
              name="lb-view"
              checked={view === 'catalog'}
              onChange={() => setView('catalog')}
            />
            <SquaresFour size={14} />
            Catalog
          </label>
          <label className="seg-opt">
            <input
              type="radio"
              name="lb-view"
              checked={view === 'admin'}
              onChange={() => setView('admin')}
            />
            <SlidersHorizontal size={14} />
            CMS
          </label>
        </div>
      </div>
    </header>
  );
}
