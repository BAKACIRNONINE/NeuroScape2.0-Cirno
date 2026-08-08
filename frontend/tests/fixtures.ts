import type { NeuroState, RuntimeWorldState, SceneJourneyPlan } from '@neuroscape/contracts';

export const snapshot = (timestampMs = 100): RuntimeWorldState => ({
  timestampMs,
  listener: { worldPosition: [1, 2, 3], orientation: [0, 0, 0, 1], velocity: [0, 0, 0], semanticLocation: 'clearing' },
  journey: { plannedPath: [[0, 0, 0], [2, 0, -2]], currentSegmentIndex: 0, remainingWaypoints: [[2, 0, -2]] },
  ambient: [
    { id: 'wind', assetId: 'ambient.wind', mode: 'global', gain: 0.4, active: true },
    { id: 'water', assetId: 'ambient.water', mode: 'localized', worldPosition: [5, 0, -2], gain: 0.8, active: true },
  ],
  action: [{ id: 'breath', assetId: 'action.breath', attachment: 'chest', relativePosition: [0, -1, 0], worldPosition: [9, 8, 7], gain: 0.5, active: true }],
  event: [{ id: 'bird', assetId: 'event.bird', worldPosition: [-3, 4, -5], velocity: [1, 0, 0], gain: 0.6, lifecycle: 'active', active: true }],
});
export const neuroState = (timestampMs = 100): NeuroState => ({ timestampMs, attention: { value: .72, trend: 'increasing' }, arousal: { value: .41, trend: 'stable' }, stability: .81, confidence: .92, historySummary: 'Arousal remained stable.' });
export const journeyPlan = (): SceneJourneyPlan => ({ planId: 'plan-1', planningHorizonSec: 120, reasoningSummary: 'Move gradually toward running water.', userJourney: { goal: 'Support sustained calm', waypoints: [{ locationId: 'clearing' }, { locationId: 'stream-bank' }] }, soundscape: { ambient: [], action: [], event: [] }, transitionPolicy: { defaultDurationMs: 4000, curve: 'smoothstep' } });
