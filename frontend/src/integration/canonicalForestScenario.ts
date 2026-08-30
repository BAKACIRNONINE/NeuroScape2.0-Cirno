import type { NeuroState, SceneJourneyPlan } from '@neuroscape/contracts';
import type { SceneGraphDefinition } from '@neuroscape/runtime-scene-controller';

/** Deterministic development fixtures. These values simulate upstream Modules 01 and 02. */
export const forestSceneGraph: SceneGraphDefinition = {
  nodes: [
    {
      id: 'forest_entry',
      worldPosition: [0, 0, 0],
      neighbors: ['clearing'],
      ambientAssetIds: ['ambient.forest.light', 'ambient.forest.wind'],
      eventAssetIds: ['event.leaves'],
    },
    {
      id: 'clearing',
      worldPosition: [0, 0, -7],
      neighbors: ['forest_entry', 'stream_bank'],
      ambientAssetIds: ['ambient.forest.light', 'ambient.forest.wind'],
      eventAssetIds: ['event.bird-pass'],
    },
    {
      id: 'stream_bank',
      worldPosition: [2, 0, -14],
      neighbors: [
        'clearing',
        'waterfall',
        'forest_clearing',
        'waterfall_vicinity',
        'lakeside_river',
      ],
      ambientAssetIds: ['ambient.stream.near', 'stream_lakeside_river'],
      eventAssetIds: ['event.bird-pass', 'forest_water_drop_far_01'],
    },
    {
      id: 'waterfall',
      worldPosition: [7, 1, -20],
      neighbors: ['stream_bank'],
      ambientAssetIds: ['ambient.waterfall'],
      eventAssetIds: ['event.leaves'],
    },
    // Canonical semantic-journey v1 nodes. Legacy nodes above remain for the
    // deterministic Module 03 development scenarios.
    {
      id: 'forest_clearing',
      worldPosition: [0, 0, -7],
      neighbors: ['dense_forest', 'stream_bank', 'forest_edge'],
      ambientAssetIds: ['forest_ambient_bed_01', 'forest_wind_leaves_01'],
      eventAssetIds: [
        'forest_bird_far_01',
        'forest_bird_far_02',
        'forest_leaf_rustle_mid_01',
      ],
    },
    {
      id: 'dense_forest',
      worldPosition: [-5, 0, -12],
      neighbors: ['forest_clearing'],
      ambientAssetIds: ['forest_ambient_bed_02', 'forest_wind_leaves_01'],
      eventAssetIds: ['forest_soft_owl_far_01', 'forest_insect_chirp_far_01'],
    },
    {
      id: 'waterfall_vicinity',
      worldPosition: [7, 1, -20],
      neighbors: ['stream_bank'],
      ambientAssetIds: ['forest_ambient_bed_01'],
      eventAssetIds: ['forest_water_drop_far_01'],
    },
    {
      id: 'lakeside_river',
      worldPosition: [-3, 0, -20],
      neighbors: ['stream_bank'],
      ambientAssetIds: ['stream_lakeside_river'],
      eventAssetIds: ['forest_bird_far_01'],
    },
    {
      id: 'forest_edge',
      worldPosition: [6, 0, -10],
      neighbors: ['forest_clearing', 'city_park', 'beach_shore'],
      ambientAssetIds: ['forest_ambient_bed_01', 'forest_wind_leaves_01'],
      eventAssetIds: ['forest_bird_far_01'],
    },
    {
      id: 'city_park',
      worldPosition: [12, 0, -10],
      neighbors: ['forest_edge'],
      ambientAssetIds: ['citypark_light_street_ambience'],
      eventAssetIds: ['citypark_dog'],
    },
    {
      id: 'beach_shore',
      worldPosition: [12, 0, -18],
      neighbors: ['forest_edge'],
      ambientAssetIds: ['ocean_waves_soft_01', 'ocean_sea_breeze_01'],
      eventAssetIds: ['ocean_seagull_far_01', 'ocean_shorebird_far_01'],
    },
  ],
};

