// @ts-check
// Facade over everything audible. UI code talks to this, never to Tone directly.

import { Emitter } from '../core/events.js';
import { Metronome } from './Metronome.js';
import { Sequencer } from './Sequencer.js';
import { Tone } from './tone.js';
import { VoiceBank } from './VoiceBank.js';
import { downloadBlob, renderPlanToWav } from './exportAudio.js';

/** @typedef {import('../model/Loop.js').Loop} Loop */
/** @typedef {import('../model/Structure.js').Structure} Structure */
/** @typedef {import('../model/Track.js').Track} Track */
/** @typedef {import('./playback/PlaybackCursor.js').Tick} Tick */

/**
 * @typedef {object} EngineEvents
 * @property {Tick} tick
 * @property {void} start
 * @property {void} stop
 */

/** @extends {Emitter<EngineEvents>} */
export class AudioEngine extends Emitter {
  constructor() {
    super();
    this.unlocked = false;
    this.bank = new VoiceBank();
    this.metronome = new Metronome();
    this.sequencer = new Sequencer(this.bank, this.metronome);
    this.sequencer.on('tick', (t) => this.emit('tick', t));
    this.sequencer.on('start', () => this.emit('start', undefined));
    this.sequencer.on('stop', () => this.emit('stop', undefined));
  }

  /**
   * Browsers keep audio suspended until a user gesture. Call from a click/keydown handler.
   */
  async unlock() {
    if (this.unlocked) return;
    await Tone.start();
    this.unlocked = true;
  }

  get playing() { return this.sequencer.playing; }
  get step() { return this.sequencer.step; }

  // ---- transport ----------------------------------------------------------

  /**
   * Play a loop on repeat.
   * @param {Loop} loop
   * @param {{click?: boolean, tracks?: () => readonly Track[], fromStep?: number}} [opts]
   *   `click: false` silences the metronome (drawer previews); `tracks` swaps what sounds live.
   */
  playLoop(loop, { click, tracks, fromStep } = {}) {
    this.sequencer.play({ type: 'loop', loop, click, tracks }, { fromStep });
  }

  /**
   * Play a structure on repeat.
   * @param {Structure} struct @param {(loopId: string) => Loop | null} resolveLoop
   */
  playStruct(struct, resolveLoop) {
    this.sequencer.play({ type: 'struct', struct, resolveLoop });
  }

  stop() { this.sequencer.stop(); }

  /** Jump the playhead (the time bar). @param {number} step */
  seek(step) { this.sequencer.seek(step); }

  // ---- instant sounds (keyboard, MIDI, placing notes) --------------------

  /** Start a held note on a track's instrument. @param {Track} track @param {number} pitch @param {number} octave */
  noteOn(track, pitch, octave) {
    this.bank.prepare(track).noteOn(pitch, octave, Tone.now());
  }

  /** @param {Track} track @param {number} pitch @param {number} octave */
  noteOff(track, pitch, octave) {
    this.bank.voice(track.kind).noteOff(pitch, octave, Tone.now());
  }

  /** Short preview of one note (used when placing notes). @param {Track} track @param {number} pitch @param {number} octave */
  blip(track, pitch, octave) {
    const voice = this.bank.prepare(track);
    if (track.isDrums) voice.noteOn(pitch, octave, Tone.now());
    else /** @type {import('./Voice.js').SynthVoice} */ (voice).blip(pitch, octave);
  }

  releaseAll() { this.bank.releaseAll(); }

  /** Output level of a kind's voice in dB, for the studio meters. @param {Track} track */
  levels(track) { return this.bank.levels(track.kind); }

  // ---- export -------------------------------------------------------------

  /** Render a loop to a .wav download. @param {Loop} loop */
  async exportLoop(loop) {
    this.stop();
    const blob = await renderPlanToWav({ type: 'loop', loop, click: false });
    downloadBlob(blob, `${loop.name}.wav`);
  }

  /** Render a structure to a .wav download. @param {Structure} struct @param {(loopId: string) => Loop | null} resolveLoop */
  async exportStruct(struct, resolveLoop) {
    this.stop();
    const blob = await renderPlanToWav({ type: 'struct', struct, resolveLoop });
    downloadBlob(blob, `${struct.name}.wav`);
  }
}
