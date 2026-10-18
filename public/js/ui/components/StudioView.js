// @ts-check
// Studio view: knobs, on/off toggles, volume fader and level meters for the
// open track. Port of Track.drawStudio; layout is a CSS grid with the original
// proportions. The petal visualiser at the top left is drawn by the scene.

import { DRUM_LABELS } from '../../music/theory.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';
import { Knob } from './Knob.js';
import { Toggle } from './Toggle.js';

/** @typedef {import('../../model/Track.js').Track} Track */

/**
 * A boxed group: label, on/off toggle and knobs.
 * @typedef {{title: string, toggle: string, params: string[], area: string}} Box
 */

/** @param {boolean} drums @returns {Box[]} */
function boxes(drums) {
  const fx = [
    { title: 'FILTER', toggle: 'filter', params: ['filter.position'], area: 'fx1' },
    { title: 'DISTORTION', toggle: 'dist', params: ['dist.amount'], area: 'fx2' },
    { title: 'DELAY', toggle: 'delay', params: ['delay.time', 'delay.feedback', 'delay.mix'], area: 'fx3' },
    { title: 'REVERB', toggle: 'reverb', params: ['reverb.decay', 'reverb.mix'], area: 'fx4' },
  ];
  if (drums) {
    return [
      ...DRUM_LABELS.map((label, i) => ({ title: label, toggle: `part${i}`, params: [`part${i}.gain`, `part${i}.pitch`], area: `d${i}` })),
      ...fx,
    ];
  }
  return [
    { title: 'OSCILLATOR 1', toggle: 'osc1', params: ['osc1.wave', 'osc1.pitch', 'osc1.volume'], area: 'osc1' },
    { title: 'ENVELOPE 1', toggle: 'env1', params: ['env1.attack', 'env1.decay', 'env1.sustain', 'env1.release'], area: 'env1' },
    { title: 'OSCILLATOR 2', toggle: 'osc2', params: ['osc2.wave', 'osc2.pitch', 'osc2.volume'], area: 'osc2' },
    { title: 'ENVELOPE 2', toggle: 'env2', params: ['env2.attack', 'env2.decay', 'env2.sustain', 'env2.release'], area: 'env2' },
    ...fx,
  ];
}

