// @ts-check
// Global limits and fixed numbers. Ported from the module-level `let`s in the
// old compose.js (nSteps, maxTracks, ...). Keep this file free of imports.

/** Steps (16th notes) per loop: four bars of 4/4. */
export const N_STEPS = 64;
export const STEPS_PER_BEAT = 4;

export const MAX_TRACKS = 4;
export const MAX_LOOPS = 50;
export const MAX_STRUCTS = 10;
export const MAX_TABS = 4;
export const MAX_LOOPS_PER_STRUCT = 5;
export const MAX_REPEATS = 8;
export const MAX_NAME_LENGTH = 15;

export const TEMPO = Object.freeze({ min: 20, max: 400, default: 120, step: 1, fastStep: 5 });
export const TRANSPOSE = Object.freeze({ min: -11, max: 11 });

/** Keyboard octave range for computer-keyboard / MIDI input. */
export const KEY_OCTAVE = Object.freeze({ min: 0, max: 8, default: 3 });
export const MAX_INPUT_NOTES = 5;

/** Increments the session version when the persisted shape changes. */
export const SESSION_VERSION = 1;
export const STORAGE_KEY = 'bloom.session';
export const SAVE_DEBOUNCE_MS = 5000;
