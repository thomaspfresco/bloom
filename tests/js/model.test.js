import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

import { TABLES, lookup } from '../../public/js/music/parameterTables.js';
import { getChordNotes } from '../../public/js/music/scales.js';
import { transposeNote, keyToPitch } from '../../public/js/music/theory.js';
import { Note } from '../../public/js/model/Note.js';
import { addNote, makeRoomFor } from '../../public/js/model/noteOps.js';
import { Track } from '../../public/js/model/Track.js';
import { Loop } from '../../public/js/model/Loop.js';
import { Structure } from '../../public/js/model/Structure.js';
import { Session } from '../../public/js/model/Session.js';
import { uniqueName } from '../../public/js/model/naming.js';

test('option tables match the legacy sizes', () => {
  assert.equal(TABLES.time.length, 30);
  assert.equal(TABLES.pitch.length, 43);
  assert.equal(TABLES.unit.length, 101);
  assert.equal(TABLES.pitch[0], -1200);
  assert.equal(TABLES.pitch.at(-1), 1200);
  assert.equal(lookup('wave', 1), 'sawtooth');
  assert.equal(lookup('wave', 0), 'sine');
  assert.equal(lookup('unit', 0.5), 0.5);
});

test('chord tones match the Python original (golden file)', () => {
  const golden = JSON.parse(readFileSync(new URL('../fixtures/chords.golden.json', import.meta.url), 'utf8'));
  assert.equal(golden.length, 252);
  for (const { key, degree, modifier, notes } of golden) {
    assert.deepEqual(getChordNotes(key, degree, modifier), notes, `key ${key} degree ${degree} mod ${modifier}`);
  }
});

test('transpose carries into the octave', () => {
  assert.deepEqual(transposeNote(10, 3, 5), { pitch: 3, octave: 4 });
  assert.deepEqual(transposeNote(1, 3, -3), { pitch: 10, octave: 2 });
  assert.equal(keyToPitch('w'), 1);
  assert.equal(keyToPitch('z'), -1);
});

test('note overlap resolution', () => {
  const mk = (start, duration) => new Note({ pitch: 0, octave: 3, start, duration });

  // covered -> removed
  let notes = [mk(4, 2)];
  addNote(notes, mk(2, 8));
  assert.equal(notes.length, 1);

  // trim front
  notes = [mk(4, 8)];
  makeRoomFor(notes, mk(2, 4)); // incoming 2..6
  assert.deepEqual(notes.map((n) => [n.start, n.duration]), [[6, 6]]);

  // trim tail (old code produced a negative-length note here)
  notes = [mk(0, 6)];
  makeRoomFor(notes, mk(4, 6)); // incoming 4..10
  assert.deepEqual(notes.map((n) => [n.start, n.duration]), [[0, 4]]);

  // split
  notes = [mk(0, 16)];
  makeRoomFor(notes, mk(4, 4));
  assert.deepEqual(notes.map((n) => [n.start, n.duration]).sort((a, b) => a[0] - b[0]), [[0, 4], [8, 8]]);

  // ends together: no zero-length remainder
  notes = [mk(0, 8)];
  makeRoomFor(notes, mk(4, 4));
  assert.deepEqual(notes.map((n) => [n.start, n.duration]), [[0, 4]]);

  // different pitch untouched
  notes = [new Note({ pitch: 1, octave: 3, start: 0, duration: 8 })];
  makeRoomFor(notes, mk(0, 8));
  assert.equal(notes.length, 1);
});

test('track layouts and presets', () => {
  const bass = new Track('BASS');
  assert.equal(bass.params.length, 21);
  assert.equal(bass.preset, 3);
  assert.equal(bass.toggles.dist, true); // SUB BASS has distortion on
  assert.equal(bass.param('osc2.volume').value, 0.55);

  const drums = new Track('DRUMS');
  assert.equal(drums.params.length, 21);
  assert.equal(drums.param('part1.pitch').value, 0.22); // SUBTLE snare pitch
  assert.equal(drums.isDrums, true);

  drums.applyPreset(2);
  assert.equal(drums.presetName, 'ELECTRONIC');
  drums.markEdited();
  assert.equal(drums.presetName, 'ELECTRONIC*');
});

test('loop limits: one track per kind, max four', () => {
  const loop = new Loop({ name: 'a' });
  loop.addTrack('BASS');
  assert.equal(loop.canAddTrack('BASS'), false);
  assert.throws(() => loop.addTrack('BASS'));
  loop.addTrack('DRUMS'); loop.addTrack('HARMONY'); loop.addTrack('MELODY');
  assert.equal(loop.tracks.length, 4);
});

test('generation context skips empty tracks and keeps insertion order', () => {
  const loop = new Loop({ name: 'a' });
  const bass = loop.addTrack('BASS');
  loop.addTrack('DRUMS');
  bass.notes.push(new Note({ pitch: 5, octave: 2, start: 8, duration: 4 }), new Note({ pitch: 0, octave: 2, start: 0, duration: 8 }));
  const ctx = loop.toGenerationContext();
  assert.deepEqual(Object.keys(ctx), ['BASS']);
  assert.deepEqual(ctx.BASS.map((n) => n.start), [8, 0]);
});

