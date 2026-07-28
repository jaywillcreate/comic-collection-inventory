/**
 * Cover-plate ground + display formatting, ported from the design handoff.
 * The gradient is presentational: a per-publisher OKLCH hue, aged by year —
 * older books read warmer and heavier, newer ones cooler and flatter.
 */

const HUES = {
  'DC Comics': 262,
  Marvel: 292,
  Timely: 232,
  Image: 318,
  Mirage: 196,
  Vertigo: 276,
  'Aardvark-Vanaheim': 340,
};

export function hueFor(pub) {
  if (HUES[pub] != null) return HUES[pub];
  let h = 0;
  for (let i = 0; i < pub.length; i++) h = (h * 31 + pub.charCodeAt(i)) % 360;
  return 190 + (h % 160);
}

export function coverFor(pub, year) {
  const h = hueFor(pub);
  const t = Math.max(0, Math.min(1, (year - 1938) / 84));
  const c = 0.135 - t * 0.045;
  return (
    `linear-gradient(155deg, oklch(${(0.44 - t * 0.06).toFixed(3)} ${c.toFixed(3)} ${h}) 0%, ` +
    `oklch(0.27 ${(c * 0.7).toFixed(3)} ${h + 16}) 58%, ` +
    `oklch(0.165 0.045 ${h + 28}) 100%)`
  );
}

/** Abbreviated display money — catalog surfaces ($3.2M, $42K, $480). */
export function money(n) {
  if (!n && n !== 0) return '—';
  if (n >= 1000000) return '$' + (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + 'M';
  if (n >= 1000) return '$' + Math.round(n / 1000) + 'K';
  return '$' + n;
}

/** Exact currency — comps always show the full figure ($1,200, never $1.2K). */
export function exact(n) {
  return '$' + Math.round(n || 0).toLocaleString('en-US');
}

export function median(list) {
  if (!list.length) return 0;
  const s = list.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return Math.round(s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2);
}

/** Value-lookup query auto-fill: `Series #Issue CGC Grade`. */
export function compQ(f) {
  return [f.series, f.issue && '#' + f.issue, f.grade && 'CGC ' + f.grade]
    .filter(Boolean)
    .join(' ');
}

/** Cover-lookup query auto-fill: `Series #Issue Publisher cover`. */
export function coverQ(f) {
  return [f.series, f.issue && '#' + f.issue, f.publisher, 'cover']
    .filter(Boolean)
    .join(' ');
}

/** The value-ceiling slider curve, mirrored from the server for the label. */
export function priceCapValue(p) {
  if (p >= 100) return null;
  return Math.round(10 ** (1 + (p / 100) * 5.6));
}

export const muted = (pct) => `color-mix(in srgb, var(--color-text) ${pct}%, transparent)`;
