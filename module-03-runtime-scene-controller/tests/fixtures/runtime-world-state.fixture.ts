import type { RuntimeWorldState } from '@neuroscape/contracts';

export const runtimeWorldStateFixture: RuntimeWorldState = {
  timestampMs: 0,
  listener: {
    worldPosition: [0, 0, 0],
    orientation: [0, 0, 0, 1],
    velocity: [0, 0, 0],
    semanticLocation: 'forest_entry',
  },
  journey: {
    plannedPath: [[0, 0, 0]],
    currentSegmentIndex: 0,
    remainingWaypoints: [],
  },
  ambient: [],
  action: [],
  event: [],
};
