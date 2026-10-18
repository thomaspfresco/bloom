// @ts-check
import { h } from '../dom.js';

/**
 * A labelled number/list selector with up and down arrows (the old `Scrollable`).
 * Hold an arrow to repeat. The mouse wheel over it steps by `inc`.
 *
 * `invert`: lists such as PRESET and PARAMETER read top-to-bottom, so the up
 * arrow moves to the *previous* entry (lower index), as in the original.
 */
export class Scroller {
  /**
   * @param {object} o
   * @param {string} o.label
   * @param {() => number} o.get
   * @param {(v: number) => void} o.set
   * @param {number} o.min @param {number} o.max
   * @param {(v: number) => string} o.format
   * @param {number} [o.inc] @param {number} [o.inc2] step while held
   * @param {boolean} [o.invert]
   * @param {boolean} [o.wheel]  step on mouse wheel
   * @param {string} [o.class]
   */
  constructor({ label, get, set, min, max, format, inc = 1, inc2 = inc, invert = false, wheel = false, class: cls = '' }) {
    this.o = { label, get, set, min, max, format, inc, inc2, invert };
    this.valueEl = h('span', { class: 'scroller-value' });
    this.labelEl = h('span', { class: 'scroller-label' }, label);
    this.up = h('button', { class: 'scroller-btn up', 'aria-label': `${label}: ${invert ? 'previous' : 'increase'}`, tabindex: '-1' }, h('img', { src: '/img/arrowUp.png', alt: '', draggable: 'false' }));
    this.down = h('button', { class: 'scroller-btn down', 'aria-label': `${label}: ${invert ? 'next' : 'decrease'}`, tabindex: '-1' }, h('img', { src: '/img/arrowDown.png', alt: '', draggable: 'false' }));
    this.el = h('div', { class: `scroller ${cls}`, role: 'spinbutton', tabindex: '0', 'aria-label': label },
      h('div', { class: 'scroller-arrows' }, this.up, this.down),
      h('div', { class: 'scroller-text' }, this.valueEl, this.labelEl));

    this.bindHold(this.up, +1);
    this.bindHold(this.down, -1);
    this.el.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { this.step(+1, inc); e.preventDefault(); e.stopPropagation(); }
      if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { this.step(-1, inc); e.preventDefault(); e.stopPropagation(); }
    });
    if (wheel) this.el.addEventListener('wheel', (e) => { e.preventDefault(); this.step(e.deltaY > 0 ? +1 : -1, inc); }, { passive: false });
    this.refresh();
  }

  /** Move by `amount` entries in arrow direction `dir` (+1 = up arrow). @param {1 | -1} dir @param {number} amount */
  step(dir, amount) {
    const { get, set, min, max, invert } = this.o;
    const delta = (invert ? -dir : dir) * amount;
    const next = Math.min(max, Math.max(min, get() + delta));
    if (next !== get()) { set(next); this.refresh(); }
  }

  /** @param {HTMLElement} btn @param {1 | -1} dir */
  bindHold(btn, dir) {
    /** @type {ReturnType<typeof setTimeout> | null} */ let delay = null;
    /** @type {ReturnType<typeof setInterval> | null} */ let repeat = null;
    const stop = () => {
      if (delay) clearTimeout(delay);
      if (repeat) clearInterval(repeat);
      delay = repeat = null;
    };
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.step(dir, this.o.inc);
      delay = setTimeout(() => { repeat = setInterval(() => this.step(dir, this.o.inc2), 1000 / 60); }, 500);
    });
    for (const t of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(t, stop);
  }

  /** Re-read the value and update text and arrow availability. */
  refresh() {
    const { get, min, max, invert, format } = this.o;
    const v = get();
    this.valueEl.textContent = format(v);
    this.el.setAttribute('aria-valuenow', String(v));
    this.up.classList.toggle('off', invert ? v <= min : v >= max);
    this.down.classList.toggle('off', invert ? v >= max : v <= min);
  }
}
