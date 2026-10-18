// @ts-check
import { Component } from '../Component.js';
import { h } from '../dom.js';

/**
 * The two faint undo / redo arrows at the top left of the editor. In the original
 * they are drawn but do nothing (hovering shows a "not allowed" cursor).
 */
export class History extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'history', 'aria-hidden': 'true' },
      h('img', { class: 'undo', src: '/img/undo.png', alt: '', draggable: 'false' }),
      h('img', { class: 'redo', src: '/img/redo.png', alt: '', draggable: 'false' }));
    this.listen(ctx.ui, 'change', ({ keys }) => { if (keys.includes('selectedTrackId')) this.update(); });
  }

  update() { this.el.hidden = this.ctx.ui.s.selectedTrackId === null; }
}
