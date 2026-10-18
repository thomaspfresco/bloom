// @ts-check
// Voices turn a Track's settings into sound. One voice exists per track kind
// (see VoiceBank); `apply()` copies the track's parameters onto it before notes
// are triggered, exactly like the old `updateSynthParams`.

import { remap } from '../core/math.js';
import { noteFrequency } from '../music/theory.js';
import { FxChain } from './FxChain.js';
import { Tone } from './tone.js';

/** @typedef {import('../model/Track.js').Track} Track */

/** Base: FX chain handling and a change cache so unchanged values are not re-sent to Tone. */
class VoiceBase {
  constructor() {
    this.fx = new FxChain();
    /** @type {Map<string, unknown>} */
    this.cache = new Map();
    /**
     * Offline rendering cannot wait for a reverb to rebuild its impulse response
     * mid-render (it would go silent), so exports fix the decay up front.
     */
    this.lockReverbDecay = false;
  }

  /**
   * Run `apply` only if `value` differs from the last one applied under `key`.
   * @param {string} key @param {unknown} value @param {() => void} apply
   */
  changed(key, value, apply) {
    if (this.cache.get(key) === value) return;
    this.cache.set(key, value);
    apply();
  }

  /** FX section shared by synths and drums. @param {Track} track @param {number} step */
  applyFx(track, step) {
    const { fx } = this;
    const t = track.toggles;
    const out = (/** @type {string} */ id) => track.param(id).output(step);
    const val = (/** @type {string} */ id) => track.param(id).valueAt(step);

    this.changed('gain', track.gain, () => { fx.gain.gain.value = track.gain; });

    const cutoff = t.filter ? remap(/** @type {number} */ (out('filter.position')), 0, 1, 100, 10000) : 20000;
    this.changed('filter', cutoff, () => { fx.filter.frequency.value = cutoff; });

    const dist = t.dist ? val('dist.amount') : 0;
    this.changed('dist', dist, () => {
      fx.distortion.wet.value = t.dist ? 0.5 : 0;
      fx.distortion.distortion = dist;
    });

    if (t.delay) {
      const time = `${String(out('delay.time')).split('/')[1]}n`;
      this.changed('delayTime', time, () => { fx.delay.delayTime.value = time; });
      this.changed('delayFb', val('delay.feedback'), () => { fx.delay.feedback.value = val('delay.feedback'); });
      this.changed('delayWet', val('delay.mix'), () => { fx.delay.wet.value = val('delay.mix'); });
    } else {
      this.changed('delayWet', 0, () => { fx.delay.wet.value = 0; fx.delay.feedback.value = 0; });
    }

    if (t.reverb) {
      const decay = /** @type {number} */ (out('reverb.decay'));
      if (!(this.lockReverbDecay && this.cache.has('revDecay'))) this.changed('revDecay', decay, () => { fx.reverb.decay = decay; });
      this.changed('revWet', out('reverb.mix'), () => { fx.reverb.wet.value = /** @type {number} */ (out('reverb.mix')); });
    } else {
      this.changed('revWet', 0, () => { fx.reverb.wet.value = 0; if (!this.lockReverbDecay) fx.reverb.decay = 0.01; });
      if (!this.lockReverbDecay) this.cache.delete('revDecay');
    }
  }

  dispose() { this.fx.dispose(); }
}

/** Two polyphonic oscillators with their own envelopes (BASS, HARMONY, MELODY). */
export class SynthVoice extends VoiceBase {
  constructor() {
    super();
    this.oscillators = [new Tone.PolySynth(Tone.Synth), new Tone.PolySynth(Tone.Synth)];
    for (const osc of this.oscillators) osc.connect(this.fx.filter);
  }

