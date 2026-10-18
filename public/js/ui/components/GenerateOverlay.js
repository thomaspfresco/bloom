// @ts-check
// Screens of the "+ track" flow: how to start, the four AI suggestions, loading.

import { OCTAVE_LABELS } from '../../music/theory.js';
import { TRACK_KINDS } from '../../music/trackKinds.js';
import { Component } from '../Component.js';
import { h, svg } from '../dom.js';
import { Scroller } from './Scroller.js';
import { Toggle } from './Toggle.js';

const N_STEPS = 64;

export class GenerateOverlay extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'generate', hidden: true });
    this.on(document, 'keydown', (e) => {
      if (e.key === 'Escape' && this.ctx.generate.isOpen && !this.ctx.menus.isOpen) { e.preventDefault(); this.ctx.generate.cancel(); }
    });
    this.listen(this.ctx.generate, 'change', () => this.update());
    this.listen(this.ctx.record, 'change', () => this.patchRecord());
    this.on(document, 'keydown', (e) => {
      if (e.key === ' ' && this.ctx.generate.s.phase === 'record' && !e.repeat) { e.preventDefault(); this.ctx.record.toggle(); }
    });
    this.listen(this.ctx.ui, 'change', ({ keys }) => { if (keys.includes('step') || keys.includes('playing')) this.updateCursors(); });
    /** @type {string} */
    this.phase = 'closed';
    this.reviewKey = '';
    /** @type {{el: HTMLElement, cursor: SVGElement}[]} */
    this.quads = [];
    /** @type {Toggle | null} */
    this.solo = null;
    /** @type {Scroller | null} */
    this.octave = null;
    // record screen (replaced whenever it is rendered)
    /** @type {HTMLElement[]} */
    this.bars = [];
    this.recStatus = document.createElement('p');
    this.recTitle = document.createElement('p');
    this.recCancel = document.createElement('button');
    this.recGo = document.createElement('button');
  }

  update() {
    const g = this.ctx.generate.s;
    this.el.hidden = g.phase === 'closed';
    if (g.phase === 'closed') { this.el.replaceChildren(); this.phase = 'closed'; return; }
    // rebuild on phase changes; patch in place for hover/solo/octave updates
    if (g.phase !== this.phase || g.phase === 'review' && this.reviewKey !== this.keyOf(g)) {
      this.phase = g.phase;
      this.el.replaceChildren(...this.render(g));
      if (g.phase === 'review') this.reviewKey = this.keyOf(g);
    }
    if (g.phase === 'review') this.patchReview(g);
    if (g.phase === 'record') this.patchRecord();
    this.updateCursors();
  }

  /** @param {import('../controllers/GenerateController.js').GenState} g */
  keyOf(g) { return g.candidates.map((c) => c.track.id).join(','); }

  /** @param {import('../controllers/GenerateController.js').GenState} g */
  render(g) {
    const color = g.kind ? TRACK_KINDS[g.kind].color.join(' ') : 'var(--fg)';
    const backdrop = h('div', { class: 'generate-backdrop' });
    if (g.phase === 'loading') return [h('div', { class: 'busy', role: 'status', 'aria-label': 'Working' }, h('img', { src: '/img/load.gif', alt: '' }))]; // the original's loading screen
    if (g.phase === 'mode') return [backdrop, this.renderModes(g, color)];
    if (g.phase === 'record') return [backdrop, this.renderRecord(g)];
    return [backdrop, this.renderReview(g, color)];
  }

  /** @param {import('../controllers/GenerateController.js').GenState} g @param {string} color */
  renderModes(g, color) {
    const { generate } = this.ctx;
    const kind = /** @type {import('../../music/trackKinds.js').TrackKind} */ (g.kind);
    const canAi = TRACK_KINDS[kind].canGenerate;
    const options = [
      { icon: '/img/scratch.png', label: 'FROM SCRATCH', size: 'sm', onPointerdown: () => generate.fromScratch() },
      { icon: '/img/ai.png', label: 'AI SUGGESTION', size: 'lg', disabled: !canAi, onPointerdown: () => generate.suggest() },
      ...(kind === 'MELODY' ? [{ icon: '/img/sing.png', label: 'HUM/SING', size: 'lg', disabled: !this.ctx.record.available, onPointerdown: () => generate.recordMelody() }] : []),
    ];
    // like the original menu, a press anywhere but on an option closes it
    return h('div', {
      class: 'generate-modes', style: `--c: ${color}`,
      onPointerdown: (/** @type {PointerEvent} */ e) => { if (!(/** @type {HTMLElement} */ (e.target)).closest('.generate-option')) generate.cancel(); },
    },
      h('h2', { class: 'generate-title' }, 'NEW ', h('span', { class: 'kind' }, kind), ' TRACK'),
      ...options.map((o, i) => h('button', {
        class: `generate-option ${o.size}`, style: `--i:${i}; --n:${options.length}`, disabled: o.disabled, onPointerdown: o.onPointerdown,
      }, h('img', { src: o.icon, alt: '', draggable: 'false' }), h('span', {}, o.label))),
      g.error && h('p', { class: 'generate-error', role: 'alert' }, g.error),
      h('button', { class: 'text-btn generate-cancel', onPointerdown: () => generate.cancel() }, 'CANCEL'),
    );
  }

  /** @param {import('../controllers/GenerateController.js').GenState} g @param {string} color */
  renderReview(g, color) {
    const { generate } = this.ctx;
    const isDrums = g.kind === 'DRUMS';
    this.quads = g.candidates.map((c, i) => {
      const cursor = svg('line', { class: 'quad-cursor', x1: 0, x2: 0, y1: 0, y2: isDrums ? 8 : 72, visibility: 'hidden' });
      const roll = this.roll(c.track, isDrums, cursor);
      const el = h('button', {
        class: 'quad', 'aria-label': `Suggestion ${i + 1}${isDrums ? '' : `, key ${c.label}`}. Click to use it.`,
        onPointerenter: () => generate.hover(i),
        onPointerleave: () => generate.hover(-1),
        onPointerdown: () => generate.choose(i),
      },
        !isDrums && h('span', { class: 'quad-key' }, h('b', {}, c.label.replace(' major', '')), h('i', {}, 'KEY')),
        roll,
      );
      return { el, cursor };
    });

    this.solo = new Toggle({ label: 'Solo suggestion', get: () => generate.s.solo, set: (v) => generate.setSolo(v), color, class: 'solo' });
    this.octave = isDrums ? null : new Scroller({
      label: 'OCTAVE', min: 0, max: 7, class: 'context',
      get: () => generate.s.octave, set: (v) => generate.setOctave(v), format: (v) => OCTAVE_LABELS[v],
    });
    const tempo = new Scroller({
      label: 'TEMPO', min: 20, max: 400, inc: 1, inc2: 5, wheel: true, class: 'tempo',
      get: () => g.loop?.tempo ?? 120, set: (v) => { g.loop?.setTempo(v); if (g.loop) this.ctx.session.touch('loop', g.loop.id); },
      format: (v) => `${v} BPM`,
    });

    return h('div', { class: 'generate-review', style: `--c: ${color}` },
      h('p', { class: 'generate-hint' }, 'Select one of the generated parts or regenerate them'),
      h('div', { class: 'quads', role: 'group', 'aria-label': 'Suggestions' }, ...this.quads.map((q) => q.el)),
      h('div', { class: 'generate-bar' },
        tempo.el,
        h('span', { class: 'ctl-label solo-label' }, 'SOLO'), this.solo.el,
        this.octave?.el,
        h('button', { class: 'text-btn generate-cancel', onPointerdown: () => generate.cancel() }, 'CANCEL'),
        h('button', { class: 'text-btn strong generate-regen', onPointerdown: () => generate.suggest() }, 'REGENERATE'),
      ),
    );
  }

  /** Mini piano roll of a candidate (SVG; one unit = one step). @param {import('../../model/Track.js').Track} track @param {boolean} isDrums @param {SVGElement} cursor */
  roll(track, isDrums, cursor) {
    const lines = track.notes.map((n) => {
      // pitched notes sit in a band; drums get one lane each (as in the old chooser)
      const y = isDrums ? 8 - (n.pitch + 1) : 48 - n.pitch;
      const x1 = isDrums ? 1 + n.start : n.start;
      return svg('line', { x1, x2: x1 + n.duration, y1: y, y2: y, class: 'roll-note', 'stroke-width': isDrums ? 0.2 : 0.5 });
    });
    const guides = [0.25, 0.5, 0.75].map((f) => svg('line', { x1: f * N_STEPS, x2: f * N_STEPS, y1: 0, y2: isDrums ? 8 : 72, class: 'roll-guide' }));
    return svg('svg', { class: 'roll', viewBox: `0 0 ${isDrums ? 65 : N_STEPS} ${isDrums ? 8 : 72}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, ...guides, ...lines, cursor);
  }

  /** @param {import('../controllers/GenerateController.js').GenState} g */
  renderRecord(g) {
    const { record, generate, session } = this.ctx;
    const loop = g.loop;
    const green = TRACK_KINDS.MELODY.color.join(' ');
    this.bars = Array.from({ length: N_STEPS }, (_, i) => h('i', { class: 'rec-bar', style: `--i:${i}` }));
    this.recStatus = h('p', { class: 'rec-status' });
    this.recTitle = h('p', { class: 'rec-title' }, 'Sing/hum a Melody');
    this.recCancel = h('button', { class: 'text-btn generate-cancel', onPointerdown: () => { if (!this.busyRecording()) generate.cancel(); } }, 'CANCEL');
    this.recGo = h('button', {
      class: 'text-btn strong generate-regen', onPointerdown: () => {
        const n = record.transcribe();
        if (n > 0) this.ctx.toast.show(`${n} note${n === 1 ? '' : 's'} detected.`, 2500);
        else this.ctx.toast.show('No notes detected. Try again, a little closer to the microphone.', 4000);
      },
    }, 'GENERATE');
    const tempo = new Scroller({
      label: 'TEMPO', min: 20, max: 400, inc: 1, inc2: 5, wheel: true, class: 'tempo',
      get: () => loop?.tempo ?? 120, set: (v) => { loop?.setTempo(v); if (loop) session.touch('loop', loop.id); },
      format: (v) => `${v} BPM`,
    });
    const click = new Toggle({
      label: 'Metronome click', class: 'click',
      get: () => loop?.click ?? false, set: (on) => { if (loop) { loop.click = on; session.touch('loop', loop.id); } },
    });
    click.setPulseColor(green);
    return h('div', { class: 'generate-record', style: `--c: ${green}` },
      this.recTitle,
      h('div', { class: 'rec-bars', 'aria-hidden': 'true' }, ...this.bars),
      this.recStatus,
      h('div', { class: 'generate-bar' }, tempo.el, h('span', { class: 'ctl-label click-label' }, 'CLICK'), click.el, this.recCancel, this.recGo));
  }

  busyRecording() {
    const st = this.ctx.record.s.status;
    return st === 'countdown' || st === 'recording';
  }

  /** Reflect the recorder's state in the record screen. */
  patchRecord() {
    if (this.ctx.generate.s.phase !== 'record' || !this.bars) return;
    const s = this.ctx.record.s;
    const text = {
      opening: 'Waiting for microphone access\u2026',
      denied: 'Microphone access was blocked. Allow it in your browser\u2019s site settings, then try again.',
      unsupported: 'This browser cannot record from a microphone.',
      idle: 'Press \u201Cspacebar\u201D to start recording',
      countdown: `Recording starts in ${s.count}`,
      recording: 'Recording...',
      recorded: 'Press \u201Cspacebar\u201D to record again',
      analyzing: 'Listening\u2026',
      closed: '',
    }[s.status];
    this.recStatus.textContent = text;
    this.recStatus.classList.toggle('error', s.status === 'denied' || s.status === 'unsupported');
    this.bars.forEach((b, i) => b.style.setProperty('--v', String(s.levels[i])));
    this.el.classList.toggle('rec-live', s.status === 'recording' || s.status === 'countdown');
    this.recCancel.disabled = this.busyRecording();
    this.recGo.disabled = s.status !== 'recorded';
  }

  /** @param {import('../controllers/GenerateController.js').GenState} g */
  patchReview(g) {
    this.quads?.forEach((q, i) => q.el.classList.toggle('hover', i === g.hover));
    this.solo?.refresh();
    this.octave?.refresh();
  }

  updateCursors() {
    const g = this.ctx.generate.s;
    if (g.phase !== 'review' || !this.quads) return;
    const { ui } = this.ctx;
    this.quads.forEach((q, i) => {
      const on = i === g.hover && ui.s.playing && ui.s.step >= 0;
      q.cursor.setAttribute('visibility', on ? 'visible' : 'hidden');
      if (on) {
        const x = g.kind === 'DRUMS' ? 1 + ui.s.step : ui.s.step;
        q.cursor.setAttribute('x1', String(x));
        q.cursor.setAttribute('x2', String(x));
      }
    });
  }
}
