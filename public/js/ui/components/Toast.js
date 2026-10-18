// @ts-check
import { h } from '../dom.js';

/** Short messages at the top right (the original "log"). */
export class Toast {
  /** @param {HTMLElement} parent */
  constructor(parent) {
    this.el = h('div', { class: 'toast', role: 'status', 'aria-live': 'polite' });
    parent.appendChild(this.el);
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.timer = null;
    /** @type {string | null} */
    this.message = null;
  }

  /** @param {string} message @param {number} [ms] */
  show(message, ms = 3000) {
    // like the original log, repeating the message that is already up changes nothing
    if (message === this.message) return;
    this.message = message;
    if (this.timer) clearTimeout(this.timer);
    this.el.textContent = message;
    this.el.classList.add('show');
    this.timer = setTimeout(() => this.el.classList.remove('show'), ms);
  }
}