  /** @param {Track} track @param {number} [step] automation step, or -1 for static knob values */
  apply(track, step = -1) {
    this.oscillators.forEach((osc, i) => {
      const n = i + 1;
      const p = (/** @type {string} */ id) => track.param(`osc${n}.${id}`);
      const env = (/** @type {string} */ id) => track.param(`env${n}.${id}`).output(step);

      if (track.toggles[`osc${n}`]) {
        const type = String(p('wave').output(step)).toLowerCase();
        const detune = /** @type {number} */ (p('pitch').output(step));
        const vol = /** @type {number} */ (p('volume').output(step));
        const volume = vol === 0 ? -Infinity : remap(vol, 0, 1, -50, 0);
        this.changed(`o${n}type`, type, () => osc.set({ oscillator: { type } }));
        this.changed(`o${n}detune`, detune, () => osc.set({ detune }));
        this.changed(`o${n}vol`, volume, () => osc.set({ volume }));
      } else {
        this.changed(`o${n}vol`, -Infinity, () => osc.set({ volume: -Infinity }));
      }

      const envelope = track.toggles[`env${n}`]
        ? { attack: env('attack'), decay: env('decay'), sustain: env('sustain'), release: env('release') }
        : { attack: 0, decay: 0, sustain: 1, release: 0 };
      this.changed(`o${n}env`, JSON.stringify(envelope), () => osc.set({ envelope }));
    });
    this.applyFx(track, step);
  }

  /** @param {number} pitch @param {number} octave @param {number} time */
  noteOn(pitch, octave, time) {
    const f = noteFrequency(pitch, octave);
    for (const osc of this.oscillators) osc.triggerAttack(f, time);
  }

  /** @param {number} pitch @param {number} octave @param {number} time */
  noteOff(pitch, octave, time) {
    const f = noteFrequency(pitch, octave);
    for (const osc of this.oscillators) osc.triggerRelease(f, time);
  }

  /** Short blip, used when placing notes. @param {number} pitch @param {number} octave @param {number} [seconds] */
  blip(pitch, octave, seconds = 0.1) {
    const f = noteFrequency(pitch, octave);
    for (const osc of this.oscillators) osc.triggerAttackRelease(f, seconds);
  }

  /** @param {number} [time] */
  releaseAll(time) {
    for (const osc of this.oscillators) osc.releaseAll(time);
  }
}

/** Seven one-shot samples with per-part volume and pitch (DRUMS). */
export class DrumVoice extends VoiceBase {
  /** @param {any[]} kit Tone.Buffer per drum part */
  constructor(kit) {
    super();
    this.kitName = '';
    this.parts = kit.map((/** @type {any} */ buffer) => {
      const player = new Tone.Player(buffer);
      player.connect(this.fx.filter);
      return player;
    });
  }

  /** @param {any[]} kit @param {string} name */
  setKit(kit, name) {
    this.parts.forEach((/** @type {any} */ part, i) => { part.buffer = kit[i]; });
    this.kitName = name;
  }

  /** @param {Track} track @param {number} [step] */
  apply(track, step = -1) {
    this.parts.forEach((/** @type {any} */ part, i) => {
      const gain = track.param(`part${i}.gain`).valueAt(step);
      const volume = track.toggles[`part${i}`] && gain > 0 ? remap(gain, 0, 1, -48, 0) : -Infinity;
      this.changed(`p${i}vol`, volume, () => { part.volume.value = volume; });

      const semitones = /** @type {number} */ (track.param(`part${i}.pitch`).output(step)) / 100;
      const rate = remap(semitones, -12, 12, 0.02, 2);
      this.changed(`p${i}rate`, rate, () => { part.playbackRate = rate; });
    });
    this.applyFx(track, step);
  }

  /** @param {number} part drum part index @param {number} [time] */
  hit(part, time) {
    const player = this.parts[part];
    if (!player?.loaded) return;
    player.stop(time);
    player.start(time);
    if (part === 2) this.parts[3]?.stop(time); // closed hat chokes the open hat
  }

  /** @param {number} pitch @param {number} _octave @param {number} time */
  noteOn(pitch, _octave, time) { this.hit(pitch, time); }

  noteOff() { /* one-shots */ }

  releaseAll() { /* one-shots */ }
}
