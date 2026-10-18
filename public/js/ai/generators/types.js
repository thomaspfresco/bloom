// @ts-check

/**
 * @typedef {object} GenNote
 * @property {number} pitch
 * @property {number} octave
 * @property {number} start
 * @property {number} duration
 */

/**
 * What the generators know about the rest of the loop: kind -> ordered notes.
 * Order matters (the harmony/bass logic walks notes in insertion order).
 * @typedef {Partial<Record<import('../../music/trackKinds.js').TrackKind, GenNote[]>>} LoopContext
 */

/**
 * One generated suggestion.
 * @typedef {object} Candidate
 * @property {string} label       e.g. "C major"
 * @property {GenNote[]} notes
 */

/**
 * Dependencies shared by every generator.
 * @typedef {object} GenDeps
 * @property {import('../ModelStore.js').ModelStore} models
 * @property {import('../../core/random.js').Random} random
 */

export {};
