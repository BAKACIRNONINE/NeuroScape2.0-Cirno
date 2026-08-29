import { describe, expect, it } from 'vitest';
import {
  DECISION_1_PROMPT_VERSION,
  AttentionInterpreter,
  OpenAIDecisionProvider,
  OpenAIPlanningProvider,
  initialForestPlan,
  phase1Config,
  prepareDecision2Input,
} from '../src/index.js';
import { mockCalibrationProfile } from '../src/fixtures.js';
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
    ...new AttentionInterpreter(mockCalibrationProfile, {
      ...phase1Config,
      minimumValidEpochs: 1,
    }).ingest({ timestampMs: 180_000, logTbr: 1.3, valid: true, qualityScore: 0.95, artifactFlags: [] }),
    baselineRelation: 'tbr-elevated',
    trajectory: 'declining',
  },
  profile: mockCalibrationProfile,
  recentStates: [],
  currentPlan: structuredClone(initialForestPlan),
  history: [],
  restrictions: {
    allowEvent: true,
    allowBodyAnchor: true,
    allowSceneTransition: true,
    sceneTransitionsRemaining: 2,
  },
  secondsSinceLastMeaningfulChange: 80,
  stasisPressure: false,
  transitionInProgress: false,
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
          decision: 'adapt',
          intent: 'gently_reorient_attention',
          salience: 'low',
          scope: 'within-scene',
          evidence_summary: {
            relation: 'tbr-elevated',
            trajectory: 'declining',
            confidence: 'high',
          },
          reason: 'A sustained decline warrants one sparse event.',
          maintain_reason: null,
          constraints_for_decision_2: ['preserve_scene_continuity'],
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
      'Positive delta means TBR is higher than baseline',
    );
    expect(String(requestBody?.prompt)).toContain(
      'empirical guided-breathing reference',
    );
    expect(String(requestBody?.prompt)).toContain(
      'does not objectively detect mind wandering',
    );
    expect(String(requestBody?.prompt)).toContain(
      'adaptationProgress is a soft session-level target',
    );
    expect(result.provider).toBe('openai-responses');
    expect(result.model).toBe('gpt-5.6-2026-08-01');
    expect(result.usage?.totalTokens).toBe(120);
  });

  it('sends Decision 2 candidates/schema and normalizes the structured patch', async () => {
    const value = context();
    const decision: AdaptationDecision = {
      decision: 'adapt',
      intent: 'gently_reorient_attention',
      salience: 'low',
      evidenceSummary: {
        relation: 'tbr-elevated',
        trajectory: 'declining',
        confidence: 'high',
      },
      reason: 'test',
      maintainReason: null,
      constraintsForDecision2: ['preserve_scene_continuity'],
      shouldAdapt: true,
      goal: 'gently-reorient',
      scope: 'within-scene',
      rationale: 'test',
      provider: 'test',
    };
    const input = prepareDecision2Input(value, decision, phase1Config);
    expect(input.prompt).toContain(
      'rank compatible candidates by authored quality and system suitability',
    );
    expect(input.prompt).toContain('"active":false');
    value.profile = { ...value.profile, qualityStatus: 'fail' };
    value.state.measurementConfidence = 'low';
    expect(prepareDecision2Input(value, decision, phase1Config).prompt).toContain(
      '"active":true',
    );
    const candidate = input.candidates[0]!;
    const provider = new OpenAIPlanningProvider({
      fetchImpl: async () =>
        jsonResponse({
          status: 'PATCH_PROPOSED',
          intent: decision.intent,
          patchOperations: [
            {
              operation: 'INSERT',
              targetElementId: null,
              effectiveStartMs: 182_000,
              transitionMs: 2_000,
              replacementAssetId: candidate.assetId,
            },
          ],
          preservedElementIds: [],
          adaptationHypothesis: {
            mechanismCode: 'GENTLE_REORIENTATION',
            expectedResponseCode: 'GENTLE_REORIENTATION',
            failureSignalCode: 'CONTINUED_DECLINE_WITH_VALID_SIGNAL',
          },
          reflectionUsed: {
            priorAdaptationIds: [],
            lessonCode: null,
            lessonConfidence: 'unavailable',
          },
          reasonCodes: ['MINIMAL_SUFFICIENT_PATCH'],
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

  it('uses a safe maintain fallback for an inconsistent Decision 1 response', async () => {
    const provider = new OpenAIDecisionProvider({
      fetchImpl: async () =>
        jsonResponse({
          decision: 'maintain',
          intent: 'gently_reorient_attention',
          salience: 'low',
          scope: 'within-scene',
          evidence_summary: {
            relation: 'baseline-consistent',
            trajectory: 'stable',
            confidence: 'medium',
          },
          reason: 'invalid',
          maintain_reason: null,
          constraints_for_decision_2: [],
        }),
    });
    const result = await provider.decide(context());
    expect(result.shouldAdapt).toBe(false);
    expect(result.provider).toBe('openai-validation-fallback');
    expect(result.reason).toContain('validation_error');
  });
});
