// @ts-check
// /upload: import a session JSON file into this browser's storage.

import { Session } from '../model/Session.js';
import { readSessionFile, SessionFileError } from '../persistence/SessionFile.js';
import { SessionStorage } from '../persistence/SessionStorage.js';

const input = /** @type {HTMLInputElement} */ (document.getElementById('session-file'));
const status = /** @type {HTMLElement} */ (document.getElementById('import-status'));

/** @param {string} text @param {boolean} [error] */
function say(text, error = false) {
  status.textContent = text;
  status.classList.toggle('error', error);
}

input.addEventListener('change', async () => {
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const imported = await readSessionFile(file);
    const storage = new SessionStorage(new Session());
    if (!storage.overwrite(imported)) {
      say('Could not save to this browser (storage is blocked or full).', true);
      return;
    }
    const loops = imported.loops.length;
    const structs = imported.structs.length;
    status.replaceChildren(
      `Imported ${loops} loop${loops === 1 ? '' : 's'} and ${structs} structure${structs === 1 ? '' : 's'}. `,
      Object.assign(document.createElement('a'), { href: '/', textContent: 'Open BLOOM' }),
      '.',
    );
    status.classList.remove('error');
  } catch (err) {
    say(err instanceof SessionFileError ? err.message : 'Could not read that file.', true);
  }
});
