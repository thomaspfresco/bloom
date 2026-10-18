// @ts-check
// DOM <-> scene bridge. UI components register elements under a name; scene
// layers read their current rectangles each frame, so petals and ribbons are
// drawn exactly where the HTML puts things (no duplicated layout maths).

/**
 * @typedef {object} Rect
 * @property {number} x @property {number} y @property {number} w @property {number} h
 * @property {number} cx @property {number} cy
 */

export class Anchors {
  constructor() {
    /** @type {Map<string, HTMLElement>} */
    this.map = new Map();
  }

  /**
   * @param {string} name unique key, e.g. "grid" or "trackIcon:abc"
   * @param {HTMLElement} el @returns {() => void} unregister
   */
  set(name, el) {
    this.map.set(name, el);
    return () => { if (this.map.get(name) === el) this.map.delete(name); };
  }

  /** @param {string} name @returns {Rect | null} viewport-relative rectangle, null when absent or hidden */
  rect(name) {
    const el = this.map.get(name);
    if (!el || !el.isConnected) return null;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return null;
    return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  /** @param {string} prefix @returns {string[]} names starting with prefix */
  names(prefix) {
    return [...this.map.keys()].filter((k) => k.startsWith(prefix));
  }
}
