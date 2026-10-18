// @ts-check
import { CircleGeometry, DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, DoubleSide } from 'three/webgpu';
import { instancedDynamicBufferAttribute } from 'three/tsl';

const _m = new Matrix4();

/** Filled discs (particles). One instanced draw call. */
export class CircleBatch {
  /** @param {{capacity?: number, renderOrder?: number}} [opts] */
  constructor({ capacity = 2048, renderOrder = 0 } = {}) {
    this.capacity = capacity;
    this.count = 0;
    this.rgba = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.rgba.setUsage(DynamicDrawUsage);

    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
    material.colorNode = instancedDynamicBufferAttribute(this.rgba, 'vec4');

    this.mesh = new InstancedMesh(new CircleGeometry(0.5, 20), material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = renderOrder;
  }

  begin() { this.count = 0; }

  /** @param {number} x @param {number} y @param {number} diameter @param {number} r 0-255 @param {number} g @param {number} b @param {number} a 0-1 */
  add(x, y, diameter, r, g, b, a) {
    if (this.count >= this.capacity || a <= 0 || diameter <= 0) return;
    const i = this.count++;
    _m.makeScale(diameter, diameter, 1).setPosition(x, y, 0);
    this.mesh.setMatrixAt(i, _m);
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
}
