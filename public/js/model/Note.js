// @ts-check

import { N_STEPS } from '../core/constants.js';
import { clamp } from '../core/math.js';
import { newId } from '../core/ids.js';

/**
 * @typedef {object} NoteData
 * @property {string} id
 * @property {number} pitch     0-11 pitch class (or drum part index 0-6)
 * @property {number} octave    absolute octave (0 for drums)
 * @property {number} start     first step, 0..N_STEPS-1
 * @property {number} duration  length in steps (>= 1)
 */

export class Note {
  /**
   * @param {{pitch: number, octave: number, start: number, duration?: number, id?: string}} init
   */
  constructor({ pitch, octave, start, duration = 1, id }) {
    this.id = id ?? newId('n');
    this.pitch = pitch;
    this.octave = octave;
    this.start = start;
    this.duration = duration;
  }

  /** Exclusive end step. */
  get end() { return this.start + this.duration; }

  /** @param {Note} other same pitch class and octave */
  samePitch(other) { return this.pitch === other.pitch && this.octave === other.octave; }

  /** @param {number} step */
  covers(step) { return this.start <= step && step < this.end; }

  clone() {
    return new Note({ pitch: this.pitch, octave: this.octave, start: this.start, duration: this.duration });
  }

  /** @returns {NoteData} */
  toJSON() {
    return { id: this.id, pitch: this.pitch, octave: this.octave, start: this.start, duration: this.duration };
  }

  /**
   * Build from untrusted data; returns null if unusable.
   * @param {any} d @returns {Note | null}
   */
  static fromJSON(d) {
    if (!d || typeof d !== 'object') return null;
    const { pitch, octave, start, duration } = d;
    if (![pitch, octave, start, duration].every((v) => Number.isFinite(v))) return null;
    const s = clamp(Math.round(start), 0, N_STEPS - 1);
    return new Note({
      id: typeof d.id === 'string' ? d.id : undefined,
      pitch: clamp(Math.round(pitch), 0, 23),
      octave: clamp(Math.round(octave), 0, 9),
      start: s,
      duration: clamp(Math.round(duration), 1, N_STEPS - s),
    });
  }
}
