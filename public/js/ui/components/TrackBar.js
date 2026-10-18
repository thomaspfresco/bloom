// @ts-check
// Track icons (a spinning petal over the track's name) and the "+" button along
// the bottom of a loop; port of the icon code in Track.draw and Loop.draw.
//
// As in the original: icons act on press (left: open the track, or mute it when
// already open; right: menu), and the "+" is invisible until the pointer nears
// the lower part of the screen (or a track is open), then glows when hovered.

import { MAX_TRACKS } from '../../core/constants.js';
import { TRACK_KIND_ORDER } from '../../music/trackKinds.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';

export class TrackBar extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'trackbar' });
    this.icons = h('div', { class: 'track-icons' });
    this.plus = h('button', {
      class: 'plus', 'aria-label': 'Add a track', 'aria-haspopup': 'menu',
      onPointerdown: (/** @type {PointerEvent} */ e) => { e.preventDefault(); this.openPlusMenu(); },
    }, h('img', { src: '/img/plus.png', alt: '', draggable: 'false' }));
    this.el.append(this.icons, this.plus);

    /** @type {Map<string, {el: HTMLElement, petal: HTMLElement, dispose: () => void}>} */
    this.items = new Map();
    this.onDestroy(() => this.items.forEach((i) => i.dispose()));
    this.lower = false;

    // the "+" appears when the pointer is in the lower part of the screen
    this.on(window, 'pointermove', (e) => {
      const lower = e.clientY > window.innerHeight * 0.8025;
      if (lower !== this.lower) { this.lower = lower; this.syncPlus(); }
    });
    this.listen(ctx.session, 'change', () => this.update());
    this.listen(ctx.ui, 'change', ({ keys }) => { if (keys.includes('selectedTrackId')) this.update(); });
  }

  /** @returns {import('../../model/Loop.js').Loop | null} */
  get loop() {
    const { session } = this.ctx;
    return session.active?.type === 'loop' ? /** @type {any} */ (session.activeItem) : null;
  }

  syncPlus() {
    const loop = this.loop;
    if (!loop) return;
    const selected = this.ctx.ui.s.selectedTrackId !== null;
    const full = loop.tracks.length >= MAX_TRACKS;
    const half = !full && ((selected || this.lower) || loop.tracks.length === 0);
    this.plus.classList.toggle('half', half);
    this.plus.disabled = full;
    this.el.classList.toggle('empty', loop.tracks.length === 0);
  }

  update() {
    const loop = this.loop;
    this.el.hidden = !loop;
    if (!loop) { this.items.forEach((i) => i.dispose()); this.items.clear(); this.icons.replaceChildren(); return; }

    const { ui, anchors } = this.ctx;
    const ids = new Set(loop.tracks.map((t) => t.id));
    for (const [id, item] of this.items) {
      if (!ids.has(id)) { item.el.remove(); item.dispose(); this.items.delete(id); }
    }

    /** @type {HTMLElement[]} */
    const ordered = [];
    for (const track of loop.tracks) {
      let item = this.items.get(track.id);
      if (!item) {
        const petal = h('span', { class: 'track-petal' });
        const el = h('button', {
          class: 'track-icon', style: `--c: ${track.info.color.join(' ')}`,
          onPointerdown: (/** @type {PointerEvent} */ e) => this.press(e, track.id),
        }, h('span', { class: 'track-muted' }, 'MUTED'), petal, h('span', { class: 'track-name' }, track.kind));
        item = { el, petal, dispose: anchors.set(`trackIcon:${track.id}`, petal) };
        this.items.set(track.id, item);
      }
      const selected = ui.s.selectedTrackId === track.id;
      item.el.classList.toggle('selected', selected);
      item.el.classList.toggle('muted', track.muted);
      item.el.classList.toggle('dim', ui.s.selectedTrackId !== null && !selected);
      item.el.setAttribute('aria-label', `${track.kind} track${track.muted ? ' (muted)' : ''}`);
      ordered.push(item.el);
    }
    let prev = null;
    for (const el of ordered) {
      if (prev ? prev.nextElementSibling !== el : this.icons.firstElementChild !== el) (prev ? prev.after(el) : this.icons.prepend(el));
      prev = el;
    }
    this.syncPlus();
  }

  /** @param {PointerEvent} e @param {string} trackId */
  press(e, trackId) {
    e.preventDefault();
    const loop = this.loop;
    const track = loop?.track(trackId);
    if (!loop || !track) return;
    const { ui, actions } = this.ctx;
    if (e.button === 2) { this.openTrackMenu(track, /** @type {HTMLElement} */ (e.currentTarget)); return; }
    if (e.button !== 0) return;
    if (ui.s.selectedTrackId === track.id) actions.toggleMute(loop, track);
    else { actions.selectTrack(track.id); this.ctx.toast.show(`${track.kind} — Grid View.`, 1500); }
  }

  openPlusMenu() {
    const loop = this.loop;
    if (!loop || loop.tracks.length >= MAX_TRACKS) return;
    this.ctx.actions.stopPlayback();
    this.ctx.notes.clearSelection();
    const r = this.plus.getBoundingClientRect();
    this.el.classList.add('plus-open'); // the "+" stays lit while its menu is open
    this.ctx.menus.open({
      x: r.left, y: r.top + r.height / 2, direction: 'up',
      onClose: () => this.el.classList.remove('plus-open'),
      options: TRACK_KIND_ORDER.map((kind) => ({
        label: kind, disabled: !loop.canAddTrack(kind),
        onSelect: () => this.ctx.generate.begin(loop, kind),
      })),
    });
  }

  /** @param {import('../../model/Track.js').Track} track @param {HTMLElement} anchor */
  openTrackMenu(track, anchor) {
    const loop = this.loop;
    if (!loop) return;
    const { menus, actions } = this.ctx;
    this.ctx.notes.clearSelection();
    actions.stopPlayback();
    const r = anchor.getBoundingClientRect();
    // the icon the menu belongs to stays above the dark layer and the "+" is hidden meanwhile
    this.el.classList.add('track-menu');
    menus.open({
      x: r.left, y: window.innerHeight - window.innerHeight / 20 - window.innerHeight / 40 - window.innerHeight / 30, direction: 'up',
      keep: { left: r.left, top: r.top, width: r.width, height: r.height },
      onClose: () => this.el.classList.remove('track-menu'),
      options: [
        { label: 'DELETE', danger: true, onSelect: async () => {
          if (await menus.confirm({ message: `Are you sure you want to delete "${track.kind}" from "${loop.name}"?` })) actions.removeTrack(loop, track.id);
        } },
        { label: 'RENAME', disabled: true },
        { label: '(UN)MUTE', onSelect: () => actions.toggleMute(loop, track) },
        { label: 'EXPORT MIDI', onSelect: () => actions.exportMidi(loop, track) },
      ],
    });
  }
}
