// @ts-check
// One take: a four-beat count-in, then a full loop (64 steps) recorded from the
// microphone. Timing comes from Tone.Transport, like normal playback.

import { Emitter } from '../core/events.js';
import { N_STEPS } from '../core/constants.js';
import { Tone } from './tone.js';

export const COUNT_IN_STEPS = 16;

/**
 * @typedef {object} RecordingEvents
 * @property {{step: number, level: number}} step   step runs -16..63 (negative = count-in); level in dB
 * @property {{samples: Float32Array, sampleRate: number, offsetSeconds: number} | null} done  null when stopped early
 */

/** @extends {Emitter<RecordingEvents>} */
export class RecordingSession extends Emitter {
  /** @param {import('./MicRecorder.js').MicRecorder} mic @param {import('./Metronome.js').Metronome} metronome */
  constructor(mic, metronome) {
    super();
    this.mic = mic;
    this.metronome = metronome;
    /** @type {number | null} */ this.eventId = null;
    this.step = -COUNT_IN_STEPS - 1;
    this.running = false;
    this.startedAt = 0;
    this.step0Time = 0;
  }

  /** @param {{tempo: number, click: boolean}} opts */
  start({ tempo, click }) {
    this.stop(false);
    this.running = true;
    this.step = -COUNT_IN_STEPS - 1;
    Tone.Transport.bpm.value = tempo;
    this.eventId = Tone.Transport.scheduleRepeat((/** @type {number} */ time) => this.#tick(time, click), '16n');
    Tone.Transport.start();
  }

  /** @param {number} time @param {boolean} click */
  #tick(time, click) {
    this.step++;
    const step = this.step;

    if (step <= N_STEPS - 1) {
      // metronome during count-in and recording: accent each bar, beat each quarter
      const rel = step < 0 ? step + COUNT_IN_STEPS : step;
      if (click || step < 0) this.metronome.click(rel % 16 === 0 ? 'accent' : rel % 4 === 0 ? 'beat' : null, time);
    }

    if (step === 0) {
      this.step0Time = time;
      this.mic.start().then((t) => { this.startedAt = t; });
    }

    const level = this.mic.level();
    if (step <= N_STEPS - 1) Tone.Draw.schedule(() => { if (this.running) this.emit('step', { step, level }); }, time);

    if (step === N_STEPS) {
      // one tick after the last step: everything has been captured
      this.#finish();
    }
  }

  async #finish() {
    this.#halt();
    const audio = await this.mic.stop();
    // capture starts a little after step 0 (positive offset) or a little before
    const offsetSeconds = this.startedAt ? this.startedAt - this.step0Time : 0;
    this.emit('done', audio ? { ...audio, offsetSeconds } : null);
  }

  #halt() {
    if (this.eventId !== null) Tone.Transport.clear(this.eventId);
    this.eventId = null;
    Tone.Transport.stop();
    Tone.Transport.seconds = 0;
    this.running = false;
  }

  /** Abort the take. @param {boolean} [notify] emit `done: null` */
  stop(notify = true) {
    const wasRunning = this.running;
    this.#halt();
    if (this.mic.recording) this.mic.stop().catch(() => {});
    if (wasRunning && notify) this.emit('done', null);
  }
}
