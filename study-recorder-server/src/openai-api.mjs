const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function usageFrom(response) {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    totalTokens: response.usage?.total_tokens ?? 0,
    reasoningTokens:
      response.usage?.output_tokens_details?.reasoning_tokens ?? 0,
  };
}

function errorMessage(payload, status) {
  return (
    payload?.error?.message ??
    payload?.error ??
    `OpenAI Responses API returned HTTP ${status}.`
  );
}

export function createOpenAIRequester(options = {}) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  return async function requestOpenAI({
    stage,
    prompt,
    promptVersion,
    outputSchema,
  }) {
    if (!apiKey)
      throw new Error(
        'OPENAI_API_KEY is not configured in the repository root .env file.',
      );
    const decisionOne = stage === 'decision-1';
    const model =
      (decisionOne
        ? process.env.OPENAI_DECISION_1_MODEL
        : process.env.OPENAI_DECISION_2_MODEL) ??
      process.env.OPENAI_MODEL ??
      'gpt-5.6';
    const reasoningEffort = decisionOne ? 'low' : 'medium';
    const response = await fetchImpl(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model,
        reasoning: { effort: reasoningEffort, context: 'current_turn' },
        input: prompt,
        text: {
          format: { type: 'json_schema', ...outputSchema },
        },
        max_output_tokens: decisionOne ? 700 : 2_000,
        store: false,
        metadata: {
          neuroscape_stage: stage,
          prompt_version: promptVersion,
        },
      }),
      signal: AbortSignal.timeout(decisionOne ? 60_000 : 120_000),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(errorMessage(payload, response.status));
    if (!payload.output_text)
      throw new Error(
        'OpenAI returned no structured output (the request may have been refused or interrupted).',
      );
    let output;
    try {
      output = JSON.parse(payload.output_text);
    } catch {
      throw new Error(
        'OpenAI returned structured output that was not valid JSON.',
      );
    }
    return {
      output,
      model: payload.model ?? model,
      responseId: payload.id,
      usage: usageFrom(payload),
    };
  };
}
