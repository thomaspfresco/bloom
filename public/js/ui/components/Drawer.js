// @ts-check
// A side drawer listing loops (left) or structures (right); port of the drawer
// code in Session.draw. Items are spread around the vertical centre (tighter
// and smaller the more there are), bulge toward the pointer, and appear one
// after another. The coloured blooms are drawn by the scene
// (scene/layers/DrawerLayer.js) at the `.drawer-bloom` rectangles.
//
// Interaction (as in the original): hovering a row selects it and, after
// 350 ms, plays it; pressing and releasing on a row opens it; pressing and
// dragging more than two radii picks it up to drop on a structure.

import { MAX_NAME_LENGTH } from '../../core/constants.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';

const PREVIEW_DELAY_MS = 350;
/** Pointer must travel this many item radii from where it went down before an item starts dragging. */
const DRAG_RADII = 2;

export class Drawer extends Component {
  /**
   * @param {import('../context.js').UiContext} ctx
   * @param {'loops' | 'structs'} kind
   */
  constructor(ctx, kind) {
    super(ctx);
    this.kind = kind;
    this.isLoops = kind === 'loops';
    /** @type {(() => void)[]} */
    this.anchorDisposers = [];
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.previewTimer = null;
    /** @type {{x: number, y: number, id: string} | null} */
    this.press = null;
    this.dragging = false;
    this.layout = { dist: 0, size: 0, top0: 0, n: 0 };
    this.wasOpen = false;

    this.el = h('aside', { class: `drawer drawer-${this.kind}`, 'aria-label': this.isLoops ? 'Loops' : 'Structures' });
    this.title = h('h2', { class: 'drawer-title' },
      h('img', { src: this.isLoops ? '/img/loops.png' : '/img/structs.png', alt: '', draggable: 'false' }),
      h('span', {}, this.isLoops ? 'LOOPS' : 'STRUCTURES'));
    this.search = h('input', {
      class: 'drawer-search', type: 'text', placeholder: 'Type something...', maxlength: String(MAX_NAME_LENGTH),
      'aria-label': this.isLoops ? 'Search loops' : 'Search structures', autocomplete: 'off', spellcheck: 'false',
    });
    this.list = h('ul', { class: 'drawer-list', role: 'listbox' });
    this.empty = h('p', { class: 'drawer-empty' });
    this.add = h('button', {
      class: 'drawer-add', 'aria-label': this.isLoops ? 'New loop' : 'New structure',
      onPointerdown: (/** @type {Event} */ e) => { e.preventDefault(); if (this.isLoops) this.ctx.actions.createLoop(); else this.ctx.actions.createStruct(); },
    }, h('img', { src: '/img/plus.png', alt: '', draggable: 'false' }));
    this.preview = h('div', { class: 'drawer-preview', hidden: true });
    this.el.append(this.title, this.search, this.list, this.empty, this.add, this.preview);

    this.on(this.search, 'input', () => {
      this.ctx.ui.set(this.isLoops ? { loopSearch: this.search.value } : { structSearch: this.search.value });
      this.setHover(null);
      this.render();
    });
    this.on(this.list, 'pointermove', (e) => this.onMove(e));
    this.on(this.list, 'pointerleave', () => { if (!this.press) this.setHover(null); });
    this.on(window, 'resize', () => { if (this.open) this.render(); });

    this.onDestroy(() => this.clearAnchors());
    this.listen(this.ctx.session, 'change', () => { if (this.open) this.render(); });
    this.listen(this.ctx.ui, 'change', ({ keys }) => {
      if (keys.includes('drawer')) this.onToggle();
      if (keys.includes('hoverId') || keys.includes('previewId') || keys.includes('dragId')) this.markItems();
    });
  }

  get open() { return this.ctx.ui.s.drawer === this.kind; }

  items() {
    const { session, ui } = this.ctx;
    return this.isLoops ? session.searchLoops(ui.s.loopSearch) : session.searchStructs(ui.s.structSearch);
  }

