// @ts-check
// Port of generateBass / identifyRoots / addPassingNotes from the old musicGeneration.py.

import { roundHalfEven } from '../../core/math.js';
import { KEY_NAMES, MAJOR_SCALES, MINOR_SCALES, getChordNotes } from '../../music/scales.js';
import { detectKey } from './keyDetection.js';
import { generateChordProgression, generateDurations, pickChordCount, pickDurationSeed } from './sequences.js';

export const BASS_OCTAVE = 2;

/** @param {number[]} a @param {Set<number>} b */
const sameSet = (a, b) => new Set(a).size === b.size && a.every((n) => b.has(n));

/**
 * Find chord roots in an existing harmony track.
 * Notes sharing a start step form one chord; each chord is matched against the
 * major/minor triads and sevenths of all 12 roots (a chord can match several).
 *
 * @param {import('./types.js').LoopContext} ctx
 * @returns {{roots: number[], durations: number[]}}
 */
export function identifyRoots(ctx) {
  /** @type {number[][]} */ const chords = [];
  /** @type {number[]} */ const durations = [];
  /** @type {number[]} */ let chord = [];
  /** @type {number | null} */ let start = null;

  for (const note of ctx.HARMONY ?? []) {
    if (start === null || start !== note.start) {
      if (chord.length) chords.push(chord);
      chord = [note.pitch];
      start = note.start;
      durations.push(note.duration);
    } else {
      chord.push(note.pitch);
    }
  }
  if (chord.length) chords.push(chord);

  /** @type {number[]} */ const roots = [];
  for (const c of chords) {
    for (let root = 0; root < 12; root++) {
      const maj = MAJOR_SCALES[root];
      const min = MINOR_SCALES[root];
      const candidates = [
        [maj[0], maj[2], maj[4]],
        [maj[0], maj[2], maj[4], maj[6]],
        [min[0], min[2], min[4]],
        [min[0], min[2], min[4], min[6]],
      ];
      if (candidates.some((set) => sameSet(c, new Set(set)))) roots.push(root);
    }
  }
  return { roots, durations };
}

/**
 * Split long notes with a fifth as a passing note. The loop bound is fixed at
 * the original length (inserted notes are still visited), as in the original.
 *
 * @param {number[]} line @param {number[]} durations mutated in place
 * @param {import('../../core/random.js').Random} random
 */
export function addPassingNotes(line, durations, random) {
  const factors = [2, 4, 8];
  const n = line.length - 1;
  for (let i = 0; i < n; i++) {
    const p = random.float();
    if (p > 0.5 && durations[i] >= 16) {
      line.splice(i + 1, 0, MAJOR_SCALES[line[i]][4]);
      const passing = roundHalfEven(durations[i] / factors[random.int(0, 3)]);
      durations[i] -= passing;
      durations.splice(i + 1, 0, passing);
    }
  }
}

/**
 * One bass suggestion.
 * @param {import('./types.js').GenDeps} deps
 * @param {import('./types.js').LoopContext} ctx
 * @returns {Promise<import('./types.js').Candidate>}
 */
export async function generateBass({ models, random }, ctx) {
  /** @type {number} */ let key;
  /** @type {number[]} */ let line;
  /** @type {number[]} */ let durations;

  if (!ctx.HARMONY) {
    key = ctx.MELODY ? detectKey(ctx, ['MELODY']) : random.int(0, 12);
    const startChord = random.int(1, 7);
    const numChords = pickChordCount(random);
    const degrees = generateChordProgression(await models.get('harmonyAndBass'), [startChord], numChords, random);
    line = degrees.map((d) => getChordNotes(key, d, 0)[0]);
    const seed = pickDurationSeed(numChords, random);
    durations = generateDurations(await models.get(`durations${numChords}`), [seed], numChords, random);
  } else {
    key = detectKey(ctx, ['HARMONY']);
    const found = identifyRoots(ctx);
    durations = found.durations;
    line = found.roots.map((r) => (random.float() > 0.75 ? MAJOR_SCALES[r][4] : r));
  }

  addPassingNotes(line, durations, random);

  /** @type {import('./types.js').GenNote[]} */
  const notes = [];
  let start = 0;
  line.forEach((pitch, i) => {
    if (i >= durations.length) return;
    notes.push({ pitch, octave: BASS_OCTAVE, start, duration: durations[i] });
    start += durations[i];
  });
  return { label: `${KEY_NAMES[key]} major`, notes };
}
