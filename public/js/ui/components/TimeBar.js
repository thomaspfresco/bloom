// @ts-check
import { N_STEPS } from '../../core/constants.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';

/** Ruler under the grid. Click to start playing from a step. */
export class TimeBar extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'timebar', role: 'slider', 'aria-label': 'Playhead position', 'aria-valuemin': '0', 'aria-valuemax': String(N_STEPS - 1) });
    this.ticks = h('div', { class: 'timebar-ticks' });
    this.labels = h('div', { class: 'timebar-labels' },
      ...Array.from({ length: N_STEPS / 4 + 1 }, (_, i) => h('span', { style: `--i:${i * 4}`, class: i % 4 === 0 ? 'major' : '' }, String(i * 4))));
    this.cursor = h('div', { class: 'timebar-cursor', hidden: true });
    this.el.append(this.ticks, this.labels, this.cursor);

    this.on(this.el, 'pointerdown', (e) => {
      if (e.button !== 0) return;
      const r = this.ticks.getBoundingClientRect();
      const step = Math.round(((e.clientX - r.left) / r.width) * N_STEPS);
      if (step >= 0 && step < N_STEPS) this.ctx.actions.seek(step);
    });
    this.listen(this.ctx.ui, 'change', ({ keys }) => { if (keys.includes('step') || keys.includes('playing') || keys.includes('selectedTrackId')) this.update(); });
  }

  update() {
    const { ui, session } = this.ctx;
    const show = session.active?.type === 'loop' && ui.s.selectedTrackId !== null;
    this.el.hidden = !show;
    if (!show) return;
    const on = ui.s.playing && ui.s.step >= 0;
    this.cursor.hidden = !on;
    if (on) this.cursor.style.setProperty('--step', String(ui.s.step));
    this.el.setAttribute('aria-valuenow', String(Math.max(0, ui.s.step)));
  }
}
