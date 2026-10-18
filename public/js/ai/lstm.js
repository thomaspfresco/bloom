// @ts-check
// Tiny inference engine for the exported Keras models (Embedding -> LSTM(s) ->
// Dense). Pure JS over Float32Array; no dependencies. The architecture comes
// from the JSON written by tools/export_models.py.
//
// Because every layer is causal, "feed the sequence so far and read the last
// output" (what the old Python did, re-running the padded sequence each step)
// equals "keep the recurrent state and feed one new step". `Stepper` does the
// latter, which is O(1) per generated step.

/**
 * @typedef {{shape: number[], offset: number, length: number}} TensorRef
 * @typedef {{type: 'embedding', inputDim: number, outputDim: number, embeddings: TensorRef}} EmbeddingSpec
 * @typedef {{type: 'lstm', units: number, returnSequences: boolean, kernel: TensorRef, recurrentKernel: TensorRef, bias: TensorRef}} LstmSpec
 * @typedef {{type: 'dense', units: number, activation: string, timeDistributed: boolean, kernel: TensorRef, bias: TensorRef}} DenseSpec
 * @typedef {{name: string, inputShape: (number|null)[], layers: (EmbeddingSpec|LstmSpec|DenseSpec)[], weights: string}} ModelSpec
 */

const sigmoid = (/** @type {number} */ x) => 1 / (1 + Math.exp(-x));

/** @param {Float32Array} v */
function softmaxInPlace(v) {
  let max = -Infinity;
  for (let i = 0; i < v.length; i++) if (v[i] > max) max = v[i];
  let sum = 0;
  for (let i = 0; i < v.length; i++) { v[i] = Math.exp(v[i] - max); sum += v[i]; }
  for (let i = 0; i < v.length; i++) v[i] /= sum;
}

/** @param {Float32Array} v @param {string} activation */
function activate(v, activation) {
  switch (activation) {
    case 'softmax': softmaxInPlace(v); break;
    case 'sigmoid': for (let i = 0; i < v.length; i++) v[i] = sigmoid(v[i]); break;
    case 'linear': break;
    default: throw new Error(`Unsupported activation "${activation}"`);
  }
}

class EmbeddingLayer {
  /** @param {EmbeddingSpec} spec @param {Float32Array} w */
  constructor(spec, w) {
    this.outputDim = spec.outputDim;
    this.inputDim = spec.inputDim;
    this.table = w.subarray(spec.embeddings.offset, spec.embeddings.offset + spec.embeddings.length);
  }

  /** @param {number} token */
  lookup(token) {
    if (!Number.isInteger(token) || token < 0 || token >= this.inputDim) throw new RangeError(`Embedding token ${token} out of range`);
    return this.table.subarray(token * this.outputDim, (token + 1) * this.outputDim);
  }
}

class LstmLayer {
  /** @param {LstmSpec} spec @param {Float32Array} w */
  constructor(spec, w) {
    this.units = spec.units;
    this.inputDim = spec.kernel.shape[0];
    this.kernel = w.subarray(spec.kernel.offset, spec.kernel.offset + spec.kernel.length);
    this.recurrent = w.subarray(spec.recurrentKernel.offset, spec.recurrentKernel.offset + spec.recurrentKernel.length);
    this.bias = w.subarray(spec.bias.offset, spec.bias.offset + spec.bias.length);
  }

  newState() {
    return { h: new Float32Array(this.units), c: new Float32Array(this.units), z: new Float32Array(4 * this.units) };
  }

