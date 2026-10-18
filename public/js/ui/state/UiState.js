// @ts-check
import { Emitter } from '../../core/events.js';

/**
 * @typedef {object} UiFields
 * @property {null | 'loops' | 'structs'} drawer
 * @property {string} loopSearch
 * @property {string} structSearch
 * @property {string | null} selectedTrackId   track open in the editor (loop tabs)
 * @property {0 | 1 | 2} view                   0 grid, 1 studio, 2 automation
 * @property {number} paramIndex                parameter shown in the automation view
 * @property {number} keyboardOctave
 * @property {boolean} playing
 * @property {number} step                      current step (-1 before the first tick)
 * @property {number} sectionIndex              structure playback
 * @property {number} repeat
 * @property {string | null} hoverId            loop/struct under the pointer in a drawer
 * @property {string | null} previewId          drawer item whose preview is playing (set after a short hover delay)
 * @property {number} dimReset                  bumped to make the drawer's dark layer vanish at once (opening a tab from a drawer)
 * @property {string | null} dragId             loop/struct being dragged out of a drawer
 * @property {boolean} busy                     a long task is running (shows the loading screen)
 * @property {ReadonlySet<string>} selectedNotes ids of selected notes in the open track
 * @property {string | null} hoverNoteId
 * @property {{trackId: string, note: import('../../model/Note.js').Note} | null} draft  note being drawn (not yet in the track)
 */

/** @typedef {{keys: (keyof UiFields)[]}} UiChange */

/** @returns {UiFields} */
const initial = () => ({
  drawer: null,
  loopSearch: '',
  structSearch: '',
  selectedTrackId: null,
  view: 0,
  paramIndex: 0,
  keyboardOctave: 3,
  playing: false,
  step: -1,
  sectionIndex: 0,
  repeat: 0,
  hoverId: null,
  previewId: null,
  dimReset: 0,
  dragId: null,
  busy: false,
  selectedNotes: new Set(),
  hoverNoteId: null,
  draft: null,
});

/**
 * Transient UI state: nothing here is saved. Components subscribe to `change`
 * and re-render the bits they show.
 * @extends {Emitter<{change: UiChange}>}
 */
export class UiState extends Emitter {
  constructor() {
    super();
    /** @type {UiFields} */
    this.s = initial();
  }

  /** @param {Partial<UiFields>} patch */
  set(patch) {
    /** @type {(keyof UiFields)[]} */
    const keys = [];
    for (const k of /** @type {(keyof UiFields)[]} */ (Object.keys(patch))) {
      if (this.s[k] !== patch[k]) {
        /** @type {any} */ (this.s)[k] = patch[k];
        keys.push(k);
      }
    }
    if (keys.length) this.emit('change', { keys });
  }

  /** Reset editor state when the active tab changes. */
  resetEditor() {
    this.set({
      selectedTrackId: null, view: 0, paramIndex: 0, hoverId: null, previewId: null, dragId: null, step: -1, playing: false,
      sectionIndex: 0, repeat: 0, selectedNotes: new Set(), hoverNoteId: null, draft: null,
    });
  }
}