  onToggle() {
    const open = this.open;
    this.el.classList.toggle('open', open);
    if (open && !this.wasOpen) {
      this.search.value = '';
      this.ctx.ui.set(this.isLoops ? { loopSearch: '' } : { structSearch: '' });
      this.render();
      this.search.focus({ preventScroll: true });
    } else if (!open && this.wasOpen) {
      this.clearPreviewTimer();
      this.search.blur();
      // the drawer closes as soon as a dragged item leaves it; the drag itself must go on
      if (!this.dragging) this.press = null;
    }
    this.wasOpen = open;
  }

  update() { this.onToggle(); }

  clearAnchors() { this.anchorDisposers.splice(0).forEach((d) => d()); }
  clearPreviewTimer() { if (this.previewTimer) { clearTimeout(this.previewTimer); this.previewTimer = null; } }

  // ---- layout -------------------------------------------------------------

  /** Item spacing and size (more items -> tighter and smaller). @param {number} n */
  computeLayout(n) {
    const H = window.innerHeight;
    let dist;
    let size;
    if (n < 8) {
      dist = H / 1.3 / 7;
      size = this.isLoops ? H / 35 : H / 60;
    } else {
      dist = H / (1.4 - 0.004 * n) / (n - 1);
      size = this.isLoops ? dist / 4 : dist / 5;
    }
    const total = dist * (n - 1);
    this.layout = { dist, size, top0: H / 2 - total / 2, n };
  }

  render() {
    this.clearAnchors();
    const items = this.items();
    const { ui } = this.ctx;
    this.computeLayout(items.length);
    const { dist, size, top0 } = this.layout;

    const searching = (this.isLoops ? ui.s.loopSearch : ui.s.structSearch) !== '';
    this.empty.hidden = items.length > 0;
    this.empty.textContent = searching ? 'No results' : `Click "+" to create a ${this.isLoops ? 'Loop' : 'Structure'}`;

    this.list.replaceChildren(...items.map((item, i) => this.renderItem(item, i, items.length, top0 + dist * i, size)));
    this.markItems();
  }

  /**
   * @param {import('../../model/Loop.js').Loop | import('../../model/Structure.js').Structure} item
   * @param {number} i @param {number} n @param {number} y centre of the row @param {number} size
   */
  renderItem(item, i, n, y, size) {
    const { session } = this.ctx;
    const loop = this.isLoops ? /** @type {import('../../model/Loop.js').Loop} */ (item) : null;
    const struct = this.isLoops ? null : /** @type {import('../../model/Structure.js').Structure} */ (item);

    const sections = struct ? struct.sections.map((s) => session.loop(s.loopId)).filter((l) => l !== null) : [];
    const empty = loop ? loop.isEmpty : sections.length === 0;
    const blooms = (loop ? [loop] : sections).map((_, k) => {
      const b = h('div', { class: 'drawer-bloom', 'aria-hidden': 'true' });
      this.anchorDisposers.push(this.ctx.anchors.set(`drawerItem:${item.id}:${k}`, b));
      return b;
    });

    const meta = loop ? `${loop.tempo} BPM` : `${/** @type {any} */ (item).tempo} BPM, ${/** @type {any} */ (item).transpose}st`;
    return h('li', {
      class: 'drawer-item', role: 'option', dataset: { id: item.id }, 'aria-label': `${item.name}, ${meta}`,
      style: `top:${y - this.layout.dist / 2}px;height:${this.layout.dist}px;--r:${size}px;--i:${i};--n:${n};--k:0;--w:${Math.max(1, sections.length)}`,
      onPointerdown: (/** @type {PointerEvent} */ e) => this.down(e, item.id),
      onPointerup: (/** @type {PointerEvent} */ e) => this.up(e, item.id),
      onPointercancel: (/** @type {PointerEvent} */ e) => this.cancel(e),
    },
      h('div', { class: 'drawer-blooms' }, ...blooms, empty && h('span', { class: 'drawer-item-empty' }, 'EMPTY')),
      h('div', { class: 'drawer-info' }, h('span', { class: 'drawer-name' }, item.name), h('span', { class: 'drawer-meta' }, meta)),
    );
  }

