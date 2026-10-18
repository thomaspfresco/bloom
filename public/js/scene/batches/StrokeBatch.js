// @ts-check
import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Mesh, MeshBasicNodeMaterial, DoubleSide } from 'three/webgpu';
import { attribute } from 'three/tsl';

/**
 * Thick polylines as triangle strips built on the CPU each frame (WebGPU has
 * no line width). Per-vertex colour with alpha lets a ribbon fade around the
 * playhead. All strokes share one draw call.
 */
export class StrokeBatch {
  /** @param {{maxVertices?: number, renderOrder?: number}} [opts] */
  constructor({ maxVertices = 60000, renderOrder = 1 } = {}) {
    this.max = maxVertices;
    this.vertexCount = 0;
    this.positions = new Float32Array(maxVertices * 3);
    this.colors = new Float32Array(maxVertices * 4);

    this.geometry = new BufferGeometry();
    const pos = new BufferAttribute(this.positions, 3);
    const col = new BufferAttribute(this.colors, 4);
    pos.setUsage(DynamicDrawUsage);
    col.setUsage(DynamicDrawUsage);
    this.geometry.setAttribute('position', pos);
    this.geometry.setAttribute('aColor', col);
    this.geometry.setDrawRange(0, 0);

    const material = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
    material.colorNode = attribute('aColor', 'vec4');
    this.mesh = new Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
  }

  begin() { this.vertexCount = 0; }

  /** @private @param {number} x @param {number} y @param {number} r @param {number} g @param {number} b @param {number} a */
  vertex(x, y, r, g, b, a) {
    const i = this.vertexCount++;
    const p = i * 3;
    this.positions[p] = x; this.positions[p + 1] = y; this.positions[p + 2] = 0;
    const c = i * 4;
    this.colors[c] = r; this.colors[c + 1] = g; this.colors[c + 2] = b; this.colors[c + 3] = a;
  }

  /**
   * Add a polyline.
   * @param {ArrayLike<number>} xs @param {ArrayLike<number>} ys point coordinates
   * @param {object} style
   * @param {number} style.width stroke width in px
   * @param {number[]} style.rgb 0-255 triple
   * @param {number | ((i: number) => number)} style.alpha 0-1, constant or per point
   * @param {boolean} [style.closed]
   * @param {number} [style.count] number of points to use (default: all)
   * @param {(i: number) => number} [style.index] map draw order to array index (for reversed rings)
   */
  polyline(xs, ys, { width, rgb, alpha, closed = false, count = xs.length, index = (i) => i }) {
    const n = count;
    if (n < 2) return;
    const segs = closed ? n : n - 1;
    if (this.vertexCount + segs * 6 > this.max) return;

    const [r, g, b] = [rgb[0] / 255, rgb[1] / 255, rgb[2] / 255];
    const a = typeof alpha === 'number' ? () => alpha : alpha;
    const half = width / 2;

    for (let s = 0; s < segs; s++) {
      const i0 = index(s);
      const i1 = index((s + 1) % n);
      const x0 = xs[i0], y0 = ys[i0], x1 = xs[i1], y1 = ys[i1];
      const dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len < 1e-4) continue;
      const nx = (-dy / len) * half, ny = (dx / len) * half;
      const a0 = a(s), a1 = a((s + 1) % n);
      this.vertex(x0 + nx, y0 + ny, r, g, b, a0);
      this.vertex(x0 - nx, y0 - ny, r, g, b, a0);
      this.vertex(x1 + nx, y1 + ny, r, g, b, a1);
      this.vertex(x1 + nx, y1 + ny, r, g, b, a1);
      this.vertex(x0 - nx, y0 - ny, r, g, b, a0);
      this.vertex(x1 - nx, y1 - ny, r, g, b, a1);
    }
  }

  /** Axis-aligned line segment. @param {number} x0 @param {number} y0 @param {number} x1 @param {number} y1 @param {number} width @param {number[]} rgb @param {number} alpha */
  line(x0, y0, x1, y1, width, rgb, alpha) {
    this.polyline([x0, x1], [y0, y1], { width, rgb, alpha });
  }

  end() {
    this.geometry.setDrawRange(0, this.vertexCount);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aColor.needsUpdate = true;
    this.mesh.visible = this.vertexCount > 0;
  }
}
