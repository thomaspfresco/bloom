// @ts-check
// BLOOM and the open tabs, centred at the top (port of Session.drawTabs).
//
// Behaviour kept from the original:
//  - the group is centred and slides smoothly when tabs come and go (positions
//    eased 10% per frame; here a FLIP animation);
//  - widths are measured in the medium weight, so hovering (light weight) never
//    shifts the layout;
//  - actions happen on press, not release;
//  - right-clicking BLOOM on the home screen opens the session menu, right-clicking
//    the active tab opens its menu; clicking BLOOM with a tab open goes home.

import { Component } from '../Component.js';
import { h } from '../dom.js';

/** @typedef {import('../../model/Session.js').TabRef} TabRef */

export class TopBar extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('header', { class: 'topbar' });
    this.bloom = this.makeTab('BLOOM');
    this.bloom.classList.add('bloom');
    this.el.append(this.bloom);
    this.fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    this.el.append(this.fileInput);
    /** @type {Map<string, HTMLElement>} tab key -> element */
    this.tabEls = new Map();
    /** @type {Map<HTMLElement, number>} last known x of each element, for sliding */
    this.lastX = new Map();

    this.on(this.bloom, 'pointerdown', (e) => this.pressBloom(e));
    this.on(this.fileInput, 'change', () => {
      const file = this.fileInput.files?.[0];
      this.fileInput.value = '';
      if (file) this.ctx.actions.importSession(file);
    });
    this.on(window, 'resize', () => this.lastX.clear());
    this.listen(this.ctx.session, 'change', () => this.update());
  }

  /** @param {string} text */
  makeTab(text) {
    return h('button', { class: 'tab', dataset: { text } }, h('span', { class: 'tab-text' }, text));
  }

  /** @param {TabRef} ref */
  key(ref) { return `${ref.type}:${ref.id}`; }

  update() {
    const { session } = this.ctx;
    const wanted = new Set(session.tabs.map((t) => this.key(t)));

    // drop tabs that are gone
    for (const [key, el] of this.tabEls) {
      if (!wanted.has(key)) { el.remove(); this.lastX.delete(el); this.tabEls.delete(key); }
    }

    // create new tabs (they fade in and slide out of the centre)
    /** @type {HTMLElement[]} */
    const ordered = [];
    for (const ref of session.tabs) {
      const item = session.resolve(ref);
      if (!item) continue;
      let el = this.tabEls.get(this.key(ref));
      if (!el) {
        el = this.makeTab(item.name);
        el.classList.add('fresh');
        el.addEventListener('pointerdown', (e) => this.pressTab(e, ref));
        this.tabEls.set(this.key(ref), el);
      }
      el.dataset.text = item.name;
      /** @type {HTMLElement} */ (el.firstElementChild).textContent = item.name;
      const active = session.active?.type === ref.type && session.active.id === ref.id;
      el.classList.toggle('active', active);
      el.setAttribute('aria-selected', String(active));
      ordered.push(el);
    }

    this.bloom.classList.toggle('active', !session.active);
    this.bloom.classList.toggle('has-tab', !!session.active);

    // keep DOM order without recreating anything
    let prev = /** @type {HTMLElement} */ (this.bloom);
    for (const el of ordered) {
      if (prev.nextElementSibling !== el) prev.after(el);
      prev = el;
    }
    this.slide([this.bloom, ...ordered]);
  }

  /** Animate elements from where they were to where the layout put them. @param {HTMLElement[]} els */
  slide(els) {
    const w = window.innerWidth;
    for (const el of els) {
      const x = el.getBoundingClientRect().left;
      const before = this.lastX.get(el) ?? w / 2 - el.offsetWidth / 2; // new tabs start in the middle
      this.lastX.set(el, x);
      if (Math.abs(before - x) < 1) continue;
      el.style.transition = 'none';
      el.style.transform = `translateX(${before - x}px)`;
      void el.offsetWidth;
      el.style.transition = '';
      el.style.transform = '';
    }
  }

  /** @param {PointerEvent} e */
  pressBloom(e) {
    const { session, actions } = this.ctx;
    if (session.active) { actions.goHome(); return; }
    if (e.button === 2) this.openSessionMenu(this.bloom);
  }

  /** @param {PointerEvent} e @param {TabRef} ref */
  pressTab(e, ref) {
    const { session, actions } = this.ctx;
    const active = session.active?.type === ref.type && session.active.id === ref.id;
    if (!active) { actions.openTab(ref, { fade: true }); return; }
    if (e.button === 2) this.openTabMenu(ref, /** @type {HTMLElement} */ (e.currentTarget));
  }

  /** Menus open under the text, aligned with its left edge. @param {HTMLElement} anchor */
  menuPoint(anchor) {
    const r = /** @type {HTMLElement} */ (anchor.firstElementChild).getBoundingClientRect();
    return { x: r.left, y: window.innerHeight / 30 };
  }

  /** @param {HTMLElement} anchor */
  openSessionMenu(anchor) {
    const { menus, actions } = this.ctx;
    menus.open({
      ...this.menuPoint(anchor),
      options: [
        { label: 'ABOUT', onSelect: () => menus.about() },
        { label: 'TUTORIAL' },
        { label: 'DOWNLOAD SESSION', onSelect: () => actions.downloadSession() },
        { label: 'IMPORT SESSION', onSelect: () => this.fileInput.click() },
        { label: 'CLEAR SESSION', danger: true, onSelect: async () => {
          if (await menus.confirm({ message: 'Are you sure you want to clear the Session?' })) actions.clearSession();
        } },
      ],
    });
  }

  /** @param {TabRef} ref @param {HTMLElement} anchor */
  openTabMenu(ref, anchor) {
    const { menus, actions, session } = this.ctx;
    const item = session.resolve(ref);
    if (!item) return;
    const isLoop = ref.type === 'loop';
    menus.open({
      ...this.menuPoint(anchor),
      options: [
        { label: 'EXPORT AUDIO', onSelect: () => actions.exportAudio() },
        { label: 'RENAME', disabled: true },
        { label: 'DUPLICATE', onSelect: () => (isLoop ? actions.duplicateLoop(item.id) : actions.duplicateStruct(item.id)) },
        ...(isLoop ? [{ label: 'STRUCT FROM', onSelect: () => actions.structFromLoop(item.id) }] : []),
        { label: 'CLOSE TAB', onSelect: () => actions.closeTab(ref) },
        { label: 'DELETE', danger: true, onSelect: async () => {
          if (await menus.confirm({ message: `Are you sure you want to delete "${item.name}"?` })) {
            if (isLoop) actions.deleteLoop(item.id); else actions.deleteStruct(item.id);
          }
        } },
      ],
    });
  }
}
