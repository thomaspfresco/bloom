// @ts-check
import { TEMPO } from '../../core/constants.js';
import { OCTAVE_LABELS } from '../../music/theory.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';
import { Scroller } from './Scroller.js';
import { Toggle } from './Toggle.js';

const VIEWS = /** @type {const} */ ([
  { view: 2, icon: '/img/automation.png', label: 'Automation view' },
  { view: 1, icon: '/img/studio.png', label: 'Studio view' },
  { view: 0, icon: '/img/grid.png', label: 'Grid view' },
]);

/** Bottom row of the loop view: tempo, click, record, a context scroller and the view switcher. */
export class ControlsBar extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'controls' });

    this.tempo = new Scroller({
      label: 'TEMPO', min: TEMPO.min, max: TEMPO.max, inc: TEMPO.step, inc2: TEMPO.fastStep, wheel: true,
      get: () => this.loop?.tempo ?? TEMPO.default,
      set: (v) => { const l = this.loop; if (l) { l.setTempo(v); this.ctx.session.touch('loop', l.id); } },
      format: (v) => `${v} BPM`, class: 'tempo',
    });
    this.click = new Toggle({
      label: 'Metronome click', class: 'click',
      get: () => this.loop?.click ?? false,
      set: (on) => { const l = this.loop; if (l) { l.click = on; this.ctx.session.touch('loop', l.id); } },
    });
    this.record = new Toggle({
      label: 'Record played notes', class: 'record', color: 'var(--record)',
      get: () => this.loop?.record ?? false,
      set: (on) => { const l = this.loop; if (l) { l.record = on; this.ctx.session.touch('loop', l.id); } },
    });

    this.octave = new Scroller({
      label: 'OCTAVE', min: 0, max: 7, class: 'context',
      get: () => this.track?.octaveWindow ?? 0,
      set: (v) => { const t = this.track; if (t) { t.octaveWindow = v; this.touch(); this.ctx.engine.releaseAll(); } },
      format: (v) => (this.track?.isDrums ? 'KICK-CRASH' : OCTAVE_LABELS[v]),
    });
    this.preset = new Scroller({
      label: 'PRESET', invert: true, min: 0, max: 0, class: 'context',
      get: () => this.track?.preset ?? 0,
      set: (v) => { const t = this.track; if (t) { t.applyPreset(v); this.touch(); } },
      format: () => this.track?.presetName ?? '',
    });
    this.param = new Scroller({
      label: 'PARAMETER', invert: true, min: 0, max: 0, class: 'context',
      get: () => this.ctx.ui.s.paramIndex,
      set: (v) => this.ctx.ui.set({ paramIndex: v }),
      format: (v) => { const p = this.track?.params[v]; return p ? `${p.group} - ${p.label}` : ''; },
    });

    this.clickLabel = h('span', { class: 'ctl-label click-label' }, 'CLICK');
    this.recordLabel = h('span', { class: 'ctl-label record-label' }, 'RECORD');
    this.viewButtons = VIEWS.map(({ view, icon, label }) => h('button', {
      class: 'view-btn', 'aria-label': label, dataset: { view: String(view) },
      onPointerdown: () => {
        const track = this.track;
        if (!track) return;
        if (this.ctx.ui.s.view === view) this.ctx.actions.selectTrack(null); // clicking the current view closes the editor
        else { this.ctx.actions.setView(view); this.ctx.toast.show(`${track.kind} — ${label.replace(' view', '')} View.`, 1500); }
      },
    }, h('img', { src: icon, alt: '', draggable: 'false' })));

    this.el.append(
      this.tempo.el, this.clickLabel, this.click.el, this.recordLabel, this.record.el,
      this.octave.el, this.preset.el, this.param.el, ...this.viewButtons,
    );

    this.listen(this.ctx.session, 'change', () => this.update());
    this.listen(this.ctx.ui, 'change', ({ keys }) => {
      if (keys.some((k) => ['selectedTrackId', 'view', 'paramIndex'].includes(k))) this.update();
      if (keys.some((k) => k === 'step' || k === 'playing')) {
        const { playing, step } = this.ctx.ui.s;
        this.click.pulse(playing && step >= 0 && step % 4 === 0);
      }
    });
  }

  get loop() {
    const { session } = this.ctx;
    return session.active?.type === 'loop' ? /** @type {import('../../model/Loop.js').Loop | null} */ (session.activeItem) : null;
  }

  get track() {
    const loop = this.loop;
    const id = this.ctx.ui.s.selectedTrackId;
    return loop && id ? loop.track(id) : null;
  }

  touch() {
    const l = this.loop;
    if (l) this.ctx.session.touch('loop', l.id);
  }

  update() {
    const color = this.track?.info.color;
    if (color) this.click.setPulseColor(color.join(' '));
    const track = this.track;
    const { ui } = this.ctx;
    this.el.hidden = !track;
    if (!track) return;

    this.preset.o.max = track.presetCount - 1;
    this.param.o.max = track.params.length - 1;
    for (const s of [this.tempo, this.octave, this.preset, this.param]) s.refresh();
    this.click.refresh();
    this.record.refresh();
    this.click.setColor(`rgb(${track.info.color.join(' ')})`);

    // which context scroller applies: octave in the grid, preset in the studio, parameter in automation
    this.octave.el.hidden = ui.s.view !== 0;
    this.preset.el.hidden = ui.s.view !== 1;
    this.param.el.hidden = ui.s.view !== 2;
    for (const b of this.viewButtons) b.classList.toggle('current', Number(b.dataset.view) === ui.s.view);
  }
}
