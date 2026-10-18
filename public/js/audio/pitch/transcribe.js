// @ts-check
// Turn a recording of a hummed or sung melody into loop notes.
//
// Pipeline: decimate -> frame -> YIN pitch per frame -> median filter ->
// group frames of the same semitone into notes -> quantise to 16th-note steps.
// Replaces the Spotify Basic Pitch call of the old server (which was disabled
// in the repository); tuned for one voice, not chords.

import { N_STEPS } from '../../core/constants.js';
import { freqToMidi, yin } from './yin.js';

/**
 * @typedef {object} TranscribeOptions
 * @property {number} tempo BPM of the loop (one step = a 16th note)
 * @property {number} [steps]        loop length in steps
 * @property {number} [latencySeconds] shift notes earlier by this much (input latency)
 * @property {number} [minNoteSeconds] shorter notes are discarded
 */

/**
 * @typedef {object} DetectedNote
 * @property {number} pitch   0-11
 * @property {number} octave
 * @property {number} start   step
 * @property {number} duration steps
 */

const DECIMATE = 4;
const FRAME = 512;   // samples after decimation (~46 ms at 44.1 kHz)
const HOP = 128;     // ~11.6 ms

/** Average groups of `factor` samples (a crude low-pass + downsample). @param {Float32Array} x @param {number} factor */
function decimate(x, factor) {
  const out = new Float32Array(Math.floor(x.length / factor));
  for (let i = 0; i < out.length; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += x[i * factor + k];
    out[i] = s / factor;
  }
  return out;
}

/** @param {number[]} values @returns {number} */
const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/**
 * Per-frame pitch track. NaN marks unvoiced frames.
 * @param {Float32Array} samples @param {number} sampleRate
 * @returns {{midi: number[], hopSeconds: number}}
 */
export function pitchTrack(samples, sampleRate) {
  const x = decimate(samples, DECIMATE);
  const sr = sampleRate / DECIMATE;

  // loudness of every frame, to decide what counts as silence
  const frames = [];
  for (let start = 0; start + FRAME <= x.length; start += HOP) {
    let e = 0;
    for (let i = 0; i < FRAME; i++) e += x[start + i] * x[start + i];
    frames.push({ start, rms: Math.sqrt(e / FRAME) });
  }
  const maxRms = frames.reduce((m, f) => Math.max(m, f.rms), 0);
  const gate = Math.max(0.004, maxRms * 0.12);

  const raw = frames.map((f) => {
    if (f.rms < gate) return NaN;
    const r = yin(x.subarray(f.start, f.start + FRAME), sr, { fmin: 70, fmax: 1000, threshold: 0.15 });
    return r && r.confidence > 0.7 ? freqToMidi(r.freq) : NaN;
  });

  // median filter over voiced neighbours: removes single-frame octave errors
  const midi = raw.map((m, i) => {
    if (Number.isNaN(m)) return NaN;
    const win = [];
    for (let k = -2; k <= 2; k++) {
      const v = raw[i + k];
      if (v !== undefined && !Number.isNaN(v)) win.push(v);
    }
    return median(win);
  });
  return { midi, hopSeconds: (HOP * DECIMATE) / sampleRate };
}

/**
 * @param {Float32Array} samples mono audio @param {number} sampleRate
 * @param {TranscribeOptions} opts
 * @returns {DetectedNote[]}
 */
export function transcribeMelody(samples, sampleRate, { tempo, steps = N_STEPS, latencySeconds = 0, minNoteSeconds = 0.06 }) {
  const { midi, hopSeconds } = pitchTrack(samples, sampleRate);
  const secondsPerStep = 60 / tempo / 4;

  // run-length encode the rounded semitone of each voiced frame
  /** @type {{note: number, from: number, to: number}[]} */
  const runs = [];
  midi.forEach((m, i) => {
    if (Number.isNaN(m)) return;
    const note = Math.round(m);
    const last = runs[runs.length - 1];
    if (last && last.note === note && i - last.to <= 3) last.to = i; // bridge tiny dropouts
    else runs.push({ note, from: i, to: i });
  });

  /** @type {DetectedNote[]} */
  const notes = [];
  for (const r of runs) {
    const t0 = r.from * hopSeconds - latencySeconds;
    const t1 = (r.to + 1) * hopSeconds - latencySeconds;
    if (t1 - t0 < minNoteSeconds) continue;
    const start = Math.round(t0 / secondsPerStep);
    const end = Math.round(t1 / secondsPerStep);
    if (start < 0 || start >= steps) continue;
    const duration = Math.max(1, Math.min(end, steps) - start);
    if (r.note < 0 || r.note > 119) continue;
    notes.push({ pitch: r.note % 12, octave: Math.floor(r.note / 12), start, duration });
  }

  // a later note cuts the end of an earlier one that overlaps it
  notes.sort((a, b) => a.start - b.start);
  for (let i = 0; i < notes.length - 1; i++) {
    if (notes[i].start + notes[i].duration > notes[i + 1].start) {
      notes[i].duration = Math.max(1, notes[i + 1].start - notes[i].start);
    }
  }
  return notes.filter((n, i) => i === 0 || n.start >= notes[i - 1].start + notes[i - 1].duration || n.start !== notes[i - 1].start);
}
