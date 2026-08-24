export interface AdaptivePlannerConfig {
  sessionDurationMs: number;
  openingDurationMs: number;
  closingStartMs: number;
  epochDurationMs: number;
  analysisWindowMs: number;
  checkpointIntervalMs: number;
  minimumValidEpochs: number;
  trendWindowCount: number;
  focusLeaningThreshold: number;
  mindWanderingLeaningThreshold: number;
  trendDeltaThreshold: number;
  highVariabilityMad: number;
  sustainedWindowCount: number;
  minimumConfidence: number;
  adaptationCooldownMs: number;
  sceneTransitionCooldownMs: number;
  maxSceneTransitions: number;
  exactAssetCooldownMs: number;
  assetFamilyCooldownMs: number;
  bodyAnchorCooldownMs: number;
}

/**
 * Runnable Phase-1 defaults. Every numeric policy value below is TBD_PILOT:
 * it is an explicit starting hypothesis, not a validated scientific threshold.
 */
export const phase1Config: AdaptivePlannerConfig = Object.freeze({
  sessionDurationMs: 600_000,
  openingDurationMs: 60_000,
  closingStartMs: 540_000,
  epochDurationMs: 10_000,
  analysisWindowMs: 60_000,
  checkpointIntervalMs: 40_000,
  minimumValidEpochs: 5,
  trendWindowCount: 3,
  focusLeaningThreshold: 0.34,
  mindWanderingLeaningThreshold: 0.67,
  trendDeltaThreshold: 0.05,
  highVariabilityMad: 0.12,
  sustainedWindowCount: 2,
  minimumConfidence: 0.6,
  adaptationCooldownMs: 60_000,
  sceneTransitionCooldownMs: 180_000,
  maxSceneTransitions: 5,
  exactAssetCooldownMs: 90_000,
  assetFamilyCooldownMs: 45_000,
  bodyAnchorCooldownMs: 80_000,
});
