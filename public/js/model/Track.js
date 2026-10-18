// @ts-check

import { newId } from '../core/ids.js';
import { clamp } from '../core/math.js';
import { TRACK_KINDS, isTrackKind } from '../music/trackKinds.js';
import { DRUM_PRESETS, SYNTH_PRESETS } from '../music/presets.js';
import { Note } from './Note.js';
import { Parameter } from './Parameter.js';
import { PARAMETER_SPECS, TOGGLE_DEFAULTS } from './parameterSpecs.js';

/** @typedef {import('../music/trackKinds.js').TrackKind} TrackKind */
/** @typedef {import('./Parameter.js').ParameterData} ParameterData */
/** @typedef {import('./Note.js').NoteData} NoteData */

/**
 * @typedef {object} TrackData
 * @property {string} id
 * @property {TrackKind} kind
 * @property {boolean} muted
 * @property {number} gain            0-1 fader
 * @property {number} preset          index into the synth or drum preset list
 * @property {boolean} presetChanged  true once the user edits away from the preset
 * @property {number} octaveWindow    lower octave of the visible two-octave grid
 * @property {Record<string, boolean>} toggles
 * @property {ParameterData[]} params
 * @property {NoteData[]} notes
 */

/**
 * One instrument lane of a loop: notes plus the synth / drum / FX settings.
 * Pure state: no audio nodes and no drawing (those live in audio/ and scene/).
 */
export class Track {
  /**
   * @param {TrackKind} kind
   * @param {{id?: string, applyPreset?: boolean}} [opts]
   */
  constructor(kind, { id, applyPreset = true } = {}) {
    const info = TRACK_KINDS[kind];
    this.id = id ?? newId('t');
    this.kind = kind;
    this.muted = false;
    this.gain = 1;
    this.preset = info.defaultPreset;
    this.presetChanged = false;
    this.octaveWindow = info.defaultOctaveWindow;
    /** @type {Note[]} */
    this.notes = [];

    const layout = info.isDrums ? 'drums' : 'synth';
    /** @type {Record<string, boolean>} */
    this.toggles = { ...TOGGLE_DEFAULTS[layout] };
    /** @type {Parameter[]} */
    this.params = PARAMETER_SPECS[layout].map((s) => new Parameter(s));

    if (applyPreset) this.applyPreset(this.preset);
  }

  get info() { return TRACK_KINDS[this.kind]; }
  get isDrums() { return this.info.isDrums; }

  /** @param {string} id @returns {Parameter} */
  param(id) {
    const p = this.params.find((x) => x.id === id);
    if (!p) throw new Error(`Track ${this.kind} has no parameter "${id}"`);
    return p;
  }

  /** @param {string} id */
  hasParam(id) { return this.params.some((x) => x.id === id); }

  /** Number of presets for this kind. */
  get presetCount() { return this.isDrums ? DRUM_PRESETS.length : SYNTH_PRESETS.length; }

  get presetName() {
    const list = this.isDrums ? DRUM_PRESETS : SYNTH_PRESETS;
    return list[this.preset].name + (this.presetChanged ? '*' : '');
  }

  /**
   * Load a factory preset into toggles + parameters.
   * @param {number} index
   */
  applyPreset(index) {
    this.preset = clamp(index, 0, this.presetCount - 1);
    this.presetChanged = false;

    if (this.isDrums) {
      const p = DRUM_PRESETS[this.preset];
      for (let i = 0; i < p.partState.length; i++) {
        this.toggles[`part${i}`] = p.partState[i];
        this.param(`part${i}.gain`).value = p.partVol[i];
        this.param(`part${i}.pitch`).value = p.partPitch[i];
      }
      this.#applyFx(p);
      return;
    }

    const p = SYNTH_PRESETS[this.preset];
    for (let i = 0; i < 2; i++) {
      const n = i + 1;
      this.toggles[`osc${n}`] = p.oscState[i];
      this.param(`osc${n}.wave`).value = p.osc[i][0];
      this.param(`osc${n}.pitch`).value = p.osc[i][1];
      this.param(`osc${n}.volume`).value = p.osc[i][2];
      this.toggles[`env${n}`] = p.envState[i];
      this.param(`env${n}.attack`).value = p.env[i][0];
      this.param(`env${n}.decay`).value = p.env[i][1];
      this.param(`env${n}.sustain`).value = p.env[i][2];
      this.param(`env${n}.release`).value = p.env[i][3];
    }
    this.#applyFx(p);
  }

  /** @param {import('../music/presets.js').FxPreset} p */
  #applyFx(p) {
    this.toggles.filter = p.filterState;
    this.param('filter.position').value = p.filter;
    this.toggles.dist = p.distortionState;
    this.param('dist.amount').value = p.distortion;
    this.toggles.delay = p.delayState;
    this.param('delay.time').value = p.delay[0];
    this.param('delay.feedback').value = p.delay[1];
    this.param('delay.mix').value = p.delay[2];
    this.toggles.reverb = p.reverbState;
    this.param('reverb.decay').value = p.reverb[0];
    this.param('reverb.mix').value = p.reverb[1];
  }

  /** Mark the preset as edited (the UI shows "NAME*"). */
  markEdited() { this.presetChanged = true; }

  /** Notes flattened for generators / export (insertion order is meaningful to the generators). */
  toNoteList() {
    return this.notes.map((n) => ({ pitch: n.pitch, octave: n.octave, start: n.start, duration: n.duration }));
  }

  /** Independent copy with fresh ids. */
  clone() {
    const t = new Track(this.kind, { applyPreset: false });
    t.restore(this.toJSON());
    t.id = newId('t');
    t.notes = this.notes.map((n) => n.clone());
    return t;
  }

  /** @returns {TrackData} */
  toJSON() {
    return {
      id: this.id,
      kind: this.kind,
      muted: this.muted,
      gain: this.gain,
      preset: this.preset,
      presetChanged: this.presetChanged,
      octaveWindow: this.octaveWindow,
      toggles: { ...this.toggles },
      params: this.params.map((p) => p.toJSON()),
      notes: this.notes.map((n) => n.toJSON()),
    };
  }

  /** Overlay persisted state onto this (already-constructed) track. @param {Partial<TrackData>} d */
  restore(d) {
    if (typeof d.id === 'string') this.id = d.id;
    this.muted = d.muted === true;
    this.gain = typeof d.gain === 'number' ? clamp(d.gain, 0, 1) : 1;
    if (typeof d.preset === 'number') this.preset = clamp(Math.round(d.preset), 0, this.presetCount - 1);
    this.presetChanged = d.presetChanged === true;
    if (typeof d.octaveWindow === 'number' && !this.isDrums) this.octaveWindow = clamp(Math.round(d.octaveWindow), 0, 7);

    if (d.toggles && typeof d.toggles === 'object') {
      for (const key of Object.keys(this.toggles)) {
        if (typeof d.toggles[key] === 'boolean') this.toggles[key] = d.toggles[key];
      }
    }
    if (Array.isArray(d.params)) {
      for (const pd of d.params) {
        if (pd && typeof pd.id === 'string' && this.hasParam(pd.id)) this.param(pd.id).restore(pd);
      }
    }
    if (Array.isArray(d.notes)) {
      this.notes = d.notes.map((n) => Note.fromJSON(n)).filter((n) => n !== null);
    }
  }

  /** @param {any} d untrusted @returns {Track | null} */
  static fromJSON(d) {
    if (!d || typeof d !== 'object' || typeof d.kind !== 'string' || !isTrackKind(d.kind)) return null;
    const t = new Track(d.kind, { applyPreset: false });
    t.restore(d);
    return t;
  }
}
