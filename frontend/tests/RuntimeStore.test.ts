import { describe, expect, it, vi } from 'vitest';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { snapshot } from './fixtures.js';

describe('RuntimeStore', () => {
  it('atomically publishes an immutable defensive copy', () => {
    const store = createRuntimeStore();
    const listener = vi.fn(); store.subscribe(listener);
    const input = snapshot();
    expect(store.getState().publishRuntimeWorldState(input)).toEqual({ accepted: true });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().runtimeWorldState).not.toBe(input);
    expect(Object.isFrozen(store.getState().runtimeWorldState?.listener.worldPosition)).toBe(true);
    input.listener.worldPosition[0] = 99;
    expect(store.getState().runtimeWorldState?.listener.worldPosition[0]).toBe(1);
  });

  it('rejects stale and malformed snapshots while preserving the last valid one', () => {
    const store = createRuntimeStore();
    store.getState().publishRuntimeWorldState(snapshot(200));
    const accepted = store.getState().runtimeWorldState;
    expect(store.getState().publishRuntimeWorldState(snapshot(100))).toMatchObject({ accepted: false, reason: 'stale' });
    expect(store.getState().runtimeWorldState).toBe(accepted);
    expect(store.getState().publishRuntimeWorldState({ timestampMs: 300 })).toMatchObject({ accepted: false, reason: 'invalid' });
    expect(store.getState().runtimeWorldState).toBe(accepted);
  });
});
