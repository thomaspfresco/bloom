// @ts-check
// State machine behind "+ track": choose how to start, review four AI
// suggestions (with live preview), or record a melody. UI state only; nothing
// here is saved until the user picks a suggestion.

import { Emitter } from '../../core/events.js';
import { Note } from '../../model/Note.js';
import { Track } from '../../model/Track.js';

/** @typedef {import('../../model/Loop.js').Loop} Loop */
/** @typedef {import('../../music/trackKinds.js').TrackKind} TrackKind */

/**
 * @typedef {object} GenState
 * @property {'closed' | 'mode' | 'loading' | 'review' | 'record'} phase
 * @property {Loop | null} loop
 * @property {TrackKind | null} kind
 * @property {{label: string, track: Track}[]} candidates
 * @property {number} hover      index of the previewed candidate, -1 for none
 * @property {boolean} solo      preview the candidate without the rest of the loop
 * @property {number} octave     octave window shared by the candidates
 * @property {string} error
 */

/** @extends {Emitter<{change: GenState}>} */
export class GenerateController extends Emitter {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super();
    this.ctx = ctx;
    /** @type {GenState} */
    this.s = { phase: 'closed', loop: null, kind: null, candidates: [], hover: -1, solo: true, octave: 3, error: '' };
    this.requestId = 0;
  }

  get isOpen() { return this.s.phase !== 'closed'; }

  /** @param {Partial<GenState>} patch */
  set(patch) {
    Object.assign(this.s, patch);
    this.emit('change', this.s);
  }

  /** Open the "how do you want to start" screen. @param {Loop} loop @param {TrackKind} kind */
  begin(loop, kind) {
    this.ctx.actions.stopPlayback();
    this.ctx.actions.selectTrack(null);
    this.ctx.generator.preload(kind);
    this.set({ phase: 'mode', loop, kind, candidates: [], hover: -1, solo: true, error: '' });
  }

  cancel() {
    this.ctx.record.cancel();
    this.requestId++;
    this.ctx.actions.stopPlayback();
    this.set({ phase: 'closed', loop: null, kind: null, candidates: [], hover: -1 });
  }

  /** An empty track. */
  fromScratch() {
    const { loop, kind } = this.s;
    if (loop && kind) this.ctx.actions.addEmptyTrack(loop, kind);
    this.cancel();
  }

  /** Ask the generator for four suggestions (also used by REGENERATE). */
  async suggest() {
    const { loop, kind } = this.s;
    if (!loop || !kind) return;
    const id = ++this.requestId;
    this.ctx.actions.stopPlayback();
    this.set({ phase: 'loading', candidates: [], hover: -1, error: '' });
    try {
      const results = await this.ctx.generator.suggest(kind, loop.toGenerationContext());
      if (id !== this.requestId) return; // cancelled meanwhile
      const candidates = results.map((r) => {
        const track = new Track(kind);
        track.notes = r.notes.map((n) => new Note(n));
        if (!track.isDrums && r.notes.length) track.octaveWindow = r.notes[0].octave;
        return { label: r.label, track };
      });
      this.set({ phase: 'review', candidates, octave: candidates[0]?.track.octaveWindow ?? 3 });
    } catch (err) {
      console.error(err);
      if (id !== this.requestId) return;
      this.set({ phase: 'mode', error: 'Could not generate suggestions. Check your connection and try again.' });
    }
  }

  /** Preview a candidate (pass -1 to stop). @param {number} index */
  hover(index) {
    if (this.s.phase !== 'review' || index === this.s.hover) return;
    const { loop, candidates } = this.s;
    this.ctx.actions.stopPlayback();
    this.set({ hover: index });
    if (index >= 0 && loop && candidates[index]) {
      const cand = candidates[index].track;
      this.ctx.engine.playLoop(loop, {
        click: false,
        tracks: () => (this.s.solo ? [cand] : [...loop.tracks, cand]),
      });
    }
  }

  /** Hum or sing a melody (needs the pitch detector). */
  recordMelody() {
    const loop = this.s.loop;
    if (!loop) return;
    this.set({ phase: 'record' });
    this.ctx.record.begin(loop);
  }

  /** @param {boolean} solo */
  setSolo(solo) { this.set({ solo }); }

  /** Move every suggestion to another octave. @param {number} octave */
  setOctave(octave) {
    for (const { track } of this.s.candidates) {
      track.octaveWindow = octave;
      for (const n of track.notes) n.octave = octave;
    }
    this.ctx.engine.releaseAll();
    this.set({ octave });
  }

  /** Keep a suggestion as a new track. @param {number} index */
  choose(index) {
    const { loop, candidates } = this.s;
    const cand = candidates[index];
    if (!loop || !cand) return;
    this.ctx.actions.stopPlayback();
    loop.addTrack(cand.track);
    this.ctx.session.touch('loop', loop.id);
    this.set({ phase: 'closed', loop: null, kind: null, candidates: [], hover: -1 });
  }
}
