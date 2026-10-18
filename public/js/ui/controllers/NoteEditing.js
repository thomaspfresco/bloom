// @ts-check
// Edits to the notes of the open track: selection, delete, resize. Shared by
// the grid editor (pointer) and the keyboard controller.

import { N_STEPS } from '../../core/constants.js';
import { makeRoomFor, removeNotes } from '../../model/noteOps.js';

export class NoteEditing {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) { this.ctx = ctx; }

  /** Loop and track currently open in the grid, if any. */
  target() {
    const { session, ui } = this.ctx;
    if (session.active?.type !== 'loop') return null;
    const loop = /** @type {import('../../model/Loop.js').Loop | null} */ (session.activeItem);
    const track = loop && ui.s.selectedTrackId ? loop.track(ui.s.selectedTrackId) : null;
    return loop && track ? { loop, track } : null;
  }

  /** @param {Iterable<string>} ids */
  select(ids) { this.ctx.ui.set({ selectedNotes: new Set(ids) }); }

  clearSelection() {
    if (this.ctx.ui.s.selectedNotes.size) this.ctx.ui.set({ selectedNotes: new Set() });
  }

  /** Backspace / Delete. */
  deleteSelected() {
    const t = this.target();
    const ids = this.ctx.ui.s.selectedNotes;
    if (!t || !ids.size) return false;
    for (const id of ids) {
      const n = t.track.notes.find((x) => x.id === id);
      if (n && !t.track.isDrums) this.ctx.engine.noteOff(t.track, n.pitch, n.octave);
    }
    removeNotes(t.track.notes, new Set(ids));
    this.ctx.ui.set({ selectedNotes: new Set(), hoverNoteId: null });
    this.ctx.session.touch('loop', t.loop.id);
    return true;
  }

  /** Mouse wheel: lengthen (+1) or shorten (-1) the selected notes. @param {1 | -1} dir */
  resizeSelected(dir) {
    const t = this.target();
    const ids = this.ctx.ui.s.selectedNotes;
    if (!t || !ids.size) return false;
    for (const note of t.track.notes) {
      if (!ids.has(note.id)) continue;
      if (dir > 0 && note.end < N_STEPS) note.duration++;
      else if (dir < 0 && note.duration > 1) note.duration--;
      else continue;
      makeRoomFor(t.track.notes, note);
    }
    this.ctx.session.touch('loop', t.loop.id);
    return true;
  }
}
