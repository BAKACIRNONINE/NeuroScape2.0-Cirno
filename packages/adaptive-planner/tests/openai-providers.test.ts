import { describe, expect, it } from 'vitest';
import {
  DECISION_1_PROMPT_VERSION,
  OpenAIDecisionProvider,
  OpenAIPlanningProvider,
  initialForestPlan,
  phase1Config,
  prepareDecision2Input,
} from '../src/index.js';
import type {
  AdaptationDecision,
  DecisionContext,
  LlmUsage,
} from '../src/index.js';

const usage: LlmUsage = {
  inputTokens: 100,
  outputTokens: 20,
  totalTokens: 120,
  reasoningTokens: 5,
};

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

function jsonResponse(output: unknown): Response {
  return new Response(
    JSON.stringify({
      output,
      model: 'gpt-5.6-2026-08-01',
      responseId: 'resp_test',
      usage,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('OpenAI planner providers', () => {
  it('sends the versioned Decision 1 prompt and records API metadata', async () => {
    let requestBody: Record<string, unknown> | undefined;
    const provider = new OpenAIDecisionProvider({
      sessionId: 'session-test',
      fetchImpl: async (_input, init) => {
        requestBody = JSON.parse(String(init?.body));
        return jsonResponse({
          shouldAdapt: true,
          goal: 'gently-reorient',
          scope: 'within-scene',
          rationale: 'A sustained decline warrants one sparse event.',
        });
      },
    });
    const result = await provider.decide(context());
    expect(requestBody).toMatchObject({
      promptVersion: DECISION_1_PROMPT_VERSION,
      sessionId: 'session-test',
    });
    expect(String(requestBody?.prompt)).toContain(
      'Eligibility does not itself mean an adaptation is necessary',
    );
    expect(String(requestBody?.prompt)).toContain(
      'do not maintain merely because the state is intermediate',
    );
    expect(String(requestBody?.prompt)).toContain(
      'high-confidence mind-wandering-leaning attention, normally adapt',
    );
    expect(result.provider).toBe('openai-responses');
    expect(result.model).toBe('gpt-5.6-2026-08-01');
    expect(result.usage?.totalTokens).toBe(120);
  });

  it('sends Decision 2 candidates/schema and normalizes the structured patch', async () => {
    const value = context();
    const decision: AdaptationDecision = {
      shouldAdapt: true,
      goal: 'gently-reorient',
      scope: 'within-scene',
      rationale: 'test',
      provider: 'test',
    };
    const input = prepareDecision2Input(value, decision, phase1Config);
    const candidate = input.candidates[0]!;
    const provider = new OpenAIPlanningProvider({
      fetchImpl: async () =>
        jsonResponse({
          patch: {
            reasoningSummary: 'Use one compatible event.',
            journey: null,
            upsertAmbient: [],
            upsertAction: [],
            upsertEvent: [
              {
                id: 'event-180000',
                assetId: candidate.assetId,
                activationTimeMs: 182_000,
                durationMs:
                  (candidate.defaultMotion.durationSec ??
                    candidate.autoDeleteAfterSec ??
                    6) * 1_000,
                trajectory: [{ locationId: 'clearing', timestampMs: 182_000 }],
                gain: candidate.recommendedVolume,
              },
            ],
            removeIds: [],
            transitionDurationMs: 2_000,
          },
          selectedAssetIds: [candidate.assetId],
          rationale: 'Selected from the compatible forest event candidates.',
        }),
    });
    const result = await provider.plan(value, decision, input);
    expect(result.patch.journey).toBeUndefined();
    expect(result.patch.upsertAmbient).toBeUndefined();
    expect(result.patch.upsertEvent?.[0]?.assetId).toBe(candidate.assetId);
    expect(result.outputSchema).toEqual(input.outputSchema);
  });

  it('rejects an inconsistent Decision 1 response', async () => {
    const provider = new OpenAIDecisionProvider({
      fetchImpl: async () =>
        jsonResponse({
          shouldAdapt: false,
          goal: 'gently-reorient',
          scope: 'within-scene',
          rationale: 'invalid',
        }),
    });
    await expect(provider.decide(context())).rejects.toThrow(
      'inconsistent adapt/goal/scope',
    );
  });
});
