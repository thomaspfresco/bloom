// @ts-check
// Static description of the four track kinds (colour, petal mesh, pitch range, ...).

import { PALETTE } from '../core/color.js';
import { DRUM_LABELS } from './theory.js';

/** @typedef {'MELODY' | 'HARMONY' | 'BASS' | 'DRUMS'} TrackKind */
/** @typedef {import('../core/color.js').RGB} RGB */

/**
 * @typedef {object} TrackKindInfo
 * @property {TrackKind} kind
 * @property {RGB} color
 * @property {number} petal        index into the petal mesh list (0-3)
 * @property {boolean} isDrums
 * @property {number} nPitches     rows in the grid (24 = two octaves, 7 drum parts)
 * @property {number} defaultOctaveWindow  initial octave-scroll value
 * @property {number} defaultPreset
 * @property {boolean} canGenerate  AI suggestion available (melody generation was never implemented)
 */

/** @type {Readonly<Record<TrackKind, TrackKindInfo>>} */
export const TRACK_KINDS = Object.freeze({
  MELODY: { kind: 'MELODY', color: PALETTE.green, petal: 2, isDrums: false, nPitches: 24, defaultOctaveWindow: 3, defaultPreset: 0, canGenerate: false },
  HARMONY: { kind: 'HARMONY', color: PALETTE.yellow, petal: 3, isDrums: false, nPitches: 24, defaultOctaveWindow: 3, defaultPreset: 5, canGenerate: true },
  BASS: { kind: 'BASS', color: PALETTE.blue, petal: 0, isDrums: false, nPitches: 24, defaultOctaveWindow: 3, defaultPreset: 3, canGenerate: true },
  DRUMS: { kind: 'DRUMS', color: PALETTE.pink, petal: 1, isDrums: true, nPitches: DRUM_LABELS.length, defaultOctaveWindow: 0, defaultPreset: 0, canGenerate: true },
});

/** Order shown in the "+" menu. */
export const TRACK_KIND_ORDER = /** @type {readonly TrackKind[]} */ (['MELODY', 'HARMONY', 'DRUMS', 'BASS']);

/** @param {string} kind @returns {kind is TrackKind} */
export function isTrackKind(kind) {
  return Object.prototype.hasOwnProperty.call(TRACK_KINDS, kind);
}
