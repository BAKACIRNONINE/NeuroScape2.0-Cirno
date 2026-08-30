import { describe, expect, it } from 'vitest';
import {
  SceneTransitionCoordinator,
  SCENE_TRANSITION_STABILIZATION_MS,
} from '../../src/controllers/SceneTransitionCoordinator.js';
import { RuntimeEventBus } from '../../src/events/RuntimeEvents.js';

const listener = (
  semanticLocation: string,
  velocity: [number, number, number] = [0, 0, 0],
) => ({
  worldPosition: [0, 0, 0] as [number, number, number],
  orientation: [0, 0, 0, 1] as [number, number, number, number],
  velocity,
  semanticLocation,
});

describe('SceneTransitionCoordinator', () => {
  it('tracks traversal, arrival, stabilization, and completion deterministically', () => {
    const events = new RuntimeEventBus();
    const coordinator = new SceneTransitionCoordinator(events);
    coordinator.initialize(1_000);
    coordinator.start({
      fromLocationId: 'forest_clearing',
      toLocationId: 'stream_bank',
      arrivalTimeMs: 26_000,
    });

    coordinator.update(10_000, listener('forest_clearing', [0, 0, -1]));
    expect(coordinator.state?.phase).toBe('traversing');

    coordinator.update(15_000, listener('stream_bank'));
    expect(coordinator.state?.phase).toBe('arriving');
    coordinator.update(1, listener('stream_bank'));
    expect(coordinator.state?.phase).toBe('stabilizing');
    coordinator.update(
      SCENE_TRANSITION_STABILIZATION_MS,
      listener('stream_bank'),
    );
    expect(coordinator.state?.phase).toBe('complete');
    expect(
      events.history.some((event) => event.type === 'SceneTransitionCompleted'),
    ).toBe(true);
  });

  it('scopes long crossfade timing to ambient transitions', () => {
    const events = new RuntimeEventBus();
    const coordinator = new SceneTransitionCoordinator(events);
    coordinator.initialize(1_000);
    coordinator.start({
      fromLocationId: 'forest_clearing',
      toLocationId: 'stream_bank',
      arrivalTimeMs: 26_000,
    });
    expect(
      coordinator.ambientPolicy({ defaultDurationMs: 2_000, curve: 'linear' }),
    ).toEqual({ defaultDurationMs: 25_000, curve: 'linear' });
  });
});
