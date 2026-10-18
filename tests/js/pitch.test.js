import test from 'node:test';
import assert from 'node:assert/strict';
import { yin, freqToMidi } from '../../public/js/audio/pitch/yin.js';
import { transcribeMelody } from '../../public/js/audio/pitch/transcribe.js';
import { Random } from '../../public/js/core/random.js';

const SR = 44100;
const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

/** Voice-like tone: a few harmonics with a short attack/release. */
function tone(midi, seconds, rng, vibratoCents = 0) {
  const n = Math.round(seconds * SR);
  const out = new Float32Array(n);
  const f = midiToFreq(midi);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const fm = f * 2 ** ((vibratoCents * Math.sin(2 * Math.PI * 5 * t)) / 1200);
    phase += (2 * Math.PI * fm) / SR;
    const env = Math.min(1, t / 0.02, (seconds - t) / 0.02);
    out[i] = env * (0.6 * Math.sin(phase) + 0.25 * Math.sin(2 * phase) + 0.12 * Math.sin(3 * phase)) + (rng ? (rng.float() - 0.5) * 0.01 : 0);
  }
  return out;
}
const silence = (seconds) => new Float32Array(Math.round(seconds * SR));
const concat = (...parts) => {
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

test('yin finds the pitch of harmonic tones', () => {
  for (const m of [45, 57, 60, 64, 69, 79]) {
    const x = tone(m, 0.3);
    const dec = new Float32Array(2048); dec.set(x.subarray(4000, 6048));
    const r = yin(dec, SR, { fmin: 70, fmax: 1000 });
    assert.ok(r, `midi ${m}`);
    assert.ok(Math.abs(freqToMidi(r.freq) - m) < 0.1, `midi ${m} got ${freqToMidi(r.freq).toFixed(2)}`);
  }
});

test('yin rejects noise', () => {
  const rng = new Random(3);
  const noise = Float32Array.from({ length: 2048 }, () => rng.float() - 0.5);
  assert.equal(yin(noise, SR), null);
});

test('a hummed melody becomes quantised notes', () => {
  // at 120 BPM one step is 0.125 s
  const rng = new Random(5);
  const audio = concat(
    silence(0.25),            // steps 0-1
    tone(57, 0.5, rng, 15),   // A3  steps 2-5  (4 steps), slight vibrato
    silence(0.125),           // step 6
    tone(60, 0.5, rng, 15),   // C4  steps 7-10
    tone(64, 0.75, rng, 15),  // E4  steps 11-16 (6 steps), legato after C4
    silence(0.25),
  );
  const notes = transcribeMelody(audio, SR, { tempo: 120 });
  assert.equal(notes.length, 3, JSON.stringify(notes));
  const [a, c, e] = notes;
  // BLOOM numbers octaves as floor(midi / 12), like the old Basic Pitch conversion
  assert.deepEqual([a.pitch, a.octave], [9, 4]);
  assert.deepEqual([c.pitch, c.octave], [0, 5]);
  assert.deepEqual([e.pitch, e.octave], [4, 5]);
  for (const [n, start, dur] of [[a, 2, 4], [c, 7, 4], [e, 11, 6]]) {
    assert.ok(Math.abs(n.start - start) <= 1, `start ${n.start} vs ${start}`);
    assert.ok(Math.abs(n.duration - dur) <= 1, `duration ${n.duration} vs ${dur}`);
  }
});

test('silence and noise produce no notes; latency shifts notes earlier', () => {
  assert.deepEqual(transcribeMelody(silence(2), SR, { tempo: 120 }), []);
  const rng = new Random(9);
  const noise = Float32Array.from({ length: SR }, () => (rng.float() - 0.5) * 0.3);
  assert.deepEqual(transcribeMelody(noise, SR, { tempo: 120 }), []);

  const audio = concat(silence(0.5), tone(60, 0.5));
  const plain = transcribeMelody(audio, SR, { tempo: 120 });
  const shifted = transcribeMelody(audio, SR, { tempo: 120, latencySeconds: 0.25 });
  assert.ok(plain[0].start - shifted[0].start >= 1 && plain[0].start - shifted[0].start <= 3);
});

test('notes beyond the loop are dropped and tempo scales steps', () => {
  const audio = concat(silence(0.1), tone(64, 1));
  const fast = transcribeMelody(audio, SR, { tempo: 240 }); // one step = 62.5 ms
  const slow = transcribeMelody(audio, SR, { tempo: 60 });  // one step = 250 ms
  assert.ok(fast[0].duration > slow[0].duration * 2);
  const late = transcribeMelody(concat(silence(10), tone(64, 1)), SR, { tempo: 120 });
  assert.deepEqual(late, [], 'starts after step 63 (7.9 s)');
});
