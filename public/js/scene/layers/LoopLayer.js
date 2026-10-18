// @ts-check
// The open loop on the canvas: one ribbon per track with its notes as petals
// (overview), or the selected track's notes on the grid. Also the petal icons
// at the bottom. Port of Loop.draw / Track.draw / Track.drawNotes / Note.draw.

import { Matrix4 } from 'three/webgpu';
import { noteRow, rowCount, rowY, stepX } from '../core/gridMath.js';
import { BloomPool } from '../actors/BloomPool.js';
import { NoteVisual } from '../actors/NoteVisual.js';
import { petalMatrix } from '../core/petalMath.js';

const _m = new Matrix4();

/** @typedef {import('../core/BloomScene.js').Frame} Frame */
/** @typedef {import('../core/types.js').SceneContext} SceneContext */
/** @typedef {import('../../model/Track.js').Track} Track */

export class LoopLayer {
  /** @param {SceneContext} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.pool = new BloomPool();
    this.lastStep = -1;
    this.lastSelected = /** @type {string | null} */ (null);
    /** icon spin state per track id */
    this.icons = new Map();
    /** visual for the note being drawn */
    this.draftVisual = new NoteVisual();
  }

  /** @param {Frame} frame */
  update(frame) {
    const { session, ui, anchors } = this.ctx;
    this.pool.sweep(frame.t);

    const loop = session.active?.type === 'loop' ? /** @type {import('../../model/Loop.js').Loop | null} */ (session.activeItem) : null;
    if (!loop) { this.lastStep = -1; return; }

    const grid = anchors.rect('grid');
    if (!grid) return;
    const { width: W, height: H, k } = frame;
    const sw = grid.w / 64;
    const sel = ui.s.selectedTrackId;
    const playing = ui.s.playing;
    const step = ui.s.step;
    const stepChanged = playing && step >= 0 && step !== this.lastStep;
    this.lastStep = playing ? step : -1;
    if (sel !== this.lastSelected) this.onSelectionChanged(sel);

    loop.tracks.forEach((track, ti) => {
      const key = `loop:${track.id}`;
      const isNew = !this.pool.map.has(key);
      const bloom = this.pool.get(key, frame.t, { x: W / 2, y: H / 2 });
      if (isNew) {
        // coming from a drawer preview: the circle unfolds into the ribbon
        const from = this.ctx.handoff.take(loop.id, track.id, frame.t);
        if (from) bloom.copyFrom(from);
      }
      bloom.ribbonTargets(frame, { gridX: grid.x, stepX: sw, trackIndex: ti });
      bloom.ease(15, k);

      // dim the lines of other tracks while one is open
      const targetOpa = sel !== null && sel !== track.id ? 0.25 : 1;
      bloom.opaLine += Math.sign(targetOpa - bloom.opaLine) * Math.min(Math.abs(targetOpa - bloom.opaLine), (10 / 255) * k);

      if (sel === null) bloom.strokeRibbon(frame, { trackIndex: ti, playing, step });

      this.drawNotes(frame, track, ti, bloom, { grid, sw, sel, view: ui.s.view, playing, step, stepChanged });
      this.drawIcon(frame, track, ti, sel);
      if (sel === track.id && ui.s.view === 1) this.drawStudioPetal(frame, track);
    });
  }

  /** The big petal in the studio's visualiser box. @param {Frame} frame @param {Track} track */
  drawStudioPetal(frame, track) {
    const rect = this.ctx.anchors.rect('studioPetal');
    const s = this.icons.get(track.id);
    if (!rect || !s) return;
    const [r, g, b] = track.info.color;
    petalMatrix(_m, { x: rect.cx, y: rect.cy, z: 0, scale: rect.w / frame.petalSize, rx: Math.PI / 2, ry: s.ang, rz: Math.sin(s.ang) * Math.PI / 3 });
    frame.batches.petals.add(_m, r, g, b, 1);
  }

  /** @param {string | null} sel */
  onSelectionChanged(sel) {
    this.lastSelected = sel;
    if (sel) {
      const s = this.icons.get(sel);
      if (s) s.angInc = Math.PI / 15;
    }
  }

  /**
   * @param {Frame} frame @param {Track} track @param {number} ti @param {import('../actors/TrackBloom.js').TrackBloom} bloom
   * @param {{grid: import('../core/gridMath.js').GridRect & {cx: number, cy: number}, sw: number, sel: string | null, view: number, playing: boolean, step: number, stepChanged: boolean}} s
   */
  drawNotes(frame, track, ti, bloom, { grid, sw, sel, view, playing, step, stepChanged }) {
    const { width: W, height: H, k } = frame;
    const { ui } = this.ctx;
    const color = track.info.color;
    const size = H / 60;
    const inGrid = sel === track.id && view === 0;
    const overview = sel === null;
    const alive = new Set(track.notes.map((n) => n.id));
    bloom.pruneNotes(alive);
    if (!inGrid && !overview) return;

    const nRows = rowCount(track);
    for (const note of track.notes) {
      let tx;
      let ty;
      if (inGrid) {
        const row = noteRow(note, track);
        if (row < 0) continue;
        tx = stepX(grid, note.start);
        ty = rowY(grid, nRows, row);
      } else {
        tx = bloom.xs[note.start + 1];
        ty = bloom.ys[note.start + 1];
      }
      const v = bloom.visual(note.id, { x: Math.random() * W, y: Math.random() * H });
      if (overview) ty += Math.sin(v.ang / 2) * (H / 40);

      if (stepChanged && note.start === step && !track.muted) v.trigger(size);
      const sounding = playing && note.start <= step && step <= note.end && !track.muted;
      if (sounding) {
        v.hold();
        if (step < note.end) v.spawn(grid.x + step * sw, v.y, H);
      }
      if (inGrid) {
        if (ui.s.selectedNotes.has(note.id)) {
          v.boost = 100;
          if (v.ringOpacity === 0) { v.ringOpacity = 1; v.ringSize = size; }
        }
        if (ui.s.hoverNoteId === note.id) v.angInc = Math.max(v.angInc, Math.PI / 12);
      }

      v.approach(tx, ty, 15, k);
      v.tick(k, H);

      if (inGrid) {
        // length of the note: a line running right from its petal
        frame.batches.strokes.line(v.x, v.y, v.x + note.duration * sw, v.y, H / 120, color, 100 / 255);
      }
      bloom.drawNote(frame, v, color, { x: v.x, y: v.y, size, alpha: 1 });
    }

    // the note being drawn right now
    const draft = ui.s.draft;
    if (inGrid && draft && draft.trackId === track.id) {
      const row = noteRow(draft.note, track);
      if (row >= 0) {
        const v = this.draftVisual;
        v.approach(stepX(grid, draft.note.start), rowY(grid, nRows, row), 4, k);
        v.boost = 100;
        v.tick(k, H);
        frame.batches.strokes.line(v.x, v.y, v.x + draft.note.duration * sw, v.y, H / 120, color, 100 / 255);
        bloom.drawNote(frame, v, color, { x: v.x, y: v.y, size, alpha: 1 });
      }
    }
  }

  /** Spinning petal above the track's name. @param {Frame} frame @param {Track} track @param {number} ti @param {string | null} sel */
  drawIcon(frame, track, ti, sel) {
    const rect = this.ctx.anchors.rect(`trackIcon:${track.id}`);
    if (!rect) return;
    let s = this.icons.get(track.id);
    if (!s) { s = { ang: Math.random() * Math.PI * 2, angInc: Math.PI / 20 }; this.icons.set(track.id, s); }
    s.ang += (ti % 2 === 0 ? 1 : -1) * s.angInc * frame.k;
    if (s.angInc > Math.PI / 400) s.angInc = Math.max(Math.PI / 400, s.angInc - 0.002 * frame.k);

    const [r, g, b] = track.info.color;
    const dim = sel !== null && sel !== track.id ? 0.25 : 1;
    const alpha = track.muted ? dim / 2 : dim;
    petalMatrix(_m, { x: rect.cx, y: rect.cy, z: 0, scale: rect.w / frame.petalSize, rx: Math.PI / 2, ry: s.ang, rz: Math.sin(s.ang) * Math.PI / 3 });
    frame.batches.petals.add(_m, r, g, b, alpha);
  }
}

