// @ts-check
import { svg, h } from '../dom.js';

const DRAG_UNITS_PER_VH = 250; // 1% per (viewport height / 250) px, as in the original

/**
 * Rotary knob bound to a `Parameter`. Drag vertically to change; arrow keys
 * nudge. Reports edits through `onEdit` (the caller marks the preset as edited,
 * switches off automation and saves).
 */
export class Knob {
  /**
   * @param {object} o
   * @param {import('../../model/Parameter.js').Parameter} o.param
   * @param {() => number} [o.step] current playhead step (for automated display)
   * @param {() => void} o.onEdit
   * @param {() => void} [o.onGrab] called when a drag starts
   */
  constructor({ param, step = () => -1, onEdit, onGrab }) {
    this.param = param;
    this.step = step;
    this.labelEl = h('span', { class: 'knob-label' }, param.label);
    this.valueEl = h('span', { class: 'knob-value' });
    this.needle = svg('line', { x1: 50, y1: 50, x2: 50, y2: 0, class: 'knob-needle' });
    this.dial = svg('svg', { class: 'knob-dial', viewBox: '0 0 100 100', 'aria-hidden': 'true' },
      svg('circle', { cx: 50, cy: 50, r: 50, class: 'knob-ring' }), this.needle);
    this.el = h('div', {
      class: 'knob', role: 'slider', tabindex: '0', 'aria-label': `${param.group} ${param.label}`,
      'aria-valuemin': '0', 'aria-valuemax': '1',
    }, this.labelEl, this.dial, this.valueEl);

    /** @type {{y: number, value: number} | null} */
    let drag = null;
    this.el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.el.setPointerCapture(e.pointerId);
      drag = { y: e.clientY, value: this.param.value };
      this.el.classList.add('dragging');
      onGrab?.();
    });
    this.el.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const units = Math.round((drag.y - e.clientY) / (window.innerHeight / DRAG_UNITS_PER_VH));
      const next = Math.min(1, Math.max(0, Math.round((drag.value + 0.01 * units) * 100) / 100));
      if (next !== this.param.value) { this.param.set(next); onEdit(); this.refresh(); }
    });
    const end = (/** @type {PointerEvent} */ e) => {
      if (!drag) return;
      drag = null;
      this.el.classList.remove('dragging');
      if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
    };
    this.el.addEventListener('pointerup', end);
    this.el.addEventListener('pointercancel', end);
    this.el.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 0.01 : e.key === 'ArrowDown' || e.key === 'ArrowLeft' ? -0.01 : 0;
      if (!d) return;
      e.preventDefault();
      e.stopPropagation();
      onGrab?.();
      this.param.set(this.param.value + (e.shiftKey ? d * 10 : d));
      onEdit();
      this.refresh();
    });
    this.refresh();
  }

  /** Re-read the parameter. */
  refresh() {
    const step = this.step();
    const v = this.param.valueAt(step);
    this.needle.setAttribute('transform', `rotate(${-135 + 270 * v} 50 50)`);
    this.valueEl.textContent = this.param.format(step);
    this.el.setAttribute('aria-valuenow', String(v));
    this.el.setAttribute('aria-valuetext', this.param.format(step));
    this.el.classList.toggle('automating', this.param.automating);
  }
}
