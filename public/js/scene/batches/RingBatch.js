// @ts-check
import { DynamicDrawUsage, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshBasicNodeMaterial, PlaneGeometry, DoubleSide } from 'three/webgpu';
import { float, instancedDynamicBufferAttribute, length, smoothstep, uv, vec4 } from 'three/tsl';

const _m = new Matrix4();

/**
 * Stroked circles (the expanding "note played" rings). A quad per ring; the
 * ring is cut in the fragment shader, so thickness is in pixels regardless of size.
 */
export class RingBatch {
  /** @param {{capacity?: number, renderOrder?: number}} [opts] */
  constructor({ capacity = 512, renderOrder = 3 } = {}) {
    this.capacity = capacity;
    this.count = 0;
    this.rgba = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4);
    this.rgba.setUsage(DynamicDrawUsage);
    /** thickness as a fraction of the radius (0-1) */
    this.ratio = new InstancedBufferAttribute(new Float32Array(capacity), 1);
    this.ratio.setUsage(DynamicDrawUsage);

    // TSL node types are not precise enough for JSDoc; treat them as opaque
    const color = /** @type {any} */ (instancedDynamicBufferAttribute(this.rgba, 'vec4'));
    const ratio = /** @type {any} */ (instancedDynamicBufferAttribute(this.ratio, 'float'));
    const d = length(uv().sub(0.5)).mul(2); // 0 at the centre, 1 at the edge of the quad
    const inner = float(1).sub(ratio);
    const edge = float(0.04);
    const alpha = smoothstep(inner.sub(edge), inner, d).mul(smoothstep(float(1), float(1).sub(edge), d));

    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
    material.colorNode = vec4(color.rgb, color.a.mul(alpha));

    this.mesh = new InstancedMesh(new PlaneGeometry(1, 1), material, capacity);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.renderOrder = renderOrder;
  }

  begin() { this.count = 0; }

  /**
   * @param {number} x @param {number} y @param {number} diameter @param {number} strokePx
   * @param {number} r 0-255 @param {number} g @param {number} b @param {number} a 0-1
   */
  add(x, y, diameter, strokePx, r, g, b, a) {
    if (this.count >= this.capacity || a <= 0 || diameter <= 0) return;
    const i = this.count++;
    _m.makeScale(diameter, diameter, 1).setPosition(x, y, 0);
    this.mesh.setMatrixAt(i, _m);
    const o = i * 4;
    const arr = /** @type {Float32Array} */ (this.rgba.array);
    arr[o] = r / 255; arr[o + 1] = g / 255; arr[o + 2] = b / 255; arr[o + 3] = a;
    /** @type {Float32Array} */ (this.ratio.array)[i] = Math.min(1, (strokePx * 2) / diameter);
  }

  end() {
    this.mesh.count = this.count;
    this.mesh.visible = this.count > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.rgba.needsUpdate = true;
    this.ratio.needsUpdate = true;
  }
}
