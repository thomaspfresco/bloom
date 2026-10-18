// @ts-check
// Context menus, delete confirmation and the About text (port of the old `Menu`
// states 0, 3 and 5). One dark layer fades in over about a third of a second;
// options then appear one after another every 50 ms. A press anywhere closes
// the menu (after running the pressed option); closing removes the options at
// once and fades the dark layer out. The tab bar stays above it.

import { Component } from '../Component.js';
import { clear, h } from '../dom.js';

/**
 * @typedef {object} MenuOption
 * @property {string} label
 * @property {() => void} [onSelect]
 * @property {boolean} [danger]    shown in red
 * @property {boolean} [disabled]  greyed out, not selectable
 */

const FADE_OUT_MS = 340;

export class MenuHost extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.openState = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.hideTimer = null;
    /** @type {((value: boolean) => void) | null} */
    this.resolver = null;
    /** @type {(() => void) | null} */
    this.onClose = null;

    this.el = h('div', { class: 'menu-layer', hidden: true });
    this.backdrop = h('div', { class: 'menu-backdrop' });
    this.content = h('div', { class: 'menu-content' });
    this.el.append(this.backdrop, this.content);

    // any press outside an option closes the menu
    this.on(this.el, 'pointerdown', (e) => {
      if (!this.openState) return;
      if (/** @type {HTMLElement} */ (e.target).closest('.menu-item, .dialog-btn')) return;
      this.cancel();
    });
    this.on(this.el, 'contextmenu', (e) => e.preventDefault());
    this.on(document, 'keydown', (e) => { if (this.openState && e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); this.cancel(); } }, true);
  }

  get isOpen() { return this.openState; }

  /** @param {'menu' | 'dialog'} kind @param {boolean} [solid] fully black backdrop (delete confirmation) */
  show(kind, solid = false) {
    if (this.hideTimer) { clearTimeout(this.hideTimer); this.hideTimer = null; }
    this.openState = true;
    if (kind !== 'menu') this.setKeep(undefined);
    document.body.classList.add('menu-open');
    this.el.hidden = false;
    this.el.className = `menu-layer ${kind}${solid ? ' solid' : ''}`;
    this.ctx.ui.set({ hoverId: null });
    void this.el.offsetWidth;
    this.el.classList.add('on');
  }

  /** @param {{left: number, top: number, width: number, height: number} | undefined} r */
  setKeep(r) {
    const w = window.innerWidth, h = window.innerHeight;
    this.backdrop.style.clipPath = r
      ? `polygon(evenodd, 0 0, ${w}px 0, ${w}px ${h}px, 0 ${h}px, 0 0, ${r.left}px ${r.top}px, ${r.left}px ${r.top + r.height}px, ${r.left + r.width}px ${r.top + r.height}px, ${r.left + r.width}px ${r.top}px, ${r.left}px ${r.top}px)`
      : '';
  }

  /** Remove the options at once, fade the dark layer out. */
  close() {
    if (!this.openState) return;
    this.openState = false;
    document.body.classList.remove('menu-open');
    const onClose = this.onClose;
    this.onClose = null;
    onClose?.();
    clear(this.content);
    this.el.classList.remove('on');
    this.el.classList.add('closing');
    this.hideTimer = setTimeout(() => { this.el.hidden = true; this.el.classList.remove('closing'); }, FADE_OUT_MS);
  }

  cancel() {
    const r = this.resolver;
    this.resolver = null;
    this.close();
    r?.(false);
  }

  /**
   * A list of options. "down" menus hang below `y`, "up" menus rise above it.
   * `keep` leaves a screen rectangle un-darkened (the original draws the element a menu belongs to above the dark layer).
   * @param {{x: number, y: number, options: MenuOption[], direction?: 'down' | 'up', keep?: {left: number, top: number, width: number, height: number}, onClose?: () => void}} spec
   */
  open({ x, y, options, direction = 'down', keep, onClose }) {
    clear(this.content);
    this.onClose = onClose ?? null;
    this.setKeep(keep);
    const optionH = window.innerHeight / 30;
    const list = h('div', { class: `menu-list ${direction}`, role: 'menu', style: { left: `${x}px` } });
    if (direction === 'down') list.style.top = `${y + optionH * 2}px`;
    else list.style.bottom = `${window.innerHeight - y + optionH * 2 - optionH}px`;

    options.forEach((opt, i) => {
      const item = h('button', {
        class: `menu-item${opt.danger ? ' danger' : ''}${opt.disabled ? ' disabled' : ''}`, role: 'menuitem', style: `--i:${i}`,
        'aria-disabled': opt.disabled ? 'true' : undefined,
        onPointerdown: (/** @type {PointerEvent} */ e) => {
          e.preventDefault();
          if (opt.disabled) return;
          this.close();
          opt.onSelect?.();
        },
      }, h('span', { class: 'menu-text' }, opt.label));
      list.append(item);
    });
    this.content.append(list);
    this.show('menu');
  }

  /**
   * "Are you sure ...?" with CANCEL and DELETE.
   * @param {{message: string, confirmLabel?: string}} spec
   * @returns {Promise<boolean>}
   */
  confirm({ message, confirmLabel = 'DELETE' }) {
    return new Promise((resolve) => {
      this.resolver = resolve;
      const done = (/** @type {boolean} */ v) => { this.resolver = null; this.close(); resolve(v); };
      clear(this.content);
      this.content.append(
        h('p', { class: 'dialog-text' }, message),
        h('button', { class: 'dialog-btn cancel', onPointerdown: (/** @type {Event} */ e) => { e.preventDefault(); done(false); } }, 'CANCEL'),
        h('button', { class: 'dialog-btn confirm', onPointerdown: (/** @type {Event} */ e) => { e.preventDefault(); done(true); } }, confirmLabel),
      );
      this.show('dialog', true);
    });
  }

  /** The About text. */
  about() {
    clear(this.content);
    this.content.append(h('p', { class: 'dialog-text about' },
      'BLOOM (2023-2024)', h('br'), h('br'),
      'Made with (too much) love by Thomas Fresco.', h('br'), h('br'),
      'Dissertation project in the context of the Master in Design and Multimedia.', h('br'),
      ' Department of Informatics Engineering of the Facultyof Sciences', h('br'),
      ' and Technology of the University of Coimbra.'));
    this.show('dialog');
  }
}
