// @ts-check
// Everything shown while a structure tab is open: its sections in a row (the
// blooms are drawn by scene/layers/StructLayer.js at the `.section-bloom`
// rectangles), per-section repeat counters, reordering by dragging, drops from
// the drawers, tempo / transpose overrides and the dice.

import { MAX_LOOPS_PER_STRUCT, MAX_REPEATS, TEMPO, TRANSPOSE } from '../../core/constants.js';
import { Random } from '../../core/random.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';
import { Scroller } from './Scroller.js';
import { Toggle } from './Toggle.js';

export class StructView extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('section', { class: 'struct-view', 'aria-label': 'Structure', hidden: true });
    this.row = h('div', { class: 'struct-row' });
    this.hint = h('p', { class: 'struct-hint' }, 'Drop Loop or Structure here');
    this.el.append(this.row, this.hint);

    this.tempo = new Scroller({
      label: 'TEMPO', min: TEMPO.min, max: TEMPO.max, inc: TEMPO.step, inc2: TEMPO.fastStep, wheel: true,
      get: () => this.struct?.tempo ?? TEMPO.default,
      set: (v) => { const s = this.struct; if (s) { s.setTempo(v); this.touch(); } },
      format: (v) => `${v} BPM`, class: 'tempo',
    });
    this.useTempo = new Toggle({
      label: 'Apply this tempo to every section', class: 'apply-tempo',
      get: () => this.struct?.useTempo ?? false,
      set: (on) => { const s = this.struct; if (s) { s.useTempo = on; this.touch(); } },
    });
    this.transpose = new Scroller({
      label: 'TRANSPOSE', min: TRANSPOSE.min, max: TRANSPOSE.max, inc: 1, wheel: true,
      get: () => this.struct?.transpose ?? 0,
      set: (v) => { const s = this.struct; if (s) { s.setTranspose(v); this.touch(); } },
      format: (v) => `${v} ST`, class: 'transpose',
    });
    this.useTranspose = new Toggle({
      label: 'Apply this transposition', class: 'apply-transpose',
      get: () => this.struct?.useTranspose ?? false,
      set: (on) => { const s = this.struct; if (s) { s.useTranspose = on; this.touch(); } },
    });
    this.applyTempoLabel = h('span', { class: 'ctl-label apply-tempo-label' }, 'APPLY');
    this.applyTransposeLabel = h('span', { class: 'ctl-label apply-transpose-label' }, 'APPLY');
    this.dice = h('button', { class: 'dice', 'aria-label': 'Roll the dice: random arrangement of your loops', onPointerdown: () => this.rollDice() },
      h('img', { src: '/img/dice5.png', alt: '', draggable: 'false' }));
    this.controls = h('div', { class: 'struct-controls' },
      this.tempo.el, this.applyTempoLabel, this.useTempo.el,
      this.dice,
      this.transpose.el, this.applyTransposeLabel, this.useTranspose.el);
    this.el.append(this.controls);

    /** @type {(() => void)[]} */
    this.anchorDisposers = [];
    this.onDestroy(() => this.anchorDisposers.forEach((d) => d()));
    /** @type {{id: string, from: number, to: number, startX: number, dx: number} | null} */
    this.reorder = null;
    /** @type {{id: string, index: number, x: number} | null} */
    this.pending = null;
    /** @type {{index: number, count: number, ok: boolean} | null} */
    this.slot = null;

    this.listen(this.ctx.session, 'change', () => this.update());
    this.listen(this.ctx.ui, 'change', ({ keys }) => {
      if (keys.some((k) => ['playing', 'step', 'sectionIndex', 'repeat', 'hoverId'].includes(k))) this.updateLive();
    });
    this.listen(this.ctx.drag, 'move', (e) => this.onDragMove(e));
    this.listen(this.ctx.drag, 'drop', (e) => this.onDrop(e));
    this.listen(this.ctx.drag, 'cancel', () => this.clearSlot());
  }

  get struct() {
    const { session } = this.ctx;
    return session.active?.type === 'struct' ? /** @type {import('../../model/Structure.js').Structure | null} */ (session.activeItem) : null;
  }

  touch() {
    const s = this.struct;
    if (s) this.ctx.session.touch('struct', s.id);
  }

  // ---- render ---------------------------------------------------------------

  update() {
    const s = this.struct;
    this.el.hidden = !s;
    if (!s) return;
    const { session } = this.ctx;

    this.anchorDisposers.splice(0).forEach((d) => d());
    const sections = s.sections.map((sec, i) => ({ sec, loop: session.loop(sec.loopId), i })).filter((x) => x.loop);
    this.hint.hidden = sections.length > 0 || this.slot !== null;

    const nodes = sections.map(({ sec, loop, i }) => this.renderSection(s, sec, /** @type {import('../../model/Loop.js').Loop} */ (loop), i));
    if (this.slot) {
      const slot = h('div', { class: `section slot${this.slot.ok ? '' : ' no'}`, style: `--span:${this.slot.count}` },
        this.slot.ok ? null : h('span', { class: 'section-name' }, `Up to ${MAX_LOOPS_PER_STRUCT} loops`));
      nodes.splice(Math.min(this.slot.index, nodes.length), 0, slot);
    }
    this.row.replaceChildren(...nodes);

    for (const w of [this.tempo, this.transpose]) w.refresh();
    this.useTempo.refresh();
    this.useTranspose.refresh();
    this.tempo.el.classList.toggle('inactive', !s.useTempo);
    this.transpose.el.classList.toggle('inactive', !s.useTranspose);
    const icon = /** @type {HTMLImageElement} */ (this.dice.firstElementChild);
    icon.src = `/img/dice${s.sections.length === 0 ? 5 : s.sections.length}.png`;
    this.dice.disabled = session.loops.length === 0;
    this.updateLive();
  }

  /**
   * @param {import('../../model/Structure.js').Structure} struct
   * @param {import('../../model/Structure.js').Section} sec
   * @param {import('../../model/Loop.js').Loop} loop @param {number} index
   */
  renderSection(struct, sec, loop, index) {
    const bloom = h('div', { class: 'section-bloom', 'aria-hidden': 'true' });
    this.anchorDisposers.push(this.ctx.anchors.set(`section:${sec.id}`, bloom));

    const repeats = new Scroller({
      label: 'REPEATS', min: 1, max: MAX_REPEATS, inc: 1, class: 'repeats',
      get: () => sec.repeats, set: (v) => { struct.setRepeats(sec.id, v); this.touch(); },
      format: (v) => `${v} x`,
    });
    const count = h('span', { class: 'section-count' });
    const el = h('div', {
      class: 'section', dataset: { id: sec.id, index: String(index) }, tabindex: '0',
      role: 'group', 'aria-label': `${loop.name}, repeats ${sec.repeats}. Right-click for options.`,
      onPointerdown: (/** @type {PointerEvent} */ e) => this.down(e, sec.id, index),
      onPointermove: (/** @type {PointerEvent} */ e) => {
        this.moveReorder(e);
        // only the ring's own area counts as hovering the section (not its REPEATS control)
        if (this.reorder || this.slot) return;
        const over = e.target === el;
        if (over && this.ctx.ui.s.hoverId !== sec.id) this.ctx.ui.set({ hoverId: sec.id });
        else if (!over && this.ctx.ui.s.hoverId === sec.id) this.ctx.ui.set({ hoverId: null });
      },
      onPointerup: (/** @type {PointerEvent} */ e) => this.up(e),
      onPointercancel: (/** @type {PointerEvent} */ e) => this.up(e),
      onPointerleave: () => { if (!this.reorder && this.ctx.ui.s.hoverId === sec.id) this.ctx.ui.set({ hoverId: null }); },
      onContextmenu: (/** @type {MouseEvent} */ e) => { e.preventDefault(); this.openMenu(struct, sec, loop, el); },
      onKeydown: (/** @type {KeyboardEvent} */ e) => { if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); this.openMenu(struct, sec, loop, el); } },
    }, repeats.el, bloom, count, h('span', { class: 'section-name' }, loop.name));
    return el;
  }

  /** Highlight the playing section and show its repeat counter. */
  updateLive() {
    const s = this.struct;
    if (!s) return;
    const { ui } = this.ctx;
    const nodes = /** @type {HTMLElement[]} */ ([...this.row.querySelectorAll('.section:not(.slot)')]);
    nodes.forEach((el, i) => {
      const sec = s.sections[i];
      const live = ui.s.playing && ui.s.sectionIndex === i;
      el.classList.toggle('live', live);
      const c = el.querySelector('.section-count');
      if (c) c.textContent = live && sec ? `${ui.s.repeat + 1} / ${sec.repeats}` : '';
      el.classList.toggle('dim', ui.s.hoverId !== null && ui.s.hoverId !== sec?.id && !this.reorder);
    });
  }

  // ---- reorder by dragging a section ---------------------------------------

  /** @param {PointerEvent} e @param {string} id @param {number} index */
  down(e, id, index) {
    if (e.button !== 0 || /** @type {HTMLElement} */ (e.target).closest('.scroller')) return;
    this.pending = { id, index, x: e.clientX };
    /** @type {HTMLElement} */ (e.currentTarget).setPointerCapture(e.pointerId);
  }

  /** @param {PointerEvent} e */
  moveReorder(e) {
    const p = this.pending;
    if (!p) return;
    const gap = window.innerWidth / 6;
    const radius = window.innerWidth / 20;
    if (!this.reorder) {
      if (Math.abs(e.clientX - p.x) <= radius) return;
      this.ctx.actions.stopPlayback();
      this.reorder = { id: p.id, from: p.index, to: p.index, startX: p.x, dx: 0 };
      this.el.classList.add('reordering');
    }
    const r = this.reorder;
    r.dx = e.clientX - r.startX;
    r.to = Math.max(0, Math.min((this.struct?.sections.length ?? 1) - 1, Math.round(r.from + r.dx / gap)));
    const nodes = /** @type {HTMLElement[]} */ ([...this.row.querySelectorAll('.section:not(.slot)')]);
    nodes.forEach((el, i) => {
      if (i === r.from) { el.style.transform = `translateX(${r.dx}px)`; el.classList.add('dragged'); return; }
      let shift = 0;
      if (r.to > r.from && i > r.from && i <= r.to) shift = -gap;
      if (r.to < r.from && i < r.from && i >= r.to) shift = gap;
      el.style.transform = shift ? `translateX(${shift}px)` : '';
    });
  }

  /** @param {PointerEvent} e */
  up(e) {
    const el = /** @type {HTMLElement} */ (e.currentTarget);
    if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    const r = this.reorder;
    this.pending = null;
    this.reorder = null;
    this.el.classList.remove('reordering');
    if (r && this.struct) {
      this.struct.moveSection(r.from, r.to);
      this.touch();
    }
    this.update();
  }

  // ---- drops from a drawer --------------------------------------------------

  /** @param {{kind: 'loop' | 'struct', id: string, x: number, y: number}} e */
  onDragMove(e) {
    const s = this.struct;
    if (!s) return;
    const { session } = this.ctx;
    const dragged = e.kind === 'loop' ? 1 : (session.struct(e.id)?.sections.length ?? 0);
    const ok = s.sections.length + dragged <= MAX_LOOPS_PER_STRUCT && dragged > 0;
    // insertion point: after every section whose centre is left of the pointer
    const nodes = /** @type {HTMLElement[]} */ ([...this.row.querySelectorAll('.section:not(.slot)')]);
    let index = 0;
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (e.x > r.left + r.width / 2) index++;
    }
    index = Math.min(index, s.sections.length);
    if (!this.slot || this.slot.index !== index || this.slot.ok !== ok || this.slot.count !== dragged) {
      this.slot = { index, count: Math.max(1, dragged), ok };
      this.update();
    }
  }

  /** @param {{kind: 'loop' | 'struct', id: string}} e */
  onDrop(e) {
    const s = this.struct;
    const slot = this.slot;
    this.clearSlot();
    if (!s || !slot || !slot.ok || this.ctx.ui.s.drawer) return;
    const { session } = this.ctx;
    const ids = e.kind === 'loop' ? [e.id] : (session.struct(e.id)?.sections ?? []).map((x) => x.loopId);
    let at = slot.index;
    for (const id of ids) {
      const added = s.insertLoop(id, at);
      if (!added) break;
      at++;
    }
    this.touch();
  }

  clearSlot() {
    if (!this.slot) return;
    this.slot = null;
    this.update();
  }

  // ---- other actions ----------------------------------------------------------

  rollDice() {
    const s = this.struct;
    if (!s) return;
    this.ctx.actions.stopPlayback();
    s.randomize(this.ctx.session.loops.map((l) => l.id), Random.shared);
    this.touch();
    this.dice.classList.remove('spin');
    void this.dice.offsetWidth;
    this.dice.classList.add('spin');
  }

  /**
   * @param {import('../../model/Structure.js').Structure} struct @param {import('../../model/Structure.js').Section} sec
   * @param {import('../../model/Loop.js').Loop} loop @param {HTMLElement} anchor
   */
  openMenu(struct, sec, loop, anchor) {
    const { menus, actions } = this.ctx;
    const r = anchor.querySelector('.section-name')?.getBoundingClientRect() ?? anchor.getBoundingClientRect();
    const box = anchor.getBoundingClientRect();
    const R = window.innerWidth / 20;
    menus.open({
      x: r.left, y: r.top,
      keep: { left: box.left, width: box.width, top: box.top - R * 2.4, height: R * 2.4 + R * 2 + window.innerHeight / 30 },
      options: [
        { label: 'EDIT LOOP', onSelect: () => actions.openTab({ type: 'loop', id: loop.id }, { fade: true }) },
        { label: 'DELETE SECTION', danger: true, onSelect: async () => {
          const ok = await menus.confirm({
            message: `Are you sure you want to delete "${loop.name}" from "${struct.name}"?\n"${loop.name}" will not be deleted from the Loops Drawer.`,
          });
          if (ok) { actions.stopPlayback(); struct.removeSection(sec.id); this.touch(); }
        } },
      ],
    });
  }
}
