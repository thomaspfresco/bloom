// @ts-check

import { SAVE_DEBOUNCE_MS, SESSION_VERSION, STORAGE_KEY } from '../core/constants.js';
import { Session } from '../model/Session.js';
import { convertLegacySession, isLegacySession } from './legacy.js';

/**
 * @typedef {'loaded' | 'empty' | 'corrupt' | 'newer' | 'unavailable'} LoadStatus
 * @typedef {{status: LoadStatus, message: string}} LoadResult
 */

/** The subset of the Storage API we use (lets tests inject a fake). */
/** @typedef {Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>} StorageLike */

/** @returns {StorageLike | null} localStorage, or null when blocked (private mode, disabled cookies) */
export function browserStorage() {
  try {
    const s = globalThis.localStorage;
    const probe = '__bloom_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/**
 * Keeps a Session in localStorage.
 *
 * On load the stored payload is validated ("site check on load"): corrupt data
 * is moved to a `.corrupt` backup key and the app starts empty; data from a
 * newer app version is left untouched and never overwritten. There is no
 * expiry: sessions stay until the user clears them.
 */
export class SessionStorage {
  /**
   * @param {Session} session
   * @param {{storage?: StorageLike | null, key?: string, debounceMs?: number}} [opts]
   */
  constructor(session, { storage = browserStorage(), key = STORAGE_KEY, debounceMs = SAVE_DEBOUNCE_MS } = {}) {
    this.session = session;
    this.storage = storage;
    this.key = key;
    this.debounceMs = debounceMs;
    /** @type {ReturnType<typeof setTimeout> | null} */
    this.timer = null;
    /** Set when stored data came from a newer version: saving would destroy it. */
    this.readOnly = false;
    this.lastSerialized = '';
    /** @type {null | (() => void)} */
    this.unsubscribe = null;
    /** Called after an autosave wrote something. @type {null | (() => void)} */
    this.onSaved = null;
  }

  /** Read storage into `this.session`. @returns {LoadResult} */
  load() {
    if (!this.storage) return { status: 'unavailable', message: 'Browser storage is unavailable; the session will not be saved.' };

    let raw;
    try {
      raw = this.storage.getItem(this.key);
    } catch {
      return { status: 'unavailable', message: 'Browser storage is unavailable; the session will not be saved.' };
    }
    if (raw === null) return { status: 'empty', message: '' };

    try {
      const data = JSON.parse(raw);
      if (typeof data?.version === 'number' && data.version > SESSION_VERSION) {
        this.readOnly = true;
        return { status: 'newer', message: 'Saved session was made by a newer version of BLOOM. It was left untouched and autosave is off.' };
      }
      const normalized = isLegacySession(data) ? convertLegacySession(data) : data;
      this.session.replaceWith(Session.fromJSON(normalized));
      this.lastSerialized = JSON.stringify({ ...this.session.toJSON(), savedAt: '' });
      return { status: 'loaded', message: 'Session restored.' };
    } catch {
      this.#backupCorrupt(raw);
      return { status: 'corrupt', message: 'The saved session could not be read. A backup was kept and a new session started.' };
    }
  }

  /** @param {string} raw */
  #backupCorrupt(raw) {
    try {
      this.storage?.setItem(`${this.key}.corrupt`, raw);
      this.storage?.removeItem(this.key);
    } catch { /* storage full: nothing more we can do */ }
  }

  /** Write immediately. @returns {boolean} whether anything was written */
  saveNow() {
    if (!this.storage || this.readOnly) return false;
    const data = this.session.toJSON();
    // savedAt changes every call; compare the rest so idle sessions do not rewrite.
    const stable = JSON.stringify({ ...data, savedAt: '' });
    if (stable === this.lastSerialized) return false;
    try {
      this.storage.setItem(this.key, JSON.stringify(data));
      this.lastSerialized = stable;
      return true;
    } catch {
      return false; // quota exceeded / blocked
    }
  }

  /**
   * Replace whatever is stored with `session`, even data from a newer version
   * (used by an explicit import, where the user asked for exactly this).
   * @param {Session} session @returns {boolean}
   */
  overwrite(session) {
    if (!this.storage) return false;
    try {
      const data = session.toJSON();
      this.storage.setItem(this.key, JSON.stringify(data));
      this.lastSerialized = JSON.stringify({ ...data, savedAt: '' });
      this.readOnly = false;
      return true;
    } catch {
      return false;
    }
  }

  /** Save after `debounceMs` of quiet. */
  scheduleSave() {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.timer = null; if (this.saveNow()) this.onSaved?.(); }, this.debounceMs);
  }

  /** Autosave on every session change and when the page is hidden/closed. */
  startAutosave() {
    this.unsubscribe?.();
    this.unsubscribe = this.session.on('change', () => this.scheduleSave());
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') this.flush();
      });
      globalThis.addEventListener?.('pagehide', () => this.flush());
    }
  }

  /** Save now if a save is pending. */
  flush() {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.saveNow();
  }

  /** Forget the stored session (does not touch the in-memory one). */
  clearStored() {
    try { this.storage?.removeItem(this.key); } catch { /* ignore */ }
    this.lastSerialized = '';
    this.readOnly = false;
  }
}
