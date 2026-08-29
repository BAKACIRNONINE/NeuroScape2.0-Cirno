import type { AdaptivePlannerConfig } from './config.js';
import type {
  AttentionState,
  CalibrationProfile,
  ConfidenceLevel,
  SessionPhase,
  StateTrajectory,
  TbrEpoch,
} from './types.js';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
};
const mad = (values: number[]) =>
  values.length
    ? median(values.map((value) => Math.abs(value - median(values))))
    : null;

export function sessionPhase(
  timestampMs: number,
  config: AdaptivePlannerConfig,
): SessionPhase {
  return timestampMs < config.openingDurationMs ? 'opening' : 'adaptive';
}

export class AttentionInterpreter {
  readonly #epochs: TbrEpoch[] = [];
  readonly #states: AttentionState[] = [];
  readonly #profile: CalibrationProfile;
  readonly #config: AdaptivePlannerConfig;

  constructor(profile: CalibrationProfile, config: AdaptivePlannerConfig) {
    this.#profile = profile;
    this.#config = config;
  }

  ingest(epoch: TbrEpoch): AttentionState {
    this.#epochs.push(structuredClone(epoch));
    const recent = this.#epochs.filter(
      (item) =>
        item.timestampMs > epoch.timestampMs - this.#config.analysisWindowMs &&
        item.timestampMs <= epoch.timestampMs,
    );
    const valid = recent.filter(
      (item): item is TbrEpoch & { logTbr: number } =>
        item.valid && item.logTbr !== null && Number.isFinite(item.logTbr),
    );
    const currentLogTbr = valid.length
      ? median(valid.map((item) => item.logTbr))
      : null;
    const profileUsable =
      this.#profile.baselineAvailable &&
      this.#profile.qualityStatus === 'pass' &&
      Number.isFinite(this.#profile.baselineLogTbr) &&
      Number.isFinite(this.#profile.effectiveBaselineScale) &&
      this.#profile.effectiveBaselineScale > 0;
    const deltaFromBaseline =
      profileUsable && currentLogTbr !== null
        ? currentLogTbr - this.#profile.baselineLogTbr
        : null;
    const tbrRatioToBaseline =
      deltaFromBaseline === null ? null : Math.exp(deltaFromBaseline);
    const robustDeltaFromBaseline =
      deltaFromBaseline === null
        ? null
        : deltaFromBaseline / this.#profile.effectiveBaselineScale;
    const medianQuality = valid.length
      ? median(valid.map((item) => item.qualityScore))
      : 0;
    const confidence = profileUsable
      ? clamp01(valid.length / this.#config.minimumValidEpochs) * medianQuality
      : 0;
    const measurementConfidence: ConfidenceLevel =
      confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
    const signalQuality = !valid.length
      ? ('unavailable' as const)
      : medianQuality >= 0.8
        ? ('good' as const)
        : medianQuality >= 0.6
          ? ('fair' as const)
          : ('poor' as const);
    const baselineRelation =
      robustDeltaFromBaseline === null ||
      valid.length < this.#config.minimumValidEpochs
        ? ('uncertain' as const)
        : robustDeltaFromBaseline > this.#config.baselineRelationThreshold
          ? ('tbr-elevated' as const)
          : robustDeltaFromBaseline < -this.#config.baselineRelationThreshold
            ? ('tbr-reduced' as const)
            : ('baseline-consistent' as const);
    const recentRobustDeltas = [
      ...this.#states
        .slice(-(this.#config.trendWindowCount - 1))
        .map((state) => state.robustDeltaFromBaseline),
      robustDeltaFromBaseline,
    ].filter((value): value is number => value !== null);
    const robustDeltaPrevious = recentRobustDeltas.at(-2) ?? null;
    const robustDeltaSlope =
      recentRobustDeltas.length < this.#config.trendWindowCount
        ? null
        : (recentRobustDeltas.at(-1)! - recentRobustDeltas[0]!) /
          (recentRobustDeltas.length - 1);
    const trend =
      robustDeltaSlope === null
        ? ('insufficient-history' as const)
        : robustDeltaSlope > this.#config.robustDeltaTrendThreshold
          ? ('increasing' as const)
          : robustDeltaSlope < -this.#config.robustDeltaTrendThreshold
            ? ('decreasing' as const)
            : ('stable' as const);
    const variabilityMad = mad(valid.map((item) => item.logTbr));
    const trajectory: StateTrajectory =
      robustDeltaSlope === null
        ? 'unavailable'
        : variabilityMad !== null &&
            variabilityMad > this.#config.highVariabilityMad
          ? 'volatile'
          : trend === 'increasing'
            ? 'declining'
            : trend === 'decreasing'
              ? 'improving'
              : 'stable';
    const previous = this.#states.at(-1);
    const state: AttentionState = {
      timestampMs: epoch.timestampMs,
      phase: sessionPhase(epoch.timestampMs, this.#config),
      currentLogTbr,
      baselineLogTbr: this.#profile.baselineLogTbr,
      baselineMad: this.#profile.baselineMad,
      baselineScale: this.#profile.baselineScale,
      effectiveBaselineScale: this.#profile.effectiveBaselineScale,
      deltaFromBaseline,
      tbrRatioToBaseline,
      tbrPercentChange:
        tbrRatioToBaseline === null ? null : (tbrRatioToBaseline - 1) * 100,
      robustDeltaFromBaseline,
      baselineRelation,
      robustDeltaPrevious,
      robustDeltaSlope,
      trend,
      trajectory,
      variabilityMad,
      sustainedElevatedWindows:
        baselineRelation === 'tbr-elevated'
          ? (previous?.sustainedElevatedWindows ?? 0) + 1
          : 0,
      sustainedReducedWindows:
        baselineRelation === 'tbr-reduced'
          ? (previous?.sustainedReducedWindows ?? 0) + 1
          : 0,
      measurementConfidence,
      signalQuality,
      validEpochCount: valid.length,
      stateEstimationVersion: 'guided_baseline_delta_v1',
      confidence,
    };
    this.#states.push(state);
    return structuredClone(state);
  }

  get states(): readonly AttentionState[] {
    return this.#states;
  }
}
