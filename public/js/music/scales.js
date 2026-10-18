// @ts-check
// Scale / chord tables used by the generators. Ported verbatim from the old
// bloomServer/musicGeneration.py (index = tonic pitch class, 0 = C).

export const KEY_NAMES = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

/** Seed durations (in steps) for the duration models, keyed by chord count. */
export const DURATION_SEEDS = Object.freeze(
  /** @type {Record<number, readonly number[]>} */ ({
    2: [32, 16, 40, 24, 8, 56, 54, 50, 14, 4, 60, 30, 34],
    3: [16, 24, 20, 16, 14, 32],
    4: [16, 32, 8, 24, 14],
    5: [16, 8, 4, 12, 32, 14],
  }),
);

/** @type {readonly (readonly number[])[]} */
export const MAJOR_SCALES = Object.freeze([
  [0, 2, 4, 5, 7, 9, 11],
  [1, 3, 5, 6, 8, 10, 0],
  [2, 4, 6, 7, 9, 11, 1],
  [3, 5, 7, 8, 10, 0, 2],
  [4, 6, 8, 9, 11, 1, 3],
  [5, 7, 9, 10, 0, 2, 4],
  [6, 8, 10, 11, 1, 3, 5],
  [7, 9, 11, 0, 2, 4, 6],
  [8, 10, 0, 1, 3, 5, 7],
  [9, 11, 1, 2, 4, 6, 8],
  [10, 0, 2, 3, 5, 7, 9],
  [11, 1, 3, 4, 6, 8, 10],
]);

/** @type {readonly (readonly number[])[]} */
export const MINOR_SCALES = Object.freeze([
  [0, 2, 3, 5, 7, 8, 10],
  [1, 3, 4, 6, 8, 9, 11],
  [2, 4, 5, 7, 9, 10, 0],
  [3, 5, 6, 8, 10, 11, 1],
  [4, 6, 7, 9, 11, 0, 2],
  [5, 7, 8, 10, 0, 1, 3],
  [6, 8, 9, 11, 1, 2, 4],
  [7, 9, 10, 0, 2, 3, 5],
  [8, 10, 11, 1, 3, 4, 6],
  [9, 11, 0, 2, 4, 5, 7],
  [10, 0, 1, 3, 5, 6, 8],
  [11, 1, 2, 4, 6, 7, 9],
]);

/** Chord quality per scale degree (1-based) in a major key. */
export const MAJOR_CHORD_TYPES = Object.freeze(
  /** @type {Record<number, 'maj'|'min'|'dim'>} */ ({ 1: 'maj', 2: 'min', 3: 'min', 4: 'maj', 5: 'maj', 6: 'min', 7: 'dim' }),
);

/** Chord quality per scale degree (1-based) in a minor key (kept for parity; unused by the active code path). */
export const MINOR_CHORD_TYPES = Object.freeze(
  /** @type {Record<number, 'maj'|'min'|'dim'>} */ ({ 1: 'min', 2: 'dim', 3: 'maj', 4: 'min', 5: 'min', 6: 'maj', 7: 'maj' }),
);

/**
 * Chord tones for a scale degree.
 * @param {number} key tonic pitch class
 * @param {number} degree 1-7
 * @param {0|1|2} modifier 0 = triad, 1 = add 7th (if in key), 2 = root+5th only
 * @returns {number[]}
 */
export function getChordNotes(key, degree, modifier) {
  const type = MAJOR_CHORD_TYPES[degree];
  const root = MAJOR_SCALES[key][degree - 1];
  const inKey = (/** @type {number} */ n) => MAJOR_SCALES[key].includes(n);

  if (type === 'maj') {
    const s = MAJOR_SCALES[root];
    if (modifier === 1) return inKey(s[6]) ? [s[0], s[2], s[4], s[6]] : [s[0], s[2], s[4]];
    if (modifier === 2) return [s[0], s[4]];
    return [s[0], s[2], s[4]];
  }
  if (type === 'min') {
    const s = MINOR_SCALES[root];
    if (modifier === 1) return inKey(s[6]) ? [s[0], s[2], s[4], s[6]] : [s[0], s[2], s[4]];
    if (modifier === 2) return [s[0], s[4]];
    return [s[0], s[2], s[4]];
  }
  // diminished: root, flat 3rd, flat 5th (derived from the major scale on the root)
  const s = MAJOR_SCALES[root];
  const flat3 = s[2] - 1 < 0 ? 11 : s[2] - 1;
  const flat5 = s[4] - 1 < 0 ? 11 : s[4] - 1;
  return [s[0], flat3, flat5];
}
