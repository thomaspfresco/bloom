// @ts-check
// Pitch tables and note helpers. Ported from the old Compose/theory.js.

/** Frequencies of C0..C1 (Hz). Octave `n` multiplies by 2^n. */
export const FREQS = Object.freeze([
  16.35, 17.32, 18.35, 19.45, 20.6, 21.83, 23.12, 24.5, 25.96, 27.5, 29.14, 30.87, 32.7,
]);

/** Labels of the 8 octave windows shown in the grid (each spans two octaves). */
export const OCTAVE_LABELS = Object.freeze([
  'C0-B1', 'C1-B2', 'C2-B3', 'C3-B4', 'C4-B5', 'C5-B6', 'C6-B7', 'C7-B8',
]);

export const NOTE_LABELS = Object.freeze(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']);

/** Drum parts, in sample / pitch-index order. */
export const DRUM_LABELS = Object.freeze([
  'KICK', 'SNARE', 'CLOSED HAT', 'OPENED HAT', 'HIGH TOM', 'LOW TOM', 'CRASH',
]);

export const WAVE_TYPES = Object.freeze(['sine', 'triangle', 'square', 'sawtooth']);
export const DELAY_TIMES = Object.freeze(['1/64', '1/32', '1/16', '1/8', '1/4', '1/2']);

/** Computer keyboard -> semitone (one octave, piano layout on the home row). */
const KEY_TO_PITCH = Object.freeze(
  /** @type {Record<string, number>} */ ({
    A: 0, W: 1, S: 2, E: 3, D: 4, F: 5, T: 6, G: 7, Y: 8, H: 9, U: 10, J: 11,
  }),
);

/** @param {string} key single character; returns 0-11 or -1 */
export function keyToPitch(key) {
  const v = KEY_TO_PITCH[key.toUpperCase()];
  return v === undefined ? -1 : v;
}

/**
 * Frequency in Hz of a pitch class (0-11, or 12-23 which is folded) in an octave.
 * @param {number} pitch @param {number} octave
 */
export function noteFrequency(pitch, octave) {
  const p = pitch > 11 ? pitch - 12 : pitch;
  return FREQS[p] * 2 ** octave;
}

/**
 * Shift a note by `semitones`, carrying into the octave.
 * @param {number} pitch 0-11 @param {number} octave @param {number} semitones
 * @returns {{pitch: number, octave: number}}
 */
export function transposeNote(pitch, octave, semitones) {
  let p = (pitch > 11 ? pitch - 12 : pitch) + semitones;
  let o = octave;
  while (p > 11) { p -= 12; o++; }
  while (p < 0) { p += 12; o--; }
  return { pitch: p, octave: o };
}

/** MIDI note number -> {pitch, octave} (octave = floor(midi / 12), as in the old input handler). @param {number} midi */
export function midiToNote(midi) {
  return { pitch: midi % 12, octave: Math.floor(midi / 12) };
}
