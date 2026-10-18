// @ts-check
// Automation view: draw a curve (one value per step) for the parameter chosen in
// the PARAMETER scroller. Port of Track.drawAutomation.

import { N_STEPS } from '../../core/constants.js';
import { Component } from '../Component.js';
import { h, svg } from '../dom.js';

export class AutomationView extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('section', { class: 'automation', 'aria-label': 'Automation', hidden: true });
    this.svg = svg('svg', { class: 'auto-svg', viewBox: `0 0 ${N_STEPS} 1`, preserveAspectRatio: 'none', 'aria-hidden': 'true' });
    this.line = svg('polyline', { class: 'auto-line', fill: 'none' });
    this.svg.append(this.line);
    this.dots = h('div', { class: 'auto-dots' });
    this.label = h('div', { class: 'auto-label', hidden: true }, h('span', { class: 'auto-step' }), h('span', { class: 'auto-value' }));
    this.hit = h('div', { class: 'auto-hit', role: 'application', 'aria-label': 'Automation curve' });
    this.el.append(this.svg, this.dots, this.label, this.hit);

    /** @type {number | null} */
    this.lastStep = null;
    this.on(this.hit, 'pointerdown', (e) => this.down(e));
    this.on(this.hit, 'pointermove', (e) => this.move(e));
    this.on(this.hit, 'pointerup', (e) => this.up(e));
    this.on(this.hit, 'pointercancel', (e) => this.up(e));
    this.on(this.hit, 'pointerleave', () => { if (this.lastStep === null) this.label.hidden = true; });
    this.on(this.hit, 'contextmenu', (e) => e.preventDefault());

    this.listen(this.ctx.session, 'change', () => this.update());
    this.listen(this.ctx.ui, 'change', ({ keys }) => {
      if (keys.some((k) => ['selectedTrackId', 'view', 'paramIndex', 'step', 'playing'].includes(k))) this.update();
    });
  }

  get target() {
    const t = this.ctx.notes.target();
    if (!t) return null;
    const param = t.track.params[this.ctx.ui.s.paramIndex];
    return param ? { ...t, param } : null;
  }

  /** @param {PointerEvent} e */
  point(e) {
    const r = this.el.getBoundingClientRect();
    return {
      step: Math.min(N_STEPS - 1, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * N_STEPS))),
      value: Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height)),
    };
  }

  /** @param {PointerEvent} e */
  down(e) {
    if (e.button !== 0 || !this.target) return;
    this.hit.setPointerCapture(e.pointerId);
    const { step, value } = this.point(e);
    this.lastStep = step;
    this.write(step, step, value, value);
  }

  /** @param {PointerEvent} e */
  move(e) {
    const t = this.target;
    if (!t) return;
    const { step, value } = this.point(e);
    this.showLabel(step, e);
    if (this.lastStep === null) return;
    // fill the steps skipped by a fast drag by interpolating from the previous one
    const from = this.lastStep;
    const prev = t.param.automation[from];
    this.write(from, step, prev, value);
    this.lastStep = step;
  }

  /** @param {PointerEvent} e */
  up(e) {
    if (this.lastStep === null) return;
    this.lastStep = null;
    if (this.hit.hasPointerCapture(e.pointerId)) this.hit.releasePointerCapture(e.pointerId);
    const t = this.ctx.notes.target();
    if (t) this.ctx.session.touch('loop', t.loop.id);
  }

  /** @param {number} s0 @param {number} s1 @param {number} v0 @param {number} v1 */
  write(s0, s1, v0, v1) {
    const t = this.target;
    if (!t) return;
    const span = Math.abs(s1 - s0) || 1;
    const dir = s1 >= s0 ? 1 : -1;
    for (let i = 0; i <= Math.abs(s1 - s0); i++) t.param.setAutomation(s0 + i * dir, v0 + ((v1 - v0) * i) / span);
    t.track.markEdited();
    this.update();
  }

  /** @param {number} step @param {PointerEvent} e */
  showLabel(step, e) {
    const t = this.target;
    if (!t) return;
    const r = this.el.getBoundingClientRect();
    const left = e.clientX - r.left <= r.width / 2;
    this.label.hidden = false;
    this.label.classList.toggle('right', !left);
    const y = (1 - t.param.automation[step]) * r.height;
    const stepX = (step / N_STEPS) * r.width;
    Object.assign(this.label.style, { left: `${stepX + (left ? 1 : -1) * (r.width / N_STEPS)}px`, top: `${(this.lastStep === null ? y : e.clientY - r.top) - 20}px` });
    /** @type {HTMLElement} */ (this.label.querySelector('.auto-step')).textContent = `STEP ${step}`;
    /** @type {HTMLElement} */ (this.label.querySelector('.auto-value')).textContent = t.param.format(step);
  }

  update() {
    const t = this.target;
    const show = !!t && this.ctx.ui.s.view === 2;
    this.el.hidden = !show;
    if (!show || !t) return;

    const { param } = t;
    this.el.style.setProperty('--c', t.track.info.color.join(' '));
    this.el.classList.toggle('active', param.automating);

    // value 1 is the top: svg y grows downward
    const pts = param.automation.map((v, i) => `${i},${1 - v}`);
    pts.push(`${N_STEPS},${1 - param.automation[0]}`);
    this.line.setAttribute('points', pts.join(' '));

    const { playing, step } = this.ctx.ui.s;
    const children = param.automation.map((v, i) => h('i', {
      class: `auto-dot${playing && i === step && param.automating ? ' now' : ''}`,
      style: `left:${(i / N_STEPS) * 100}%;top:${(1 - v) * 100}%`,
    }));
    this.dots.replaceChildren(...children);
  }
}
