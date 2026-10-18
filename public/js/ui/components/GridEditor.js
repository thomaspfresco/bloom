// @ts-check
// The note grid: pointer editing of the open track's notes.
//
// Left-drag on empty space draws a note, left-drag on a note moves it (and the
// whole selection), right-drag draws a selection box, the wheel changes the
// length of selected notes. Drawing of the notes themselves is done by the
// scene (scene/layers/LoopLayer.js); this component owns the pointer logic and
// the dotted grid, labels and playhead.

import { Note } from '../../model/Note.js';
import { addNote, makeRoomFor } from '../../model/noteOps.js';
import { DRUM_LABELS, NOTE_LABELS } from '../../music/theory.js';
import { Component } from '../Component.js';
import { h } from '../dom.js';
import { canMove, cellAt, dragSpan, noteRow, rowCount, rowToNote, rowY, stepX } from '../../scene/core/gridMath.js';

/**
 * @typedef {{mode: 'draw', anchorStep: number, row: number}
 *   | {mode: 'move', anchorStep: number, anchorRow: number, origin: Map<string, {start: number, row: number}>, leadId: string}
 *   | {mode: 'marquee', x0: number, y0: number}} Drag
 */

export class GridEditor extends Component {
  /** @param {import('../context.js').UiContext} ctx */
  constructor(ctx) {
    super(ctx);
    this.el = h('div', { class: 'grid-frame' });
    this.dots = h('div', { class: 'grid-dots' });
    this.hot = h('div', { class: 'grid-dots hot' });
    this.lines = h('div', { class: 'grid-lines' });
    this.playhead = h('div', { class: 'playhead', hidden: true });
    this.marquee = h('div', { class: 'marquee', hidden: true });
    this.info = h('div', { class: 'note-info', hidden: true }, h('span', { class: 'note-info-step' }), h('span', { class: 'note-info-name' }));
    this.hit = h('div', { class: 'grid-hit', role: 'application', 'aria-label': 'Note grid' });
    this.el.append(this.dots, this.hot, this.lines, this.playhead, this.marquee, this.info, this.hit);

    this.onDestroyAnchor = this.ctx.anchors.set('grid', this.el);
    this.onDestroy(this.onDestroyAnchor);

    /** @type {Drag | null} */
    this.drag = null;
    this.gridHover = false;

    this.on(this.hit, 'pointerdown', (e) => this.down(e));
    this.on(this.hit, 'pointermove', (e) => this.move(e));
    this.on(this.hit, 'pointerup', (e) => this.up(e));
    this.on(this.hit, 'pointercancel', (e) => this.up(e));
    this.on(this.hit, 'pointerleave', () => { this.gridHover = false; if (!this.drag) this.ctx.ui.set({ hoverNoteId: null }); });
    this.on(this.hit, 'contextmenu', (e) => e.preventDefault());
    this.on(this.hit, 'wheel', (e) => this.wheel(e), { passive: false });

    this.listen(this.ctx.ui, 'change', ({ keys }) => {
      if (keys.some((k) => ['selectedTrackId', 'view', 'step', 'playing', 'draft', 'selectedNotes', 'hoverNoteId'].includes(k))) this.update();
    });
    this.listen(this.ctx.session, 'change', () => this.update());
  }

  // ---- state helpers --------------------------------------------------------

  get editing() { return this.ctx.notes.target(); }

  /** Is the grid interactive right now? */
  get active() { return this.ctx.ui.s.view === 0 && this.editing !== null; }

  rect() {
    const r = this.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }

  // ---- pointer ----------------------------------------------------------------

  /** @param {PointerEvent} e */
  down(e) {
    const t = this.editing;
    if (!t || this.ctx.menus.isOpen || this.ctx.ui.s.drawer) return;
    const { track } = t;
    const rect = this.rect();
    const nRows = rowCount(track);
    const cell = cellAt(rect, nRows, e.clientX, e.clientY);

    if (e.button === 2) {
      this.hit.setPointerCapture(e.pointerId);
      this.ctx.notes.clearSelection();
      this.drag = { mode: 'marquee', x0: e.clientX, y0: e.clientY };
      this.showMarquee(e.clientX, e.clientY);
      return;
    }
    if (e.button !== 0 || !cell.inside) return;

    this.hit.setPointerCapture(e.pointerId);
    const hit = this.noteAt(track, cell.step, cell.row);
    const { ui, engine } = this.ctx;

    if (hit) {
      if (!ui.s.selectedNotes.has(hit.id)) this.ctx.notes.select([hit.id]);
      /** @type {Map<string, {start: number, row: number}>} */
      const origin = new Map();
      for (const n of track.notes) if (ui.s.selectedNotes.has(n.id)) origin.set(n.id, { start: n.start, row: noteRow(n, track) });
      this.drag = { mode: 'move', anchorStep: cell.step, anchorRow: cell.row, origin, leadId: hit.id };
      engine.blip(track, hit.pitch, hit.octave);
    } else {
      this.ctx.notes.clearSelection();
      const { pitch, octave } = rowToNote(cell.row, track);
      ui.set({ draft: { trackId: track.id, note: new Note({ pitch, octave, start: cell.step, duration: 1 }) } });
      this.drag = { mode: 'draw', anchorStep: cell.step, row: cell.row };
      engine.blip(track, pitch, octave);
    }
    this.hit.classList.add('dragging');
  }

