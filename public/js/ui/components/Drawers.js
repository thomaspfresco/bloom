// @ts-check
// Both drawers plus what they share: opening and closing from the screen edges
// and the ghost that follows a dragged item. (The dimming behind the drawers is
// drawn by the scene, see scene/layers/DrawerLayer.js.)
//
// As in the original, a drawer opens when the pointer reaches the edge (4% of the
// width on the home screen, 1% with a tab open) and closes when it leaves the
// outer fifth of the screen.

import { Component } from '../Component.js';
import { h } from '../dom.js';
import { Drawer } from './Drawer.js';

export class Drawers extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'drawers' });
    this.ghost = h('div', { class: 'drag-ghost', hidden: true });
    this.loops = new Drawer(ctx, 'loops');
    this.structs = new Drawer(ctx, 'structs');
    this.el.append(this.ghost);
    this.loops.mount(this.el);
    this.structs.mount(this.el);
    this.onDestroy(() => { this.loops.destroy(); this.structs.destroy(); });
    this.onDestroy(ctx.anchors.set('dragGhost', this.ghost));

    this.on(window, 'pointermove', (e) => this.onPointer(e));
    this.on(document.documentElement, 'pointerleave', () => this.close());
    this.listen(ctx.ui, 'change', ({ keys }) => { if (keys.includes('drawer') || keys.includes('dragId')) this.update(); });
    this.listen(ctx.drag, 'move', ({ x, y }) => this.moveGhost(x, y));
  }

  /** @param {'loops' | 'structs'} kind */
  openDrawer(kind) {
    const { ui, actions, menus, generate, drag } = this.ctx;
    if (ui.s.drawer === kind || menus.isOpen || generate.isOpen || drag.active) return;
    actions.stopPlayback();
    this.ctx.notes.clearSelection();
    ui.set({ drawer: kind, hoverId: null, previewId: null });
  }

  close() {
    const { ui, actions } = this.ctx;
    if (!ui.s.drawer) return;
    actions.stopPlayback();
    ui.set({ drawer: null, hoverId: null, previewId: null });
  }

  /** @param {PointerEvent} e */
  onPointer(e) {
    if (e.pointerType === 'touch') return;
    const W = window.innerWidth;
    const { ui, session, drag, menus, generate } = this.ctx;
    if (menus.isOpen || generate.isOpen) return;

    if (!ui.s.drawer) {
      if (drag.active) return;
      const edge = session.active ? W / 100 : W / 25;
      if (e.clientX < edge) this.openDrawer('loops');
      else if (e.clientX > W - edge) this.openDrawer('structs');
    } else if (ui.s.drawer === 'loops' && e.clientX > W / 5) this.close();
    else if (ui.s.drawer === 'structs' && e.clientX < W * 0.8) this.close();
  }

  /** @param {number} x @param {number} y */
  moveGhost(x, y) {
    this.ghost.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  update() {
    const { ui } = this.ctx;
    this.el.classList.toggle('is-open', ui.s.drawer !== null);
    this.ghost.hidden = ui.s.dragId === null;
    if (ui.s.dragId) this.ghost.className = `drag-ghost ${this.ctx.drag.current?.kind ?? 'loop'}`;
  }
}
