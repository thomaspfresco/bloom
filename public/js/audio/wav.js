// @ts-check
// 16-bit PCM WAV encoder (replaces the audiobuffer-to-wav dependency).

/**
 * @param {Float32Array[]} channels one array per channel, equal lengths
 * @param {number} sampleRate
 * @returns {ArrayBuffer}
 */
export function encodeWav(channels, sampleRate) {
  const nCh = channels.length;
  const length = channels[0]?.length ?? 0;
  const bytesPerSample = 2;
  const dataSize = length * nCh * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  /** @param {number} offset @param {string} s */
  const text = (offset, s) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };

  text(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, nCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * nCh * bytesPerSample, true);
  view.setUint16(32, nCh * bytesPerSample, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let c = 0; c < nCh; c++) {
      const s = Math.max(-1, Math.min(1, channels[c][i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

/** @param {AudioBuffer} audioBuffer */
export function audioBufferToWav(audioBuffer) {
  const channels = [];
  for (let c = 0; c < audioBuffer.numberOfChannels; c++) channels.push(audioBuffer.getChannelData(c));
  return encodeWav(channels, audioBuffer.sampleRate);
}