  /** Reflect hover / preview / drag state on the items. */
  markItems() {
    const { ui } = this.ctx;
    for (const li of /** @type {HTMLElement[]} */ ([...this.list.children])) {
      const id = li.dataset.id;
      li.classList.toggle('hover', id === ui.s.hoverId);
      li.classList.toggle('dragging', id === ui.s.dragId);
    }
    this.preview.hidden = !(this.open && ui.s.previewId && !ui.s.dragId);
    if (!this.preview.hidden) this.renderPreview(String(ui.s.previewId));
    else if (this.preview.childElementCount) { this.preview.replaceChildren(); this.clearPreviewAnchors(); }
  }

  clearPreviewAnchors() {
    for (const name of this.ctx.anchors.names('drawerPreview')) this.ctx.anchors.map.delete(name);
  }

  /** The big preview shapes to the right (loops) or left (structures) of the list. @param {string} id */
  renderPreview(id) {
    const { session } = this.ctx;
    const loops = this.isLoops
      ? [session.loop(id)].filter((l) => l !== null)
      : (session.struct(id)?.sections ?? []).map((s) => session.loop(s.loopId)).filter((l) => l !== null);
    this.clearPreviewAnchors();
    this.preview.replaceChildren(...loops.map((_, k) => {
      const b = h('div', { class: 'drawer-preview-bloom', style: `--k:${k - (loops.length - 1) / 2}` });
      this.ctx.anchors.set(`drawerPreview:${k}`, b);
      return b;
    }));
  }

  // ---- interaction --------------------------------------------------------

  /** Fisheye + hover from the pointer's height. @param {PointerEvent} e */
  onMove(e) {
    if (this.press) { this.dragMove(e); return; }
    const { dist, top0, n } = this.layout;
    if (!n) return;
    const y = e.clientY;
    const inside = y > top0 - dist / 2 && y < top0 + dist * (n - 1) + dist / 2;
    const items = /** @type {HTMLElement[]} */ ([...this.list.children]);
    items.forEach((li, i) => {
      let k = 0;
      if (inside) k = 1 - Math.min(Math.abs(top0 + dist * i - y), dist * 2) / (dist * 2);
      li.style.setProperty('--k', k.toFixed(3));
    });
    if (!inside) { this.setHover(null); return; }
    const idx = Math.min(n - 1, Math.max(0, Math.round((y - top0) / dist)));
    this.setHover(/** @type {string} */ (items[idx]?.dataset.id ?? null));
  }

  /** @param {string | null} id */
  setHover(id) {
    const { ui, actions } = this.ctx;
    if (ui.s.hoverId === id) return;
    this.clearPreviewTimer();
    actions.stopPlayback();
    ui.set({ hoverId: id, previewId: null });
    if (!id || ui.s.dragId) return;
    this.previewTimer = setTimeout(() => {
      if (ui.s.hoverId !== id || !this.open) return;
      ui.set({ previewId: id });
      if (this.isLoops) actions.previewLoop(id); else actions.previewStruct(id);
    }, PREVIEW_DELAY_MS);
  }

  /** @param {PointerEvent} e @param {string} id */
  down(e, id) {
    if (e.button !== 0) return;
    this.press = { x: e.clientX, y: e.clientY, id };
    this.dragging = false;
    /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
  }

  /** @param {PointerEvent} e */
  dragMove(e) {
    const p = this.press;
    if (!p) return;
    const { size } = this.layout;
    if (!this.dragging && Math.hypot(e.clientX - p.x, e.clientY - p.y) > size * DRAG_RADII) {
      this.dragging = true;
      this.clearPreviewTimer();
      this.ctx.drag.start(this.isLoops ? 'loop' : 'struct', p.id, e.clientX, e.clientY);
    }
    if (this.dragging) this.ctx.drag.move(e.clientX, e.clientY);
  }

  /** @param {PointerEvent} e @param {string} id */
  up(e, id) {
    const target = /** @type {HTMLElement} */ (e.currentTarget);
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    const wasDrag = this.dragging;
    this.press = null;
    this.dragging = false;
    if (wasDrag) { this.ctx.drag.end(true); return; }
    this.ctx.actions.openTab({ type: this.isLoops ? 'loop' : 'struct', id }, { fromDrawer: true });
  }

  /** @param {PointerEvent} e */
  cancel(e) {
    const target = /** @type {HTMLElement} */ (e.currentTarget);
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (this.dragging) this.ctx.drag.end(false);
    this.press = null;
    this.dragging = false;
  }
}
