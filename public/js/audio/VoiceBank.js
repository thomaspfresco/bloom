// @ts-check
// One voice per track kind, shared by every loop (only one loop sounds at a
// time). Before a track's notes play, `prepare()` copies its settings onto the
// voice for its kind. Creating a voice builds a reverb and filters, so voices
// are created lazily and kept for the page's lifetime.

import { DRUM_PRESETS } from '../music/presets.js';
import { DrumVoice, SynthVoice } from './Voice.js';
import { kitIfLoaded, loadKit } from './drumKits.js';

/** @typedef {import('../model/Track.js').Track} Track */
/** @typedef {import('../music/trackKinds.js').TrackKind} TrackKind */

export class VoiceBank {
  /** @param {{lockReverbDecay?: boolean}} [opts] `lockReverbDecay` is set for offline rendering */
  constructor({ lockReverbDecay = false } = {}) {
    this.lockReverbDecay = lockReverbDecay;
    /** @type {Map<TrackKind, SynthVoice | DrumVoice>} */
    this.voices = new Map();
    /** @type {Promise<void> | null} */
    this.kitLoading = null;
  }

  /** @param {TrackKind} kind @returns {SynthVoice | DrumVoice} */
  voice(kind) {
    let v = this.voices.get(kind);
    if (!v) {
      v = kind === 'DRUMS' ? this.#createDrums() : new SynthVoice();
      v.lockReverbDecay = this.lockReverbDecay;
      this.voices.set(kind, v);
    }
    return v;
  }

  #createDrums() {
    // The Players start empty; the kit is attached once its samples have loaded.
    const placeholder = Array.from({ length: 7 }, () => undefined);
    const voice = new DrumVoice(placeholder);
    this.#ensureKit(voice, DRUM_PRESETS[0].kit);
    return voice;
  }

  /** @param {DrumVoice} voice @param {import('./drumKits.js').KitName} name */
  #ensureKit(voice, name) {
    if (voice.kitName === name) return Promise.resolve();
    const now = kitIfLoaded(name);
    if (now) {
      voice.setKit(now, name); // already in memory: attach synchronously
      return Promise.resolve();
    }
    voice.kitName = name; // claim it now so repeated calls do not re-request
    this.kitLoading = loadKit(name).then((kit) => voice.setKit(kit, name));
    this.kitLoading.catch(() => { voice.kitName = ''; });
    return this.kitLoading;
  }

  /**
   * Copy a track's settings onto the voice for its kind.
   * @param {Track} track @param {number} [step] automation step (-1 = static values)
   * @returns {SynthVoice | DrumVoice}
   */
  prepare(track, step = -1) {
    const voice = this.voice(track.kind);
    if (voice instanceof DrumVoice) {
      this.#ensureKit(voice, DRUM_PRESETS[track.preset].kit);
      voice.apply(track, step);
    } else {
      voice.apply(track, step);
    }
    return voice;
  }

  /**
   * Create and configure the voice of every kind in `tracks` now, and wait for
   * reverb impulse responses. Offline rendering needs this before it starts.
   * @param {Iterable<Track>} tracks
   */
  async warmUp(tracks) {
    /** @type {Set<TrackKind>} */
    const done = new Set();
    const reverbs = [];
    for (const track of tracks) {
      if (done.has(track.kind)) continue;
      done.add(track.kind);
      const voice = this.prepare(track, 0);
      if (track.toggles.reverb) reverbs.push(voice.fx.reverb.ready);
    }
    await Promise.all(reverbs);
  }

  /** Resolves when the active drum kit's samples are ready. */
  async ready() {
    await this.kitLoading;
  }

  /** @param {number} [time] */
  releaseAll(time) {
    for (const v of this.voices.values()) v.releaseAll(time);
  }

  /** Per-kind output level in dB, for meters. @param {TrackKind} kind */
  levels(kind) {
    return this.voices.get(kind)?.fx.levels() ?? [-Infinity, -Infinity];
  }

  dispose() {
    for (const v of this.voices.values()) v.dispose();
    this.voices.clear();
  }
}
