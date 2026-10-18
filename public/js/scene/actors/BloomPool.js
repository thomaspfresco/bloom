// @ts-check
import { TrackBloom } from './TrackBloom.js';

/** Keeps one `TrackBloom` per key so shapes stay continuous between frames; drops idle ones. */
export class BloomPool {
  /** @param {{maxIdleMs?: number}} [opts] */
  constructor({ maxIdleMs = 4000 } = {}) {
    this.maxIdleMs = maxIdleMs;
    /** @type {Map<string, TrackBloom>} */
    this.map = new Map();
  }

  /** @param {string} key @param {number} now ms @param {{x: number, y: number}} origin where a new bloom starts */
  get(key, now, origin) {
    let b = this.map.get(key);
    if (!b) { b = new TrackBloom(origin); this.map.set(key, b); }
    b.lastUsed = now;
    return b;
  }

  /** Forget blooms not used for a while. @param {number} now */
  sweep(now) {
    for (const [key, b] of this.map) if (now - b.lastUsed > this.maxIdleMs) this.map.delete(key);
  }

  clear() { this.map.clear(); }
}
