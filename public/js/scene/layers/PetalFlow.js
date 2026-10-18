// @ts-check
// Petals streaming past the camera on the home screen (the p5 `PetalParticle`s).

import { Matrix4 } from 'three/webgpu';
import { PALETTE } from '../../core/color.js';
import { Random } from '../../core/random.js';
import { petalMatrix } from '../core/petalMath.js';

const COUNT = 50;
const COLORS = [PALETTE.blue, PALETTE.pink, PALETTE.yellow, PALETTE.green];
const _m = new Matrix4();
const _r = new Matrix4();
const _z = new Matrix4();

class FlowPetal {
  /** @param {number} width @param {Random} rng */
  constructor(width, rng) {
    this.age = 1;
    this.n = rng.range(1, width / 2);
    this.rot = rng.range(0, Math.PI * 2);
    this.o = rng.range(1, rng.range(1, width / this.n));
    this.ang = rng.range(0, Math.PI * 2);
    this.angInc = rng.range(0.005, 0.05);
    // p5's round(random(0, 3)): the end colours are half as likely as the middle ones
    this.color = COLORS[Math.round(rng.range(0, COLORS.length - 1))];
  }

  /** Distance from the screen centre along the petal's ray. @param {number} width */
  distance(width) {
    return (Math.atan(this.n / this.o) * width) / (Math.PI / 2);
  }
}

export class PetalFlow {
  /** @param {Random} [rng] */
  constructor(rng = Random.shared) {
    this.rng = rng;
    this.rotation = 0;
    /** @type {FlowPetal[]} */
    this.petals = [];
    /** Only drawn (and advanced) on the home screen; the field simply resumes where it was. */
    this.visible = true;
  }

  /** @param {import('../core/BloomScene.js').Frame} frame */
  update({ batches, width, height, k, petalSize }) {
    if (!this.visible) return;
    if (this.petals.length === 0) {
      this.petals = Array.from({ length: COUNT }, () => new FlowPetal(width, this.rng));
    }
    const diagonal = Math.hypot(width, height) / 2;
    this.rotation -= 0.001 * k;

    // the original relied on the depth buffer: nearer (larger `o`) petals are in front
    const order = [...this.petals].sort((a, b) => a.o - b.o);

    for (const p of order) {
      p.age += k;
      const dist = p.distance(width);
      const scale = width / p.o / 4 / petalSize;
      petalMatrix(_m, {
        x: dist + (height / 50) * Math.sin(p.ang / 4),
        y: (height / 50) * Math.sin(p.ang / 2),
        z: -width / p.o / 5,
        scale, rx: p.ang, ry: p.ang,
      });
      // spin the whole field about the centre, then each petal about its own ray angle
      _r.makeTranslation(width / 2, height / 2, 0).multiply(_z.makeRotationZ(this.rotation + p.rot));
      _r.multiply(_m);
      batches.petals.add(_r, p.color[0], p.color[1], p.color[2], Math.min(p.age, 255) / 255);

      p.o -= 0.015 * k;
      p.ang += p.angInc * k;
    }

    // respawn petals that have left the screen
    for (let i = 0; i < this.petals.length; i++) {
      if (this.petals[i].distance(width) > diagonal || this.petals[i].o <= 0.05) this.petals[i] = new FlowPetal(width, this.rng);
    }
  }
}
