import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Session } from '../../public/js/model/Session.js';
import { Note } from '../../public/js/model/Note.js';
import { SessionStorage } from '../../public/js/persistence/SessionStorage.js';
import { parseSessionText, serializeSession, sessionFilename, SessionFileError } from '../../public/js/persistence/SessionFile.js';
import { convertLegacySession, isLegacySession } from '../../public/js/persistence/legacy.js';

class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
  setItem(k, v) { this.map.set(k, String(v)); }
  removeItem(k) { this.map.delete(k); }
}

const legacy = JSON.parse(readFileSync(new URL('../fixtures/legacy-session.json', import.meta.url), 'utf8'));

function sampleSession() {
  const s = new Session();
  const loop = s.createLoop();
  loop.addTrack('BASS').notes.push(new Note({ pitch: 0, octave: 2, start: 0, duration: 8 }));
  return s;
}

test('save then load restores the session', () => {
  const storage = new FakeStorage();
  const a = sampleSession();
  const sa = new SessionStorage(a, { storage });
  assert.equal(sa.saveNow(), true);
  assert.equal(sa.saveNow(), false, 'unchanged session is not rewritten');

  const b = new Session();
  const res = new SessionStorage(b, { storage }).load();
  assert.equal(res.status, 'loaded');
  assert.equal(b.loops[0].tracks[0].notes[0].duration, 8);
  assert.deepEqual(b.active, a.active);
});

test('empty storage', () => {
  assert.equal(new SessionStorage(new Session(), { storage: new FakeStorage() }).load().status, 'empty');
});

test('unavailable storage never throws', () => {
  const s = new SessionStorage(new Session(), { storage: null });
  assert.equal(s.load().status, 'unavailable');
  assert.equal(s.saveNow(), false);
});

test('corrupt data is backed up and the app starts clean', () => {
  const storage = new FakeStorage();
  storage.setItem('bloom.session', '{not json');
  const s = new SessionStorage(new Session(), { storage });
  assert.equal(s.load().status, 'corrupt');
  assert.equal(storage.getItem('bloom.session'), null);
  assert.equal(storage.getItem('bloom.session.corrupt'), '{not json');
});

test('data from a newer version is never overwritten', () => {
  const storage = new FakeStorage();
  const raw = JSON.stringify({ version: 999, loops: [] });
  storage.setItem('bloom.session', raw);
  const sess = new Session();
  const s = new SessionStorage(sess, { storage });
  assert.equal(s.load().status, 'newer');
  sess.createLoop();
  assert.equal(s.saveNow(), false);
  assert.equal(storage.getItem('bloom.session'), raw);
});

test('autosave debounces and flush writes immediately', async () => {
  const storage = new FakeStorage();
  const sess = new Session();
  const s = new SessionStorage(sess, { storage, debounceMs: 20 });
  s.startAutosave();
  sess.createLoop();
  sess.createLoop();
  assert.equal(storage.getItem('bloom.session'), null);
  await new Promise((r) => setTimeout(r, 60));
  assert.equal(JSON.parse(storage.getItem('bloom.session')).loops.length, 2);
  sess.createLoop();
  s.flush();
  assert.equal(JSON.parse(storage.getItem('bloom.session')).loops.length, 3);
});

test('file export/import round trip', () => {
  const a = sampleSession();
  const text = serializeSession(a);
  assert.equal(JSON.parse(text).app, 'bloom');
  const b = parseSessionText(text);
  assert.deepEqual(b.toJSON().loops, a.toJSON().loops);
  assert.match(sessionFilename(new Date(2026, 9, 16, 9, 5)), /^bloom-session-20261016-0905\.json$/);
});

test('import rejects bad files with friendly errors', () => {
  assert.throws(() => parseSessionText('nope'), SessionFileError);
  assert.throws(() => parseSessionText('[]'), SessionFileError);
  assert.throws(() => parseSessionText('{"foo":1}'), SessionFileError);
  assert.throws(() => parseSessionText('{"version":99,"loops":[]}'), /newer/);
  assert.throws(() => parseSessionText(' '.repeat(5 * 1024 * 1024)), /too large/);
});

test('legacy sessions from the p5 app convert', () => {
  assert.equal(isLegacySession(legacy), true);
  assert.equal(isLegacySession(sampleSession().toJSON()), false);

  const data = convertLegacySession(legacy);
  const s = Session.fromJSON(data);
  assert.equal(s.loops.length, legacy.loops ? Object.keys(legacy.loops).length : 0);
  assert.equal(s.structs.length, Object.keys(legacy.structs).length);
  assert.equal(s.loops[0].name, 'myLoop1');
  for (const l of s.loops) for (const t of l.tracks) assert.equal(t.params.length, 21);

  // importing through the file path works too
  const viaFile = parseSessionText(JSON.stringify(legacy));
  assert.equal(viaFile.loops.length, s.loops.length);
});