test('structure merges identical neighbours and caps repeats', () => {
  const s = new Structure({ name: 's' });
  s.insertLoop('a'); s.insertLoop('a'); s.insertLoop('b');
  assert.equal(s.sections.length, 2);
  assert.equal(s.sections[0].repeats, 2);
  for (let i = 0; i < 20; i++) s.insertLoop('a', 0);
  assert.ok(s.sections[0].repeats <= 8);
  s.removeLoopReferences('a');
  assert.deepEqual(s.sections.map((x) => x.loopId), ['b']);
});

test('structure max sections', () => {
  const s = new Structure({ name: 's' });
  ['a', 'b', 'a', 'b', 'a'].forEach((id) => s.insertLoop(id));
  assert.equal(s.isFull, true);
  assert.equal(s.insertLoop('c'), null);
});

test('naming', () => {
  assert.equal(uniqueName('x', ['y']), 'x');
  assert.equal(uniqueName('x', ['x']), 'x(1)');
  assert.equal(uniqueName('x', ['x', 'x(1)']), 'x(2)');
});

test('session create/duplicate/delete/tabs', () => {
  const s = new Session();
  const events = [];
  s.on('change', (e) => events.push(e.scope));

  const a = s.createLoop();
  const b = s.createLoop();
  assert.equal(a.name, 'myLoop1');
  assert.equal(b.name, 'myLoop2');
  assert.deepEqual(s.active, { type: 'loop', id: b.id });

  const st = s.structFromLoop(a.id);
  assert.equal(st.sections.length, 1);

  const dup = s.duplicateLoop(a.id);
  assert.equal(dup.name, 'myLoop1(1)');
  assert.notEqual(dup.id, a.id);

  // 4 tabs max: a, b, struct, dup => open one more
  s.createLoop();
  assert.equal(s.tabs.length, 4);
  assert.equal(s.tabs.some((t) => t.id === a.id), false); // oldest dropped

  s.deleteLoop(a.id);
  assert.equal(s.struct(st.id).sections.length, 0);
  assert.ok(events.length > 0);
});

test('session round trip through JSON', () => {
  const s = new Session();
  const loop = s.createLoop();
  const t = loop.addTrack('HARMONY');
  t.notes.push(new Note({ pitch: 4, octave: 4, start: 0, duration: 16 }));
  t.param('delay.mix').setAutomation(3, 0.9);
  t.markEdited();
  const st = s.structFromLoop(loop.id);
  st.setTranspose(5); st.useTranspose = true;

  const copy = Session.fromJSON(JSON.parse(JSON.stringify(s.toJSON())));
  assert.equal(copy.loops.length, 1);
  assert.equal(copy.loops[0].tracks[0].notes[0].duration, 16);
  assert.equal(copy.loops[0].tracks[0].param('delay.mix').automation[3], 0.9);
  assert.equal(copy.loops[0].tracks[0].param('delay.mix').automating, true);
  assert.equal(copy.loops[0].tracks[0].presetChanged, true);
  assert.equal(copy.structs[0].transpose, 5);
  assert.deepEqual(copy.active, s.active);
  assert.deepEqual(copy.toJSON().loops, s.toJSON().loops);
});

test('fromJSON survives hostile data', () => {
  const evil = {
    loops: [null, 5, { name: 'ok', tempo: 'x', tracks: [{ kind: 'NOPE' }, { kind: 'BASS', notes: [{ pitch: 'a' }, { pitch: 3, octave: 2, start: 999, duration: 999 }], params: [{ id: 'nope', value: 3 }] }] }],
    structs: [{ name: 's', sections: [{ loopId: 'ghost' }] }],
    tabs: [{ type: 'loop', id: 'ghost' }, 42],
    active: { type: 'loop', id: 'ghost' },
  };
  const s = Session.fromJSON(evil);
  assert.equal(s.loops.length, 1);
  assert.equal(s.loops[0].tracks.length, 1);
  const n = s.loops[0].tracks[0].notes;
  assert.equal(n.length, 1);
  assert.ok(n[0].start <= 63 && n[0].start + n[0].duration <= 64);
  assert.equal(s.structs[0].sections.length, 0);
  assert.equal(s.tabs.length, 0);
  assert.equal(s.active, null);
});

test('structure randomize respects limits and merges neighbours', async () => {
  const { Random } = await import('../../public/js/core/random.js');
  const ids = ['a', 'b', 'c'];
  for (let seed = 0; seed < 50; seed++) {
    const s = new Structure({ name: 's' });
    s.randomize(ids, new Random(seed));
    assert.ok(s.sections.length >= 1 && s.sections.length <= 5, `seed ${seed}`);
    assert.ok(s.sections.every((x) => x.repeats >= 1 && x.repeats <= 8 && ids.includes(x.loopId)));
    for (let i = 1; i < s.sections.length; i++) assert.notEqual(s.sections[i].loopId, s.sections[i - 1].loopId);
  }
  const empty = new Structure({ name: 'e' });
  empty.randomize([], new Random(1));
  assert.equal(empty.sections.length, 0);
});
