// @ts-check
import { Color, DoubleSide, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, Scene } from 'three/webgpu';
import { uniform, vec4 } from 'three/tsl';
import { Batches } from '../batches/Batches.js';
import { createRenderer } from './renderer.js';
import { loadPetal } from './petalAsset.js';

/**
 * Per-frame information handed to every layer.
 * @typedef {object} Frame
 * @property {number} t        ms since start
 * @property {number} dt       ms since the previous frame
 * @property {number} k        dt in 60 fps frames (1 at 60 Hz); scale per-frame increments by it
 * @property {number} width    CSS px
 * @property {number} height   CSS px
 * @property {Batches} batches   base layer primitives
 * @property {Batches} overlay   primitives drawn above the dimming quad (drawers, dragged items)
 * @property {{value: number}} dim  0-1 opacity of a black quad between `batches` and `overlay`
 * @property {number} petalSize x-extent of the petal mesh (divide target sizes by it)
 */

/**
 * @typedef {object} Layer
 * @property {(frame: Frame) => void} update   push this frame's primitives into frame.batches
 * @property {() => void} [dispose]
 */

/**
 * The one WebGPU canvas behind the page. Coordinates are CSS pixels with the
 * origin at the top-left and y pointing down (as in the original p5 sketch),
 * so DOM rectangles can be used directly as positions.
 */
export class BloomScene {
  /**
   * @private use `BloomScene.create`
   * @param {HTMLCanvasElement} canvas @param {import('three/webgpu').WebGPURenderer} renderer @param {'webgpu' | 'webgl'} backend
   * @param {Batches} batches @param {number} petalSize @param {import('three/webgpu').BufferGeometry} petalGeometry
   */
  constructor(canvas, renderer, backend, batches, petalSize, petalGeometry) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.backend = backend;
    this.batches = batches;
    this.petalSize = petalSize;

    this.scene = new Scene();
    this.scene.background = new Color(0x000000);
    // the drawer can show 50 loops x 4 tracks of small circles, hence the larger buffers
    this.overlay = new Batches(petalGeometry, { orderBase: 6, capacity: 4 });
    for (const o of batches.objects()) this.scene.add(o);
    for (const o of this.overlay.objects()) this.scene.add(o);

    // full-screen black quad between the two batch sets; layers raise `frame.dim.value` to darken what is behind
    this.dim = uniform(0);
    const dimMaterial = new MeshBasicNodeMaterial({ transparent: true, depthTest: false, depthWrite: false, side: DoubleSide });
    dimMaterial.colorNode = vec4(0, 0, 0, this.dim);
    this.dimMesh = new Mesh(new PlaneGeometry(1, 1), dimMaterial);
    this.dimMesh.renderOrder = 5;
    this.dimMesh.frustumCulled = false;
    this.scene.add(this.dimMesh);

    this.width = 1;
    this.height = 1;
    this.camera = new OrthographicCamera(0, 1, 0, 1, -1000, 1000);

    /** @type {Layer[]} */
    this.layers = [];
    this.last = 0;
    this.start = 0;
    this.running = false;
    this.onResize = () => this.resize();
    window.addEventListener('resize', this.onResize);
    this.resize();
  }

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{forceWebGL?: boolean}} [opts]
   */
  static async create(canvas, opts) {
    const [{ renderer, backend }, { geometry, size }] = await Promise.all([createRenderer(canvas, opts), loadPetal()]);
    return new BloomScene(canvas, renderer, backend, new Batches(geometry), size, geometry);
  }

  /** @param {Layer} layer */
  add(layer) { this.layers.push(layer); return layer; }

  /** @param {Layer} layer */
  remove(layer) {
    const i = this.layers.indexOf(layer);
    if (i >= 0) this.layers.splice(i, 1);
    layer.dispose?.();
  }

  /** Match the canvas to the window (called on resize). */
  resize() {
    this.width = Math.max(1, window.innerWidth);
    this.height = Math.max(1, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(this.width, this.height, false);
    // top < bottom flips the projection so +y points down the screen
    this.camera.left = 0;
    this.camera.right = this.width;
    this.camera.top = 0;
    this.camera.bottom = this.height;
    this.camera.updateProjectionMatrix();
    this.dimMesh.scale.set(this.width, this.height, 1);
    this.dimMesh.position.set(this.width / 2, this.height / 2, 0);
  }

  /** Begin rendering every animation frame. */
  run() {
    if (this.running) return;
    this.running = true;
    this.start = this.last = performance.now();
    this.renderer.setAnimationLoop((/** @type {number} */ now) => this.#frame(now));
  }

  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }

  /** @param {number} now */
  #frame(now) {
    const dt = Math.min(100, now - this.last); // clamp after tab switches
    this.last = now;
    /** @type {Frame} */
    const frame = {
      t: now - this.start, dt, k: dt / (1000 / 60),
      width: this.width, height: this.height,
      batches: this.batches, overlay: this.overlay, dim: this.dim, petalSize: this.petalSize,
    };

    this.dim.value = 0;
    this.batches.begin();
    this.overlay.begin();
    for (const layer of this.layers) layer.update(frame);
    this.batches.end();
    this.overlay.end();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
    for (const l of this.layers) l.dispose?.();
    this.layers.length = 0;
    this.renderer.dispose();
  }
}
