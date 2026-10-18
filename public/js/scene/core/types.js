// @ts-check

/**
 * What scene layers may read from the application. Deliberately a structural
 * subset of the UI context so `scene/` does not import from `ui/`.
 *
 * @typedef {object} SceneContext
 * @property {import('../../model/Session.js').Session} session
 * @property {{s: SceneUiState}} ui
 * @property {import('./anchors.js').Anchors} anchors
 * @property {import('./handoff.js').Handoff} handoff
 */

/**
 * @typedef {object} SceneUiState
 * @property {null | 'loops' | 'structs'} drawer
 * @property {string | null} selectedTrackId
 * @property {0 | 1 | 2} view
 * @property {number} paramIndex
 * @property {boolean} playing
 * @property {number} step
 * @property {number} sectionIndex
 * @property {number} repeat
 * @property {string | null} hoverId
 * @property {string | null} previewId
 * @property {number} dimReset  bumped when the drawer's dark layer must vanish at once
 * @property {string | null} dragId
 * @property {ReadonlySet<string>} selectedNotes
 * @property {string | null} hoverNoteId
 * @property {{trackId: string, note: import('../../model/Note.js').Note} | null} draft
 */

export {};
