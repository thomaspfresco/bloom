// Browser smoke tests: drives a real Chrome against a running BLOOM server.
//
//   python app.py &                       # or any server on BLOOM_URL
//   npm run e2e                           # needs `npm i` (playwright-core) and Chrome
//
// Environment: BLOOM_URL (default http://127.0.0.1:5000), CHROME_PATH (default: macOS Chrome).
// Each check prints PASS/FAIL; the process exits non-zero if any fail.

import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { encodeWav } from '../../public/js/audio/wav.js';

const URL_ = process.env.BLOOM_URL ?? 'http://127.0.0.1:5000';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

// A melody for the fake microphone: A3 C4 E4 G4 repeating, half a second each.
function melodyWav(dir) {
  const SR = 44100;
  const parts = [];
  for (let k = 0; k < 14; k++) {
    const f = 440 * 2 ** (([57, 60, 64, 67][k % 4] - 69) / 12);
    const n = Math.round(0.5 * SR);
    const x = new Float32Array(n);
    let ph = 0;
    for (let i = 0; i < n; i++) {
      ph += (2 * Math.PI * f) / SR;
      const t = i / SR;
      x[i] = 0.5 * Math.min(1, t / 0.02, (0.5 - t) / 0.02) * (Math.sin(ph) + 0.4 * Math.sin(2 * ph));
    }
    parts.push(x, new Float32Array(Math.round(0.1 * SR)));
  }
  const all = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { all.set(p, o); o += p.length; }
  const path = join(dir, 'melody.wav');
  writeFileSync(path, Buffer.from(encodeWav([all], SR)));
  return path;
}

