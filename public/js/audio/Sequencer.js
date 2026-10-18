// @ts-check
// Live playback: drives a PlaybackCursor from Tone.Transport (one tick per 16th).

import { Emitter } from '../core/events.js';
import { PlaybackCursor } from './playback/PlaybackCursor.js';
import { playTick } from './playback/playTick.js';
import { Tone } from './tone.js';

/** @typedef {import('./playback/PlaybackCursor.js').PlaybackPlan} PlaybackPlan */
/** @typedef {import('./playback/PlaybackCursor.js').Tick} Tick */

/**
 * @typedef {object} SequencerEvents
 * @property {Tick} tick       fired in sync with what the listener hears (via Tone.Draw)
 * @property {{plan: PlaybackPlan}} start
 * @property {void} stop
 */

/** @extends {Emitter<SequencerEvents>} */
export class Sequencer extends Emitter {
  /** @param {import('./VoiceBank.js').VoiceBank} bank @param {import('./Metronome.js').Metronome} metronome */
  constructor(bank, metronome) {
    super();
    this.bank = bank;
    this.metronome = metronome;
    /** @type {PlaybackCursor | null} */
    this.cursor = null;
    /** @type {number | null} */
    this.eventId = null;
    this.playing = false;
    /** Step most recently reported to listeners (-1 before the first tick). */
    this.step = -1;
  }

  get plan() { return this.cursor?.plan ?? null; }

  /**
   * Start (or restart) playback of a plan.
   * @param {PlaybackPlan} plan @param {{fromStep?: number}} [opts]
   */
  play(plan, { fromStep = 0 } = {}) {
    this.#halt();
    this.cursor = new PlaybackCursor(plan);
    if (fromStep > 0) this.cursor.seek(fromStep);
    this.step = -1;

    this.eventId = Tone.Transport.scheduleRepeat((/** @type {number} */ time) => this.#onTick(time), '16n');
    Tone.Transport.start();
    this.playing = true;
    this.emit('start', { plan });
  }

  /** Jump to a step; starts playback if stopped. @param {number} step */
  seek(step) {
    if (!this.cursor) return;
    this.cursor.seek(step);
    if (!this.playing) this.play(this.cursor.plan, { fromStep: step });
  }

  stop() {
    if (!this.playing && this.eventId === null) return;
    this.#halt();
    this.emit('stop', undefined);
  }

  #halt() {
    if (this.eventId !== null) Tone.Transport.clear(this.eventId);
    this.eventId = null;
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    this.bank.releaseAll();
    this.playing = false;
    this.step = -1;
  }

  /** @param {number} time */
  #onTick(time) {
    const cursor = this.cursor;
    const tick = cursor?.advance();
    if (!cursor || !tick) {
      Tone.Draw.schedule(() => this.stop(), time);
      return;
    }
    Tone.Transport.bpm.value = tick.bpm;
    playTick(tick, this.bank, time);
    this.metronome.click(tick.click, time);
    Tone.Draw.schedule(() => {
      if (!this.playing) return;
      this.step = tick.step;
      this.emit('tick', tick);
    }, time);
  }
}
