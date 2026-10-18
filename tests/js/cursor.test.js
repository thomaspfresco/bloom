import test from 'node:test';
import assert from 'node:assert/strict';

import { Loop } from '../../public/js/model/Loop.js';
import { Note } from '../../public/js/model/Note.js';
import { Structure } from '../../public/js/model/Structure.js';
import { PlaybackCursor } from '../../public/js/audio/playback/PlaybackCursor.js';

function loopWith(name, tempo = 120) {
  const loop = new Loop({ name, tempo });
  const bass = loop.addTrack('BASS');
  bass.notes.push(new Note({ pitch: 0, octave: 2, start: 0, duration: 4 }), new Note({ pitch: 7, octave: 2, start: 60, duration: 4 }));
  const drums = loop.addTrack('DRUMS');
  drums.notes.push(new Note({ pitch: 0, octave: 0, start: 0, duration: 1 }), new Note({ pitch: 1, octave: 0, start: 4, duration: 1 }));
  return loop;
}

test('loop plan: steps 0..63 then wraps', () => {
  const cur = new PlaybackCursor({ type: 'loop', loop: loopWith('a') });
  const t0 = cur.advance();
  assert.equal(t0.step, 0);
  assert.equal(t0.wrapped, false);
  assert.deepEqual(t0.on.map((e) => e.track.kind).sort(), ['BASS', 'DRUMS']);

  let last;
  for (let i = 1; i < 64; i++) last = cur.advance();
  assert.equal(last.step, 63);
  const wrap = cur.advance();
  assert.equal(wrap.step, 0);
  assert.equal(wrap.wrapped, true);
});

test('note on/off timing: bass releases at end, drums never release', () => {
  const cur = new PlaybackCursor({ type: 'loop', loop: loopWith('a') });
  const ticks = Array.from({ length: 64 }, () => cur.advance());
  assert.deepEqual(ticks[4].off.map((e) => e.track.kind), ['BASS']); // note 0..4 ends at step 4
  assert.deepEqual(ticks[4].on.map((e) => e.track.kind), ['DRUMS']);
  assert.equal(ticks.flatMap((t) => t.off).filter((e) => e.track.isDrums).length, 0);
  // note 60..64 never gets an off tick: the wrap releases it
  assert.equal(ticks.flatMap((t) => t.off).filter((e) => e.note.start === 60).length, 0);
});

test('muted tracks are skipped; custom track list is honoured', () => {
  const loop = loopWith('a');
  loop.tracks[0].muted = true;
  let tick = new PlaybackCursor({ type: 'loop', loop }).advance();
  assert.deepEqual(tick.on.map((e) => e.track.kind), ['DRUMS']);

  const solo = [loop.tracks[1]];
  tick = new PlaybackCursor({ type: 'loop', loop, tracks: () => solo }).advance();
  assert.deepEqual(tick.tracks.map((t) => t.kind), ['DRUMS']);
});

test('click accents the bar and marks beats', () => {
  const loop = loopWith('a'); loop.click = true;
  const cur = new PlaybackCursor({ type: 'loop', loop });
  const clicks = Array.from({ length: 17 }, () => cur.advance().click);
  assert.equal(clicks[0], 'accent');
  assert.equal(clicks[1], null);
  assert.equal(clicks[4], 'beat');
  assert.equal(clicks[16], 'accent');
  const quiet = new PlaybackCursor({ type: 'loop', loop, click: false });
  assert.equal(quiet.advance().click, null);
});

test('finite loop plan ends after one pass', () => {
  const cur = new PlaybackCursor({ type: 'loop', loop: loopWith('a'), finite: true });
  let n = 0; let doneTick = null; let t;
  while ((t = cur.advance())) { n++; if (t.done) doneTick = t; }
  assert.equal(n, 64);
  assert.equal(doneTick.step, 63);
});

test('struct plan: sections, repeats, tempo and transpose', () => {
  const a = loopWith('a', 100); const b = loopWith('b', 140);
  const map = new Map([[a.id, a], [b.id, b]]);
  const st = new Structure({ name: 's' });
  st.insertLoop(a.id, 0, 2); st.insertLoop(b.id, 1, 1);
  st.useTempo = true; st.setTempo(90);
  st.useTranspose = true; st.setTranspose(3);

  const cur = new PlaybackCursor({ type: 'struct', struct: st, resolveLoop: (id) => map.get(id) ?? null, finite: true });
  const seq = [];
  let tick; let first;
  while ((tick = cur.advance())) {
    if (tick.step === 0) seq.push([tick.sectionIndex, tick.repeat]);
    first ??= tick;
  }
  assert.deepEqual(seq, [[0, 0], [0, 1], [1, 0]]);
  assert.equal(first.bpm, 90, 'structure tempo overrides');
  const bassOn = first.on.find((e) => e.track.kind === 'BASS');
  assert.deepEqual([bassOn.pitch, bassOn.octave], [3, 2], 'C transposed up 3 semitones');
  const drumOn = first.on.find((e) => e.track.kind === 'DRUMS');
  assert.equal(drumOn.pitch, 0, 'drums are not transposed');
});

test('struct plan loops forever when not finite, and each loop keeps its tempo', () => {
  const a = loopWith('a', 100); const b = loopWith('b', 140);
  const map = new Map([[a.id, a], [b.id, b]]);
  const st = new Structure({ name: 's' });
  st.insertLoop(a.id); st.insertLoop(b.id);
  const cur = new PlaybackCursor({ type: 'struct', struct: st, resolveLoop: (id) => map.get(id) });
  const bpms = [];
  for (let i = 0; i < 64 * 3; i++) { const t = cur.advance(); if (t.step === 0) bpms.push(t.bpm); }
  assert.deepEqual(bpms, [100, 140, 100]);
});

test('empty struct yields nothing; seek works', () => {
  const st = new Structure({ name: 's' });
  assert.equal(new PlaybackCursor({ type: 'struct', struct: st, resolveLoop: () => null }).advance(), null);
  const cur = new PlaybackCursor({ type: 'loop', loop: loopWith('a') });
  cur.seek(32);
  assert.equal(cur.advance().step, 32);
});
