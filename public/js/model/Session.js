// @ts-check

import { MAX_LOOPS, MAX_STRUCTS, MAX_TABS, SESSION_VERSION } from '../core/constants.js';
import { Emitter } from '../core/events.js';
import { newId } from '../core/ids.js';
import { Loop } from './Loop.js';
import { Structure } from './Structure.js';
import { uniqueName } from './naming.js';

/**
 * @typedef {{type: 'loop' | 'struct', id: string}} TabRef
 */

/**
 * @typedef {object} SessionData
 * @property {number} version
 * @property {string} savedAt        ISO timestamp
 * @property {import('./Loop.js').LoopData[]} loops
 * @property {import('./Structure.js').StructureData[]} structs
 * @property {TabRef[]} tabs         open tabs, oldest first
 * @property {TabRef | null} active
 */

/**
 * @typedef {'all' | 'loops' | 'structs' | 'tabs' | 'loop' | 'struct'} ChangeScope
 * @typedef {{scope: ChangeScope, id?: string}} ChangeEvent
 */

/**
 * Everything the user has made: loops, structures and which tabs are open.
 * This is the single source of truth that gets persisted. Playback position,
 * hover/drag state and the like are UI state and live elsewhere.
 *
 * Mutations go through methods here (or call `touch()` after editing a loop /
 * structure in place) so listeners get a `change` event and autosave runs.
 *
 * @extends {Emitter<{change: ChangeEvent}>}
 */
export class Session extends Emitter {
  constructor() {
    super();
    /** @type {Loop[]} */
    this.loops = [];
    /** @type {Structure[]} */
    this.structs = [];
    /** @type {TabRef[]} */
    this.tabs = [];
    /** @type {TabRef | null} */
    this.active = null;
  }

  // ---- lookup -------------------------------------------------------------

  /** @param {string} id */
  loop(id) { return this.loops.find((l) => l.id === id) ?? null; }

  /** @param {string} id */
  struct(id) { return this.structs.find((s) => s.id === id) ?? null; }

  /** @param {TabRef | null} ref @returns {Loop | Structure | null} */
  resolve(ref) {
    if (!ref) return null;
    return ref.type === 'loop' ? this.loop(ref.id) : this.struct(ref.id);
  }

  get activeItem() { return this.resolve(this.active); }

  /** @param {string} q */
  searchLoops(q) {
    const s = q.trim().toLowerCase();
    if (!s) return this.loops;
    return this.loops.filter((l) => l.name.toLowerCase().includes(s) || String(l.tempo).includes(s));
  }

  /** @param {string} q */
  searchStructs(q) {
    const s = q.trim().toLowerCase();
    if (!s) return this.structs;
    return this.structs.filter((x) => x.name.toLowerCase().includes(s) || String(x.tempo).includes(s));
  }

  // ---- change notification ------------------------------------------------

  /** Call after mutating a loop / structure in place. @param {ChangeScope} scope @param {string} [id] */
  touch(scope, id) {
    this.emit('change', { scope, id });
  }

  // ---- loops --------------------------------------------------------------

  /** @returns {Loop | null} null when MAX_LOOPS is reached */
  createLoop() {
    if (this.loops.length >= MAX_LOOPS) return null;
    const name = uniqueName(`myLoop${this.loops.length + 1}`, this.loops.map((l) => l.name));
    const loop = new Loop({ name });
    this.loops.push(loop);
    this.openTab({ type: 'loop', id: loop.id });
    this.touch('loops');
    return loop;
  }

  /** @param {string} id @returns {Loop | null} */
  duplicateLoop(id) {
    const src = this.loop(id);
    if (!src || this.loops.length >= MAX_LOOPS) return null;
    const copy = src.clone({ name: uniqueName(src.name, this.loops.map((l) => l.name)) });
    this.loops.push(copy);
    this.openTab({ type: 'loop', id: copy.id });
    this.touch('loops');
    return copy;
  }

  /** Deleting a loop also drops every structure section that used it. @param {string} id */
  deleteLoop(id) {
    const i = this.loops.findIndex((l) => l.id === id);
    if (i < 0) return false;
    this.loops.splice(i, 1);
    for (const s of this.structs) s.removeLoopReferences(id);
    this.tabs = this.tabs.filter((t) => !(t.type === 'loop' && t.id === id));
    if (this.active?.type === 'loop' && this.active.id === id) this.active = null;
    this.touch('all');
    return true;
  }

  // ---- structures ---------------------------------------------------------

  /** @returns {Structure | null} */
  createStruct() {
    if (this.structs.length >= MAX_STRUCTS) return null;
    const name = uniqueName(`myStruct${this.structs.length + 1}`, this.structs.map((s) => s.name));
    const struct = new Structure({ name });
    this.structs.push(struct);
    this.openTab({ type: 'struct', id: struct.id });
    this.touch('structs');
    return struct;
  }

