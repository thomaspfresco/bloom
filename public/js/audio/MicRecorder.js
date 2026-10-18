// @ts-check
// Microphone capture: open the mic, watch its level, record to an AudioBuffer.

import { Tone } from './tone.js';

/** @typedef {{ok: true} | {ok: false, reason: 'unsupported' | 'denied' | 'error'}} OpenResult */

export class MicRecorder {
  constructor() {
    /** @type {any} */ this.mic = null;
    /** @type {any} */ this.meter = null;
    /** @type {any} */ this.recorder = null;
    this.isOpen = false;
    this.recording = false;
  }

  /** Ask for the microphone. Never throws. @returns {Promise<OpenResult>} */
  async open() {
    if (this.isOpen) return { ok: true };
    if (!navigator.mediaDevices?.getUserMedia) return { ok: false, reason: 'unsupported' };
    try {
      this.mic = new Tone.UserMedia();
      this.meter = new Tone.Meter({ smoothing: 0.2 });
      this.recorder = new Tone.Recorder();
      this.mic.connect(this.meter);
      this.meter.connect(this.recorder); // the meter passes audio through
      await this.mic.open();
      this.isOpen = true;
      return { ok: true };
    } catch (err) {
      this.dispose();
      const name = /** @type {any} */ (err)?.name ?? '';
      return { ok: false, reason: name === 'NotAllowedError' || name === 'SecurityError' || /permission|denied|allowed/i.test(String(err)) ? 'denied' : 'error' };
    }
  }

  /** Current input level in dB (-Infinity when silent). */
  level() {
    const v = this.meter?.getValue();
    return typeof v === 'number' ? v : -Infinity;
  }

  /** Begin capturing. @returns {Promise<number>} the audio-context time at which capture actually began */
  async start() {
    if (!this.isOpen || this.recording) return Tone.now();
    this.recording = true;
    await this.recorder.start();
    return Tone.now();
  }

  /** Stop and decode what was captured. @returns {Promise<{samples: Float32Array, sampleRate: number} | null>} */
  async stop() {
    if (!this.recording) return null;
    this.recording = false;
    const blob = /** @type {Blob} */ (await this.recorder.stop());
    const bytes = await blob.arrayBuffer();
    const ctx = /** @type {AudioContext} */ (Tone.getContext().rawContext);
    const decoded = await ctx.decodeAudioData(bytes);
    // mix to mono
    const out = new Float32Array(decoded.length);
    for (let c = 0; c < decoded.numberOfChannels; c++) {
      const ch = decoded.getChannelData(c);
      for (let i = 0; i < out.length; i++) out[i] += ch[i] / decoded.numberOfChannels;
    }
    return { samples: out, sampleRate: decoded.sampleRate };
  }

  /** Release the microphone. */
  dispose() {
    try { this.mic?.close(); } catch { /* ignore */ }
    for (const n of [this.mic, this.meter, this.recorder]) { try { n?.dispose(); } catch { /* ignore */ } }
    this.mic = this.meter = this.recorder = null;
    this.isOpen = false;
    this.recording = false;
  }
}
