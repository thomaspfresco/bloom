// @ts-check

/**
 * Minimal typed event emitter.
 * @template {Record<string, any>} Events map of event name -> payload type
 */
export class Emitter {
  constructor() {
    /** @type {Map<keyof Events, Set<(payload: any) => void>>} */
    this.listeners = new Map();
    /** Type-level only: lets generic helpers infer `Events` from an emitter. Never read. @type {Events | undefined} */
    this.eventTypes = undefined;
  }

  /**
   * @template {keyof Events} K
   * @param {K} event @param {(payload: Events[K]) => void} fn
   * @returns {() => void} unsubscribe
   */
  on(event, fn) {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(fn);
    return () => this.off(event, fn);
  }

  /** @template {keyof Events} K @param {K} event @param {(payload: Events[K]) => void} fn */
  off(event, fn) {
    this.listeners.get(event)?.delete(fn);
  }

  /** @template {keyof Events} K @param {K} event @param {Events[K]} payload */
  emit(event, payload) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[bloom] listener for "${String(event)}" threw`, err);
      }
    }
  }

  /** Remove every listener (used on teardown). */
  clear() {
    this.listeners.clear();
  }
}
