import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioContextManager } from '../src/audio/AudioContextManager.js';
import { AudioEngine } from '../src/audio/AudioEngine.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { FakeAudioContext } from './audioFakes.js';
import { snapshot } from './fixtures.js';

afterEach(() => vi.unstubAllGlobals());

describe('AudioEngine integration', () => {
  it('resumes from a gesture, reconciles replay snapshots, and closes the session context', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, arrayBuffer: async () => new ArrayBuffer(1) })));
    const fake = new FakeAudioContext(); const store = createRuntimeStore();
    const engine = new AudioEngine(store, new AudioContextManager(() => fake as unknown as AudioContext));
    await engine.enable(); expect(engine.getState().status).toBe('running');
    await engine.suspend(); expect(engine.getState().status).toBe('suspended'); await engine.enable(); expect(engine.getState().status).toBe('running');
    store.getState().publishRuntimeWorldState(snapshot(0)); await Promise.resolve(); await Promise.resolve();
    expect(engine.getState().sourceCount).toBe(4); expect(engine.diagnostics().map((item) => item.runtimeId).sort()).toEqual(['bird', 'breath', 'water']);
    store.getState().publishRuntimeWorldState({ ...snapshot(1000), action: [], event: [] });
    expect(engine.getState().sourceCount).toBe(2);
    await engine.dispose(); expect(fake.closed).toBe(true); expect(engine.getState().status).toBe('disabled');
  });
});
