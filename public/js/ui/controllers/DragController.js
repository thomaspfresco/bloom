// @ts-check
// Dragging a loop or structure out of a drawer onto a structure tab.

import { Emitter } from '../../core/events.js';

/**
 * @typedef {object} DragEvents
 * @property {{kind: 'loop' | 'struct', id: string, x: number, y: number}} move
 * @property {{kind: 'loop' | 'struct', id: string, x: number, y: number}} drop
 * @property {void} cancel
 */

/** @extends {Emitter<DragEvents>} */
export class DragController extends Emitter {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super();
    this.ctx = ctx;
    /** @type {{kind: 'loop' | 'struct', id: string} | null} */
    this.current = null;
    this.x = 0;
    this.y = 0;
  }

  get active() { return this.current !== null; }

  /** @param {'loop' | 'struct'} kind @param {string} id @param {number} x @param {number} y */
  start(kind, id, x, y) {
    this.current = { kind, id };
    this.x = x; this.y = y;
    this.ctx.actions.stopPlayback();
    this.ctx.ui.set({ dragId: id, previewId: null });
    this.emit('move', { kind, id, x, y });
  }

  /** @param {number} x @param {number} y */
  move(x, y) {
    if (!this.current) return;
    this.x = x; this.y = y;
    this.emit('move', { ...this.current, x, y });
  }

  /** @param {boolean} [drop] false cancels without dropping */
  end(drop = true) {
    const cur = this.current;
    if (!cur) return;
    this.current = null;
    this.ctx.ui.set({ dragId: null });
    if (drop) this.emit('drop', { ...cur, x: this.x, y: this.y });
    else this.emit('cancel', undefined);
  }
}