  /** @param {PointerEvent} e */
  move(e) {
    const t = this.editing;
    if (!t) return;
    const { track } = t;
    const rect = this.rect();
    const nRows = rowCount(track);
    const cell = cellAt(rect, nRows, e.clientX, e.clientY);
    this.el.style.setProperty('--mx', `${e.clientX - rect.x}px`);
    this.el.style.setProperty('--my', `${e.clientY - rect.y}px`);

    const d = this.drag;
    if (!d) {
      const over = cell.inside ? this.noteAt(track, cell.step, cell.row) : null;
      this.hit.classList.toggle('over-note', !!over);
      this.hit.classList.toggle('can-add', cell.inside && !over);
      if (!cell.inside) this.gridHover = false;
      else if (!this.gridHover) {
        this.gridHover = true;
        const n = this.ctx.ui.s.selectedNotes.size;
        this.ctx.toast.show(n === 0 ? 'Right Click drag to add Note.\nLeft Click drag to select Notes.'
          : n === 1 ? "Scroll to change Note's duration.\nDrag to change its position."
            : "Scroll to change Notes' duration.\nDrag one to move all the selected.", 5000);
      }
      this.ctx.ui.set({ hoverNoteId: over?.id ?? null });
      return;
    }

    if (d.mode === 'draw') {
      const draft = this.ctx.ui.s.draft;
      if (!draft || !(cell.step >= 0 && cell.step < 64)) return;
      const span = dragSpan(d.anchorStep, cell.step);
      draft.note.start = span.start;
      draft.note.duration = span.duration;
      this.ctx.ui.set({ draft: { ...draft } });
    } else if (d.mode === 'move') {
      if (!cell.inside) return;
      this.applyMove(track, d, cell.step - d.anchorStep, cell.row - d.anchorRow);
    } else {
      this.showMarquee(e.clientX, e.clientY);
      this.selectInside(track, rect, nRows, d.x0, d.y0, e.clientX, e.clientY);
    }
  }

  /**
   * @param {import('../../model/Track.js').Track} track
   * @param {Extract<Drag, {mode: 'move'}>} d @param {number} dStep @param {number} dRow
   */
  applyMove(track, d, dStep, dRow) {
    const moving = track.notes.filter((n) => d.origin.has(n.id));
    const from = moving.map((n) => {
      const o = /** @type {{start: number, row: number}} */ (d.origin.get(n.id));
      return { start: o.start, duration: n.duration, pitch: rowToNote(o.row, track).pitch, octave: rowToNote(o.row, track).octave };
    });
    if (!canMove(from, track, dStep, dRow)) return;

    let leadChanged = false;
    for (const n of moving) {
      const o = /** @type {{start: number, row: number}} */ (d.origin.get(n.id));
      const target = rowToNote(o.row + dRow, track);
      if (n.id === d.leadId && (n.pitch !== target.pitch || n.octave !== target.octave)) leadChanged = true;
      n.start = o.start + dStep;
      n.pitch = target.pitch;
      n.octave = target.octave;
    }
    const lead = moving.find((n) => n.id === d.leadId);
    if (leadChanged && lead) this.ctx.engine.blip(track, lead.pitch, lead.octave);
    this.ctx.ui.set({ hoverNoteId: d.leadId });
    this.update();
  }

  /** @param {PointerEvent} e */
  up(e) {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.hit.classList.remove('dragging');
    if (this.hit.hasPointerCapture(e.pointerId)) this.hit.releasePointerCapture(e.pointerId);

    const t = this.editing;
    const { ui, session } = this.ctx;
    if (t) {
      if (d.mode === 'draw' && ui.s.draft) {
        addNote(t.track.notes, ui.s.draft.note);
        session.touch('loop', t.loop.id);
      } else if (d.mode === 'move') {
        for (const n of [...t.track.notes]) if (d.origin.has(n.id)) makeRoomFor(t.track.notes, n);
        session.touch('loop', t.loop.id);
      }
    }
    this.marquee.hidden = true;
    ui.set({ draft: null });
  }

