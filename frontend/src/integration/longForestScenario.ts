import type { NeuroState, SceneJourneyPlan } from '@neuroscape/contracts';
import { forestSceneGraph } from './canonicalForestScenario.js';

export const LONG_FOREST_DURATION_MS = 180_000;
export const longForestPlanTransitionTimesMs = [0, 30_000, 60_000, 90_000, 120_000, 150_000] as const;
export { forestSceneGraph as longForestSceneGraph };

const ambient = [
  { id: 'forest-bed', assetId: 'ambient.forest.light', mode: 'global' as const, gain: .42, active: true },
  { id: 'forest-wind', assetId: 'ambient.forest.wind', mode: 'localized' as const, locationId: 'clearing', gain: .24, active: true },
  { id: 'stream-anchor', assetId: 'ambient.stream.near', mode: 'localized' as const, locationId: 'stream_bank', gain: .52, active: true },
  { id: 'waterfall-anchor', assetId: 'ambient.waterfall', mode: 'localized' as const, locationId: 'waterfall', gain: .48, active: true },
];
const action = [
  { id: 'breathing', assetId: 'action.guided-breath', attachment: 'chest' as const, relativePosition: [0, -.25, -.12] as [number, number, number], gain: .28, active: true },
  { id: 'footsteps', assetId: 'action.footsteps', attachment: 'feet' as const, relativePosition: [0, -1.65, .1] as [number, number, number], gain: .18, active: true },
];
const policy = { defaultDurationMs: 2_500, curve: 'smoothstep' as const };
const plan = (planId: string, goal: string, waypoints: SceneJourneyPlan['userJourney']['waypoints'], event: SceneJourneyPlan['soundscape']['event'] = []): SceneJourneyPlan => ({
  planId, planningHorizonSec: 30, reasoningSummary: `Deterministic long validation: ${goal.toLowerCase()}.`,
  userJourney: { goal, waypoints }, soundscape: { ambient, action, event }, transitionPolicy: policy,
});

export const longForestPlans: readonly SceneJourneyPlan[] = [
  plan('long-forest-plan-1', 'Move gradually from the forest entry toward the clearing', [{ locationId: 'forest_entry' }, { locationId: 'clearing' }]),
  plan('long-forest-plan-2', 'Pause in the clearing while a distant bird crosses independently', [{ locationId: 'clearing', pauseDurationMs: 30_000 }], [{ id: 'long-bird-1', assetId: 'event.bird-pass', activationTimeMs: 36_000, durationMs: 14_000, trajectory: [{ locationId: 'forest_entry', timestampMs: 36_000 }, { locationId: 'clearing', timestampMs: 43_000 }, { locationId: 'stream_bank', timestampMs: 50_000 }], gain: .34 }]),
  plan('long-forest-plan-3', 'Approach the stream bank gradually with one subtle rustle', [{ locationId: 'clearing' }, { locationId: 'stream_bank' }], [{ id: 'long-rustle-1', assetId: 'event.leaves', activationTimeMs: 70_000, durationMs: 12_000, trajectory: [{ locationId: 'clearing', timestampMs: 70_000 }, { locationId: 'stream_bank', timestampMs: 82_000 }], gain: .22 }]),
  plan('long-forest-plan-4', 'Remain settled near the stream with low event density', [{ locationId: 'stream_bank', pauseDurationMs: 30_000 }]),
  plan('long-forest-plan-5', 'Move gradually from the stream toward the waterfall', [{ locationId: 'stream_bank' }, { locationId: 'waterfall' }], [{ id: 'long-bird-2', assetId: 'event.bird-pass', activationTimeMs: 132_000, durationMs: 12_000, trajectory: [{ locationId: 'stream_bank', timestampMs: 132_000 }, { locationId: 'waterfall', timestampMs: 144_000 }], gain: .28 }]),
  plan('long-forest-plan-6', 'Settle at the waterfall with continuous ambience and no new events', [{ locationId: 'waterfall', pauseDurationMs: 30_000 }]),
];

export const longForestNeuroStates: readonly NeuroState[] = Array.from({ length: 13 }, (_, index) => {
  const progress = index / 12;
  return {
    timestampMs: index * 15_000,
    attention: { value: .58 + .08 * Math.sin(progress * Math.PI), trend: index < 4 ? 'increasing' : index > 8 ? 'decreasing' : 'stable' },
    arousal: { value: .46 - .08 * progress, trend: index < 9 ? 'decreasing' : 'stable' },
    stability: .62 + .2 * progress,
    confidence: .9 + .05 * progress,
  } satisfies NeuroState;
});
