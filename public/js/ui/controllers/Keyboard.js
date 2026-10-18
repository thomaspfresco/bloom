// @ts-check
// Global shortcuts. Typing into text fields and menus is left alone.

import { KEY_OCTAVE } from '../../core/constants.js';
import { keyToPitch } from '../../music/theory.js';

export class Keyboard {
  /** @param {import('../context.js').UiContext} ctx @param {import('./PlayInput.js').PlayInput} input */
  constructor(ctx, input) {
    this.ctx = ctx;
    this.input = input;
    this.octave = KEY_OCTAVE.default;
    window.addEventListener('keydown', (e) => this.down(e));
    window.addEventListener('keyup', (e) => this.up(e));
    window.addEventListener('blur', () => this.input.releaseAll());
  }

  /** @param {KeyboardEvent} e */
  ignore(e) {
    const el = /** @type {HTMLElement | null} */ (e.target);
    if (e.ctrlKey || e.metaKey || e.altKey) return true;
    if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return true;
    return this.ctx.menus.isOpen;
  }

  get editing() { return this.ctx.notes.target() !== null; }

  /** @param {KeyboardEvent} e */
  down(e) {
    if (this.ignore(e)) return;
    const { ui, actions, session, generate } = this.ctx;

    if (e.key === ' ') {
      e.preventDefault();
      if (e.repeat || ui.s.drawer || generate.s.phase === 'review') return;
      if (generate.isOpen) return;
      if (session.active) actions.togglePlay();
      return;
    }
    if (e.repeat) return;

    if (e.key === 'Backspace' || e.key === 'Delete') {
      if (this.ctx.notes.deleteSelected()) e.preventDefault();
      return;
    }

    if (ui.s.drawer || generate.isOpen || !this.editing) return;
    const pitch = keyToPitch(e.key);
    if (pitch >= 0) this.input.noteOn(pitch, this.octave);
  }

  /** @param {KeyboardEvent} e */
  up(e) {
    if (e.key === ' ') { e.preventDefault(); return; }
    if (this.ignore(e)) return;
    const { ui, actions, generate } = this.ctx;
    if (ui.s.drawer || generate.isOpen) return;

    const key = e.key.toUpperCase();
    const pitch = keyToPitch(e.key);
    if (pitch >= 0) this.input.noteOff(pitch, this.octave);

    const track = this.ctx.notes.target();
    if (!track) return;

    if (key === 'Z' && this.octave > KEY_OCTAVE.min) this.shiftOctave(-1);
    else if (key === 'X' && this.octave < KEY_OCTAVE.max) this.shiftOctave(+1);
    else if (e.key === 'ArrowLeft' && ui.s.view > 0) actions.setView(/** @type {0 | 1 | 2} */ (ui.s.view - 1));
    else if (e.key === 'ArrowRight' && ui.s.view < 2) actions.setView(/** @type {0 | 1 | 2} */ (ui.s.view + 1));
    else if (e.key === 'Escape') actions.selectTrack(null);

  }

  /** @param {1 | -1} dir */
  shiftOctave(dir) {
    this.input.releaseAll();
    this.octave += dir;
    this.ctx.ui.set({ keyboardOctave: this.octave });
    this.ctx.toast.show(`Current keyboard octave: ${this.octave}`, 1500);
  }
}
