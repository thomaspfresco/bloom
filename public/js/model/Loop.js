// @ts-check

import { MAX_NAME_LENGTH, MAX_TRACKS, N_STEPS, TEMPO } from '../core/constants.js';
import { newId } from '../core/ids.js';
import { clamp } from '../core/math.js';
import { Track } from './Track.js';
import { isTrackKind } from '../music/trackKinds.js';

/** @typedef {import('../music/trackKinds.js').TrackKind} TrackKind */
/** @typedef {import('./Track.js').TrackData} TrackData */

/**
 * @typedef {object} LoopData
 * @property {string} id
 * @property {string} name
 * @property {number} tempo
 * @property {boolean} click    metronome on
 * @property {boolean} record   record played notes into the selected track
 * @property {TrackData[]} tracks
 */

/** A 64-step loop of up to four tracks (one per kind). */
export class Loop {
  /** @param {{name: string, tempo?: number, id?: string}} init */
  constructor({ name, tempo = TEMPO.default, id }) {
    this.id = id ?? newId('l');
    this.name = name;
    this.tempo = tempo;
    this.click = false;
    this.record = false;
    /** @type {Track[]} */
    this.tracks = [];
  }

  get nSteps() { return N_STEPS; }
  get isEmpty() { return this.tracks.length === 0; }

  /** Seconds per step (16th note) at the current tempo. */
  get secondsPerStep() { return 60 / this.tempo / 4; }

  /** @param {TrackKind} kind */
  hasKind(kind) { return this.tracks.some((t) => t.kind === kind); }

  /** @param {TrackKind} kind */
  canAddTrack(kind) { return this.tracks.length < MAX_TRACKS && !this.hasKind(kind); }

  /** @param {string} id */
  track(id) { return this.tracks.find((t) => t.id === id) ?? null; }

  /** @param {TrackKind} kind */
  trackOfKind(kind) { return this.tracks.find((t) => t.kind === kind) ?? null; }

  /**
   * Append an existing track or create an empty one.
   * @param {TrackKind | Track} kindOrTrack
   * @returns {Track}
   */
  addTrack(kindOrTrack) {
    const track = typeof kindOrTrack === 'string' ? new Track(kindOrTrack) : kindOrTrack;
    if (!this.canAddTrack(track.kind)) throw new Error(`Cannot add a ${track.kind} track to "${this.name}".`);
    this.tracks.push(track);
    return track;
  }

  /** @param {string} id */
  removeTrack(id) {
    const i = this.tracks.findIndex((t) => t.id === id);
    if (i >= 0) this.tracks.splice(i, 1);
    return i >= 0;
  }

  /** @param {number} tempo */
  setTempo(tempo) { this.tempo = clamp(Math.round(tempo), TEMPO.min, TEMPO.max); }

  /** @param {string} name */
  setName(name) { this.name = name.slice(0, MAX_NAME_LENGTH); }

  /**
   * Context handed to the generators: kind -> ordered notes, skipping empty tracks.
   * @returns {Partial<Record<TrackKind, {pitch: number, octave: number, start: number, duration: number}[]>>}
   */
  toGenerationContext() {
    /** @type {Partial<Record<TrackKind, any[]>>} */
    const out = {};
    for (const t of this.tracks) if (t.notes.length > 0) out[t.kind] = t.toNoteList();
    return out;
  }

  /** Deep copy. @param {{keepIds?: boolean, name?: string}} [opts] */
  clone({ keepIds = false, name } = {}) {
    const l = new Loop({ name: name ?? this.name, tempo: this.tempo, id: keepIds ? this.id : undefined });
    l.click = this.click;
    l.record = this.record;
    l.tracks = this.tracks.map((t) => {
      const c = t.clone();
      if (keepIds) c.id = t.id;
      return c;
    });
    return l;
  }

  /** @returns {LoopData} */
  toJSON() {
    return {
      id: this.id, name: this.name, tempo: this.tempo, click: this.click, record: this.record,
      tracks: this.tracks.map((t) => t.toJSON()),
    };
  }

  /** @param {any} d untrusted @returns {Loop | null} */
  static fromJSON(d) {
    if (!d || typeof d !== 'object' || typeof d.name !== 'string') return null;
    const loop = new Loop({
      id: typeof d.id === 'string' ? d.id : undefined,
      name: d.name.slice(0, 64),
      tempo: Number.isFinite(d.tempo) ? clamp(Math.round(d.tempo), TEMPO.min, TEMPO.max) : TEMPO.default,
    });
    loop.click = d.click === true;
    loop.record = d.record === true;
    if (Array.isArray(d.tracks)) {
      for (const td of d.tracks) {
        const t = Track.fromJSON(td);
        if (t && isTrackKind(t.kind) && loop.canAddTrack(t.kind)) loop.tracks.push(t);
      }
    }
    return loop;
  }
}
