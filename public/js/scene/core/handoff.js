// @ts-check
// Carries a loop's shape from one place on screen to another. When a loop is
// opened from a drawer, its ribbon starts out as the preview circle and its
// notes start where they were on that circle (the original copied
// particlesPreviewX/Y into particlesX/Y), so the circle visibly unfolds.

/** @typedef {import('../actors/TrackBloom.js').TrackBloom} TrackBloom */

export class Handoff {
  constructor() {
    /** @type {Map<string, {bloom: TrackBloom, at: number}>} */
    this.map = new Map();
  }

  /** Remember the latest bloom drawn for a track in the hover preview. @param {string} loopId @param {string} trackId @param {TrackBloom} bloom @param {number} now */
  offer(loopId, trackId, bloom, now) {
    this.map.set(`${loopId}:${trackId}`, { bloom, at: now });
  }

  /** The preview shape for a track, if one was shown in the last two seconds. @param {string} loopId @param {string} trackId @param {number} now */
  take(loopId, trackId, now) {
    const e = this.map.get(`${loopId}:${trackId}`);
    return e && now - e.at < 2000 ? e.bloom : null;
  }

  clear() { this.map.clear(); }
}