  /** New structure containing one section for `loopId`. @param {string} loopId */
  structFromLoop(loopId) {
    const loop = this.loop(loopId);
    if (!loop || this.structs.length >= MAX_STRUCTS) return null;
    const name = uniqueName(`myStruct${this.structs.length + 1}`, this.structs.map((s) => s.name));
    const struct = new Structure({ name });
    struct.insertLoop(loop.id);
    struct.setTempo(loop.tempo);
    this.structs.push(struct);
    this.openTab({ type: 'struct', id: struct.id });
    this.touch('structs');
    return struct;
  }

  /** @param {string} id @returns {Structure | null} */
  duplicateStruct(id) {
    const src = this.struct(id);
    if (!src || this.structs.length >= MAX_STRUCTS) return null;
    const copy = Structure.fromJSON({ ...src.toJSON(), id: undefined, name: uniqueName(src.name, this.structs.map((s) => s.name)) });
    if (!copy) return null;
    for (const section of copy.sections) section.id = newId('s');
    this.structs.push(copy);
    this.openTab({ type: 'struct', id: copy.id });
    this.touch('structs');
    return copy;
  }

  /** @param {string} id */
  deleteStruct(id) {
    const i = this.structs.findIndex((s) => s.id === id);
    if (i < 0) return false;
    this.structs.splice(i, 1);
    this.tabs = this.tabs.filter((t) => !(t.type === 'struct' && t.id === id));
    if (this.active?.type === 'struct' && this.active.id === id) this.active = null;
    this.touch('all');
    return true;
  }

  // ---- tabs ---------------------------------------------------------------

  /** Open (or focus) a tab; the oldest tab is dropped when MAX_TABS is exceeded. @param {TabRef} ref */
  openTab(ref) {
    const known = this.tabs.some((t) => t.type === ref.type && t.id === ref.id);
    if (!known) {
      if (this.tabs.length >= MAX_TABS) this.tabs.shift();
      this.tabs.push({ type: ref.type, id: ref.id });
    }
    this.active = { type: ref.type, id: ref.id };
    this.touch('tabs');
  }

  /** @param {TabRef} ref */
  closeTab(ref) {
    this.tabs = this.tabs.filter((t) => !(t.type === ref.type && t.id === ref.id));
    if (this.active?.type === ref.type && this.active.id === ref.id) this.active = null;
    this.touch('tabs');
  }

  /** Show a tab already open, or the home screen for `null`. @param {TabRef | null} ref */
  activate(ref) {
    this.active = ref ? { type: ref.type, id: ref.id } : null;
    this.touch('tabs');
  }

  // ---- lifecycle ----------------------------------------------------------

  /** Replace this session's content (used by import / load) without losing listeners. @param {Session} other */
  replaceWith(other) {
    this.loops = other.loops;
    this.structs = other.structs;
    this.tabs = other.tabs;
    this.active = other.active;
    this.touch('all');
  }

  clear() {
    this.replaceWith(new Session());
  }

  /** @returns {SessionData} */
  toJSON() {
    return {
      version: SESSION_VERSION,
      savedAt: new Date().toISOString(),
      loops: this.loops.map((l) => l.toJSON()),
      structs: this.structs.map((s) => s.toJSON()),
      tabs: this.tabs.map((t) => ({ ...t })),
      active: this.active ? { ...this.active } : null,
    };
  }

  /**
   * Rebuild from untrusted data. Dangling references (tabs or sections whose
   * loop is gone) are dropped instead of failing the whole load.
   * @param {any} data @returns {Session}
   */
  static fromJSON(data) {
    const session = new Session();
    if (!data || typeof data !== 'object') return session;

    if (Array.isArray(data.loops)) {
      for (const d of data.loops) {
        const l = Loop.fromJSON(d);
        if (l && session.loops.length < MAX_LOOPS && !session.loop(l.id)) session.loops.push(l);
      }
    }
    if (Array.isArray(data.structs)) {
      for (const d of data.structs) {
        const s = Structure.fromJSON(d);
        if (s && session.structs.length < MAX_STRUCTS && !session.struct(s.id)) {
          s.sections = s.sections.filter((sec) => session.loop(sec.loopId));
          session.structs.push(s);
        }
      }
    }
    /** @param {any} t @returns {t is TabRef} */
    const validRef = (t) => !!t && (t.type === 'loop' || t.type === 'struct') && typeof t.id === 'string' && session.resolve(t) !== null;
    if (Array.isArray(data.tabs)) {
      session.tabs = data.tabs.filter(validRef).slice(-MAX_TABS).map((/** @type {TabRef} */ t) => ({ type: t.type, id: t.id }));
    }
    if (validRef(data.active) && session.tabs.some((/** @type {TabRef} */ t) => t.type === data.active.type && t.id === data.active.id)) {
      session.active = { type: data.active.type, id: data.active.id };
    }
    return session;
  }
}
