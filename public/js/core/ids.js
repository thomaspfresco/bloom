// @ts-check

const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

/**
 * Short, URL-safe unique id. Loops, structures, tracks and sections reference
 * each other by id (the old app used array indexes, which broke on deletion).
 * @param {string} [prefix]
 */
export function newId(prefix = '') {
  const bytes = new Uint8Array(8);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return prefix ? `${prefix}_${out}` : out;
}
