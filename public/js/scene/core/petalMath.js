// @ts-check
import { Matrix4 } from 'three/webgpu';

const _t = new Matrix4();
const _a = new Matrix4();
const _b = new Matrix4();

/**
 * Build a petal's model matrix the way the p5 sketch did:
 *   translate(x, y, z) · scale(s) · rotateX(rx) · rotateY(ry) · rotateZ(rz)
 * (p5 multiplies transformations on the right, so rotations apply to the model first.)
 *
 * @param {Matrix4} out
 * @param {{x: number, y: number, z?: number, scale: number, rx?: number, ry?: number, rz?: number}} p
 */
export function petalMatrix(out, { x, y, z = 0, scale, rx = 0, ry = 0, rz = 0 }) {
  out.makeTranslation(x, y, z);
  out.multiply(_t.makeScale(scale, scale, scale));
  if (rx) out.multiply(_a.makeRotationX(rx));
  if (ry) out.multiply(_b.makeRotationY(ry));
  if (rz) out.multiply(_a.makeRotationZ(rz));
  return out;
}
