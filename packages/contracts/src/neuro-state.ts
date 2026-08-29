export type SessionTimestampMs = number;

export type NeuroTrend = 'increasing' | 'decreasing' | 'stable';

export interface NeuroMetric {
  value: number;
  trend: NeuroTrend;
}

export interface NeuroState {
  timestampMs: SessionTimestampMs;
  arousal: NeuroMetric;
  confidence?: number;
  /** Optional Module 01 baseline-relative detail. */
  attention?: BaselineRelativeAttentionState | LegacyTwoAnchorAttentionState;
}

export interface BaselineRelativeAttentionState {
    currentLogTbr: number | null;
    baselineLogTbr: number;
    baselineMad: number;
    baselineScale: number;
    effectiveBaselineScale: number;
    deltaFromBaseline: number | null;
    tbrRatioToBaseline: number | null;
    tbrPercentChange: number | null;
    robustDeltaFromBaseline: number | null;
    baselineRelation:
      | 'baseline-consistent'
      | 'tbr-elevated'
      | 'tbr-reduced'
      | 'uncertain';
    robustDeltaSlope: number | null;
    trajectory: string;
    measurementConfidence: 'high' | 'medium' | 'low';
    signalQuality: 'good' | 'fair' | 'poor' | 'unavailable';
    stateEstimationVersion: 'guided_baseline_delta_v1';
    trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient-history';
    variabilityMad: number | null;
    sustainedElevatedWindows: number;
    sustainedReducedWindows: number;
    phase: 'opening' | 'adaptive' | 'closing';
    validEpochCount: number;
}

/** Schema 1.3 replay only. New live sessions must never produce this shape. */
export interface LegacyTwoAnchorAttentionState {
    currentLogTbr: number | null;
    relativePosition?: number | null;
    referenceGap?: number;
    deltaFromFocus?: number | null;
    deltaFromMindWandering?: number | null;
    coverage?: string;
    trajectory?: string;
    relativePositionSlope?: number | null;
    measurementConfidence?: 'high' | 'medium' | 'low';
    calibrationQuality?: 'high' | 'medium' | 'low' | 'unusable';
    signalQuality?: 'good' | 'fair' | 'poor' | 'unavailable';
    stateEstimationVersion?: string;
    /** Visualization only; not a focus probability or percentage. */
    focusPosition: number | null;
    /** Visualization only; not a mind-wandering probability or percentage. */
    mindWanderingPosition: number | null;
    label:
      'focus-leaning' | 'intermediate' | 'mind-wandering-leaning' | 'uncertain';
    trend:
      | 'toward-focus'
      | 'toward-mind-wandering'
      | 'stable'
      | 'insufficient-history';
    variabilityMad: number | null;
    phase: 'opening' | 'adaptive' | 'closing';
    validEpochCount: number;
}
