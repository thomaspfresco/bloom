// @ts-check
import { DoubleSide, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, MeshBasicNodeMaterial } from 'three/webgpu';
import { instancedDynamicBufferAttribute } from 'three/tsl';

/** @typedef {import('three/webgpu').Matrix4} Matrix4 */

/**
 * Every petal on screen, in one instanced draw call. Each frame: `begin()`,
 * any number of `add()`, then `end()`. Colour (with alpha) is per instance.
 */
export class PetalBatch {
  /** @param {import('three/webgpu').BufferGeometry} geometry @param {number} [capacity] @param {number} [renderOrder] */
  constructor(geometry, capacity = 4096, renderOrder = 2) {
    this.capacity = capacity;
    this.count = 0;
    this.rgba = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.rgba.setUsage(DynamicDrawUsage);

    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
    material.colorNode = instancedDynamicBufferAttribute(this.rgba, 'vec4');

    this.mesh = new InstancedMesh(geometry, material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = renderOrder;
  }

  begin() { this.count = 0; }

  /**
   * @param {Matrix4} matrix model matrix in scene (CSS px, y-down) space
   * @param {number} r 0-255 @param {number} g 0-255 @param {number} b 0-255 @param {number} a 0-1
   */
  add(matrix, r, g, b, a) {
    if (this.count >= this.capacity || a <= 0) return;
    const i = this.count++;
    this.mesh.setMatrixAt(i, matrix);
    const o = i * 4;
    const arr = /** @type {Float32Array} */ (this.rgba.array);
    arr[o] = r / 255; arr[o + 1] = g / 255; arr[o + 2] = b / 255; arr[o + 3] = a;
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.rgba.needsUpdate = true;
  }

  dispose() {
    this.mesh.geometry.dispose();
    /** @type {import('three/webgpu').Material} */ (this.mesh.material).dispose();
    this.mesh.dispose();
  }
}
