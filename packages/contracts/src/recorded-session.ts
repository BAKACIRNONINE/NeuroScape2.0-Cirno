import type { NeuroState } from './neuro-state.js';
import type { PlannerStatusPayload, SessionStatusPayload } from './protocol.js';
import type { RuntimeWorldState } from './runtime-world-state.js';
import type { SceneJourneyPlan } from './scene-journey-plan.js';

export const RECORDED_SESSION_SCHEMA_VERSION = '1.0';
export interface RecordedSessionMetadata {
  sessionId: string; protocolVersion: string; schemaVersion: string; durationMs: number;
  startState: string; endState: string; userPrompt?: string; eegMode?: 'muse' | 'recorded';
}
export interface TimestampedRecord<T> { timestampMs: number; value: T }
export interface RecordedSession {
  metadata: RecordedSessionMetadata;
  runtimeSnapshots: RuntimeWorldState[];
  neuroStates: NeuroState[];
  sceneJourneyPlans: TimestampedRecord<SceneJourneyPlan>[];
  sessionEvents: TimestampedRecord<SessionStatusPayload>[];
  plannerEvents: TimestampedRecord<PlannerStatusPayload>[];
}
