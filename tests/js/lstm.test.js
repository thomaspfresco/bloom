import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { makeStore } from './helpers.js';

const golden = JSON.parse(readFileSync(new URL('../fixtures/lstm.golden.json', import.meta.url), 'utf8'));

test('JS inference reproduces Keras outputs for every case', async () => {
  const store = makeStore();
  for (const c of golden) {
    const model = await store.get(c.model);
    const out = model.predictSequence(c.input);
    assert.equal(out.length, c.output.length, `${c.model}: step count`);
    let worst = 0;
    for (let t = 0; t < out.length; t++) {
      assert.equal(out[t].length, c.output[t].length);
      for (let j = 0; j < out[t].length; j++) worst = Math.max(worst, Math.abs(out[t][j] - c.output[t][j]));
    }
    assert.ok(worst < 1e-5, `${c.model}: max abs diff ${worst}`);
  }
});

test('softmax outputs are distributions', async () => {
  const model = await makeStore().get('durations3');
  const [out] = model.predictSequence([16]);
  const sum = out.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-5);
  assert.equal(out.length, 65);
});

test('stepper rejects wrong input types', async () => {
  const store = makeStore();
  const embed = await store.get('harmonyAndBass');
  assert.throws(() => embed.stepper().step([1, 2]), TypeError);
  assert.throws(() => embed.stepper().step(99), RangeError);
  const drums = await store.get('drums1');
  assert.throws(() => drums.stepper().step(3), TypeError);
});
