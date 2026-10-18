// @ts-check
// Home screen text (port of Session.showSuggestions and the drawer hints drawn
// while no tab is open): a random Oblique Strategy, new every 15 s or after a
// click, fading in over about 0.85 s; two small icons hinting at the drawers.

import { OBLIQUE_STRATEGIES } from '../../music/obliqueStrategies.js';
import { Random } from '../../core/random.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';

const ROTATE_MS = 15000;

export class HomeView extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('section', { class: 'home', 'aria-label': 'Home' });
    this.quote = h('p', { class: 'quote' });
    this.credit = h('p', { class: 'quote-credit' }, 'in Oblique Strategies — Brian Eno, Peter Schmidt');
    this.hintLeft = h('img', { class: 'edge-hint left', src: '/img/loops.png', alt: '', draggable: 'false' });
    this.hintRight = h('img', { class: 'edge-hint right', src: '/img/structs.png', alt: '', draggable: 'false' });
    this.el.append(this.quote, this.credit, this.hintLeft, this.hintRight);

    this.index = Random.shared.int(0, OBLIQUE_STRATEGIES.length);
    this.timer = setInterval(() => this.next(), ROTATE_MS);
    this.onDestroy(() => clearInterval(this.timer));
    // a click on the empty screen asks for a new one
    this.on(document, 'pointerup', (e) => {
      if (this.el.hidden || this.ctx.menus.isOpen || this.ctx.ui.s.drawer) return;
      if (/** @type {HTMLElement} */ (e.target).closest('button, input, a, .tab')) return;
      this.next();
    });
    this.listen(this.ctx.session, 'change', () => this.update());
    this.listen(this.ctx.ui, 'change', ({ keys }) => { if (keys.includes('drawer')) this.update(); });
    this.render();
  }

  next() {
    this.index = Random.shared.int(0, OBLIQUE_STRATEGIES.length);
    this.render();
  }

  render() {
    this.quote.classList.remove('in');
    this.quote.textContent = `"${OBLIQUE_STRATEGIES[this.index]}"`;
    void this.quote.offsetWidth; // restart the fade-in
    this.quote.classList.add('in');
  }

  update() {
    const visible = this.ctx.session.active === null;
    if (this.el.hidden === visible) {
      this.el.hidden = !visible;
      if (visible) this.render();
    }
    const drawer = this.ctx.ui.s.drawer;
    this.hintLeft.classList.toggle('away', drawer === 'loops');
    this.hintRight.classList.toggle('away', drawer === 'structs');
  }
}
