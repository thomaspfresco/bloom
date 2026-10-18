// @ts-check

import { LstmModel } from './lstm.js';

/**
 * How model files are fetched. Defaults to `fetch`; tests inject a file reader.
 * @typedef {object} ModelSource
 * @property {(path: string) => Promise<any>} json
 * @property {(path: string) => Promise<ArrayBuffer>} bytes
 */

/** @param {string} [baseUrl] @returns {ModelSource} */
export function fetchSource(baseUrl = '/models') {
  return {
    async json(path) {
      const res = await fetch(`${baseUrl}/${path}`);
      if (!res.ok) throw new Error(`Could not load model file ${path} (${res.status})`);
      return res.json();
    },
    async bytes(path) {
      const res = await fetch(`${baseUrl}/${path}`);
      if (!res.ok) throw new Error(`Could not load model file ${path} (${res.status})`);
      return res.arrayBuffer();
    },
  };
}

/** Lazily loads and caches models by name (e.g. "drums1", "durations3"). */
export class ModelStore {
  /** @param {ModelSource} [source] */
  constructor(source = fetchSource()) {
    this.source = source;
    /** @type {Map<string, Promise<LstmModel>>} */
    this.cache = new Map();
  }

  /** @param {string} name @returns {Promise<LstmModel>} */
  get(name) {
    let p = this.cache.get(name);
    if (!p) {
      p = this.#load(name);
      this.cache.set(name, p);
      // a failed load must not be cached forever
      p.catch(() => this.cache.delete(name));
    }
    return p;
  }

  /** @param {string} name */
  async #load(name) {
    const spec = await this.source.json(`${name}.json`);
    const bytes = await this.source.bytes(spec.weights);
    return new LstmModel(spec, bytes);
  }

  /** Start fetching models in the background. @param {string[]} names */
  preload(names) {
    for (const n of names) this.get(n).catch(() => {});
  }
}
