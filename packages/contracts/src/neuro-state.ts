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
  /** Optional Module 01 detail. `arousal` remains for protocol 1.0 compatibility. */
  attention?: {
    currentLogTbr: number | null;
    focusPosition: number | null;
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
  };
}
