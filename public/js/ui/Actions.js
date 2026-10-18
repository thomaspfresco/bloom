// @ts-check
// User-level operations that combine session changes with audio / UI-state
// side effects. Components call these instead of juggling the engine themselves.

import { MAX_LOOPS, MAX_STRUCTS } from '../core/constants.js';
import { downloadSession, readSessionFile, SessionFileError } from '../persistence/SessionFile.js';
import { downloadBlob } from '../audio/exportAudio.js';

/** @typedef {import('../model/Session.js').TabRef} TabRef */
/** @typedef {import('../model/Track.js').Track} Track */

export class Actions {
  /**
   * @param {object} deps
   * @param {import('../model/Session.js').Session} deps.session
   * @param {import('./state/UiState.js').UiState} deps.ui
   * @param {import('../audio/AudioEngine.js').AudioEngine} deps.engine
   * @param {import('./components/Toast.js').Toast} deps.toast
   * @param {import('../persistence/SessionStorage.js').SessionStorage} deps.storage
   * @param {import('./controllers/Fades.js').Fades} deps.fades
   */
  constructor({ session, ui, engine, toast, storage, fades }) {
    this.fades = fades;
    this.session = session;
    this.ui = ui;
    this.engine = engine;
    this.toast = toast;
    this.storage = storage;
  }

  // ---- audio gate ---------------------------------------------------------

  /** Browsers need a gesture before audio can start. Safe to call repeatedly. */
  unlockAudio() {
    return this.engine.unlock().catch(() => {});
  }

  // ---- playback -----------------------------------------------------------

  /** Stop whatever is playing and release held notes. */
  stopPlayback() {
    this.engine.stop();
    this.engine.releaseAll();
    this.ui.set({ playing: false, step: -1, sectionIndex: 0, repeat: 0 });
  }

  /** Space bar: play or stop the active tab. */
  togglePlay() {
    const item = this.session.activeItem;
    if (!item) return;
    if (this.engine.playing) { this.stopPlayback(); return; }
    this.playActive();
  }

  playActive() {
    const item = this.session.activeItem;
    if (!item) return;
    if (this.session.active?.type === 'loop') {
      this.engine.playLoop(/** @type {import('../model/Loop.js').Loop} */ (item));
    } else {
      const struct = /** @type {import('../model/Structure.js').Structure} */ (item);
      if (struct.isEmpty) return;
      this.engine.playStruct(struct, (id) => this.session.loop(id));
    }
  }

  /** Jump the playhead on the time bar. @param {number} step */
  seek(step) {
    const item = this.session.activeItem;
    if (!item || this.session.active?.type !== 'loop') return;
    if (!this.engine.playing) {
      this.engine.playLoop(/** @type {import('../model/Loop.js').Loop} */ (item), { fromStep: step });
    } else {
      this.engine.seek(step);
    }
  }

  /** Hover preview in a drawer (no metronome). @param {string} loopId */
  previewLoop(loopId) {
    const loop = this.session.loop(loopId);
    if (loop && !loop.isEmpty) this.engine.playLoop(loop, { click: false });
  }

  /** @param {string} structId */
  previewStruct(structId) {
    const struct = this.session.struct(structId);
    if (struct && !struct.isEmpty) this.engine.playStruct(struct, (id) => this.session.loop(id));
  }

  // ---- tabs & navigation --------------------------------------------------

  /**
   * Open (or switch to) a tab. `fade`: the new content fades in from black, as when
   * clicking a tab; opening from a drawer does not (the drawer's scrim vanishes at once).
   * @param {TabRef} ref @param {{fade?: boolean, fromDrawer?: boolean}} [opts]
   */
  openTab(ref, { fade = false, fromDrawer = false } = {}) {
    this.stopPlayback();
    this.session.openTab(ref);
    this.ui.resetEditor();
    this.ui.set({ drawer: null, ...(fromDrawer ? { dimReset: this.ui.s.dimReset + 1 } : {}) });
    if (fade) this.fades.play('screen');
  }

  goHome() {
    this.stopPlayback();
    this.session.activate(null);
    this.ui.resetEditor();
    this.fades.play('screen');
  }

  /** @param {TabRef} ref */
  closeTab(ref) {
    this.stopPlayback();
    this.session.closeTab(ref);
    this.ui.resetEditor();
  }

  // ---- creation / deletion ------------------------------------------------

  createLoop() {
    this.stopPlayback();
    const loop = this.session.createLoop();
    if (!loop) { this.toast.show(`A session holds at most ${MAX_LOOPS} loops.`); return null; }
    this.ui.resetEditor();
    this.ui.set({ drawer: null });
    this.fades.play('screen');
    return loop;
  }

  createStruct() {
    this.stopPlayback();
    const s = this.session.createStruct();
    if (!s) { this.toast.show(`A session holds at most ${MAX_STRUCTS} structures.`); return null; }
    this.ui.resetEditor();
    this.ui.set({ drawer: null });
    this.fades.play('screen');
    return s;
  }

