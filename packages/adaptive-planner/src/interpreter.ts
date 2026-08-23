import type { AdaptivePlannerConfig } from './config.js';
import type {
  AttentionState,
  AttentionTrend,
  CalibrationProfile,
  SessionPhase,
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
  if (timestampMs < config.openingDurationMs) return 'opening';
  if (timestampMs >= config.closingStartMs) return 'closing';
  return 'adaptive';
}

export class AttentionInterpreter {
  readonly #profile: CalibrationProfile;
  readonly #config: AdaptivePlannerConfig;
  readonly #epochs: TbrEpoch[] = [];
  readonly #states: AttentionState[] = [];

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
    const denominator =
      this.#profile.focusedAnchorLogTbr -
      this.#profile.mindWanderingAnchorLogTbr;
    const focusUnbounded =
      currentLogTbr === null || Math.abs(denominator) < 1e-6
        ? null
        : (currentLogTbr - this.#profile.mindWanderingAnchorLogTbr) /
          denominator;
    const focusPosition =
      focusUnbounded === null ? null : clamp01(focusUnbounded);
    const mindWanderingPosition =
      focusPosition === null ? null : 1 - focusPosition;
    const unboundedMindWanderingPosition =
      focusUnbounded === null ? null : 1 - focusUnbounded;
    const confidence = valid.length
      ? clamp01(valid.length / this.#config.minimumValidEpochs) *
        median(valid.map((item) => item.qualityScore))
      : 0;
    const variabilityMad = mad(valid.map((item) => item.logTbr));
    const provisional = {
      timestampMs: epoch.timestampMs,
      mindWanderingPosition,
    };
    const checkpoints = [...this.#states, provisional].filter(
      (item) =>
        item.timestampMs >=
        epoch.timestampMs -
          this.#config.checkpointIntervalMs *
            (this.#config.trendWindowCount - 1),
    );
    const trendDelta =
      checkpoints.length < this.#config.trendWindowCount ||
      mindWanderingPosition === null ||
      checkpoints[0]!.mindWanderingPosition === null
        ? null
        : (mindWanderingPosition - checkpoints[0]!.mindWanderingPosition!) /
          (checkpoints.length - 1);
    const trend: AttentionTrend =
      trendDelta === null
        ? 'insufficient-history'
        : trendDelta > this.#config.trendDeltaThreshold
          ? 'toward-mind-wandering'
          : trendDelta < -this.#config.trendDeltaThreshold
            ? 'toward-focus'
            : 'stable';
    const previousSustained =
      this.#states.at(-1)?.sustainedMindWanderingWindows ?? 0;
    const sustainedMindWanderingWindows =
      mindWanderingPosition !== null &&
      mindWanderingPosition >= this.#config.mindWanderingLeaningThreshold
        ? previousSustained + 1
        : 0;
    const label =
      confidence < this.#config.minimumConfidence ||
      mindWanderingPosition === null
        ? 'uncertain'
        : mindWanderingPosition < this.#config.focusLeaningThreshold
          ? 'focus-leaning'
          : mindWanderingPosition >= this.#config.mindWanderingLeaningThreshold
            ? 'mind-wandering-leaning'
            : 'intermediate';
    const state: AttentionState = {
      timestampMs: epoch.timestampMs,
      phase: sessionPhase(epoch.timestampMs, this.#config),
      currentLogTbr,
      focusPosition,
      mindWanderingPosition,
      unboundedMindWanderingPosition,
      label,
      trend,
      trendDeltaPerCheckpoint: trendDelta,
      variabilityMad,
      sustainedMindWanderingWindows,
      confidence,
      validEpochCount: valid.length,
    };
    this.#states.push(state);
    return structuredClone(state);
  }

  get states(): readonly AttentionState[] {
    return this.#states;
  }
}