  /**
   * One timestep, in place on `state`. Gate order along the 4*units axis is i, f, g, o (Keras).
   * @param {{h: Float32Array, c: Float32Array, z: Float32Array}} state
   * @param {ArrayLike<number>} x @returns {Float32Array} state.h
   */
  step(state, x) {
    const { units } = this;
    const n4 = 4 * units;
    const { h, c, z } = state;
    z.set(this.bias);
    for (let k = 0; k < this.inputDim; k++) {
      const xk = x[k];
      if (xk === 0) continue; // drum inputs are mostly zeros
      const row = k * n4;
      for (let j = 0; j < n4; j++) z[j] += xk * this.kernel[row + j];
    }
    for (let k = 0; k < units; k++) {
      const hk = h[k];
      const row = k * n4;
      for (let j = 0; j < n4; j++) z[j] += hk * this.recurrent[row + j];
    }
    for (let u = 0; u < units; u++) {
      const i = sigmoid(z[u]);
      const f = sigmoid(z[units + u]);
      const g = Math.tanh(z[2 * units + u]);
      const o = sigmoid(z[3 * units + u]);
      c[u] = f * c[u] + i * g;
      h[u] = o * Math.tanh(c[u]);
    }
    return h;
  }
}

class DenseLayer {
  /** @param {DenseSpec} spec @param {Float32Array} w */
  constructor(spec, w) {
    this.units = spec.units;
    this.inputDim = spec.kernel.shape[0];
    this.activation = spec.activation;
    this.kernel = w.subarray(spec.kernel.offset, spec.kernel.offset + spec.kernel.length);
    this.bias = w.subarray(spec.bias.offset, spec.bias.offset + spec.bias.length);
  }

  /** @param {ArrayLike<number>} x @returns {Float32Array} */
  apply(x) {
    const out = Float32Array.from(this.bias);
    for (let k = 0; k < this.inputDim; k++) {
      const xk = x[k];
      const row = k * this.units;
      for (let j = 0; j < this.units; j++) out[j] += xk * this.kernel[row + j];
    }
    activate(out, this.activation);
    return out;
  }
}

/** Streaming interface over a model: feed one step, get that step's output. */
export class Stepper {
  /** @param {LstmModel} model */
  constructor(model) {
    this.model = model;
    this.states = model.layers.map((l) => (l instanceof LstmLayer ? l.newState() : null));
  }

  /**
   * @param {number | ArrayLike<number>} input token id (embedding models) or feature vector
   * @returns {Float32Array} output of the final layer for this step (fresh copy)
   */
  step(input) {
    /** @type {ArrayLike<number>} */
    let x;
    const layers = this.model.layers;
    let li = 0;
    if (layers[0] instanceof EmbeddingLayer) {
      if (typeof input !== 'number') throw new TypeError('Embedding models take an integer token');
      x = layers[0].lookup(input);
      li = 1;
    } else {
      if (typeof input === 'number') throw new TypeError('This model takes a feature vector');
      x = input;
    }
    for (; li < layers.length; li++) {
      const layer = layers[li];
      if (layer instanceof LstmLayer) x = layer.step(/** @type {any} */ (this.states[li]), x);
      else if (layer instanceof DenseLayer) x = layer.apply(x);
    }
    return Float32Array.from(x);
  }
}

export class LstmModel {
  /**
   * @param {ModelSpec} spec @param {ArrayBuffer} weightsBuffer little-endian float32
   */
  constructor(spec, weightsBuffer) {
    this.name = spec.name;
    const w = new Float32Array(weightsBuffer);
    /** @type {(EmbeddingLayer | LstmLayer | DenseLayer)[]} */
    this.layers = spec.layers.map((l) => {
      switch (l.type) {
        case 'embedding': return new EmbeddingLayer(l, w);
        case 'lstm': return new LstmLayer(l, w);
        case 'dense': return new DenseLayer(l, w);
        default: throw new Error(`Unsupported layer "${/** @type {any} */ (l).type}" in model ${spec.name}`);
      }
    });
  }

  stepper() { return new Stepper(this); }

  /**
   * Run a whole sequence (used by tests to compare against Keras).
   * @param {(number | ArrayLike<number>)[]} sequence @returns {Float32Array[]} one output per step
   */
  predictSequence(sequence) {
    const s = this.stepper();
    return sequence.map((x) => s.step(x));
  }
}
