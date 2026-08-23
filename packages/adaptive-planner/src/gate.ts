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
): EligibilityResult {
  const reasons: string[] = [];
  if (!profile.mappingAvailable || profile.qualityStatus === 'fail')
    reasons.push('calibration_mapping_unavailable');
  if (
    Math.abs(profile.focusedAnchorLogTbr - profile.mindWanderingAnchorLogTbr) <
    1e-6
  )
    reasons.push('calibration_anchors_not_separated');
  if (state.phase === 'opening') reasons.push('opening_phase');
  if (state.phase === 'closing') reasons.push('closing_phase');
  if (state.validEpochCount < config.minimumValidEpochs)
    reasons.push('insufficient_valid_epochs');
  if (
    state.confidence < config.minimumConfidence ||
    state.label === 'uncertain'
  )
    reasons.push('low_confidence');
  const lastAdaptation = history.at(-1);
  if (
    lastAdaptation &&
    state.timestampMs - lastAdaptation.timestampMs < config.adaptationCooldownMs
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
  const lastBodyAnchor = [...history]
    .reverse()
    .find((item) => item.assetIds.some((id) => id.startsWith('action.')));
  return {
    allowEvent: state.phase === 'adaptive',
    allowBodyAnchor:
      state.phase === 'adaptive' &&
      (!lastBodyAnchor ||
        state.timestampMs - lastBodyAnchor.timestampMs >=
          config.bodyAnchorCooldownMs),
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
