import type { AdaptivePlannerConfig } from './config.js';
import type {
  AdaptationHistoryItem,
  AttentionState,
  CalibrationProfile,
  EligibilityResult,
} from './types.js';

export function evaluateEligibility(
  state: AttentionState,
  profile: CalibrationProfile,
  history: readonly AdaptationHistoryItem[],
  config: AdaptivePlannerConfig,
  transitionUntilMs = 0,
  _stasisPressure = false,
): EligibilityResult {
  const reasons: string[] = [];
  if (
    profile.featureVersion !==
    'raw_welch_frontal_log_tbr_guided_baseline_protocol_v5'
  )
    reasons.push('unsupported_calibration_feature_version');
  if (!profile.baselineAvailable || profile.qualityStatus !== 'pass')
    reasons.push('baseline_unavailable');
  if (state.phase === 'opening') reasons.push('opening_phase');
  // An in-progress fade is context for the planners and validator, not a
  // global prohibition on an independent future adaptation.
  if (state.validEpochCount < config.minimumValidEpochs)
    reasons.push('insufficient_valid_epochs');
  if (state.confidence < config.minimumConfidence)
    reasons.push('insufficient_measurement_confidence');
  if (transitionUntilMs > state.timestampMs)
    reasons.push('protected_transition_in_progress');
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
