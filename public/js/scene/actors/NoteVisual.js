// @ts-check
// Visual-only state of one note (never saved): where its petal is, how fast it
// spins, the "just played" glow/ring and the particles it sheds. Port of the
// animation fields of the old `Note` and `PlayParticle` classes.

import { Random } from '../../core/random.js';

const MAX_PARTICLES = 25;

class PlayParticle {
  /** @param {number} x @param {number} y @param {number} size @param {Random} rng */
  constructor(x, y, size, rng) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.theta = rng.range(0, Math.PI * 2);
    this.wander = rng.range(0.5, 2.0);
    this.drag = rng.range(0.85, 0.92);
    const dir = rng.range(0, Math.PI * 2);
    const force = rng.range(1, 2);
    this.vx = Math.sin(dir) * force;
    this.vy = Math.cos(dir) * force;
    this.opacity = rng.range(0.5, 1);
    this.alive = true;
  }

  /** @param {number} k frames @param {Random} rng */
  move(k, rng) {
    this.x += this.vx * k;
    this.y += this.vy * k;
    const drag = this.drag ** k;
    this.vx *= drag;
    this.vy *= drag;
    this.theta += rng.range(-0.5, 0.5) * this.wander * k;
    this.vx += Math.sin(this.theta) * 0.1 * k;
    this.vy += Math.cos(this.theta) * 0.1 * k;
    this.size *= 0.97 ** k;
    this.alive = this.size > 0.5;
  }
}

export class NoteVisual {
  /** @param {{x?: number, y?: number}} [at] initial position (omit to snap to the first target) */
  constructor({ x, y } = {}) {
    this.rng = Random.shared;
    /** current screen position; NaN until first placed */
    this.x = x ?? NaN;
    this.y = y ?? NaN;
    this.ang = Math.PI * this.rng.range(0, 100);
    this.angInc = this.rng.range(Math.PI / 210, Math.PI / 190);
    /** brightness boost 0-100 added to each colour channel while playing/selected */
    this.boost = 0;
    this.ringOpacity = 0;
    this.ringSize = 0;
    /** @type {PlayParticle[]} */
    this.particles = [];
    this.lastStep = -1;
  }

  /** The note was just played: spin fast, brighten, pulse a ring. @param {number} size petal size in px */
  trigger(size) {
    this.angInc = Math.PI / 12;
    this.boost = 100;
    this.ringOpacity = 1;
    this.ringSize = size;
  }

  /** While a note sounds under the playhead keep it bright and spinning. */
  hold() {
    this.angInc = Math.PI / 12;
    this.boost = 100;
  }

  /** @param {number} k frames @param {number} height viewport height */
  tick(k, height) {
    this.boost = Math.max(0, this.boost - 5 * k);
    if (this.angInc > Math.PI / 200) this.angInc = Math.max(Math.PI / 200, this.angInc - 0.005 * k);
    this.ang += this.angInc * k;
    this.ringOpacity = Math.max(0, this.ringOpacity - (10 / 255) * k);
    if (this.ringSize < height / 15) this.ringSize += (height / 400) * k;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      if (p.alive) p.move(k, this.rng);
      else this.particles.splice(i, 1);
    }
  }

  /** @param {number} x @param {number} y @param {number} height */
  spawn(x, y, height) {
    if (this.particles.length >= MAX_PARTICLES) this.particles.shift();
    this.particles.push(new PlayParticle(x, y, this.rng.range(height / 150, height / 100), this.rng));
  }

  /**
   * Move toward a target the way the old code did: close 1/n of the gap per frame.
   * @param {number} tx @param {number} ty @param {number} n @param {number} k frames
   */
  approach(tx, ty, n, k) {
    if (Number.isNaN(this.x)) { this.x = tx; this.y = ty; return; }
    const f = 1 - (1 - 1 / n) ** k;
    this.x += (tx - this.x) * f;
    this.y += (ty - this.y) * f;
  }
}
