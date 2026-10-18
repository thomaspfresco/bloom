// @ts-check
import { Component } from '../Component.js';
import { h } from '../dom.js';
import { AutomationView } from './AutomationView.js';
import { ControlsBar } from './ControlsBar.js';
import { GenerateOverlay } from './GenerateOverlay.js';
import { GridEditor } from './GridEditor.js';
import { History } from './History.js';
import { StudioView } from './StudioView.js';
import { TimeBar } from './TimeBar.js';
import { TrackBar } from './TrackBar.js';

/** Everything shown while a loop tab is open. */
export class LoopView extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('section', { class: 'loop-view', 'aria-label': 'Loop', hidden: true });
    this.hint = h('p', { class: 'loop-hint' }, 'Click "+" to create a Track');
    this.children = [
      new GridEditor(this.ctx),
      new AutomationView(this.ctx),
      new StudioView(this.ctx),
      new TimeBar(this.ctx),
      new History(this.ctx),
      new ControlsBar(this.ctx),
      new TrackBar(this.ctx),
      new GenerateOverlay(this.ctx),
    ];
    this.el.append(this.hint);
    for (const c of this.children) c.mount(this.el);
    this.onDestroy(() => this.children.forEach((c) => c.destroy()));

    this.listen(this.ctx.session, 'change', () => this.update());
    this.listen(this.ctx.generate, 'change', () => this.update());
    this.listen(this.ctx.ui, 'change', ({ keys }) => { if (keys.includes('selectedTrackId')) this.update(); });
  }

  update() {
    const { session, ui } = this.ctx;
    const loop = session.active?.type === 'loop' ? /** @type {import('../../model/Loop.js').Loop | null} */ (session.activeItem) : null;
    this.el.hidden = !loop;
    this.hint.hidden = !loop || loop.tracks.length > 0 || this.ctx.generate.isOpen;
    this.el.dataset.view = String(ui.s.view);
    this.el.classList.toggle('editing', ui.s.selectedTrackId !== null);
    if (loop) for (const c of this.children) c.update();
  }
}
