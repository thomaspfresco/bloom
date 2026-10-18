// @ts-check
// Sampling loops shared by harmony and bass: chord progressions and durations.

import { DURATION_SEEDS } from '../../music/scales.js';

const N_CHORD_CLASSES = 8; // token 0 is padding, 1-7 are scale degrees
const N_DURATION_CLASSES = 65; // token 0 is padding, 1-64 are step counts

/**
 * Autoregressively extend `seed` to `length` tokens. Class 0 is masked out and
 * the rest renormalised before sampling, exactly like the original.
 *
 * @param {import('../lstm.js').LstmModel} model
 * @param {number[]} seed @param {number} length @param {number} nClasses
 * @param {import('../../core/random.js').Random} random
 * @returns {number[]}
 */
function extend(model, seed, length, nClasses, random) {
  const generated = [...seed];
  const stepper = model.stepper();
  let last = null;
  for (const token of generated) last = stepper.step(token);

  while (generated.length < length) {
    const probs = /** @type {Float32Array} */ (last);
    const masked = Array.from(probs.subarray(0, nClasses));
    masked[0] = 0;
    const next = random.weighted(masked);
    generated.push(next);
    if (generated.length < length) last = stepper.step(next);
  }
  return generated;
}

/** @param {import('../lstm.js').LstmModel} model @param {number[]} seed @param {number} length @param {import('../../core/random.js').Random} random */
export function generateChordProgression(model, seed, length, random) {
  return extend(model, seed, length, N_CHORD_CLASSES, random);
}

/** @param {import('../lstm.js').LstmModel} model @param {number[]} seed @param {number} length @param {import('../../core/random.js').Random} random */
export function generateDurations(model, seed, length, random) {
  return extend(model, seed, length, N_DURATION_CLASSES, random);
}

/** How many chords a section gets: 4 (50%), 3 (20%), 2 (15%), 5 (15%). @param {import('../../core/random.js').Random} random */
export function pickChordCount(random) {
  const p = random.float();
  if (p < 0.5) return 4;
  if (p < 0.7) return 3;
  if (p < 0.85) return 2;
  return 5;
}

/**
 * Pick one of the seed durations for a chord count: first (50%), second (25%), otherwise a random later one.
 * @param {number} numChords @param {import('../../core/random.js').Random} random
 */
export function pickDurationSeed(numChords, random) {
  const seeds = DURATION_SEEDS[numChords];
  const p = random.float();
  let index;
  if (p < 0.5) index = 0;
  else if (p > 0.5 && p < 0.75) index = 1;
  else index = random.int(2, seeds.length);
  return seeds[index];
}
