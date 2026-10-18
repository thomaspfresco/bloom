// @ts-check
import { LinearSRGBColorSpace, WebGPURenderer } from 'three/webgpu';

/**
 * WebGPU renderer on the page's full-viewport canvas. three.js falls back to
 * its WebGL2 backend automatically when WebGPU is unavailable; `forceWebGL`
 * (URL `?gl=1`) forces that path for debugging.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {{forceWebGL?: boolean}} [opts]
 * @returns {Promise<{renderer: WebGPURenderer, backend: 'webgpu' | 'webgl'}>}
 */
export async function createRenderer(canvas, { forceWebGL = false } = {}) {
  const renderer = new WebGPURenderer({ canvas, antialias: true, alpha: false, forceWebGL });
  // All colours and alphas are authored in display space, exactly like p5 (and blended there).
  // Leaving the default sRGB output would brighten every colour and fade.
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 1);
  await renderer.init();
  const isWebGPU = /** @type {any} */ (renderer.backend)?.isWebGPUBackend === true;
  return { renderer, backend: isWebGPU ? 'webgpu' : 'webgl' };
}
