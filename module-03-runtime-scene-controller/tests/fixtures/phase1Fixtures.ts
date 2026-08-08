import type { SceneJourneyPlan } from '@neuroscape/contracts';
import type { SceneGraphDefinition } from '../../src/scene-graph/SceneGraph.js';

export const sceneGraphDefinitionFixture: SceneGraphDefinition = {
  nodes: [
    {
      id: 'forest_entry',
      worldPosition: [0, 0, 0],
      neighbors: ['clearing'],
      ambientAssetIds: ['ambient.forest-wind'],
      eventAssetIds: ['event.leaves'],
    },
    {
      id: 'clearing',
      worldPosition: [0, 0, -6],
      neighbors: ['forest_entry', 'stream_bank'],
      ambientAssetIds: ['ambient.forest-wind'],
      eventAssetIds: ['event.bird'],
    },
    {
      id: 'stream_bank',
      worldPosition: [0, 0, -12],
      neighbors: ['clearing'],
      ambientAssetIds: ['ambient.stream'],
      eventAssetIds: ['event.bird', 'event.frog'],
    },
  ],
};

export const sceneJourneyPlanFixture: SceneJourneyPlan = {
  planId: 'plan-001',
  planningHorizonSec: 30,
  reasoningSummary: 'Move gradually toward the stream to support grounding.',
  userJourney: {
    goal: 'increase grounding',
    waypoints: [
      { locationId: 'forest_entry', arrivalTimeMs: 0 },
      { locationId: 'clearing', arrivalTimeMs: 10_000 },
      { locationId: 'stream_bank', arrivalTimeMs: 20_000, pauseDurationMs: 2_000 },
    ],
  },
  soundscape: {
    ambient: [
      {
        id: 'forest-bed',
        assetId: 'ambient.forest-wind',
        mode: 'global',
        gain: 0.4,
        active: true,
      },
      {
        id: 'stream-anchor',
        assetId: 'ambient.stream',
        mode: 'localized',
        locationId: 'stream_bank',
        gain: 0.5,
        active: true,
      },
    ],
    action: [
      {
        id: 'breathing',
        assetId: 'action.breathing',
        attachment: 'chest',
        relativePosition: [0, -0.2, -0.1],
        gain: 0.25,
        active: true,
      },
    ],
    event: [
      {
        id: 'bird-001',
        assetId: 'event.bird',
        activationTimeMs: 5_000,
        durationMs: 4_000,
        trajectory: [
          { locationId: 'clearing', timestampMs: 5_000 },
          { locationId: 'stream_bank', timestampMs: 9_000 },
        ],
        gain: 0.35,
      },
    ],
  },
  transitionPolicy: {
    defaultDurationMs: 2_000,
    curve: 'smoothstep',
  },
};
