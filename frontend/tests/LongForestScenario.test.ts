import { describe, expect, it } from 'vitest';
import { PlanValidator, SceneGraph } from '@neuroscape/runtime-scene-controller';
import { forestDemoAssetIds } from '../src/audio/audioAssetManifest.js';
import { IntegrationHarness, longForestIntegrationScenario, type IntervalApi } from '../src/integration/IntegrationHarness.js';
import { LONG_FOREST_DURATION_MS, longForestPlans, longForestPlanTransitionTimesMs, longForestSceneGraph } from '../src/integration/longForestScenario.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';

describe('long forest validation scenario', () => {
  it('contains ordered, valid plans whose locations and assets resolve', () => {
    const graph = new SceneGraph(longForestSceneGraph), validator = new PlanValidator(graph), assets = new Set(forestDemoAssetIds);
    expect(longForestPlanTransitionTimesMs).toEqual([0, 30_000, 60_000, 90_000, 120_000, 150_000]);
    expect(longForestPlanTransitionTimesMs.every((value, index) => index === 0 || value > longForestPlanTransitionTimesMs[index - 1]!)).toBe(true);
    for (const plan of longForestPlans) {
      expect(validator.validate(plan)).toMatchObject({ valid:true });
      expect(plan.userJourney.waypoints.every((waypoint) => graph.hasNode(waypoint.locationId))).toBe(true);
      expect([...plan.soundscape.ambient, ...plan.soundscape.action, ...plan.soundscape.event].every((source) => assets.has(source.assetId))).toBe(true);
    }
  });

  it('completes approximately 180 session seconds without waiting in real time', () => {
    const store = createRuntimeStore(), timers: IntervalApi = { set:() => 1, clear:() => undefined };
    const harness = new IntegrationHarness(store, 'long-validation-test', timers, longForestIntegrationScenario);
    harness.start();
    while (harness.getState().status !== 'ended') harness.tick(1_000);
    expect(harness.getState().timestampMs).toBe(LONG_FOREST_DURATION_MS);
    expect(harness.getState().appliedPlanIndex).toBe(longForestPlans.length - 1);
    expect(store.getState().sessionRuntime).toMatchObject({ status:'ended', elapsedTimeMs:LONG_FOREST_DURATION_MS });
    expect(store.getState().runtimeWorldState?.listener.semanticLocation).toBe('waterfall');
  });
});
