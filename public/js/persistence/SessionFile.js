// @ts-check
// Session <-> .json file (download / import).

import { SESSION_VERSION } from '../core/constants.js';
import { Session } from '../model/Session.js';
import { convertLegacySession, isLegacySession } from './legacy.js';

export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;

export class SessionFileError extends Error {}

/** @param {Date} [now] */
export function sessionFilename(now = new Date()) {
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0');
  return `bloom-session-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}.json`;
}

/** @param {Session} session */
export function serializeSession(session) {
  return JSON.stringify({ app: 'bloom', ...session.toJSON() }, null, 2);
}

/**
 * Parse and validate file contents.
 * @param {string} text @returns {Session}
 */
export function parseSessionText(text) {
  if (text.length > MAX_IMPORT_BYTES) throw new SessionFileError('That file is too large to be a BLOOM session.');
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new SessionFileError('That file is not valid JSON.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new SessionFileError('That file does not look like a BLOOM session.');
  }
  if (typeof data.version === 'number' && data.version > SESSION_VERSION) {
    throw new SessionFileError('That session was made by a newer version of BLOOM.');
  }
  if (!isLegacySession(data) && !Array.isArray(data.loops)) {
    throw new SessionFileError('That file does not look like a BLOOM session.');
  }
  return Session.fromJSON(isLegacySession(data) ? convertLegacySession(data) : data);
}

/** @param {File} file @returns {Promise<Session>} */
export async function readSessionFile(file) {
  if (file.size > MAX_IMPORT_BYTES) throw new SessionFileError('That file is too large to be a BLOOM session.');
  return parseSessionText(await file.text());
}

/** Trigger a browser download of the session. @param {Session} session */
export function downloadSession(session) {
  const blob = new Blob([serializeSession(session)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sessionFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
