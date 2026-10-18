// @ts-check
import { Component } from '../Component.js';
import { h } from '../dom.js';

/** Black rectangles that fade away to reveal new content. Regions mirror the old `blackOpa1..4`. */
export class Blackouts extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'blackouts', 'aria-hidden': 'true' });
    /** @type {Record<string, HTMLElement[]>} */
    this.regions = {
      screen: [h('i', { class: 'blackout screen' })],
      controls: [h('i', { class: 'blackout controls-left' }), h('i', { class: 'blackout controls-right' })],
      context: [h('i', { class: 'blackout context' })],
      grid: [h('i', { class: 'blackout grid' })],
      ruler: [h('i', { class: 'blackout ruler' })],
    };
    this.el.append(...Object.values(this.regions).flat());
    this.listen(ctx.fades, 'fade', (names) => names.forEach((n) => this.run(n)));
    this.run('screen'); // the page itself fades in from black on load
  }

  /** @param {string} name */
  run(name) {
    for (const el of this.regions[name] ?? []) {
      el.classList.remove('run');
      void el.offsetWidth; // restart the animation
      el.classList.add('run');
    }
  }
}