const ambience = (
  localizedId: 'ambient.stream.near' | 'ambient.waterfall',
  locationId: 'stream_bank' | 'waterfall',
) => [
  {
    id: 'forest-bed',
    assetId: 'ambient.forest.light',
    mode: 'global' as const,
    gain: 0.42,
    active: true,
  },
  {
    id: 'forest-wind',
    assetId: 'ambient.forest.wind',
    mode: 'localized' as const,
    locationId: 'clearing',
    gain: 0.26,
    active: true,
  },
  {
    id: 'water-anchor',
    assetId: localizedId,
    mode: 'localized' as const,
    locationId,
    gain: 0.58,
    active: true,
  },
];
const actions = [
  {
    id: 'breathing',
    assetId: 'action.guided-breath',
    attachment: 'chest' as const,
    relativePosition: [0, -0.25, -0.12] as [number, number, number],
    gain: 0.28,
    active: true,
  },
  {
    id: 'footsteps',
    assetId: 'action.footsteps',
    attachment: 'feet' as const,
    relativePosition: [0, -1.65, 0.1] as [number, number, number],
    gain: 0.2,
    active: true,
  },
];
export const forestPlans: readonly SceneJourneyPlan[] = [
  {
    planId: 'forest-plan-1',
    planningHorizonSec: 8,
    reasoningSummary:
      'Simulated planner output: begin quietly and move toward the clearing with low event density.',
    userJourney: {
      goal: 'Establish a grounded forest entry',
      waypoints: [
        { locationId: 'forest_entry', arrivalTimeMs: 0 },
        { locationId: 'clearing', arrivalTimeMs: 8000, pauseDurationMs: 1000 },
      ],
    },
    soundscape: {
      ambient: ambience('ambient.stream.near', 'stream_bank'),
      action: actions,
      event: [],
    },
    transitionPolicy: { defaultDurationMs: 1200, curve: 'smoothstep' },
  },
  {
    planId: 'forest-plan-2',
    planningHorizonSec: 9,
    reasoningSummary:
      'Simulated planner output: maintain grounding ambience and introduce one sparse directional bird event.',
    userJourney: {
      goal: 'Continue toward the stream bank',
      waypoints: [
        { locationId: 'clearing', pauseDurationMs: 1000 },
        { locationId: 'stream_bank' },
      ],
    },
    soundscape: {
      ambient: ambience('ambient.stream.near', 'stream_bank'),
      action: actions,
      event: [
        {
          id: 'bird-crossing',
          assetId: 'event.bird-pass',
          activationTimeMs: 11000,
          durationMs: 5500,
          trajectory: [
            { locationId: 'clearing', timestampMs: 11000 },
            { locationId: 'stream_bank', timestampMs: 16000 },
          ],
          gain: 0.38,
        },
      ],
    },
    transitionPolicy: { defaultDurationMs: 1400, curve: 'smoothstep' },
  },
  {
    planId: 'forest-plan-3',
    planningHorizonSec: 7,
    reasoningSummary:
      'Simulated planner output: continue toward the waterfall, reduce event activity, and preserve the stable ambient layer.',
    userJourney: {
      goal: 'Complete the journey at the waterfall',
      waypoints: [
        { locationId: 'stream_bank', pauseDurationMs: 500 },
        { locationId: 'waterfall' },
      ],
    },
    soundscape: {
      ambient: ambience('ambient.waterfall', 'waterfall'),
      action: actions,
      event: [
        {
          id: 'leaves-drift',
          assetId: 'event.leaves',
          activationTimeMs: 20000,
          durationMs: 4500,
          trajectory: [
            { locationId: 'stream_bank', timestampMs: 20000 },
            { locationId: 'waterfall', timestampMs: 24000 },
          ],
          gain: 0.25,
        },
      ],
    },
    transitionPolicy: { defaultDurationMs: 1600, curve: 'smoothstep' },
  },
];
export const simulatedNeuroStates: readonly NeuroState[] = [
  {
    timestampMs: 0,
    arousal: { value: 0.46, trend: 'stable' },
    confidence: 0.9,
  },
  {
    timestampMs: 6000,
    arousal: { value: 0.43, trend: 'decreasing' },
    confidence: 0.92,
  },
  {
    timestampMs: 12000,
    arousal: { value: 0.41, trend: 'stable' },
    confidence: 0.93,
  },
  {
    timestampMs: 18000,
    arousal: { value: 0.39, trend: 'decreasing' },
    confidence: 0.94,
  },
  {
    timestampMs: 24000,
    arousal: { value: 0.38, trend: 'stable' },
    confidence: 0.95,
  },
];
