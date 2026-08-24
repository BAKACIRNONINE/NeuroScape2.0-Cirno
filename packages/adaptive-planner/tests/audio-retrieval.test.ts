import { describe, expect, it } from 'vitest';
import {
  DECISION_2_PROMPT_VERSION,
  initialForestPlan,
  phase1Config,
  prepareDecision2Input,
  validateDecision2Selection,
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
    expect(input.currentScene).toBe('forest');
    expect(input.candidates.length).toBeGreaterThanOrEqual(3);
    expect(input.candidates.every((item) => item.layer === 'event')).toBe(true);
    const bird = input.candidates.find(
      (item) => item.assetId === 'forest_bird_far_01',
    );
    expect(bird?.defaultMotion.durationSec).toBe(6);
    expect(bird?.autoDeleteAfterSec).toBe(8);
    expect(input.prompt).toContain('defaultMotion.durationSec');
    expect(input.prompt).toContain('forest_bird_far_01');
    expect(input.prompt).toContain('Use only assetId values in candidates');
    expect(input.prompt).toContain('listenerReachableLocations');
    expect(input.outputSchema).toMatchObject({
      name: 'neuroscape_decision_2',
      strict: true,
      schema: { additionalProperties: false },
    });
  });

  it('uses family cooldown to withhold all recently used bird variants', () => {
    const value = context();
    value.history.push({
      timestampMs: 150_000,
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
    ).toBe(false);
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
});
