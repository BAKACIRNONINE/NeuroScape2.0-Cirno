import { describe, expect, it } from 'vitest';
import { RuntimeReplayController, type ReplayScheduler } from '../src/replay/index.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { snapshot } from './fixtures.js';

describe('RuntimeReplayController', () => {
  it('steps exact recorded snapshots and resets without interpolation', () => {
    const store = createRuntimeStore();
    const replay = new RuntimeReplayController(store);
    replay.load([snapshot(1000), snapshot(0)]);
    replay.step(); expect(store.getState().runtimeWorldState?.timestampMs).toBe(0);
    replay.step(); expect(store.getState().runtimeWorldState?.timestampMs).toBe(1000);
    replay.reset(); expect(store.getState().runtimeWorldState).toBeNull();
  });

  it('schedules playback using timestamp deltas', () => {
    const queued: Array<{ callback: () => void; delay: number }> = [];
    const scheduler: ReplayScheduler = { set: (callback, delay) => (queued.push({ callback, delay }), callback), clear: () => undefined };
    const store = createRuntimeStore();
    const replay = new RuntimeReplayController(store, scheduler);
    replay.load([snapshot(0), snapshot(750)]); replay.play();
    expect(store.getState().runtimeWorldState?.timestampMs).toBe(0);
    expect(queued[0]?.delay).toBe(750);
    queued[0]?.callback();
    expect(store.getState().runtimeWorldState?.timestampMs).toBe(750);
  });
});
