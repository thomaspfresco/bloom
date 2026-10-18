// @ts-check

/**
 * Base class for UI pieces. A component owns one root element (built in its
 * constructor, so every field has a definite type), registers its listeners through `listen`/`on` so `destroy()` can remove them all, and
 * re-renders itself from state in `update()`.
 */
export class Component {
  /** @param {import('./context.js').UiContext} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {HTMLElement} */
    this.el = document.createElement('div');
    /** @type {(() => void)[]} */
    this.disposers = [];
    this.mounted = false;
  }

  /** Refresh DOM from state. Override. */
  update() {}

  /** Attach to the page and render. Subclasses build their DOM in their constructor. @param {HTMLElement} parent @returns {this} */
  mount(parent) {
    parent.appendChild(this.el);
    this.mounted = true;
    this.update();
    return this;
  }

  /**
   * Subscribe to an Emitter; unsubscribed on destroy.
   * @template {Record<string, any>} E
   * @template {keyof E} K
   * @param {import('../core/events.js').Emitter<E>} emitter @param {K} event @param {(p: E[K]) => void} fn
   */
  listen(emitter, event, fn) {
    this.disposers.push(emitter.on(event, fn));
  }

  /**
   * DOM listener removed on destroy.
   * @param {EventTarget} target @param {string} type @param {(e: any) => void} fn @param {AddEventListenerOptions | boolean} [opts]
   */
  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.disposers.push(() => target.removeEventListener(type, fn, opts));
  }

  /** @param {() => void} fn */
  onDestroy(fn) { this.disposers.push(fn); }

  destroy() {
    for (const d of this.disposers.splice(0)) d();
    this.el.remove();
    this.mounted = false;
  }
}
