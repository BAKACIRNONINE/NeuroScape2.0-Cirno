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
}
