import { describe, expect, it } from 'vitest';
import { PlanValidator, SceneGraph } from '@neuroscape/runtime-scene-controller';
import { forestDemoAssetIds } from '../src/audio/audioAssetManifest.js';
import { IntegrationHarness, spatialDiagnosticIntegrationScenario, type IntervalApi } from '../src/integration/IntegrationHarness.js';
import { SPATIAL_DIAGNOSTIC_DURATION_MS, spatialDiagnosticPhases, spatialDiagnosticPlans, spatialDiagnosticPositions, spatialDiagnosticSceneGraph } from '../src/integration/spatialDiagnosticScenario.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';

const phase = (id: string) => spatialDiagnosticPhases.find((item) => item.id === id)!;
const positionsFor = (eventId: string) => {
  const item = spatialDiagnosticPhases.flatMap((value) => value.events).find((event) => event.id === eventId)!;
  return item.trajectory.map((waypoint) => spatialDiagnosticSceneGraph.nodes.find((node) => node.id === waypoint.locationId)!.worldPosition);
};

describe('spatial event HRTF diagnostic scenario', () => {
  it('validates every plan, semantic control point, and asset ID', () => {
    const graph = new SceneGraph(spatialDiagnosticSceneGraph), validator = new PlanValidator(graph), assets = new Set(forestDemoAssetIds);
    for (const plan of spatialDiagnosticPlans) {
      expect(validator.validate(plan)).toMatchObject({ valid:true });
      expect(plan.soundscape.event.every((event) => assets.has(event.assetId) && event.trajectory.every((point) => graph.hasNode(point.locationId)))).toBe(true);
    }
  });

  it('exercises all axes, a full orbit, elevation, and combined 3D motion', () => {
    const values = Object.values(spatialDiagnosticPositions);
    expect(values.some(([x]) => x !== 0)).toBe(true); expect(values.some(([,y]) => y !== 0)).toBe(true); expect(values.some(([, ,z]) => z !== 0)).toBe(true);
    const orbit = positionsFor('horizontal-orbit'); expect(orbit[0]).toEqual(orbit.at(-1)); expect(orbit.some(([x]) => x > 0) && orbit.some(([x]) => x < 0) && orbit.some(([, ,z]) => z > 0) && orbit.some(([, ,z]) => z < 0)).toBe(true);
    const spiral = positionsFor('three-dimensional-spiral'); expect(new Set(spiral.map(([,y]) => y)).size).toBeGreaterThan(2); expect(new Set(spiral.map(([x,,z]) => Math.hypot(x,z).toFixed(2))).size).toBeGreaterThan(1); expect(spiral.some(([x]) => x > 0) && spiral.some(([x]) => x < 0) && spiral.some(([, ,z]) => z > 0) && spiral.some(([, ,z]) => z < 0)).toBe(true);
  });

  it('contains opposing simultaneous sources and completes with event cleanup', () => {
    expect(phase('opposing-sources').events).toHaveLength(2); expect(new Set(phase('opposing-sources').events.map((event) => event.assetId)).size).toBe(2);
    const store = createRuntimeStore(), timers: IntervalApi = { set:() => 1, clear:() => undefined }, harness = new IntegrationHarness(store,'spatial-diagnostic-test',timers,spatialDiagnosticIntegrationScenario); let maximumActive = 0;
    harness.start(); while (harness.getState().status !== 'ended') { harness.tick(100); maximumActive = Math.max(maximumActive,store.getState().runtimeWorldState?.event.filter((event) => event.active).length ?? 0); }
    expect(harness.getState().timestampMs).toBe(SPATIAL_DIAGNOSTIC_DURATION_MS); expect(maximumActive).toBeGreaterThanOrEqual(2); expect(maximumActive).toBeLessThanOrEqual(3); expect(store.getState().runtimeWorldState?.event).toHaveLength(0);
  });
});
