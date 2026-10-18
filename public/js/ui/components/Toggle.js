// @ts-check
import { h } from '../dom.js';

/** Round on/off button with a coloured centre (the old `Button`). */
export class Toggle {
  /**
   * @param {object} o
   * @param {string} o.label accessible name
   * @param {() => boolean} o.get @param {(on: boolean) => void} o.set
   * @param {string} [o.color] css rgb triplet "r g b" for the centre dot
   * @param {string} [o.class]
   */
  constructor({ label, get, set, color = 'var(--fg)', class: cls = '' }) {
    this.get = get;
    this.el = h('button', {
      class: `toggle ${cls}`, role: 'switch', 'aria-label': label, style: `--c: ${color}`,
      onPointerdown: () => { set(!get()); this.refresh(); },
    }, h('i'), h('b'));
    this.refresh();
  }

  refresh() {
    const on = this.get();
    this.el.classList.toggle('on', on);
    this.el.setAttribute('aria-checked', String(on));
  }

  /** Beat flash over the centre dot (the CLICK button): `on` while the step is a beat. @param {boolean} on */
  pulse(on) { this.el.classList.toggle('pulse', on); }

  /** @param {string} color css triplet */
  setColor(color) { this.el.style.setProperty('--c', color); }

  /** @param {string} color css triplet for the beat flash */
  setPulseColor(color) { this.el.style.setProperty('--pulse', color); }
}
