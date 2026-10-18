import test from 'node:test';
import assert from 'node:assert/strict';

import { Random } from '../../public/js/core/random.js';
import { roundHalfEven } from '../../public/js/core/math.js';
import { Generator } from '../../public/js/ai/Generator.js';
import { detectKey } from '../../public/js/ai/generators/keyDetection.js';
import { addPassingNotes, identifyRoots } from '../../public/js/ai/generators/bass.js';
import { identifyChords } from '../../public/js/ai/generators/harmony.js';
import { makeStore } from './helpers.js';

const gen = (seed) => new Generator({ models: makeStore(), random: new Random(seed) });

const inLoop = (notes) => notes.every((n) => n.start >= 0 && n.duration >= 1 && n.start + n.duration <= 64);

test('seeded random is reproducible and uniform enough', () => {
  const a = new Random(7); const b = new Random(7);
  assert.deepEqual([a.float(), a.int(0, 10)], [b.float(), b.int(0, 10)]);
  const r = new Random(1);
  const counts = new Array(5).fill(0);
  for (let i = 0; i < 20000; i++) counts[r.int(0, 5)]++;
  for (const c of counts) assert.ok(Math.abs(c - 4000) < 300);
  assert.equal(r.weighted([0, 0, 1]), 2);
});

test('banker rounding like Python', () => {
  assert.deepEqual([0.5, 1.5, 2.5, 3.5, 2.4, 2.6].map(roundHalfEven), [0, 2, 2, 4, 2, 3]);
});

test('key detection', () => {
  const cMajorScale = [0, 2, 4, 5, 7, 9, 11].map((pitch, i) => ({ pitch, octave: 3, start: i, duration: 1 }));
  assert.equal(detectKey({ MELODY: cMajorScale }, ['MELODY']), 0);
  assert.equal(detectKey({}, ['MELODY']), 0);
  const gMajor = [7, 9, 11, 0, 2, 4, 6, 7].map((pitch, i) => ({ pitch, octave: 3, start: i, duration: 1 }));
  assert.equal(detectKey({ MELODY: gMajor }, ['MELODY']), 7);
});

test('harmony from scratch: valid notes, chords share starts, key label', async () => {
  const out = await gen(11).suggest('HARMONY', {});
  assert.equal(out.length, 4);
  for (const c of out) {
    assert.match(c.label, /^[A-G]#? major$/);
    assert.ok(c.notes.length >= 2);
    assert.ok(inLoop(c.notes));
    assert.ok(c.notes.every((n) => n.octave === 4 && n.pitch >= 0 && n.pitch <= 11));
    assert.equal(c.notes[0].start, 0);
  }
});

test('bass from scratch', async () => {
  const out = await gen(3).suggest('BASS', {});
  for (const c of out) {
    assert.ok(c.notes.length >= 1 && inLoop(c.notes));
    assert.ok(c.notes.every((n) => n.octave === 2));
    // consecutive, non-overlapping
    const sorted = [...c.notes].sort((a, b) => a.start - b.start);
    for (let i = 1; i < sorted.length; i++) assert.equal(sorted[i].start, sorted[i - 1].start + sorted[i - 1].duration);
  }
});

test('bass follows an existing harmony; harmony follows an existing bass', async () => {
  const harmony = [[0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]].flatMap((chord, i) =>
    chord.map((pitch) => ({ pitch, octave: 4, start: i * 16, duration: 16 })));
  const roots = identifyRoots({ HARMONY: harmony });
  assert.deepEqual(roots.roots, [0, 5, 7, 0]);
  assert.deepEqual(roots.durations, [16, 16, 16, 16]);

  const out = await gen(5).suggest('BASS', { HARMONY: harmony });
  assert.ok(out.every((c) => c.notes.length >= 4 && inLoop(c.notes)));

  const bass = [0, 5, 7, 0].map((pitch, i) => ({ pitch, octave: 2, start: i * 16, duration: 16 }));
  const hout = await gen(5).suggest('HARMONY', { BASS: bass });
  assert.ok(hout.every((c) => c.notes.length >= 6 && inLoop(c.notes)));
});

test('identifyChords merges short passing notes into the previous root', () => {
  const bass = [
    { pitch: 0, octave: 2, start: 0, duration: 12 },
    { pitch: 7, octave: 2, start: 12, duration: 4 }, // passing: folded into the C
    { pitch: 5, octave: 2, start: 16, duration: 16 },
  ];
  const r = identifyChords({ BASS: bass }, false, new Random(1));
  assert.deepEqual(r.durations, [16, 16]);
  assert.equal(r.progression.length, 2);
  for (const chord of r.progression) assert.equal(chord.length, 3);
  assert.equal(identifyChords({ BASS: bass }, true, new Random(1)).progression[0].length, 2);
});

test('passing notes split long notes with a fifth', () => {
  const line = [0, 5]; const dur = [32, 32];
  const rng = { float: () => 0.9, int: () => 0 }; // always insert, factor 2
  addPassingNotes(line, dur, rng);
  assert.deepEqual(line, [0, 7, 5]);
  assert.deepEqual(dur, [16, 16, 32]);
});

test('drums: valid pattern over two bars', async () => {
  const out = await gen(21).suggest('DRUMS', {});
  assert.equal(out.length, 4);
  for (const c of out) {
    assert.ok(c.notes.length > 0 && inLoop(c.notes));
    assert.ok(c.notes.every((n) => n.octave === 0 && n.duration === 1 && n.pitch >= 0 && n.pitch <= 6));
    const keys = c.notes.map((n) => `${n.pitch}:${n.start}`);
    assert.equal(new Set(keys).size, keys.length, 'no duplicate hits');
    assert.ok(c.notes.some((n) => n.start >= 32), 'second bar is present');
  }
});

test('same seed gives the same suggestions', async () => {
  const a = await gen(99).suggest('DRUMS', {});
  const b = await gen(99).suggest('DRUMS', {});
  assert.deepEqual(a, b);
});

test('melody has no AI suggestion (never implemented in the original)', async () => {
  await assert.rejects(() => gen(1).suggest('MELODY', {}), /not available/);
});
