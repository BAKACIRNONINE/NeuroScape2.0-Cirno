import type { NeuroState } from './neuro-state.js';
import type { PlannerStatusPayload, SessionStatusPayload } from './protocol.js';
import type { RuntimeWorldState } from './runtime-world-state.js';
import type { SceneJourneyPlan } from './scene-journey-plan.js';

export const RECORDED_SESSION_SCHEMA_VERSION = '1.1';
export interface RecordedSessionMetadata {
  sessionId: string;
  protocolVersion: string;
  schemaVersion: string;
  durationMs: number;
  startState: string;
  endState: string;
  userPrompt?: string;
  eegMode?: 'muse' | 'recorded';
  participantId?: string;
  runMode?: 'mock-fast' | 'study-realtime';
  startedAtIso?: string;
}
export interface TimestampedRecord<T> {
  timestampMs: number;
  value: T;
}
export interface AdaptiveTraceRecord {
  timestampMs: number;
  kind:
    | 'eeg-epoch'
    | 'attention-state'
    | 'eligibility'
    | 'decision-1'
    | 'decision-2'
    | 'plan-applied';
  source: 'deterministic' | 'mock-llm' | 'openai';
  summary: string;
  data: Record<string, unknown>;
}
export interface RecordedSession {
  metadata: RecordedSessionMetadata;
  runtimeSnapshots: RuntimeWorldState[];
  neuroStates: NeuroState[];
  sceneJourneyPlans: TimestampedRecord<SceneJourneyPlan>[];
  sessionEvents: TimestampedRecord<SessionStatusPayload>[];
  plannerEvents: TimestampedRecord<PlannerStatusPayload>[];
  /** Structured, user-study-safe rationale and inputs/outputs; never hidden chain-of-thought. */
  adaptiveTrace: AdaptiveTraceRecord[];
}
