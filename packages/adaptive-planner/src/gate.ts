import type { AdaptivePlannerConfig } from './config.js';
import type {
  AdaptationHistoryItem,
  AttentionState,
  CalibrationProfile,
  EligibilityResult,
} from './types.js';

export function evaluateEligibility(
  state: AttentionState,
  _profile: CalibrationProfile,
  history: readonly AdaptationHistoryItem[],
  config: AdaptivePlannerConfig,
  transitionUntilMs = 0,
  stasisPressure = false,
): EligibilityResult {
  const reasons: string[] = [];
  if (state.phase === 'opening') reasons.push('opening_phase');
  // An in-progress fade is context for the planners and validator, not a
  // global prohibition on an independent future adaptation.
  if (state.validEpochCount < config.minimumValidEpochs && !stasisPressure)
    reasons.push('insufficient_valid_epochs');
  const lastExperiencedAdaptation = [...history]
    .reverse()
    .find((item) => item.experiencedAtMs !== undefined);
  if (
    lastExperiencedAdaptation?.experiencedAtMs !== undefined &&
    state.timestampMs - lastExperiencedAdaptation.experiencedAtMs <
      config.adaptationCooldownMs
  )
    reasons.push('adaptation_cooldown');
  return {
    eligible: reasons.length === 0,
    timestampMs: state.timestampMs,
    reasons: reasons.length ? reasons : ['eligible'],
  };
}

export function restrictionsFor(
  state: AttentionState,
  history: readonly AdaptationHistoryItem[],
  config: AdaptivePlannerConfig,
) {
  const transitions = history.filter(
    (item) => item.scope === 'scene-transition',
  );
  const lastTransition = transitions.at(-1);
  return {
    allowEvent: state.phase === 'adaptive',
    // Body/action recency is supplied to Decision 2 as experienced history.
    // Canonical asset metadata, rather than an asset-ID prefix, owns layers.
    allowBodyAnchor: state.phase === 'adaptive',
    allowSceneTransition:
      state.phase === 'adaptive' &&
      transitions.length < config.maxSceneTransitions &&
      (!lastTransition ||
        state.timestampMs - lastTransition.timestampMs >=
          config.sceneTransitionCooldownMs),
    sceneTransitionsRemaining: Math.max(
      0,
      config.maxSceneTransitions - transitions.length,
    ),
  };
}
