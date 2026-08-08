import type { RuntimeWorldState } from '@neuroscape/contracts';

const base = (timestampMs: number, x: number, z: number): RuntimeWorldState => ({
  timestampMs,
  listener: { worldPosition: [x, 1.7, z], orientation: timestampMs < 2000 ? [0, 0, 0, 1] : [0, 0.7071067811865475, 0, 0.7071067811865476], velocity: [1, 0, -1], semanticLocation: 'forest-path' },
  journey: {
    plannedPath: [[0, 1.7, 0], [3, 1.7, -3], [7, 1.7, -6]],
    currentSegmentIndex: timestampMs < 2000 ? 0 : 1,
    remainingWaypoints: timestampMs < 2000 ? [[3, 1.7, -3], [7, 1.7, -6]] : [[7, 1.7, -6]],
  },
  ambient: [
    { id: 'forest-bed', assetId: 'ambient.forest.light', mode: 'global', gain: 0.55, active: true },
    { id: 'stream', assetId: 'ambient.stream.near', mode: 'localized', worldPosition: [5, 0, -4], gain: 0.7, active: true },
  ],
  action: [{ id: 'breath', assetId: 'action.guided-breath', attachment: 'chest', relativePosition: [0, -0.3, 0.2], worldPosition: [x, 1.4, z + 0.2], gain: 0.4, active: true }],
  event: [{ id: 'bird-pass', assetId: 'event.bird-pass', worldPosition: [-2 + timestampMs / 400, 4, -5 - timestampMs / 1000], velocity: [2.5, 0, -1], gain: 0.65, lifecycle: timestampMs === 0 ? 'waiting' : 'active', active: timestampMs > 0 }],
});

export const demoRuntimeSnapshots: readonly RuntimeWorldState[] = [base(0, 0, 0), base(1000, 1, -1), base(2000, 3, -3)];
