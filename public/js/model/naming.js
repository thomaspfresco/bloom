// @ts-check

/**
 * Make `name` unique among `existing` using the old scheme:
 * "myLoop1" -> "myLoop1(1)" -> "myLoop1(2)" ...
 * @param {string} name @param {Iterable<string>} existing
 */
export function uniqueName(name, existing) {
  const taken = new Set(existing);
  let candidate = name;
  while (taken.has(candidate)) {
    const m = /^(.*)\((\d+)\)$/.exec(candidate);
    candidate = m ? `${m[1]}(${Number(m[2]) + 1})` : `${candidate}(1)`;
  }
  return candidate;
}
