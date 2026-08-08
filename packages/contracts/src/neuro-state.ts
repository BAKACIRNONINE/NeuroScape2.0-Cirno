export type SessionTimestampMs = number;

export type NeuroTrend = 'increasing' | 'decreasing' | 'stable';

export interface NeuroMetric {
  value: number;
  trend: NeuroTrend;
}

export interface NeuroState {
  timestampMs: SessionTimestampMs;
  attention: NeuroMetric;
  arousal: NeuroMetric;
  stability: number;
  confidence: number;
  historySummary?: string;
}
