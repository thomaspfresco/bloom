// @ts-check
// "HUM/SING": record a take from the microphone and turn it into a melody track.

import { Emitter } from '../../core/events.js';
import { N_STEPS } from '../../core/constants.js';
import { Note } from '../../model/Note.js';
import { Track } from '../../model/Track.js';
import { MicRecorder } from '../../audio/MicRecorder.js';
import { RecordingSession } from '../../audio/RecordingSession.js';
import { transcribeMelody } from '../../audio/pitch/transcribe.js';

/**
 * @typedef {object} RecordState
 * @property {'closed' | 'opening' | 'denied' | 'unsupported' | 'idle' | 'countdown' | 'recording' | 'recorded' | 'analyzing'} status
 * @property {number} count       count-in beats left (4..1) while counting
 * @property {number[]} levels    0-1 loudness per step (length 64), 0 where nothing was recorded
 * @property {{samples: Float32Array, sampleRate: number, offsetSeconds: number, tempo: number} | null} take
 * @property {import('../../model/Loop.js').Loop | null} loop
 */

/** @extends {Emitter<{change: RecordState}>} */
export class RecordController extends Emitter {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.mic = new MicRecorder();
    this.session = new RecordingSession(this.mic, ctx.engine.metronome);
    /** @type {RecordState} */
    this.s = { status: 'closed', count: 0, levels: new Array(N_STEPS).fill(0), take: null, loop: null };
    /** quietest level seen: the noise floor used to scale the bars */
    this.floor = 0;

    this.session.on('step', ({ step, level }) => this.onStep(step, level));
    this.session.on('done', (take) => this.onDone(take));
  }

  get available() { return !!navigator.mediaDevices?.getUserMedia; }

  /** @param {Partial<RecordState>} patch */
  set(patch) { Object.assign(this.s, patch); this.emit('change', this.s); }

  /** @param {import('../../model/Loop.js').Loop} loop */
  async begin(loop) {
    this.set({ status: 'opening', loop, take: null, levels: new Array(N_STEPS).fill(0), count: 0 });
    const res = await this.mic.open();
    if (this.s.status !== 'opening') { this.mic.dispose(); return; }
    this.floor = 0;
    this.set({ status: res.ok ? 'idle' : res.reason === 'unsupported' ? 'unsupported' : 'denied' });
  }

  /** Space bar: start a take, or stop the current one. */
  toggle() {
    const { status, loop } = this.s;
    if (!loop) return;
    if (status === 'idle' || status === 'recorded') {
      this.ctx.actions.stopPlayback();
      this.floor = 0;
      this.set({ status: 'countdown', count: 4, take: null, levels: new Array(N_STEPS).fill(0) });
      this.session.start({ tempo: loop.tempo, click: loop.click });
    } else if (status === 'countdown' || status === 'recording') {
      this.session.stop(true);
    }
  }

  /** @param {number} step @param {number} dB */
  onStep(step, dB) {
    if (step < 0) { this.set({ status: 'countdown', count: Math.ceil(-step / 4) }); return; }
    if (Number.isFinite(dB)) this.floor = this.floor === 0 ? dB : Math.min(this.floor, dB);
    const span = Math.max(12, -this.floor);
    const level = Number.isFinite(dB) ? Math.max(0, Math.min(1, (dB - this.floor) / span)) : 0;
    const levels = this.s.levels.slice();
    levels[step] = Math.max(0.04, level);
    this.set({ status: 'recording', levels });
  }

  /** @param {{samples: Float32Array, sampleRate: number, offsetSeconds: number} | null} take */
  onDone(take) {
    if (!take || !this.s.loop) { this.set({ status: this.s.status === 'closed' ? 'closed' : 'idle', levels: new Array(N_STEPS).fill(0) }); return; }
    this.set({ status: 'recorded', take: { ...take, tempo: this.s.loop.tempo } });
  }

  /** Turn the take into a MELODY track. @returns {number} notes added (0 when nothing was detected) */
  transcribe() {
    const { take, loop } = this.s;
    if (!take || !loop || !loop.canAddTrack('MELODY')) return 0;
    this.set({ status: 'analyzing' });
    // the microphone adds ~50 ms; a late-starting capture moves notes later
    const notes = transcribeMelody(take.samples, take.sampleRate, {
      tempo: take.tempo, latencySeconds: 0.05 - take.offsetSeconds,
    });
    if (notes.length === 0) { this.set({ status: 'recorded' }); return 0; }

    const track = new Track('MELODY');
    track.notes = notes.map((n) => new Note(n));
    const lowest = Math.min(...notes.map((n) => n.octave));
    track.octaveWindow = Math.max(0, Math.min(7, lowest));
    loop.addTrack(track);
    this.ctx.session.touch('loop', loop.id);
    this.close();
    return notes.length;
  }

  cancel() { this.close(); }

  close() {
    this.session.stop(false);
    this.mic.dispose();
    this.set({ status: 'closed', loop: null, take: null, levels: new Array(N_STEPS).fill(0) });
  }
}