  /** @param {string} id */
  duplicateLoop(id) {
    this.stopPlayback();
    if (!this.session.duplicateLoop(id)) this.toast.show(`A session holds at most ${MAX_LOOPS} loops.`);
    this.ui.resetEditor();
  }

  /** @param {string} id */
  duplicateStruct(id) {
    this.stopPlayback();
    if (!this.session.duplicateStruct(id)) this.toast.show(`A session holds at most ${MAX_STRUCTS} structures.`);
    this.ui.resetEditor();
  }

  /** @param {string} loopId */
  structFromLoop(loopId) {
    this.stopPlayback();
    if (!this.session.structFromLoop(loopId)) this.toast.show(`A session holds at most ${MAX_STRUCTS} structures.`);
    this.ui.resetEditor();
  }

  /** @param {string} id */
  deleteLoop(id) {
    this.stopPlayback();
    this.session.deleteLoop(id);
    this.ui.resetEditor();
    this.fades.play('screen');
  }

  /** @param {string} id */
  deleteStruct(id) {
    this.stopPlayback();
    this.session.deleteStruct(id);
    this.ui.resetEditor();
    this.fades.play('screen');
  }

  // ---- loop editing -------------------------------------------------------

  /** @param {string | null} trackId @param {0 | 1 | 2} [view] */
  selectTrack(trackId, view = 0) {
    if (trackId !== null) {
      if (this.ui.s.selectedTrackId === null) this.fades.trackSelected(true);
      else if (this.ui.s.selectedTrackId !== trackId || this.ui.s.view !== view) this.fades.viewChanged();
    }
    this.ui.set({ selectedTrackId: trackId, view: trackId ? view : 0, selectedNotes: new Set(), hoverNoteId: null, draft: null, paramIndex: 0 });
  }

  /** @param {0 | 1 | 2} view */
  setView(view) {
    if (view !== this.ui.s.view) this.fades.viewChanged();
    this.ui.set({ view, selectedNotes: new Set(), hoverNoteId: null, draft: null });
  }

  /** @param {import('../model/Loop.js').Loop} loop @param {Track} track */
  toggleMute(loop, track) {
    track.muted = !track.muted;
    if (track.muted) this.engine.releaseAll();
    this.session.touch('loop', loop.id);
  }

  /** @param {import('../model/Loop.js').Loop} loop @param {string} trackId */
  removeTrack(loop, trackId) {
    this.stopPlayback();
    loop.removeTrack(trackId);
    this.ui.set({ selectedTrackId: null, view: 0 });
    this.session.touch('loop', loop.id);
  }

  /** @param {import('../model/Loop.js').Loop} loop @param {import('../music/trackKinds.js').TrackKind} kind */
  addEmptyTrack(loop, kind) {
    if (!loop.canAddTrack(kind)) return null;
    const track = loop.addTrack(kind);
    this.session.touch('loop', loop.id);
    return track;
  }

  // ---- export -------------------------------------------------------------

  /** Download one track as a Standard MIDI File (rendered by Flask). @param {import('../model/Loop.js').Loop} loop @param {Track} track */
  async exportMidi(loop, track) {
    this.ui.set({ busy: true });
    try {
      const res = await fetch('/api/midi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `${loop.name}-${track.kind}`, kind: track.kind, tempo: loop.tempo, notes: track.toNoteList() }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.error ?? `Export failed (${res.status})`);
      }
      downloadBlob(await res.blob(), `${loop.name}-${track.kind}.mid`);
    } catch (err) {
      this.toast.show(err instanceof Error ? err.message : 'Could not export MIDI.');
    } finally {
      this.ui.set({ busy: false });
    }
  }

  /** Render the active loop or structure to WAV. */
  async exportAudio() {
    const item = this.session.activeItem;
    if (!item) return;
    this.stopPlayback();
    this.ui.set({ busy: true });
    try {
      if (this.session.active?.type === 'loop') await this.engine.exportLoop(/** @type {import('../model/Loop.js').Loop} */ (item));
      else {
        const struct = /** @type {import('../model/Structure.js').Structure} */ (item);
        if (struct.isEmpty) { this.toast.show('Add a loop to the structure first.'); return; }
        await this.engine.exportStruct(struct, (id) => this.session.loop(id));
      }
    } catch (err) {
      console.error(err);
      this.toast.show('Could not render the audio.');
    } finally {
      this.ui.set({ busy: false });
    }
  }

  // ---- session ------------------------------------------------------------

  downloadSession() { downloadSession(this.session); }

  /** @param {File} file */
  async importSession(file) {
    try {
      const imported = await readSessionFile(file);
      this.stopPlayback();
      this.session.replaceWith(imported);
      this.ui.resetEditor();
      this.storage.saveNow();
      this.toast.show('Session imported.');
    } catch (err) {
      this.toast.show(err instanceof SessionFileError ? err.message : 'Could not import that file.');
    }
  }

  clearSession() {
    this.stopPlayback();
    this.session.clear();
    this.ui.resetEditor();
    this.storage.saveNow();
  }
}
