// @ts-check
// The object every component receives. Built once in App.

/**
 * @typedef {object} UiContext
 * @property {import('../model/Session.js').Session} session
 * @property {import('./state/UiState.js').UiState} ui
 * @property {import('../audio/AudioEngine.js').AudioEngine} engine
 * @property {import('../ai/Generator.js').Generator} generator
 * @property {import('./Actions.js').Actions} actions
 * @property {import('../scene/core/anchors.js').Anchors} anchors
 * @property {import('../scene/core/handoff.js').Handoff} handoff
 * @property {import('./components/Toast.js').Toast} toast
 * @property {import('./components/MenuHost.js').MenuHost} menus
 * @property {import('./controllers/NoteEditing.js').NoteEditing} notes
 * @property {import('./controllers/GenerateController.js').GenerateController} generate
 * @property {import('./controllers/PlayInput.js').PlayInput} playInput
 * @property {import('./controllers/DragController.js').DragController} drag
 * @property {import('./controllers/RecordController.js').RecordController} record
 * @property {import('./controllers/Fades.js').Fades} fades
 */

export {};
