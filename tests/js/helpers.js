// Node helpers shared by tests: load exported models from public/models.
import { readFile } from 'node:fs/promises';
import { ModelStore } from '../../public/js/ai/ModelStore.js';

const dir = new URL('../../public/models/', import.meta.url);

export const fileSource = {
  json: async (p) => JSON.parse(await readFile(new URL(p, dir), 'utf8')),
  bytes: async (p) => {
    const buf = await readFile(new URL(p, dir));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  },
};

export const makeStore = () => new ModelStore(fileSource);
