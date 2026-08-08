import type { AudioAssetDefinition } from './AudioAssetManager.js';

// Small generated WAV placeholders keep development self-contained. Replace URLs with
// versioned production assets without changing RuntimeWorldState assetIds.
function toneUrl(frequency: number): string {
  const sampleRate = 8000, samples = 2000, bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const write = (offset: number, value: string) => [...value].forEach((character, index) => view.setUint8(offset + index, character.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + samples * 2, true); write(8, 'WAVE'); write(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  write(36, 'data'); view.setUint32(40, samples * 2, true);
  for (let index = 0; index < samples; index += 1) view.setInt16(44 + index * 2, Math.sin(2 * Math.PI * frequency * index / sampleRate) * 3500, true);
  let binary = ''; bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return `data:audio/wav;base64,${btoa(binary)}`;
}

export const developmentAudioManifest: readonly AudioAssetDefinition[] = [
  { assetId: 'ambient.forest.light', url: toneUrl(110), preload: true },
  { assetId: 'ambient.stream.near', url: toneUrl(220), preload: true },
  { assetId: 'action.guided-breath', url: toneUrl(330) },
  { assetId: 'event.bird-pass', url: toneUrl(550) },
  { assetId: 'ambient.waterfall', url: toneUrl(180), preload: true },
  { assetId: 'action.footsteps', url: toneUrl(280) },
  { assetId: 'event.leaves', url: toneUrl(440) },
];
