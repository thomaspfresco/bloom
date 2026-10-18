// @ts-check
// Port of generateHarmony / identifyChords from the old musicGeneration.py.

import { KEY_NAMES, MAJOR_SCALES, MINOR_SCALES, getChordNotes } from '../../music/scales.js';
import { detectKey } from './keyDetection.js';
import { generateChordProgression, generateDurations, pickChordCount, pickDurationSeed } from './sequences.js';

export const HARMONY_OCTAVE = 4;

/**
 * Derive chords from an existing bass line.
 * Notes shorter than 8 steps are treated as passing notes whose length is
 * folded into the previous root; two consecutive 8-step notes are sometimes merged.
 *
 * @param {import('./types.js').LoopContext} ctx @param {boolean} neutral drop the third
 * @param {import('../../core/random.js').Random} random
 */
export function identifyChords(ctx, neutral, random) {
  /** @type {number[]} */ const roots = [];
  /** @type {number[]} */ const durations = [];
  /** @type {{pitch: number, duration: number} | null} */
  let previous = null;
  let accumulated = 0;

  for (const { pitch, duration } of ctx.BASS ?? []) {
    if (duration < 8) {
      accumulated += duration;
      continue;
    }
    if (previous === null) {
      previous = { pitch, duration };
      continue;
    }
    const simplify = random.float();
    if (previous.duration === 8 && duration === 8 && simplify < 0.5) {
      roots.push(previous.pitch);
      durations.push(previous.duration * 2 + accumulated);
      accumulated = 0;
      previous = null; // the current note was absorbed
    } else {
      roots.push(previous.pitch);
      durations.push(previous.duration + accumulated);
      accumulated = 0;
      previous = { pitch, duration };
    }
  }
  if (previous !== null) {
    roots.push(previous.pitch);
    durations.push(previous.duration + accumulated);
  }

  const key = detectKey(ctx, ['BASS']);
  const keyScale = MAJOR_SCALES[key];
  const inKey = (/** @type {number[]} */ chord) => chord.every((n) => keyScale.includes(n));

  /** @type {number[][]} */
  const progression = [];
  for (let r of roots) {
    if (random.float() > 0.5) {
      // treat the bass note as the 5th of the chord a fifth below
      const tonic = MAJOR_SCALES.findIndex((scale) => scale[4] === r);
      if (tonic >= 0) r = MAJOR_SCALES[tonic][0];
    }
    let chord = [MAJOR_SCALES[r][0], MAJOR_SCALES[r][2], MAJOR_SCALES[r][4]];
    if (!inKey(chord)) chord = [MINOR_SCALES[r][0], MINOR_SCALES[r][2], MINOR_SCALES[r][4]];
    if (!inKey(chord)) chord = [keyScale[0], keyScale[2], keyScale[4]];
    if (neutral) chord.splice(1, 1);
    progression.push(chord);
  }
  return { key, progression, durations };
}

/**
 * One harmony suggestion.
 * @param {import('./types.js').GenDeps} deps
 * @param {import('./types.js').LoopContext} ctx
 * @param {boolean} neutral power chords (root + fifth) instead of triads
 * @returns {Promise<import('./types.js').Candidate>}
 */
export async function generateHarmony({ models, random }, ctx, neutral) {
  /** @type {number} */ let key;
  /** @type {number[][]} */ let progression;
  /** @type {number[]} */ let durations;

  if (!ctx.BASS) {
    key = ctx.MELODY ? detectKey(ctx, ['MELODY']) : random.int(0, 12);
    const startChord = random.int(1, 7);
    const numChords = pickChordCount(random);
    const degrees = generateChordProgression(await models.get('harmonyAndBass'), [startChord], numChords, random);

    progression = degrees.map((degree) => {
      if (neutral) return getChordNotes(key, degree, 2);
      return getChordNotes(key, degree, random.float() > 0.8 ? 1 : 0);
    });
    const seed = pickDurationSeed(numChords, random);
    durations = generateDurations(await models.get(`durations${numChords}`), [seed], numChords, random);
  } else {
    ({ key, progression, durations } = identifyChords(ctx, neutral, random));
  }

  /** @type {import('./types.js').GenNote[]} */
  const notes = [];
  let start = 0;
  progression.forEach((chord, i) => {
    if (i >= durations.length) return;
    for (const pitch of chord) notes.push({ pitch, octave: HARMONY_OCTAVE, start, duration: durations[i] });
    start += durations[i];
  });
  return { label: `${KEY_NAMES[key]} major`, notes };
}
