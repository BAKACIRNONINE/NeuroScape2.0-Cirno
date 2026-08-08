import { describe, expect, it } from 'vitest';
import type { NeuroState, RuntimeWorldState } from '../src/index.js';

describe('shared contracts', () => {
  it('accepts canonical contract fixtures', () => {
    const neuroState: NeuroState = {
      timestampMs: 0,
      attention: { value: 0.5, trend: 'stable' },
      arousal: { value: 0.4, trend: 'decreasing' },
      stability: 0.8,
      confidence: 0.9,
    };
    const runtimeState: RuntimeWorldState = {
      timestampMs: 0,
      listener: {
        worldPosition: [0, 0, 0],
        orientation: [0, 0, 0, 1],
        velocity: [0, 0, 0],
        semanticLocation: 'forest_entry',
      },
      ambient: [],
      action: [],
      event: [],
    };

    expect(neuroState.arousal.value).toBe(0.4);
    expect(runtimeState.listener.worldPosition).toEqual([0, 0, 0]);
  });
});
