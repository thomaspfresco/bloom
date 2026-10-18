// @ts-check
import { CircleBatch } from './CircleBatch.js';
import { PetalBatch } from './PetalBatch.js';
import { RingBatch } from './RingBatch.js';
import { StrokeBatch } from './StrokeBatch.js';

/**
 * All drawing primitives the scene uses, created once. Layers call `begin()`
 * (via the scene) then push instances; the whole frame is ~5 draw calls.
 * Draw order is fixed: back dots, strokes, petals, front dots, rings. The scene owns two sets
 * (base and overlay) with a dimming quad between them.
 */
export class Batches {
  /**
   * @param {import('three/webgpu').BufferGeometry} petalGeometry
   * @param {{orderBase?: number, capacity?: number}} [opts] `orderBase` shifts every renderOrder (used for the overlay set)
   */
  constructor(petalGeometry, { orderBase = 0, capacity = 1 } = {}) {
    this.back = new CircleBatch({ capacity: 512 * capacity, renderOrder: orderBase });
    this.strokes = new StrokeBatch({ maxVertices: 60000 * capacity, renderOrder: orderBase + 1 });
    this.petals = new PetalBatch(petalGeometry, 4096 * capacity, orderBase + 2);
    this.front = new CircleBatch({ capacity: 4096 * capacity, renderOrder: orderBase + 3 });
    this.rings = new RingBatch({ capacity: 512 * capacity, renderOrder: orderBase + 4 });
  }

  /** @returns {import('three/webgpu').Object3D[]} meshes to add to the scene graph */
  objects() {
    return [this.back.mesh, this.strokes.mesh, this.petals.mesh, this.front.mesh, this.rings.mesh];
  }

  begin() {
    this.back.begin(); this.strokes.begin(); this.petals.begin(); this.front.begin(); this.rings.begin();
  }

  end() {
    this.back.end(); this.strokes.end(); this.petals.end(); this.front.end(); this.rings.end();
  }
}
