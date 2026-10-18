// @ts-check
import { Component } from '../Component.js';
import { h } from '../dom.js';

/** Full-screen loading indicator for long tasks (audio export, MIDI export). */
export class Busy extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'busy', hidden: true, role: 'status', 'aria-live': 'polite', 'aria-label': 'Working' },
      h('img', { src: '/img/load.gif', alt: '' }));
    this.listen(this.ctx.ui, 'change', ({ keys }) => { if (keys.includes('busy')) this.update(); });
  }

  update() { this.el.hidden = !this.ctx.ui.s.busy; }
}
