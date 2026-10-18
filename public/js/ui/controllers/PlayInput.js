// @ts-check
// Playing the selected track from the computer keyboard or a MIDI keyboard,
// and recording those notes into it while the loop plays.

import { MAX_INPUT_NOTES } from '../../core/constants.js';
import { Note } from '../../model/Note.js';
import { addNote } from '../../model/noteOps.js';
import { DRUM_LABELS } from '../../music/theory.js';

/** @typedef {{pitch: number, octave: number, start: number}} Pending */

export class PlayInput {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** keys currently held, as "pitch:octave" */
    this.held = new Set();
    /** @type {Map<string, Pending>} notes being recorded */
    this.pending = new Map();
    ctx.engine.on('tick', (t) => { if (t.step === 63) this.flush(t.step); });
    ctx.engine.on('stop', () => { this.pending.clear(); });
  }

  /** Track that notes would go to: the open track of the active loop. */
  target() {
    const t = this.ctx.notes.target();
    return t ?? null;
  }

  /** @param {number} pitch 0-11 (drum part for drums) @param {number} octave */
  noteOn(pitch, octave) {
    const t = this.target();
    if (!t) return;
    const { track, loop } = t;
    if (track.isDrums) { if (pitch >= DRUM_LABELS.length) return; octave = 0; }
    const id = `${pitch}:${octave}`;
    if (this.held.has(id) || this.held.size >= MAX_INPUT_NOTES) return;
    this.held.add(id);
    this.ctx.engine.noteOn(track, pitch, octave);

    const { ui } = this.ctx;
    if (loop.record && ui.s.playing && ui.s.step > -1 && !this.pending.has(id)) {
      this.pending.set(id, { pitch, octave, start: ui.s.step });
      if (!track.isDrums && track.octaveWindow !== octave && track.octaveWindow + 1 !== octave) {
        track.octaveWindow = Math.min(7, octave);
        this.ctx.session.touch('loop', loop.id);
      }
    }
  }

  /** @param {number} pitch @param {number} octave */
  noteOff(pitch, octave) {
    const t = this.target();
    if (!t) { this.held.clear(); return; }
    const { track, loop } = t;
    if (track.isDrums) octave = 0;
    const id = `${pitch}:${octave}`;
    if (!this.held.delete(id)) return;
    this.ctx.engine.noteOff(track, pitch, octave);

    const rec = this.pending.get(id);
    if (rec) {
      this.pending.delete(id);
      const step = this.ctx.ui.s.step;
      const duration = Math.max(1, (step < rec.start ? 64 : step) - rec.start);
      addNote(track.notes, new Note({ pitch, octave, start: rec.start, duration: Math.min(duration, 64 - rec.start) }));
      this.ctx.session.touch('loop', loop.id);
    }
  }

  /** At the end of the loop, close notes that are still being held. @param {number} step */
  flush(step) {
    const t = this.target();
    if (!t) { this.pending.clear(); return; }
    for (const [id, rec] of this.pending) {
      const duration = Math.max(1, step - rec.start + 1);
      addNote(t.track.notes, new Note({ pitch: rec.pitch, octave: rec.octave, start: rec.start, duration }));
      // keep sounding into the next pass: it restarts at step 0
      this.pending.set(id, { ...rec, start: 0 });
    }
    if (this.pending.size) this.ctx.session.touch('loop', t.loop.id);
  }

  /** Release everything held (e.g. when the octave changes). */
  releaseAll() {
    const t = this.target();
    if (t) for (const id of this.held) {
      const [p, o] = id.split(':').map(Number);
      this.ctx.engine.noteOff(t.track, p, o);
    }
    this.held.clear();
    this.pending.clear();
  }
}

