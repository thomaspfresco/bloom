// @ts-check
import { BufferGeometry, Box3 } from 'three/webgpu';
import { OBJLoader } from 'three/addons/OBJLoader.js';

/**
 * The petal mesh (one shape, tinted per track kind). `size` is the model's
 * x-extent: every scale in the original sketch is "target / petalModelSize".
 *
 * @param {string} [url]
 * @returns {Promise<{geometry: BufferGeometry, size: number}>}
 */
export async function loadPetal(url = '/meshes/petal.obj') {
  const text = await (await fetch(url)).text();
  const group = new OBJLoader().parse(text);
  /** @type {BufferGeometry | null} */
  let geometry = null;
  group.traverse((obj) => {
    const mesh = /** @type {import('three/webgpu').Mesh} */ (obj);
    if (!geometry && mesh.isMesh) geometry = mesh.geometry;
  });
  if (!geometry) throw new Error('petal.obj contains no mesh');

  // Only positions are used (flat, unlit colour); drop the rest to keep buffers small.
  const g = /** @type {BufferGeometry} */ (geometry);
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  g.computeBoundingBox();
  const box = /** @type {Box3} */ (g.boundingBox);
  return { geometry: g, size: box.max.x - box.min.x };
}
