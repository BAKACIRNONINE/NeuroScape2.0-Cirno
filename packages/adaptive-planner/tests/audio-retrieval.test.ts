import { describe, expect, it } from 'vitest';
import {
  DECISION_2_PROMPT_VERSION,
  initialForestPlan,
  phase1Config,
  prepareDecision2Input,
  validateDecision2Selection,
  retrieveDecision2Candidates,
} from '../src/index.js';
import type {
  AdaptationDecision,
  DecisionContext,
  PlanningResult,
} from '../src/index.js';

const context = (): DecisionContext => ({
  state: {
    timestampMs: 180_000,
    phase: 'adaptive',
    currentLogTbr: 1.7,
    focusPosition: 0.12,
    mindWanderingPosition: 0.88,
    unboundedMindWanderingPosition: 0.88,
    label: 'mind-wandering-leaning',
    trend: 'toward-mind-wandering',
    trendDeltaPerCheckpoint: 0.08,
    variabilityMad: 0.04,
    sustainedMindWanderingWindows: 3,
    confidence: 0.9,
    validEpochCount: 6,
  },
  recentStates: [],
  currentPlan: structuredClone(initialForestPlan),
  history: [],
  restrictions: {
    allowEvent: true,
    allowBodyAnchor: true,
    allowSceneTransition: true,
    sceneTransitionsRemaining: 2,
  },
});

const decision = (
  goal: AdaptationDecision['goal'],
  scope: AdaptationDecision['scope'] = 'within-scene',
): AdaptationDecision => ({
  shouldAdapt: true,
  goal,
  scope,
  rationale: 'test',
  provider: 'test',
});

