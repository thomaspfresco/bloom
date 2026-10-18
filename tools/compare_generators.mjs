// Sample the JS generators the same way as tools/compare_generators.py.
//   node tools/compare_generators.mjs OUT_JS.json [n_drums] [n_harmony_bass]
import { readFile, writeFile } from 'node:fs/promises';
import { Generator } from '../public/js/ai/Generator.js';
import { ModelStore } from '../public/js/ai/ModelStore.js';
import { Random } from '../public/js/core/random.js';

const dir = new URL('../public/models/', import.meta.url);
const store = new ModelStore({
  json: async (p) => JSON.parse(await readFile(new URL(p, dir), 'utf8')),
  bytes: async (p) => { const b = await readFile(new URL(p, dir)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); },
});

const [out, nDrums = 1000, nHb = 1000] = [process.argv[2], Number(process.argv[3]), Number(process.argv[4])];
const g = new Generator({ models: store, random: new Random(2026) });

const drum = Array.from({ length: 7 }, () => new Array(64).fill(0));
const counts = [];
for (let i = 0; i < Math.ceil(nDrums / 4); i++) {
  for (const c of await g.suggest('DRUMS', {})) { counts.push(c.notes.length); for (const n of c.notes) drum[n.pitch][n.start]++; }
}
const harm = []; const bass = [];
for (let i = 0; i < Math.ceil(nHb / 4); i++) {
  for (const c of await g.suggest('HARMONY', {})) harm.push({ chords: new Set(c.notes.map((n) => n.start)).size, first: c.notes.find((n) => n.start === 0).duration, size: c.notes.length });
  for (const c of await g.suggest('BASS', {})) bass.push({ n: c.notes.length, first: c.notes[0].duration });
}
await writeFile(out, JSON.stringify({ drum: drum.map((r) => r.map((v) => v / counts.length)), drum_counts: counts, harm, bass }));
console.log('wrote', out);