const tmp = mkdtempSync(join(tmpdir(), 'bloom-e2e-'));
const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--enable-unsafe-webgpu', '--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${melodyWav(tmp)}`],
});

const results = [];
async function check(name, fn) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, permissions: ['microphone'], acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  try {
    await page.goto(URL_);
    await page.waitForFunction(() => window.__bloom, null, { timeout: 20000 });
    await fn(page);
    assert.deepEqual(errors, [], 'page errors');
    results.push([name, true]);
    console.log(`PASS  ${name}`);
  } catch (err) {
    results.push([name, false]);
    console.log(`FAIL  ${name}\n      ${String(err.message ?? err).split('\n')[0]}`);
  } finally {
    await context.close();
  }
}

/** Evaluate in the page with the app context. */
const app = (page, fn, arg) => page.evaluate(fn, arg);

await check('boots and renders with a GPU backend', async (page) => {
  const backend = await app(page, () => window.__bloom.scene.backend);
  assert.ok(['webgpu', 'webgl'].includes(backend));
  const counts = await app(page, () => ({ dots: window.__bloom.scene.batches.back.count, petals: window.__bloom.scene.batches.petals.count }));
  assert.equal(counts.dots, 100);
  assert.ok(counts.petals > 0);
});

await check('loop, tracks, notes, views', async (page) => {
  const r = await app(page, async () => {
    const { ctx } = window.__bloom;
    const { Note } = await import('/js/model/Note.js');
    const loop = ctx.actions.createLoop();
    const bass = ctx.actions.addEmptyTrack(loop, 'BASS');
    bass.octaveWindow = 2;
    bass.notes.push(new Note({ pitch: 0, octave: 2, start: 0, duration: 8 }));
    ctx.session.touch('loop', loop.id);
    const out = [];
    for (const view of [0, 1, 2]) { ctx.actions.selectTrack(bass.id, view); await new Promise((r) => setTimeout(r, 200)); out.push(document.querySelector('.grid-frame, .studio, .automation') !== null); }
    return { tabs: ctx.session.tabs.length, views: out };
  });
  assert.equal(r.tabs, 1);
  assert.deepEqual(r.views, [true, true, true]);
});

await check('grid: draw a note with the pointer', async (page) => {
  await app(page, () => { const { ctx } = window.__bloom; const l = ctx.actions.createLoop(); const t = ctx.actions.addEmptyTrack(l, 'MELODY'); ctx.actions.selectTrack(t.id, 0); });
  await page.waitForTimeout(500);
  const box = await page.locator('.grid-frame').boundingBox();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.25 + (box.width / 64) * 6, box.y + box.height * 0.5, { steps: 5 });
  await page.mouse.up();
  const notes = await app(page, () => window.__bloom.ctx.session.activeItem.tracks[0].notes.map((n) => [n.start, n.duration]));
  assert.equal(notes.length, 1);
  assert.equal(notes[0][1], 7, 'dragging across 6 columns covers 7 steps');
});

await check('AI suggestions are generated, previewed and kept', async (page) => {
  await app(page, () => window.__bloom.ctx.actions.createLoop());
  await page.mouse.click(700, 300);
  await page.click('.plus');
  await page.getByText('DRUMS', { exact: true }).click();
  await page.getByText('AI SUGGESTION').click();
  await page.waitForSelector('.quad');
  assert.equal(await page.locator('.quad').count(), 4);
  await page.locator('.quad').nth(1).hover();
  await page.waitForFunction(() => window.__bloom.ctx.ui.s.playing, null, { timeout: 5000 });
  await page.locator('.quad').nth(1).click();
  const n = await app(page, () => window.__bloom.ctx.session.activeItem.tracks[0].notes.length);
  assert.ok(n > 4);
});

await check('drawer: drag a loop into a structure; playback advances', async (page) => {
  await app(page, async () => {
    const { ctx } = window.__bloom;
    for (let i = 0; i < 3; i++) ctx.session.createLoop();
    const s = ctx.session.createStruct();
    s.insertLoop(ctx.session.loops[0].id);
    ctx.session.touch('struct', s.id);
  });
  await page.mouse.move(700, 300);
  await page.mouse.move(10, 300);
  await page.waitForSelector('.drawer-loops.open .drawer-item', { state: 'attached' });
  const box = await page.locator('.drawer-loops .drawer-item').nth(2).boundingBox();
  await page.mouse.move(box.x + 40, box.y);
  await page.mouse.down();
  await page.mouse.move(300, 450, { steps: 6 });
  await page.mouse.move(900, 450, { steps: 10 });
  await page.mouse.up();
  assert.equal(await app(page, () => window.__bloom.ctx.session.activeItem.sections.length), 2);
});

await check('offline audio export is not silent', async (page) => {
  const rms = await app(page, async () => {
    const { ctx } = window.__bloom;
    const { Note } = await import('/js/model/Note.js');
    const { renderPlan } = await import('/js/audio/exportAudio.js');
    const loop = ctx.session.createLoop();
    const b = ctx.actions.addEmptyTrack(loop, 'BASS');
    const d = ctx.actions.addEmptyTrack(loop, 'DRUMS');
    for (let s = 0; s < 64; s += 16) b.notes.push(new Note({ pitch: 0, octave: 2, start: s, duration: 8 }));
    for (let s = 0; s < 64; s += 4) d.notes.push(new Note({ pitch: 0, octave: 0, start: s, duration: 1 }));
    const buf = await renderPlan({ type: 'loop', loop, click: false });
    const x = buf.getChannelData(0);
    let sum = 0;
    for (const v of x) sum += v * v;
    return Math.sqrt(sum / x.length);
  });
  assert.ok(rms > 0.02, `rms ${rms}`);
});

await check('live playback produces sound', async (page) => {
  await page.mouse.click(700, 400);
  const peak = await app(page, async () => {
    const { ctx } = window.__bloom;
    const { Note } = await import('/js/model/Note.js');
    await ctx.engine.unlock();
    const loop = ctx.session.createLoop();
    loop.setTempo(240);
    const d = ctx.actions.addEmptyTrack(loop, 'DRUMS');
    for (let s = 0; s < 64; s += 4) d.notes.push(new Note({ pitch: 0, octave: 0, start: s, duration: 1 }));
    // eslint-disable-next-line no-undef
    const meter = new Tone.Meter({ smoothing: 0 });
    Tone.getDestination().connect(meter);
    ctx.actions.playActive();
    let peak = -Infinity;
    const t0 = performance.now();
    while (performance.now() - t0 < 2000) { peak = Math.max(peak, meter.getValue()); await new Promise((r) => setTimeout(r, 20)); }
    ctx.actions.stopPlayback();
    return peak;
  });
  assert.ok(peak > -40, `peak ${peak} dB`);
});

await check('session survives a reload; corrupt storage is quarantined', async (page) => {
  await app(page, async () => {
    const { ctx } = window.__bloom;
    const l = ctx.actions.createLoop();
    ctx.actions.addEmptyTrack(l, 'HARMONY');
  });
  await page.waitForTimeout(2200); // autosave debounce
  await page.reload();
  await page.waitForFunction(() => window.__bloom);
  assert.equal(await app(page, () => window.__bloom.ctx.session.loops.length), 1);
  await app(page, () => localStorage.setItem('bloom.session', '{oops'));
  await page.reload();
  await page.waitForFunction(() => window.__bloom);
  const r = await app(page, () => ({ loops: window.__bloom.ctx.session.loops.length, backup: localStorage.getItem('bloom.session.corrupt') }));
  assert.equal(r.loops, 0);
  assert.equal(r.backup, '{oops');
});

await check('MIDI export through the API', async (page) => {
  const r = await app(page, async () => {
    const res = await fetch('/api/midi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'x', kind: 'BASS', tempo: 120, notes: [{ pitch: 0, octave: 2, start: 0, duration: 4 }] }) });
    return { status: res.status, type: res.headers.get('content-type') };
  });
  assert.equal(r.status, 200);
  assert.equal(r.type, 'audio/midi');
});

await check('hum a melody: record from the (fake) microphone and transcribe', async (page) => {
  await app(page, () => { const { ctx } = window.__bloom; const l = ctx.actions.createLoop(); l.setTempo(240); ctx.session.touch('loop', l.id); });
  await page.mouse.click(700, 300);
  await page.click('.plus');
  await page.getByText('MELODY', { exact: true }).click();
  await page.getByText('HUM/SING').click();
  await page.waitForFunction(() => window.__bloom.ctx.record.s.status === 'idle', null, { timeout: 8000 });
  await page.keyboard.press(' ');
  await page.waitForFunction(() => window.__bloom.ctx.record.s.status === 'recorded', null, { timeout: 20000 });
  await page.getByText('GENERATE', { exact: true }).click();
  const notes = await app(page, () => window.__bloom.ctx.session.activeItem.trackOfKind('MELODY')?.notes.map((n) => n.pitch) ?? []);
  assert.ok(notes.length >= 4, `notes ${notes}`);
  assert.ok(notes.every((p) => [9, 0, 4, 7].includes(p)), `pitch classes ${notes}`);
});

await browser.close();
const failed = results.filter(([, ok]) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
