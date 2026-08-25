import { describe, expect, it } from 'vitest';
import {
  assignSharedBasePlan,
  createForestBasePlan,
  measureBasePlan,
  materializeBasePlan,
  normalizeLegacyPlanPatch,
  phase1Config,
  validateAndProjectPatch,
  type FutureScenePatch,
  type SoundscapePlanPatch,
} from '../src/index.js';

describe('shared Base Plan and future patching', () => {
  const a = createForestBasePlan(phase1Config);
  it('provides one complete restrained ambient-and-bird Base Plan', () => {
    expect(measureBasePlan(a)).toMatchObject({
      durationMs: 600_000,
      ambientCount: 1,
      eventCount: 2,
      bodyAnchorCount: 0,
    });
    expect(a.scheduledElements.map((item) => item.assetId)).toEqual([
      'forest_ambient_bed_01',
      'forest_bird_far_01',
      'forest_bird_far_02',
    ]);
  });
  it('assigns the same plan to both experimental conditions', () => {
    const assignment = assignSharedBasePlan('P002');
    expect(assignment.basePlanId).toBe('forest_base');
    expect(assignment.assignmentRuleVersion).toBe('shared_base_v1');
  });
  const patch = (
    operation: FutureScenePatch['operations'][number],
  ): FutureScenePatch => ({
    adaptationId: 'adapt-1',
    status: 'PATCH_PROPOSED',
    intent: 'reduce_stimulation',
    salience: 'low',
    operations: [operation],
    preservedElementIds: ['base-ambient'],
    hypothesis: {
      mechanismCode: 'REDUCE_FOREGROUND',
      expectedResponseCode: 'REDUCE_VARIABILITY_OR_HALT_DECLINE',
      failureSignalCode: 'CONTINUED_DECLINE_WITH_VALID_SIGNAL',
    },
    priorAdaptationIds: [],
    lessonCode: null,
    lessonConfidence: 'unavailable',
    reasonCodes: ['MINIMAL_SUFFICIENT_PATCH'],
  });
  it.each(['ADJUST', 'RESCHEDULE', 'REPLACE', 'SUPPRESS'] as const)(
    'accepts future %s without touching the freeze buffer',
    (kind) => {
      const target = a.scheduledElements.find(
        (e) => e.elementId === 'base-bird-early',
      )!;
      const operation = {
        operation: kind,
        targetElementId: target.elementId,
        effectiveStartMs: 155_000,
        transitionMs: 5_000,
        ...(kind === 'ADJUST' ? { gain: 0.12 } : {}),
        ...(kind === 'REPLACE'
          ? { replacementAssetId: 'forest_bird_far_02' }
          : {}),
      };
      expect(
        validateAndProjectPatch({
          basePlan: a,
          acceptedPatches: [],
          proposedPatch: patch(operation),
          nowMs: 60_000,
          config: phase1Config,
        }).valid,
      ).toBe(true);
    },
  );
  it('rejects immutable history/freeze-buffer operations and non-minimal INSERT', () => {
    const insertedElement = structuredClone(a.scheduledElements[1]!);
    insertedElement.elementId = 'inserted';
    insertedElement.startMs = 210_000;
    insertedElement.endMs = 218_000;
    const result = validateAndProjectPatch({
      basePlan: a,
      acceptedPatches: [],
      proposedPatch: patch({
        operation: 'INSERT',
        effectiveStartMs: 210_000,
        transitionMs: 3_000,
        insertedElement,
      }),
      nowMs: 200_000,
      config: phase1Config,
    });
    expect(result.valid).toBe(false);
    expect(result.violations).toContain('operation_inside_freeze_buffer');
    expect(result.violations).toContain('insert_not_minimal');
  });
  it('treats NO_SAFE_PATCH as a safe Base Plan continuation', () => {
    const noSafe = {
      ...patch({
        operation: 'KEEP',
        targetElementId: 'base-ambient',
        effectiveStartMs: 220_000,
        transitionMs: 0,
      }),
      status: 'NO_SAFE_PATCH' as const,
      operations: [],
    };
    expect(
      validateAndProjectPatch({
        basePlan: a,
        acceptedPatches: [],
        proposedPatch: noSafe,
        nowMs: 200_000,
        config: phase1Config,
      }).valid,
    ).toBe(true);
  });
  it('materializes ADJUST into the runtime payload rather than metadata only', () => {
    const result = validateAndProjectPatch({
      basePlan: a,
      acceptedPatches: [],
      proposedPatch: patch({
        operation: 'ADJUST',
        targetElementId: 'base-bird-early',
        effectiveStartMs: 155_000,
        transitionMs: 5_000,
        gain: 0.12,
      }),
      nowMs: 60_000,
      config: phase1Config,
    });
    const element = result.projectedPlan?.scheduledElements.find(
      (item) => item.elementId === 'base-bird-early',
    );
    expect(element?.gain).toBe(0.12);
    expect((element?.payload as { gain: number }).gain).toBe(0.12);
  });

  it('omits schema-required null locationId from inserted global ambient', () => {
    const futurePatch = normalizeLegacyPlanPatch({
      adaptationId: 'adapt-global-ambient',
      patch: {
        reasoningSummary: 'Add a quiet stream bed.',
        upsertAmbient: [
          {
            id: 'adapt-stream',
            assetId: 'forest_stream_ambient_bed_01',
            mode: 'global',
            locationId: null,
            gain: 0.58,
            active: true,
          },
        ],
        transitionDurationMs: 4_000,
      } as unknown as SoundscapePlanPatch,
      decision: {
        decision: 'adapt',
        intent: 'support_sustained_focus',
        salience: 'minimal',
        evidenceSummary: {
          position: 'focus-leaning',
          trajectory: 'stable',
          confidence: 'low',
        },
        reason: 'stasis pressure',
        maintainReason: null,
        constraintsForDecision2: [],
        shouldAdapt: true,
        goal: 'support-sustained-focus',
        scope: 'within-scene',
        rationale: 'test',
        provider: 'test',
      },
      basePlan: a,
      nowMs: 220_000,
      freezeBufferMs: phase1Config.executionFreezeBufferMs,
    });
    const validation = validateAndProjectPatch({
      basePlan: a,
      acceptedPatches: [],
      proposedPatch: futurePatch,
      nowMs: 220_000,
      config: phase1Config,
    });
    expect(validation.valid).toBe(true);
    const runtimePlan = materializeBasePlan(validation.projectedPlan!);
    const stream = runtimePlan.soundscape.ambient.find(
      (item) => item.id === 'adapt-stream',
    );
    expect(stream).not.toHaveProperty('locationId');
  });
});