export class StudioView extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('section', { class: 'studio', 'aria-label': 'Studio', hidden: true });
    /** @type {{refresh: () => void}[]} */
    this.widgets = [];
    /** @type {string | null} */
    this.builtFor = null;

    this.listen(this.ctx.session, 'change', () => this.update());
    this.listen(this.ctx.ui, 'change', ({ keys }) => {
      if (keys.some((k) => ['selectedTrackId', 'view'].includes(k))) this.update();
      else if (keys.includes('step') && this.ctx.ui.s.view === 1) this.refreshWidgets();
    });
    this.raf = 0;
    this.onDestroy(() => cancelAnimationFrame(this.raf));
  }

  get target() { return this.ctx.notes.target(); }

  update() {
    const t = this.target;
    const show = !!t && this.ctx.ui.s.view === 1;
    this.el.hidden = !show;
    if (!show || !t) { cancelAnimationFrame(this.raf); this.raf = 0; this.builtFor = null; return; }

    const key = `${t.track.id}:${t.track.kind}`;
    if (this.builtFor !== key) { this.builtFor = key; this.rebuild(t.loop, t.track); }
    this.refreshWidgets();
    if (!this.raf) this.raf = requestAnimationFrame(() => this.meterLoop());
  }

  refreshWidgets() { for (const w of this.widgets) w.refresh(); }

  /** @param {import('../../model/Loop.js').Loop} loop @param {Track} track */
  rebuild(loop, track) {
    this.widgets = [];
    const { session, ui, toast, anchors } = this.ctx;
    const touch = () => session.touch('loop', loop.id);
    const color = track.info.color.join(' ');
    this.el.style.setProperty('--c', color);
    this.el.classList.toggle('drums', track.isDrums);

    const visual = h('div', { class: 'studio-visual box' }, h('span', { class: 'studio-petal' }));
    this.petalDispose?.();
    this.petalDispose = anchors.set('studioPetal', /** @type {HTMLElement} */ (visual.firstElementChild));

    // volume fader + L/R meters
    this.meterL = h('i', { class: 'meter l' });
    this.meterR = h('i', { class: 'meter r' });
    const handle = h('i', { class: 'fader-handle' });
    const gainText = h('span', { class: 'fader-text' });
    const fader = h('div', { class: 'studio-fader box', role: 'slider', tabindex: '0', 'aria-label': 'Volume', 'aria-valuemin': '0', 'aria-valuemax': '1' },
      h('span', { class: 'box-title' }, 'VOLUME'),
      h('div', { class: 'fader-track' }, this.meterL, this.meterR, handle),
      gainText);
    const trackEl = /** @type {HTMLElement} */ (fader.querySelector('.fader-track'));
    const setGain = (/** @type {number} */ g) => { track.gain = Math.min(1, Math.max(0, g)); touch(); };
    const fromPointer = (/** @type {PointerEvent} */ e) => {
      const r = trackEl.getBoundingClientRect();
      setGain(1 - (e.clientY - r.top) / r.height);
    };
    trackEl.addEventListener('pointerdown', (e) => { if (e.button !== 0) return; trackEl.setPointerCapture(e.pointerId); fromPointer(e); });
    trackEl.addEventListener('pointermove', (e) => { if (trackEl.hasPointerCapture(e.pointerId)) fromPointer(e); });
    trackEl.addEventListener('pointerup', (e) => { if (trackEl.hasPointerCapture(e.pointerId)) trackEl.releasePointerCapture(e.pointerId); });
    fader.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowUp' ? 0.02 : e.key === 'ArrowDown' ? -0.02 : 0;
      if (d) { e.preventDefault(); e.stopPropagation(); setGain(track.gain + d); }
    });
    this.widgets.push({
      refresh: () => {
        fader.style.setProperty('--g', String(track.gain));
        const db = track.gain <= 0 ? -Infinity : Math.round(20 * Math.log10(track.gain) * 10) / 10;
        gainText.textContent = db <= -48 ? '-Inf' : `${db.toFixed(1)}dB`;
        fader.setAttribute('aria-valuenow', String(track.gain));
      },
    });

    const main = h('div', { class: 'studio-main' });
    for (const box of boxes(track.isDrums)) {
      const toggle = new Toggle({
        label: `${box.title} on/off`, color,
        get: () => track.toggles[box.toggle],
        set: (on) => { track.toggles[box.toggle] = on; track.markEdited(); touch(); },
      });
      const knobs = box.params.map((id) => {
        const param = track.param(id);
        return new Knob({
          param, step: () => (ui.s.playing ? ui.s.step : -1),
          onGrab: () => {
            ui.set({ paramIndex: track.params.indexOf(param) });
            if (param.automating) { param.automating = false; toast.show(`Automation "${param.label}" disabled.`, 2000); }
          },
          onEdit: () => { track.markEdited(); touch(); },
        });
      });
      const el = h('div', { class: `box fxbox area-${box.area}`, dataset: { toggle: box.toggle } },
        h('div', { class: 'box-head' }, h('span', { class: 'box-title' }, box.title), toggle.el),
        h('div', { class: 'box-knobs' }, ...knobs.map((k, j) => { k.el.style.setProperty('--j', String(j)); return k.el; })));
      this.widgets.push({ refresh: () => { toggle.refresh(); el.classList.toggle('off', !track.toggles[box.toggle]); } });
      for (const k of knobs) this.widgets.push(k);
      main.append(el);
    }
    this.el.replaceChildren(visual, fader, main);
  }

  meterLoop() {
    this.raf = 0;
    const t = this.target;
    if (!t || this.ctx.ui.s.view !== 1 || this.el.hidden) return;
    const [l, r] = this.ctx.engine.levels(t.track);
    const norm = (/** @type {number} */ db) => (Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0);
    const g = t.track.gain; // the bars never rise above the fader
    this.meterL?.style.setProperty('--v', String(norm(l) * g));
    this.meterR?.style.setProperty('--v', String(norm(r) * g));
    this.raf = requestAnimationFrame(() => this.meterLoop());
  }
}
