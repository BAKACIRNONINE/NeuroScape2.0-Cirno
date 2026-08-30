import { describe, expect, it } from 'vitest';
import {
  createForestBasePlan,
  materializeBasePlan,
  materializeSemanticDecision2,
  footstepAssetForTransition,
  phase1Config,
  SCENE_TRAVERSAL_DURATION_MS,
  validateAndProjectPatch,
} from '../src/index.js';
import type {
  AdaptationDecision,
  Decision2SemanticOutput,
} from '../src/index.js';

const decision = (
  scope: 'within-scene' | 'scene-transition',
): AdaptationDecision => ({
  decision: 'adapt',
  intent: 'refresh_engagement',
  salience: 'low',
  adaptationBasis: 'progression_driven',
  evidenceSummary: {
    relation: 'baseline-consistent',
    trajectory: 'stable',
    confidence: 'high',
  },
  reason: 'test',
  maintainReason: null,
  constraintsForDecision2: [],
  shouldAdapt: true,
  goal: 'refresh-engagement',
  scope,
  rationale: 'test',
  provider: 'test',
});

describe('semantic Decision 2 materializer', () => {
  it('resolves authored playback/gain and commits a canonical adjacent journey projection', () => {
    const basePlan = createForestBasePlan(phase1Config);
    const output: Decision2SemanticOutput = {
      status: 'CHANGE_PROPOSED',
      destinationNodeId: 'stream_bank',
      changes: [
        {
          operation: 'INSERT',
          assetId: 'stream_lakeside_river',
          targetElementId: null,
          semanticRole: 'foundation',
          mixIntent: 'slightly_softer',
        },
      ],
      selectedAssetIds: ['stream_lakeside_river'],
      reasonCodes: ['COHERENT_WATER_TRANSITION'],
      rationale: 'test',
    };
    const patch = materializeSemanticDecision2({
      adaptationId: 'a1',
      output,
      decision: decision('scene-transition'),
      basePlan,
      nowMs: 200_000,
      config: phase1Config,
    });
    expect(patch.journeyUpdate).toMatchObject({
      fromNodeId: 'forest_clearing',
      toNodeId: 'stream_bank',
    });
    const inserted = patch.operations[0]?.insertedElement;
    expect(inserted?.payload.playback).toBeDefined();
    expect(inserted?.gain).toBe(0.255);
    const locomotion = patch.operations.find(
      (operation) => operation.systemGenerated === 'scene_transition_footsteps',
    );
    expect(locomotion?.insertedElement?.assetId).toBe(
      'forest_body_slow_creek_steps_01',
    );
    expect(locomotion?.insertedElement?.payload).toMatchObject({
      attachment: 'feet',
      activationCondition: 'listener-moving',
    });
    expect(
      locomotion!.insertedElement!.endMs -
        locomotion!.insertedElement!.startMs,
    ).toBe(SCENE_TRAVERSAL_DURATION_MS);
    expect(
      patch.journeyUpdate!.arrivalTimeMs -
        (200_000 + phase1Config.executionFreezeBufferMs),
    ).toBe(SCENE_TRAVERSAL_DURATION_MS);

    expect(
      patch.operations
        .filter((operation) => !operation.systemGenerated)
        .every(
          (operation) =>
            operation.transitionMs ===
            basePlan.transitionPolicy.defaultDurationMs,
        ),
    ).toBe(true);
    const validation = validateAndProjectPatch({
      basePlan,
      acceptedPatches: [],
      proposedPatch: patch,
      nowMs: 200_000,
      config: phase1Config,
    });
    expect(validation.valid).toBe(true);
    const foundation = validation.projectedPlan?.scheduledElements.find(
      (element) => element.assetId === 'stream_lakeside_river',
    );
    expect(
      foundation!.endMs - patch.journeyUpdate!.arrivalTimeMs,
    ).toBeGreaterThanOrEqual(phase1Config.destinationStabilizationMinMs);
    expect(
      materializeBasePlan(validation.projectedPlan!).userJourney.waypoints.at(
        -1,
      )?.locationId,
    ).toBe('stream_bank');
  });

  it('selects authored footsteps for forest, city, water, and beach surfaces', () => {
    expect(footstepAssetForTransition('forest_clearing', 'dense_forest')).toBe(
      'forest_grass_footstep_01',
    );
    expect(footstepAssetForTransition('forest_edge', 'city_park')).toBe(
      'citypark_walk_on_the_street',
    );
    expect(footstepAssetForTransition('forest_edge', 'beach_shore')).toBe(
      'ocean_wet_sand_footstep_01',
    );
    expect(footstepAssetForTransition('stream_bank', 'lakeside_river')).toBe(
      'forest_body_slow_creek_steps_01',
    );
  });

  it('rejects locomotion from within-scene output and incoherent destination audio', () => {
    const basePlan = createForestBasePlan(phase1Config);
    const make = (
      scope: 'within-scene' | 'scene-transition',
      assetId: string,
    ) =>
      materializeSemanticDecision2({
        adaptationId: 'a2',
        decision: decision(scope),
        basePlan,
        nowMs: 200_000,
        config: phase1Config,
        output: {
          status: 'CHANGE_PROPOSED',
          destinationNodeId: 'stream_bank',
          changes: [
            {
              operation: 'INSERT',
              assetId,
              targetElementId: null,
              semanticRole: 'event',
              mixIntent: 'default',
            },
          ],
          selectedAssetIds: [assetId],
          reasonCodes: [],
          rationale: 'test',
        },
      });
    expect(make('within-scene', 'forest_bird_far_01').status).toBe(
      'NO_SAFE_PATCH',
    );
    expect(make('scene-transition', 'citypark_dog').reasonCodes).toContain(
      'SCENE_AUDIO_INCOHERENT',
    );
    expect(
      validateAndProjectPatch({
        basePlan,
        acceptedPatches: [],
        proposedPatch: make('scene-transition', 'forest_water_drop_far_01'),
        nowMs: 200_000,
        config: phase1Config,
      }).violations,
    ).toContain('DESTINATION_ACOUSTIC_FOUNDATION_MISSING');
  });
});