describe('Decision 2 audio-library retrieval', () => {
  it('provides compatible authored event metadata and motion duration to the prompt', () => {
    const input = prepareDecision2Input(
      context(),
      decision('gently-reorient'),
      phase1Config,
    );
    expect(input.promptVersion).toBe(DECISION_2_PROMPT_VERSION);
    expect(input.retrievalAudit).toHaveLength(24);
    expect(input.currentScene).toBe('forest');
    expect(input.candidates.length).toBeGreaterThanOrEqual(3);
    expect(input.candidates.some((item) => item.layer === 'ambient')).toBe(
      true,
    );
    expect(input.candidates.some((item) => item.layer === 'event')).toBe(true);
    const bird = input.candidates.find(
      (item) => item.assetId === 'forest_bird_far_01',
    );
    expect(bird?.defaultMotion.durationSec).toBe(6);
    expect(bird?.autoDeleteAfterSec).toBe(8);
    expect(input.prompt).toContain('defaultMotion.durationSec');
    expect(input.prompt).toContain(
      'durationMs MUST equal defaultMotion.durationSec * 1000',
    );
    expect(input.prompt).toContain('forest_bird_far_01');
    expect(input.prompt).toContain('Use only assetId values in candidates');
    expect(input.prompt).toContain('reachableLocations');
    expect(input.prompt).not.toContain('"eegState"');
    expect(input.prompt).toContain('operationGuidance');
    expect(input.prompt).not.toContain(
      'Prefer KEEP, ADJUST, RESCHEDULE, REPLACE, or SUPPRESS before INSERT',
    );
    expect(input.prompt).toContain('restrained but perceptibly layered');
    expect(input.prompt).toContain(
      'gently-reorient: prioritize one perceptible event',
    );
    expect(input.prompt).toContain(
      'ambient-only changes should not satisfy this goal',
    );
    expect(input.outputSchema).toMatchObject({
      name: 'neuroscape_decision_2',
      strict: true,
      schema: { additionalProperties: false },
    });
    expect(JSON.stringify(input.outputSchema)).not.toContain('uniqueItems');
    const serializedSchema = JSON.stringify(input.outputSchema);
    expect(serializedSchema).toContain(
      '"assetId":{"type":"string","enum":["forest_bird_far_01"]}',
    );
    expect(serializedSchema).toContain(
      '"durationMs":{"type":"number","enum":[6000]}',
    );
    expect(serializedSchema).toContain(
      '"gain":{"type":"number","minimum":0,"maximum":0.24}',
    );
  });

  it('offers ambient plus action candidates for grounding', () => {
    const input = prepareDecision2Input(
      context(),
      decision('support-grounding'),
      phase1Config,
    );
    expect(input.candidates.some((item) => item.layer === 'ambient')).toBe(
      true,
    );
    expect(input.candidates.some((item) => item.layer === 'action')).toBe(true);
    expect(input.candidates.some((item) => item.layer === 'event')).toBe(true);
    expect(input.prompt).toContain(
      'support-grounding: prioritize one body-anchored action',
    );
  });

  it('keeps recently used bird variants available with a soft penalty', () => {
    const value = context();
    value.history.push({
      adaptationId: 'adapt-heard-bird',
      timestampMs: 150_000,
      experiencedAtMs: 150_000,
      goal: 'gently-reorient',
      scope: 'within-scene',
      assetIds: ['forest_bird_far_01'],
      rationale: 'test',
    });
    const input = prepareDecision2Input(
      value,
      decision('gently-reorient'),
      phase1Config,
    );
    expect(
      input.candidates.some((item) => item.assetId.startsWith('forest_bird')),
    ).toBe(true);
    expect(
      input.retrievalAudit.find(
        (item) => item.assetId === 'forest_bird_far_01',
      )?.recencyPenalty,
    ).toBeGreaterThan(0);
  });

  it('ranks bird 02 above bird 01 and enforces its exclusive session contract', () => {
    const value = context();
    const initial = retrieveDecision2Candidates(
      value,
      decision('gently-reorient'),
      { ...phase1Config, exactAssetCooldownMs: 0, assetFamilyCooldownMs: 0 },
    ).candidates.filter((item) => item.assetId.startsWith('forest_bird_far'));
    expect(initial.map((item) => item.assetId).slice(0, 2)).toEqual([
      'forest_bird_far_02',
      'forest_bird_far_01',
    ]);
    value.state.timestampMs = 180_000;
    value.history.push({
      adaptationId: 'adapt-heard-bird-02',
      timestampMs: 120_000,
      experiencedAtMs: 120_000,
      goal: 'gently-reorient',
      scope: 'within-scene',
      assetIds: ['forest_bird_far_02'],
      rationale: 'exactly sixty seconds ago',
    });
    expect(
      retrieveDecision2Candidates(value, decision('gently-reorient'), {
        ...phase1Config,
        exactAssetCooldownMs: 0,
        assetFamilyCooldownMs: 0,
      }).candidates.some((item) => item.assetId === 'forest_bird_far_02'),
    ).toBe(false);
    value.state.timestampMs = 180_001;
    expect(
      retrieveDecision2Candidates(value, decision('gently-reorient'), {
        ...phase1Config,
        exactAssetCooldownMs: 0,
        assetFamilyCooldownMs: 0,
      }).candidates.some((item) => item.assetId === 'forest_bird_far_02'),
    ).toBe(true);
  });

  it('exposes the active ambient as a modification target, not an INSERT candidate', () => {
    const input = prepareDecision2Input(
      context(),
      decision('support-sustained-focus'),
      phase1Config,
    );
    expect(
      input.candidates.find(
        (item) => item.assetId === 'forest_ambient_bed_01',
      ),
    ).toMatchObject({
      currentlyActive: true,
      activeElementId: 'forest-bed',
      currentLayer: 'ambient',
      allowedOperations: ['ADJUST', 'REPLACE', 'SUPPRESS'],
    });
  });

  it('accepts gain inside the authored safe range and rejects gain above it', () => {
    const input = prepareDecision2Input(
      context(),
      decision('gently-reorient'),
      phase1Config,
    );
    const bird = input.candidates.find(
      (item) => item.assetId === 'forest_bird_far_01',
    )!;
    const result = (gain: number): PlanningResult => ({
      patch: {
        reasoningSummary: 'safe variable gain',
        upsertEvent: [
          {
            id: 'gain-test',
            assetId: bird.assetId,
            activationTimeMs: 180_000,
            durationMs: 6_000,
            trajectory: [{ locationId: 'clearing', timestampMs: 180_000 }],
            gain,
          },
        ],
      },
      selectedAssetIds: [bird.assetId],
      candidateAssetIds: input.retrievedCandidateIds,
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      outputSchema: input.outputSchema,
      rationale: 'test',
      provider: 'test',
    });
    expect(() => validateDecision2Selection(result(0.12), input)).not.toThrow();
    expect(() => validateDecision2Selection(result(0.25), input)).toThrow(
      'safe range',
    );
  });

  it('uses only audio-started history for recency and exposes diversity context', () => {
    const value = context();
    value.history.push(
      {
        adaptationId: 'planned-only',
        timestampMs: 150_000,
        goal: 'gently-reorient',
        scope: 'within-scene',
        assetIds: ['forest_bird_far_01'],
        rationale: 'never heard',
        intent: 'gently_reorient_attention',
      },
      {
        adaptationId: 'heard',
        timestampMs: 100_000,
        experiencedAtMs: 100_000,
        goal: 'gently-reorient',
        scope: 'within-scene',
        assetIds: ['forest_leaf_rustle_mid_01'],
        rationale: 'heard by participant',
        intent: 'gently_reorient_attention',
      },
    );
    const input = prepareDecision2Input(
      value,
      decision('gently-reorient'),
      phase1Config,
    );
    expect(input.fullLibrarySize).toBe(24);
    expect(input.eligibleCandidateCount).toBeGreaterThanOrEqual(
      input.candidates.length,
    );
    expect(input.recentlyUsedAssets).toEqual([
      expect.objectContaining({
        assetId: 'forest_leaf_rustle_mid_01',
        lastPlayedMs: 100_000,
        useCount: 1,
        lastIntent: 'gently_reorient_attention',
      }),
    ]);
    expect(input.recentlyUsedAssets).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ assetId: 'forest_bird_far_01' }),
      ]),
    );
    expect(input.prompt).toContain('actual participant-experience history');
  });

  it('identifies body anchors from canonical action metadata and keeps reuse soft', () => {
    const value = context();
    value.history.push({
      adaptationId: 'heard-body-anchor',
      timestampMs: 100_000,
      experiencedAtMs: 50_000,
      goal: 'support-grounding',
      scope: 'within-scene',
      assetIds: ['body_slow_breath_01'],
      rationale: 'heard body anchor',
      intent: 'support_grounding',
    });
    const input = prepareDecision2Input(
      value,
      decision('support-grounding'),
      phase1Config,
    );
    expect(
      input.candidates.find((item) => item.assetId === 'body_slow_breath_01'),
    ).toMatchObject({ layer: 'action' });
    expect(
      input.retrievalAudit.find(
        (item) => item.assetId === 'body_slow_breath_01',
      )?.repetitionPenalty,
    ).toBeGreaterThan(0);
  });

  it('makes INSERT first-class only for low density', () => {
    const low = context();
    low.currentPlan.soundscape.ambient =
      low.currentPlan.soundscape.ambient.slice(0, 1);
    const lowInput = prepareDecision2Input(
      low,
      decision('gently-reorient'),
      phase1Config,
    );
    expect(lowInput.operationGuidance.currentDensity).toBe('low');
    expect(lowInput.operationGuidance.preferredOperations[0]).toBe('INSERT');
    const high = context();
    high.currentPlan.soundscape.action.push({
      id: 'breath',
      assetId: 'body_slow_breath_01',
      attachment: 'chest',
      relativePosition: [0, 0, 1],
      gain: 0.2,
      active: true,
    });
    const highInput = prepareDecision2Input(
      high,
      decision('gently-reorient'),
      phase1Config,
    );
    expect(highInput.operationGuidance.currentDensity).toBe('high');
    expect(highInput.operationGuidance.preferredOperations[0]).toBe('SUPPRESS');
  });

  it('rejects a planning result that invents an asset outside retrieval', () => {
    const input = prepareDecision2Input(
      context(),
      decision('support-grounding'),
      phase1Config,
    );
    const result: PlanningResult = {
      patch: { reasoningSummary: 'invalid' },
      selectedAssetIds: ['invented_asset'],
      candidateAssetIds: input.candidates.map((item) => item.assetId),
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      outputSchema: input.outputSchema,
      rationale: 'invalid',
      provider: 'test',
    };
    expect(() => validateDecision2Selection(result, input)).toThrow(
      'outside the retrieved candidate set',
    );
  });

  it('rejects duplicate selected asset IDs after structured output parsing', () => {
    const input = prepareDecision2Input(
      context(),
      decision('gently-reorient'),
      phase1Config,
    );
    const candidate = input.candidates.find((item) => item.layer === 'event')!;
    const result: PlanningResult = {
      patch: { reasoningSummary: 'invalid duplicate selection' },
      selectedAssetIds: [candidate.assetId, candidate.assetId],
      candidateAssetIds: input.candidates.map((item) => item.assetId),
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      outputSchema: input.outputSchema,
      rationale: 'invalid',
      provider: 'test',
    };
    expect(() => validateDecision2Selection(result, input)).toThrow(
      'selectedAssetIds must not contain duplicates',
    );
  });

  it('rejects an event lifecycle value when an authored motion duration exists', () => {
    const input = prepareDecision2Input(
      context(),
      decision('gently-reorient'),
      phase1Config,
    );
    const bird = input.candidates.find(
      (candidate) => candidate.assetId === 'forest_bird_far_01',
    )!;
    const result: PlanningResult = {
      patch: {
        reasoningSummary: 'invalid lifecycle duration',
        upsertEvent: [
          {
            id: 'bird-test',
            assetId: bird.assetId,
            activationTimeMs: 180_000,
            durationMs: 8_000,
            trajectory: [{ locationId: 'clearing', timestampMs: 180_000 }],
            gain: bird.recommendedVolume,
          },
        ],
      },
      selectedAssetIds: [bird.assetId],
      candidateAssetIds: input.candidates.map((item) => item.assetId),
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      outputSchema: input.outputSchema,
      rationale: 'invalid',
      provider: 'test',
    };
    expect(() => validateDecision2Selection(result, input)).toThrow(
      'authored event motion/lifecycle duration',
    );
  });

  it('rejects a candidate placed in the wrong layer or with invented gain', () => {
    const input = prepareDecision2Input(
      context(),
      decision('gently-reorient'),
      phase1Config,
    );
    const candidate = input.candidates.find((item) => item.layer === 'event')!;
    const result: PlanningResult = {
      patch: {
        reasoningSummary: 'invalid',
        upsertAmbient: [
          {
            id: 'wrong-layer',
            assetId: candidate.assetId,
            mode: 'global',
            gain: 0.99,
            active: true,
          },
        ],
      },
      selectedAssetIds: [candidate.assetId],
      candidateAssetIds: input.candidates.map((item) => item.assetId),
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      outputSchema: input.outputSchema,
      rationale: 'invalid',
      provider: 'test',
    };
    expect(() => validateDecision2Selection(result, input)).toThrow(
      'wrong sound layer',
    );
  });
});
