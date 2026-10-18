// @ts-check
// Entry point for AI suggestions. Replaces the old POST /generate round trip.

import { N_STEPS } from '../core/constants.js';
import { Random } from '../core/random.js';
import { TRACK_KINDS } from '../music/trackKinds.js';
import { ModelStore } from './ModelStore.js';
import { generateBass } from './generators/bass.js';
import { generateDrums } from './generators/drums.js';
import { generateHarmony } from './generators/harmony.js';

/** @typedef {import('../music/trackKinds.js').TrackKind} TrackKind */
/** @typedef {import('./generators/types.js').Candidate} Candidate */
/** @typedef {import('./generators/types.js').LoopContext} LoopContext */

/** Number of alternatives offered per request (the 2x2 grid in the generate menu). */
export const N_SUGGESTIONS = 4;

/** Model files each kind needs, for background preloading. */
const MODELS_FOR = {
  HARMONY: ['harmonyAndBass', 'durations2', 'durations3', 'durations4', 'durations5'],
  BASS: ['harmonyAndBass', 'durations2', 'durations3', 'durations4', 'durations5'],
  DRUMS: ['drums1', 'drums2', 'drums3', 'drums4', 'brakes'],
  MELODY: /** @type {string[]} */ ([]),
};

/** Keep every note inside the 64-step loop (the models can overshoot). @param {Candidate} c */
function fitToLoop(c) {
  const notes = c.notes
    .filter((n) => n.start >= 0 && n.start < N_STEPS && n.duration > 0)
    .map((n) => ({ ...n, duration: Math.min(n.duration, N_STEPS - n.start) }));
  return { ...c, notes };
}

export class Generator {
  /** @param {{models?: ModelStore, random?: Random}} [opts] */
  constructor({ models = new ModelStore(), random = Random.shared } = {}) {
    this.models = models;
    this.random = random;
  }

  /** @param {TrackKind} kind */
  canGenerate(kind) { return TRACK_KINDS[kind].canGenerate; }

  /** Warm the model cache so the first suggestion is instant. @param {TrackKind} kind */
  preload(kind) { this.models.preload(MODELS_FOR[kind]); }

  /**
   * Generate four alternatives for a new track of `kind`.
   * @param {TrackKind} kind @param {LoopContext} context notes already in the loop
   * @returns {Promise<Candidate[]>}
   */
  async suggest(kind, context) {
    if (!this.canGenerate(kind)) throw new Error(`AI suggestions are not available for ${kind}.`);
    const deps = { models: this.models, random: this.random };

    // Sequential on purpose: each suggestion draws from the shared random
    // stream, so awaiting one at a time keeps seeded runs reproducible.
    /** @type {Candidate[]} */
    const out = [];
    for (let i = 0; i < N_SUGGESTIONS; i++) {
      if (kind === 'DRUMS') out.push(await generateDrums(deps));
      else if (kind === 'BASS') out.push(await generateBass(deps, context));
      else {
        // first two harmonies are full triads; the others sometimes become open fifths
        const neutral = i > 1 && this.random.float() > 0.8;
        out.push(await generateHarmony(deps, context, neutral));
      }
    }
    return out.map(fitToLoop);
  }
}
