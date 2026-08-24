import type {
  AdaptationDecision,
  AdaptationGoal,
  AdaptationScope,
  Decision2Input,
  DecisionContext,
  DecisionProvider,
  LlmUsage,
  PlanningProvider,
  PlanningResult,
  SoundscapePlanPatch,
} from './types.js';

export const DECISION_1_PROMPT_VERSION = 'decision-1-attention-policy-v1';

const goals: readonly AdaptationGoal[] = [
  'maintain',
  'gently-reorient',
  'support-grounding',
  'reduce-stimulation',
  'refresh-engagement',
];
const scopes: readonly AdaptationScope[] = [
  'maintain',
  'within-scene',
  'scene-transition',
];

export const decision1OutputSchema: Record<string, unknown> = Object.freeze({
  name: 'neuroscape_decision_1',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['shouldAdapt', 'goal', 'scope', 'rationale'],
    properties: {
      shouldAdapt: { type: 'boolean' },
      goal: { type: 'string', enum: goals },
      scope: { type: 'string', enum: scopes },
      rationale: { type: 'string' },
    },
  },
});

export function buildDecision1Prompt(context: DecisionContext): string {
  return [
    'You are NeuroScape Decision 1: Should Adapt?',
    'Decide whether the current soundscape should be adapted at this eligible checkpoint.',
    'The deterministic eligibility gate has already approved an LLM assessment. Eligibility does not itself mean an adaptation is necessary.',
    'Use the calibration-relative attention state, trend, confidence, session phase, current soundscape, recent adaptation history, and restrictions.',
    'Prefer maintain when evidence is ambiguous, transient, already improving, or a recent intervention has not had enough time to take effect.',
    'Use within-scene adaptation before scene transition. Scene transition is a rare, high-salience intervention for sustained, severe mind-wandering after lighter interventions were insufficient, and only when restrictions allow it.',
    'Opening and closing phase restrictions are authoritative. Never request a forbidden event, body anchor, or scene transition.',
    'If shouldAdapt is false, return goal=maintain and scope=maintain. If shouldAdapt is true, neither goal nor scope may be maintain.',
    'Provide a concise, inspectable rationale based only on supplied observations. Do not claim objective mind-wandering detection and do not expose hidden chain-of-thought.',
    `INPUT_JSON=${JSON.stringify({
      attentionState: context.state,
      recentAttentionStates: context.recentStates,
      currentPlan: context.currentPlan,
      recentAdaptations: context.history.slice(-6),
      restrictions: context.restrictions,
    })}`,
  ].join('\n');
}

interface OpenAIProxyResponse<T> {
  output: T;
  model: string;
  responseId: string;
  usage: LlmUsage;
}

export interface OpenAIProviderOptions {
  baseUrl?: string;
  sessionId?: string;
  fetchImpl?: typeof fetch;
}

async function requestStructuredOutput<T>(
  path: string,
  body: Record<string, unknown>,
  options: OpenAIProviderOptions,
): Promise<OpenAIProxyResponse<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${options.baseUrl ?? ''}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...body, sessionId: options.sessionId }),
  });
  const payload = (await response.json()) as
    OpenAIProxyResponse<T> | { error?: string };
  if (!response.ok || !('output' in payload))
    throw new Error(
      `OpenAI planner request failed (${response.status}): ${
        'error' in payload && payload.error
          ? payload.error
          : response.statusText
      }`,
    );
  return payload;
}

function assertDecision1(
  value: AdaptationDecision,
  context: DecisionContext,
): void {
  if (!goals.includes(value.goal) || !scopes.includes(value.scope))
    throw new Error('Decision 1 returned an unsupported goal or scope.');
  if (
    (!value.shouldAdapt &&
      (value.goal !== 'maintain' || value.scope !== 'maintain')) ||
    (value.shouldAdapt &&
      (value.goal === 'maintain' || value.scope === 'maintain'))
  )
    throw new Error(
      'Decision 1 returned inconsistent adapt/goal/scope values.',
    );
  if (
    value.scope === 'scene-transition' &&
    !context.restrictions.allowSceneTransition
  )
    throw new Error('Decision 1 requested a forbidden scene transition.');
  if (
    value.goal === 'support-grounding' &&
    !context.restrictions.allowBodyAnchor
  )
    throw new Error('Decision 1 requested a forbidden body anchor.');
}

export class OpenAIDecisionProvider implements DecisionProvider {
  readonly #options: OpenAIProviderOptions;

  constructor(options: OpenAIProviderOptions = {}) {
    this.#options = options;
  }

  async decide(context: DecisionContext): Promise<AdaptationDecision> {
    const prompt = buildDecision1Prompt(context);
    const response = await requestStructuredOutput<
      Omit<AdaptationDecision, 'provider'>
    >(
      '/api/llm/decision-1',
      {
        promptVersion: DECISION_1_PROMPT_VERSION,
        prompt,
        outputSchema: decision1OutputSchema,
      },
      this.#options,
    );
    const decision: AdaptationDecision = {
      ...response.output,
      provider: 'openai-responses',
      promptVersion: DECISION_1_PROMPT_VERSION,
      prompt,
      outputSchema: decision1OutputSchema,
      model: response.model,
      responseId: response.responseId,
      usage: response.usage,
    };
    assertDecision1(decision, context);
    return decision;
  }
}

interface Decision2WireOutput {
  patch: SoundscapePlanPatch & {
    journey?: SoundscapePlanPatch['journey'] | null;
  };
  selectedAssetIds: string[];
  rationale: string;
}

function normalizePatch(
  patch: Decision2WireOutput['patch'],
): SoundscapePlanPatch {
  const normalized: SoundscapePlanPatch = {
    reasoningSummary: patch.reasoningSummary,
  };
  if (patch.journey) normalized.journey = patch.journey;
  if (patch.upsertAmbient?.length)
    normalized.upsertAmbient = patch.upsertAmbient;
  if (patch.upsertAction?.length) normalized.upsertAction = patch.upsertAction;
  if (patch.upsertEvent?.length) normalized.upsertEvent = patch.upsertEvent;
  if (patch.removeIds?.length) normalized.removeIds = patch.removeIds;
  if (patch.transitionDurationMs !== undefined)
    normalized.transitionDurationMs = patch.transitionDurationMs;
  return normalized;
}

export class OpenAIPlanningProvider implements PlanningProvider {
  readonly #options: OpenAIProviderOptions;

  constructor(options: OpenAIProviderOptions = {}) {
    this.#options = options;
  }

  async plan(
    _context: DecisionContext,
    _decision: AdaptationDecision,
    input: Decision2Input,
  ): Promise<PlanningResult> {
    const response = await requestStructuredOutput<Decision2WireOutput>(
      '/api/llm/decision-2',
      {
        promptVersion: input.promptVersion,
        prompt: input.prompt,
        outputSchema: input.outputSchema,
      },
      this.#options,
    );
    return {
      patch: normalizePatch(response.output.patch),
      selectedAssetIds: response.output.selectedAssetIds,
      candidateAssetIds: input.candidates.map((candidate) => candidate.assetId),
      promptVersion: input.promptVersion,
      prompt: input.prompt,
      outputSchema: input.outputSchema,
      rationale: response.output.rationale,
      provider: 'openai-responses',
      model: response.model,
      responseId: response.responseId,
      usage: response.usage,
    };
  }
}
