/**
 * Domain rules ported verbatim from the Longbox Archive design handoff
 * (design_handoff_longbox_archive/README.md + prototype logic).
 */

export const GENRES = [
  'Superhero',
  'Crime',
  'Horror',
  'Sci-Fi',
  'Fantasy',
  'Indie',
  'War',
  'Social',
];

export const ERAS = [
  'Golden Age',
  'Silver Age',
  'Bronze Age',
  'Modern Age',
  'Contemporary',
];

/** Inclusive year ranges for each era (mirrors the prototype's eraFor). */
export const ERA_RANGES = {
  'Golden Age': { min: null, max: 1955 },
  'Silver Age': { min: 1956, max: 1970 },
  'Bronze Age': { min: 1971, max: 1985 },
  'Modern Age': { min: 1986, max: 1999 },
  Contemporary: { min: 2000, max: null },
};

export function eraFor(year) {
  if (year < 1956) return 'Golden Age';
  if (year < 1971) return 'Silver Age';
  if (year < 1986) return 'Bronze Age';
  if (year < 2000) return 'Modern Age';
  return 'Contemporary';
}

export const SORTS = [
  'year-asc',
  'year-desc',
  'value-desc',
  'grade-desc',
  'title-asc',
  'added-desc',
];

export const DEFAULT_SORT = 'value-desc';

/**
 * The catalog's value-ceiling slider: 0–100 mapped logarithmically to
 * 10^(1 + p/100 * 5.6) dollars; 100 means "no cap".
 * Returns null when uncapped.
 */
export function priceCapValue(p) {
  const n = Number(p);
  if (!Number.isFinite(n) || n >= 100) return null;
  const clamped = Math.max(0, n);
  return Math.round(10 ** (1 + (clamped / 100) * 5.6));
}

/**
 * Stable public record reference ("RECORD LB-#####" in the slide-over),
 * same hash the prototype uses.
 */
export function recordRef(id) {
  const h = String(id)
    .split('')
    .reduce((a, ch) => a * 7 + ch.charCodeAt(0), 11);
  return 'LB-' + String(Math.abs(h) % 100000).padStart(5, '0');
}

/**
 * Illustrative census-by-grade distribution for the record detail panel:
 * 8 bars, height max(8, round(70 * exp(-dist^2 * 1.1))) px.
 * Swap for real census data when a census source is integrated.
 */
export const CENSUS_GRADES = [9.8, 9.6, 9.4, 9.2, 9.0, 8.5, 8.0, 6.0];

export function censusFor(grade) {
  return CENSUS_GRADES.map((g) => {
    const dist = Math.abs(g - grade);
    return {
      grade: g,
      height: Math.max(8, Math.round(70 * Math.exp(-dist * dist * 1.1))),
      isRecordGrade: dist < 0.05,
    };
  });
}