  /** @param {WheelEvent} e */
  wheel(e) {
    if (!this.ctx.ui.s.selectedNotes.size) return;
    e.preventDefault();
    this.ctx.notes.resizeSelected(e.deltaY > 0 ? 1 : -1);
  }

  // ---- hit testing --------------------------------------------------------

  /** @param {import('../../model/Track.js').Track} track @param {number} step @param {number} row */
  noteAt(track, step, row) {
    return track.notes.find((n) => n.covers(step) && noteRow(n, track) === row) ?? null;
  }

  /** @param {number} x @param {number} y */
  showMarquee(x, y) {
    const d = this.drag;
    if (!d || d.mode !== 'marquee') return;
    const left = Math.min(d.x0, x), top = Math.min(d.y0, y);
    Object.assign(this.marquee.style, { left: `${left}px`, top: `${top}px`, width: `${Math.abs(x - d.x0)}px`, height: `${Math.abs(y - d.y0)}px` });
    this.marquee.hidden = false;
  }

  /**
   * Select the notes whose petals lie inside the box.
   * @param {import('../../model/Track.js').Track} track
   * @param {{x: number, y: number, w: number, h: number}} rect @param {number} nRows
   * @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 box corners
   */
  selectInside(track, rect, nRows, x0, y0, x1, y1) {
    const [l, r] = [Math.min(x0, x1), Math.max(x0, x1)];
    const [tp, b] = [Math.min(y0, y1), Math.max(y0, y1)];
    const ids = [];
    for (const n of track.notes) {
      const row = noteRow(n, track);
      if (row < 0) continue;
      const x = stepX(rect, n.start), y = rowY(rect, nRows, row);
      if (x > l && x < r && y > tp && y < b) ids.push(n.id);
    }
    const prev = this.ctx.ui.s.selectedNotes;
    if (ids.length === prev.size && ids.every((id) => prev.has(id))) return;
    for (const id of ids) {
      if (prev.has(id)) continue;
      const n = track.notes.find((x) => x.id === id);
      if (n) this.ctx.engine.blip(track, n.pitch, n.octave);
    }
    this.ctx.notes.select(ids);
  }

  // ---- view ---------------------------------------------------------------

  update() {
    const t = this.editing;
    const { ui, session } = this.ctx;
    this.el.classList.toggle('on', !!t && ui.s.view !== 1);
    this.el.classList.toggle('v0', !!t && ui.s.view === 0);
    this.el.classList.toggle('v2', !!t && ui.s.view === 2);
    this.el.classList.toggle('interactive', this.active);
    if (!t) { this.info.hidden = true; this.playhead.hidden = true; return; }

    const nRows = rowCount(t.track);
    this.el.style.setProperty('--rows', String(nRows));
    this.el.style.setProperty('--accent', t.track.info.color.join(' '));
    this.el.classList.toggle('drums', t.track.isDrums);

    // playhead
    const showHead = ui.s.playing && ui.s.step >= 0 && ui.s.view !== 1 && session.active?.type === 'loop';
    this.playhead.hidden = !showHead;
    if (showHead) {
      this.playhead.style.transform = `translateX(${ui.s.step * (this.el.clientWidth / 64)}px)`;
    }

    // label of the hovered / dragged / drafted note
    const draft = ui.s.draft?.note;
    const note = draft ?? t.track.notes.find((n) => n.id === ui.s.hoverNoteId) ?? null;
    const row = note ? noteRow(note, t.track) : -1;
    if (!note || row < 0 || ui.s.view !== 0) { this.info.hidden = true; return; }

    const sw = this.el.clientWidth / 64;
    const rh = this.el.clientHeight / (nRows - 1);
    const x = note.start * sw;
    const y = this.el.clientHeight - row * rh;
    const left = x <= this.el.clientWidth / 2;
    const [stepEl, nameEl] = /** @type {HTMLElement[]} */ ([...this.info.children]);
    nameEl.textContent = t.track.isDrums ? DRUM_LABELS[note.pitch] : `${NOTE_LABELS[note.pitch]}${note.octave}`;
    stepEl.textContent = note.duration === 1 ? `STEP ${note.start}` : `STEP ${note.start}-${note.end}`;
    this.info.classList.toggle('right', !left);
    Object.assign(this.info.style, { left: `${left ? x + sw : x - sw}px`, top: `${y - sw * 1.4}px` });
    this.info.hidden = false;
  }
}

