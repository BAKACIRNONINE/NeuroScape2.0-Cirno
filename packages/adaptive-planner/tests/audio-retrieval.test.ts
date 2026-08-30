import { describe, expect, it } from 'vitest';
import {
  createForestBasePlan,
  materializeBasePlan,
  phase1Config,
  prepareDecision2Input,
  destinationFoundationAssetIds,
  validateDecision2Selection,
} from '../src/index.js';
import type {
  AdaptationDecision,
  DecisionContext,
  PlanningResult,
} from '../src/index.js';

function context(): DecisionContext {
  const basePlan = createForestBasePlan(phase1Config);
  return {
    state: {
      timestampMs: 180_000,
      phase: 'adaptive',
      currentLogTbr: 1,
      baselineLogTbr: 1,
      baselineMad: 0.1,
      baselineScale: 0.1,
      effectiveBaselineScale: 0.1,
      measurementConfidence: 'high',
      signalQuality: 'good',
      deltaFromBaseline: 0,
      tbrRatioToBaseline: 1,
      tbrPercentChange: 0,
      robustDeltaFromBaseline: 0,
      baselineRelation: 'baseline-consistent',
      robustDeltaPrevious: 0,
      robustDeltaSlope: 0,
      trajectory: 'stable',
      stateEstimationVersion: 'guided_baseline_delta_v1',
      trend: 'stable',
      variabilityMad: 0.01,
      sustainedElevatedWindows: 0,
      sustainedReducedWindows: 0,
      confidence: 0.9,
      validEpochCount: 6,
    },
    profile: {
      profileId: 'p',
      baselineLogTbr: 1,
      baselineMad: 0.1,
      baselineScale: 0.1,
      effectiveBaselineScale: 0.1,
      expectedEpochCount: 30,
      validEpochCount: 30,
      invalidEpochCount: 0,
      baselineAvailable: true,
      qualityStatus: 'pass',
      qualityIssues: [],
      selfReportedFocus: null,
      selfReportedDrowsiness: null,
      featureVersion: 'v',
    },
    recentStates: [],
    currentPlan: materializeBasePlan(basePlan),
    basePlan,
    history: [],
    restrictions: {
      allowEvent: true,
      allowBodyAnchor: true,
      allowSceneTransition: true,
      sceneTransitionsRemaining: 2,
    },
    secondsSinceLastMeaningfulChange: 100,
    stasisPressure: true,
    transitionInProgress: false,
    secondsSinceLastSpatialProgression: 180,
    progressionPressure: 'medium',
  };
}

const decision = (scope: AdaptationDecision['scope']): AdaptationDecision => ({
  decision: 'adapt',
  intent: 'refresh_engagement',
  salience: 'low',
  adaptationBasis: 'progression_driven',
  evidenceSummary: {
    relation: 'baseline-consistent',
    trajectory: 'stable',
    confidence: 'high',
  },
  reason: 'progress',
  maintainReason: null,
  constraintsForDecision2: [],
  shouldAdapt: true,
  goal: 'refresh-engagement',
  scope,
  rationale: 'progress',
  provider: 'test',
});

describe('semantic graph Decision 2 retrieval', () => {
  it('uses compact semantic cards and no numeric semantic ranking', () => {
    const input = prepareDecision2Input(
      context(),
      decision('within-scene'),
      phase1Config,
    );
    expect(input.promptVersion).toBe('decision-2-semantic-scene-graph-v10');
    expect(
      input.semanticCandidates?.some((x) => x.assetId === 'forest_bird_far_01'),
    ).toBe(true);
    expect(
      input.semanticCandidates?.some((x) => x.assetId === 'ocean_waves'),
    ).toBe(false);
    expect(input.retrievalAudit).toEqual([]);
    expect(input.prompt).not.toContain('selectionWeight');
    expect(input.prompt).toContain('prefer perceptual and semantic variation');
    expect(input.operationGuidance.preferredOperations).toEqual([]);
    expect(JSON.stringify(input.outputSchema)).not.toContain('uniqueItems');
  });

  it('uses graph locality and exposes all adjacent transition coverage', () => {
    const local = prepareDecision2Input(
      context(),
      decision('within-scene'),
      phase1Config,
    );
    expect(local.retrievedCandidateIds).toContain('body_slow_breath_01');
    expect(local.retrievedCandidateIds).not.toContain('citypark_dog');
    const transition = prepareDecision2Input(
      context(),
      decision('scene-transition'),
      phase1Config,
    );
    expect(transition.reachableNodeIds).toEqual(
      expect.arrayContaining(['dense_forest', 'stream_bank', 'forest_edge']),
    );
    expect(transition.retrievedCandidateIds).toContain(
      'forest_water_drop_far_01',
    );
    expect(transition.excludedCandidates).toContainEqual({
      assetId: 'forest_stream_ambient_bed_01',
      reason: 'no_technical_record',
    });
    expect(destinationFoundationAssetIds('stream_bank')).toContain(
      'stream_lakeside_river',
    );
    expect(destinationFoundationAssetIds('waterfall_vicinity')).toEqual([]);
  });

  it('rejects a non-adjacent destination', () => {
    const input = prepareDecision2Input(
      context(),
      decision('scene-transition'),
      phase1Config,
    );
    const result: PlanningResult = {
      patch: { reasoningSummary: 'semantic' },
      semanticOutput: {
        status: 'CHANGE_PROPOSED',
        destinationNodeId: 'beach_shore',
        changes: [],
        selectedAssetIds: ['forest_bird_far_01'],
        reasonCodes: [],
        rationale: 'test',
      },
      selectedAssetIds: ['forest_bird_far_01'],
      candidateAssetIds: input.retrievedCandidateIds,
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      outputSchema: input.outputSchema,
      rationale: 'test',
      provider: 'test',
    };
    expect(() => validateDecision2Selection(result, input)).toThrow(
      'not graph-adjacent',
    );
  });
});
