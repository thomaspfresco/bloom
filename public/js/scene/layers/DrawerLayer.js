// @ts-check
// Blooms inside the open drawer, the hover preview, and the dragged ghost.
// Port of the drawInDrawer / drawPreview paths of the old Loop and Track classes.

import { BloomPool } from '../actors/BloomPool.js';
import { drawLoopCircle } from '../actors/LoopCircle.js';

/** @typedef {import('../core/BloomScene.js').Frame} Frame */
/** @typedef {import('../core/types.js').SceneContext} SceneContext */

export class DrawerLayer {
  /** @param {SceneContext} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.pool = new BloomPool();
    this.clock = { phase: 0, zoff: 0 };
    this.openness = 0;
    this.content = 0;
    this.lastReset = 0;
    this.lastDrawer = /** @type {string | null} */ (null);
    this.lastStep = -1;
    this.previewSince = 0;
    this.lastPreview = /** @type {string | null} */ (null);
    this.openedAt = 0;
  }

  /** @param {Frame} frame */
  update(frame) {
    const { ui, session, anchors } = this.ctx;
    const { k } = frame;
    this.pool.sweep(frame.t);

    // The dark layer grows 10/255 per frame up to 225/255 (and shrinks the same way);
    // the drawer's own content fades 15/255 per frame.
    const open = ui.s.drawer !== null;
    this.openness = Math.min(1, Math.max(0, this.openness + (open ? 1 : -1) * (10 / 225) * k));
    this.content = Math.min(1, Math.max(0, this.content + (open ? 1 : -1) * (15 / 255) * k));
    if (ui.s.drawer !== this.lastDrawer) {
      if (ui.s.drawer) { this.pool.clear(); this.openedAt = frame.t; }
      this.lastDrawer = ui.s.drawer;
    }
    if (ui.s.dimReset !== this.lastReset) { this.lastReset = ui.s.dimReset; this.openness = 0; this.content = 0; }
    const dragging = ui.s.dragId !== null;
    if (this.openness < 0.01 && !dragging) { this.lastStep = -1; return; }
    frame.dim.value = Math.max(frame.dim.value, 0.88 * this.openness);
    const out = { ...frame, batches: frame.overlay };

    this.clock.phase += 0.0025 * k;
    this.clock.zoff += 0.0008 * k;

    const playing = ui.s.playing;
    const step = ui.s.step;
    const stepChanged = playing && step >= 0 && step !== this.lastStep;
    this.lastStep = playing ? step : -1;
    const H = frame.height;
    const W = frame.width;

    // --- items ---------------------------------------------------------------
    if (open) {
      const names = anchors.names('drawerItem:');
      const byItem = new Map();
      for (const name of names) {
        const [, id] = name.split(':');
        if (!byItem.has(id)) byItem.set(id, byItem.size);
      }
      const n = byItem.size || 1;
      const isLoops = ui.s.drawer === 'loops';
      for (const name of names) {
        const [, id, kStr] = name.split(':');
        const rect = anchors.rect(name);
        if (!rect) continue;
        const loop = isLoops ? session.loop(id) : session.loop(session.struct(id)?.sections[Number(kStr)]?.loopId ?? '');
        if (!loop) continue;

        const index = byItem.get(id) ?? 0;
        const reveal = (frame.t - this.openedAt) >= (500 / n) * index;
        if (!reveal) continue;

        const hover = ui.s.hoverId === id;
        const dragged = ui.s.dragId === id;
        drawLoopCircle(out, this.pool, `item:${name}`, loop, {
          cx: rect.cx, cy: rect.cy, radius: rect.w / 2, wobble: 1 / 3, clock: this.clock,
          loopIndex: session.loops.indexOf(loop), lineScale: 1 / 1.5,
          opacity: (hover ? 1 : 1 / 3) * this.content * (dragged ? 0 : 1), thin: true,
          playing: false, step: -1, stepChanged: false,
          noteSize: rect.w / 8, noteAlpha: (hover ? 1 : 0.5) * this.content * (dragged ? 0 : 1),
          origin: { x: isLoops ? -W / 5 : W + W / 5, y: H / 2 },
        });
      }
    }

    // --- preview -------------------------------------------------------------
    const previewId = open ? ui.s.previewId : null;
    if (previewId !== this.lastPreview) { this.lastPreview = previewId; this.previewSince = frame.t; }
    if (previewId && !dragging) {
      const isLoops = ui.s.drawer === 'loops';
      const loops = isLoops
        ? [session.loop(previewId)]
        : (session.struct(previewId)?.sections ?? []).map((s) => session.loop(s.loopId));
      const ramp = Math.min(1, (frame.t - this.previewSince) / 425);
      loops.forEach((loop, i) => {
        const rect = anchors.rect(`drawerPreview:${i}`);
        if (!loop || !rect) return;
        // for a structure, only the section being played is "live"
        const live = isLoops || ui.s.sectionIndex === i;
        drawLoopCircle(out, this.pool, `preview:${previewId}:${i}`, loop, {
          cx: rect.cx, cy: rect.cy, radius: rect.w / 2, wobble: 1 / 2.5, clock: this.clock,
          loopIndex: session.loops.indexOf(loop), opacity: ramp, fade: true,
          playing: playing && live, step: live ? step : -1, stepChanged: stepChanged && live,
          noteSize: isLoops ? H / 50 : H / 80, noteAlpha: ramp, react: true,
          origin: { x: rect.cx, y: rect.cy },
        });
        if (isLoops) for (const track of loop.tracks) {
          const bloom = this.pool.map.get(`preview:${previewId}:${i}:${track.id}`);
          if (bloom) this.ctx.handoff.offer(loop.id, track.id, bloom, frame.t);
        }
      });
    }

    // --- dragged ghost -------------------------------------------------------
    if (dragging) {
      const rect = anchors.rect('dragGhost');
      const id = /** @type {string} */ (ui.s.dragId);
      const struct = session.struct(id);
      if (rect) {
        const loops = struct ? struct.sections.map((s) => session.loop(s.loopId)) : [session.loop(id)];
        loops.forEach((loop, i) => {
          if (!loop) return;
          drawLoopCircle(out, this.pool, `ghost:${id}:${i}`, loop, {
            cx: rect.cx - (loops.length - 1 - i) * rect.w * 1.3, cy: rect.cy, radius: rect.w / 2, wobble: 1 / 3, clock: this.clock,
            loopIndex: session.loops.indexOf(loop), lineScale: 1 / 1.5, opacity: 1, thin: true,
            playing: false, step: -1, stepChanged: false,
            noteSize: rect.w / 8, noteAlpha: 1, origin: { x: rect.cx, y: rect.cy }, easeN: 3,
          });
        });
      }
    }
  }
}
