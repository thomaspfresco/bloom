// @ts-check
// The sections of the open structure: one bloom per loop, bobbing gently, the
// playing one lit up. Port of Structure.draw / Loop.drawInStructure.

import { BloomPool } from '../actors/BloomPool.js';
import { drawLoopCircle } from '../actors/LoopCircle.js';

/** @typedef {import('../core/BloomScene.js').Frame} Frame */
/** @typedef {import('../core/types.js').SceneContext} SceneContext */

export class StructLayer {
  /** @param {SceneContext} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.pool = new BloomPool();
    this.clock = { phase: 0, zoff: 0 };
    this.lastStep = -1;
    /** @type {Map<string, {angle: number, inc: number}>} */
    this.bob = new Map();
  }

  /** @param {Frame} frame */
  update(frame) {
    const { session, ui, anchors } = this.ctx;
    const struct = session.active?.type === 'struct' ? /** @type {import('../../model/Structure.js').Structure | null} */ (session.activeItem) : null;
    this.pool.sweep(frame.t);
    if (!struct) { this.lastStep = -1; return; }

    const { k, height: H } = frame;
    this.clock.phase += 0.0015 * k;
    this.clock.zoff += 0.0005 * k;

    const playing = ui.s.playing;
    const stepChanged = playing && ui.s.step >= 0 && ui.s.step !== this.lastStep;
    this.lastStep = playing ? ui.s.step : -1;

    struct.sections.forEach((sec, index) => {
      const loop = session.loop(sec.loopId);
      const rect = anchors.rect(`section:${sec.id}`);
      if (!loop || !rect) return;

      let b = this.bob.get(sec.id);
      if (!b) { b = { angle: Math.random() * Math.PI * 2, inc: 0.01 + Math.random() * 0.01 }; this.bob.set(sec.id, b); }
      b.angle += b.inc * k;

      const live = playing && ui.s.sectionIndex === index;
      const dim = 1; // the original only darkens the texts of the other sections, never their rings
      drawLoopCircle(frame, this.pool, `sec:${sec.id}`, loop, {
        cx: rect.cx, cy: rect.cy + Math.sin(b.angle) * (H / 150), radius: rect.w / 2, wobble: 1 / 2.5, clock: this.clock,
        loopIndex: session.loops.indexOf(loop), opacity: dim, fade: true,
        playing: live, step: live ? ui.s.step : -1, stepChanged: stepChanged && live,
        noteSize: H / 75, noteAlpha: dim, react: true, origin: { x: rect.cx, y: rect.cy },
      });
    });
  }
}
