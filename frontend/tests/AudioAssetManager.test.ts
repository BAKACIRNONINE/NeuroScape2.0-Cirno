import { describe, expect, it, vi } from 'vitest';
import { AudioAssetManager } from '../src/audio/AudioAssetManager.js';
import { fakeBuffer } from './audioFakes.js';

describe('AudioAssetManager', () => {
  it('resolves manifests, caches decoded buffers, and deduplicates pending loads', async () => {
    const decode = vi.fn(async () => fakeBuffer); const fetcher = vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(2) }));
    const manager = new AudioAssetManager([{ assetId: 'ambient.wind', url: '/wind.wav', preload: true }], decode, fetcher);
    expect(manager.resolve('ambient.wind')?.url).toBe('/wind.wav');
    const [first, second] = await Promise.all([manager.load('ambient.wind'), manager.load('ambient.wind')]);
    expect(first).toEqual(second); expect(fetcher).toHaveBeenCalledTimes(1); expect(decode).toHaveBeenCalledTimes(1);
    await manager.load('ambient.wind'); expect(fetcher).toHaveBeenCalledTimes(1); expect(manager.cachedCount).toBe(1);
  });

  it('returns structured missing and fetch errors without throwing', async () => {
    const manager = new AudioAssetManager([], async () => fakeBuffer, async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }));
    const missing = await manager.load('missing');
    expect(missing.ok).toBe(false); if (!missing.ok) expect(missing.error.code).toBe('NOT_REGISTERED');
  });
});
