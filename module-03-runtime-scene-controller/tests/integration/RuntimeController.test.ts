import { describe, expect, it } from 'vitest';
import { sceneJourneyPlanFixture } from '../fixtures/phase1Fixtures.js';
import { createRuntimeHarness } from '../helpers/createRuntimeHarness.js';

describe('RuntimeController Phase 2 integration', () => {
  it('orchestrates controllers and publishes immutable complete frames', () => {
    const { controller } = createRuntimeHarness();
    controller.initialize(sceneJourneyPlanFixture);
    const state = controller.update(1_000);

    expect(state.timestampMs).toBe(1_000);
    expect(state.listener.worldPosition[2]).toBeLessThan(0);
    expect(state.ambient).toHaveLength(2);
    expect(state.action.some((item) => item.id === 'breathing')).toBe(true);
    expect(state.event.some((item) => item.id === 'bird-001')).toBe(true);
    expect(Object.isFrozen(state)).toBe(true);
  });

  it('replaces future journey intention without teleporting the listener', () => {
    const { controller } = createRuntimeHarness();
    controller.initialize(sceneJourneyPlanFixture);
    controller.update(4_000);
    const before = controller.currentState!.listener.worldPosition;

    controller.applyPlan({
      ...sceneJourneyPlanFixture,
      planId: 'plan-002',
      userJourney: {
        goal: 'return to the entry',
        waypoints: [{ locationId: 'clearing' }, { locationId: 'forest_entry' }],
      },
    });

    expect(controller.currentState!.listener.worldPosition).toEqual(before);
    expect(controller.update(0).listener.worldPosition).toEqual(before);
    expect(controller.update(100).listener.worldPosition).not.toEqual([
      0, 0, 0,
    ]);
  });

  it('reuses compatible sounds and applies replacements immediately', () => {
    const { controller } = createRuntimeHarness();
    controller.initialize(sceneJourneyPlanFixture);
    controller.update(2_000);
    const beforeGain = controller.currentState!.ambient.find(
      (item) => item.id === 'forest-bed',
    )!.gain;

    controller.applyPlan({
      ...sceneJourneyPlanFixture,
      planId: 'compatible',
      soundscape: {
        ...sceneJourneyPlanFixture.soundscape,
        ambient: sceneJourneyPlanFixture.soundscape.ambient.map((item) =>
          item.id === 'forest-bed' ? { ...item, gain: 0.6 } : item,
        ),
      },
    });
    const compatibleFrame = controller.update(500);
    expect(
      compatibleFrame.ambient.filter((item) => item.id === 'forest-bed'),
    ).toHaveLength(1);
    expect(
      compatibleFrame.ambient.find((item) => item.id === 'forest-bed')!.gain,
    ).toBeGreaterThan(beforeGain);

    controller.applyPlan({
      ...sceneJourneyPlanFixture,
      planId: 'incompatible',
      soundscape: {
        ...sceneJourneyPlanFixture.soundscape,
        ambient: sceneJourneyPlanFixture.soundscape.ambient.map((item) =>
          item.id === 'forest-bed'
            ? { ...item, assetId: 'ambient.replacement' }
            : item,
        ),
      },
    });
    const fadingFrame = controller.update(1_000);
    expect(
      fadingFrame.ambient.find((item) => item.id === 'forest-bed')!.assetId,
    ).toBe('ambient.replacement');
    controller.update(1_000);
    const replacedFrame = controller.update(1);
    expect(
      replacedFrame.ambient.find((item) => item.id === 'forest-bed')!.assetId,
    ).toBe('ambient.replacement');
  });

  it('preserves the current snapshot when an invalid plan is rejected', () => {
    const { controller } = createRuntimeHarness();
    controller.initialize(sceneJourneyPlanFixture);
    const previous = controller.update(100);
    const invalidPlan = {
      ...sceneJourneyPlanFixture,
      userJourney: { goal: 'invalid', waypoints: [{ locationId: 'missing' }] },
    };
    expect(() => controller.applyPlan(invalidPlan)).toThrow(
      /Invalid SceneJourneyPlan/,
    );
    expect(controller.currentState).toBe(previous);
  });

  it('coordinates an authored scene transition without teleporting', () => {
    const { controller, events } = createRuntimeHarness();
    controller.initialize(sceneJourneyPlanFixture);
    controller.update(1_000);
    const before = controller.currentState!.listener.worldPosition;

    controller.applyPlan({
      ...sceneJourneyPlanFixture,
      planId: 'scene-transition',
      userJourney: {
        goal: 'move to clearing',
        waypoints: [
          { locationId: 'forest_entry' },
          { locationId: 'clearing', arrivalTimeMs: 26_000 },
        ],
      },
    });

    expect(controller.currentState!.listener.worldPosition).toEqual(before);
    expect(controller.sceneTransitionState).toMatchObject({
      fromLocationId: 'forest_entry',
      toLocationId: 'clearing',
      phase: 'traversing',
      arrivalTimeMs: 26_000,
    });
    controller.update(24_000);
    expect(controller.currentState!.listener.semanticLocation).toBe(
      'forest_entry',
    );
    controller.update(1_000);
    expect(controller.currentState!.listener.semanticLocation).toBe('clearing');
    expect(controller.sceneTransitionState?.phase).toBe('arriving');
    expect(
      events.history.some((event) => event.type === 'SceneTransitionStarted'),
    ).toBe(true);
  });

  it('requires initialization, validates elapsed time, and supports shutdown', () => {
    const { controller } = createRuntimeHarness();
    expect(() => controller.update(1)).toThrow(/not initialized/);
    controller.initialize(sceneJourneyPlanFixture);
    expect(() => controller.update(-1)).toThrow(/non-negative/);
    controller.shutdown();
    expect(controller.currentState).toBeUndefined();
  });
});
