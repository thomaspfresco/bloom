// @ts-check
// Port of generateDrums from the old musicGeneration.py.
//
// A drum model predicts, for each 16th step, the probability that each of 6
// parts (kick, snare, closed hat, open hat, high tom, low tom) plays, given the
// previous steps. Each step is sampled as independent Bernoulli draws.

import { N_STEPS } from '../../core/constants.js';

const N_PARTS = 6;
const CRASH = 6;
const BAR_STEPS = 32;
const BREAK_STEPS = 16;

/** Opening hits (one column of 6 parts) the models are primed with. Index = original dict key. */
const SEEDS = Object.freeze(
  /** @type {Record<number, number[]>} */ ({
    1: [1, 0, 0, 0, 0, 0], 2: [1, 0, 0, 1, 0, 0], 3: [1, 0, 1, 0, 0, 0], 4: [1, 0, 0, 0, 1, 0],
    5: [1, 0, 0, 0, 0, 1], 6: [1, 0, 0, 1, 0, 0], 7: [1, 0, 1, 0, 0, 0], 8: [1, 0, 0, 1, 1, 0],
    9: [1, 0, 1, 0, 1, 0], 10: [1, 0, 0, 1, 0, 1], 11: [1, 0, 1, 0, 0, 1], 12: [1, 1, 0, 0, 0, 0],
    13: [0, 0, 0, 0, 1, 0], 14: [0, 0, 0, 0, 0, 1], 15: [0, 0, 0, 1, 0, 0], 16: [0, 0, 1, 0, 0, 0],
    17: [0, 0, 0, 1, 1, 0], 18: [0, 0, 1, 0, 1, 0], 19: [0, 0, 0, 1, 0, 1], 20: [0, 0, 1, 0, 0, 1],
    21: [0, 1, 0, 0, 0, 0],
  }),
);

/**
 * Sample `length` steps from a drum model.
 * @param {import('../lstm.js').LstmModel} model @param {number[]} seed first column
 * @param {number} length
 * @param {import('../../core/random.js').Random} random
 * @returns {number[][]} columns[step][part] of 0/1
 */
function sampleRhythm(model, seed, length, random) {
  const columns = [seed.slice()];
  const stepper = model.stepper();
  let probs = stepper.step(Float32Array.from(seed));
  while (columns.length < length) {
    const col = Array.from(probs, (p) => (random.float() < p ? 1 : 0));
    columns.push(col);
    if (columns.length < length) probs = stepper.step(Float32Array.from(col));
  }
  return columns;
}

/**
 * One drum suggestion: two repeats of a 32-step pattern, optionally with a
 * 16-step "break" replacing the second half of the repeat.
 *
 * @param {import('./types.js').GenDeps} deps
 * @returns {Promise<import('./types.js').Candidate>}
 */
export async function generateDrums({ models, random }) {
  const style = random.int(1, 5); // drums1..drums4
  const base = sampleRhythm(await models.get(`drums${style}`), SEEDS[random.int(1, 4)], BAR_STEPS, random);

  /** @type {number[][] | null} */
  let fill = null;
  if (random.float() > 0.6 && style !== 1 && style !== 3) {
    fill = sampleRhythm(await models.get('brakes'), SEEDS[random.int(4, 22)], BREAK_STEPS, random);
  }

  /** @type {import('./types.js').GenNote[]} */
  const notes = [];
  const hit = (/** @type {number} */ pitch, /** @type {number} */ start) => notes.push({ pitch, octave: 0, start, duration: 1 });

  for (let repeat = 0; repeat < 2; repeat++) {
    const offset = repeat * BAR_STEPS;
    if (repeat === 1 && fill) {
      for (let s = 0; s < BREAK_STEPS; s++) base[BREAK_STEPS + s] = fill[s];
      hit(CRASH, 0); // the original places this crash at step 0
    }
    for (let part = 0; part < N_PARTS; part++) {
      for (let step = 0; step < BAR_STEPS; step++) {
        if (base[step][part] === 1) hit(part, step + offset);
      }
    }
  }

  if (random.float() > 0.5) hit(CRASH, 0);

  // a crash can be requested twice for step 0: keep one
  const seen = new Set();
  const unique = notes.filter((n) => {
    const key = `${n.pitch}:${n.start}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return n.start < N_STEPS;
  });
  return { label: 'C major', notes: unique };
}
