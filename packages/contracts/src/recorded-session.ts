import type { NeuroState } from './neuro-state.js';
import type { PlannerStatusPayload, SessionStatusPayload } from './protocol.js';
import type { RuntimeWorldState } from './runtime-world-state.js';
import type { SceneJourneyPlan } from './scene-journey-plan.js';
import type { AudioExecutionDiagnostic, AudioPlaybackEvidence } from './audio-playback-evidence.js';

export const RECORDED_SESSION_SCHEMA_VERSION = '1.4';
export const LEGACY_RECORDED_SESSION_SCHEMA_VERSION = '1.3';
export interface RecordedSessionMetadata {
  sessionId: string;
  protocolVersion: string;
  schemaVersion: string;
  durationMs: number;
  startState: string;
  endState: string;
  userPrompt?: string;
  eegMode?: 'muse' | 'recorded' | 'none';
  participantId?: string;
  runMode?: 'mock-fast' | 'study-realtime' | 'non-adaptive';
  plannerMode?: 'openai' | 'mock' | 'fixed';
  startedAtIso?: string;
  controlAudioId?: string;
  controlTrajectoryId?: string;
  basePlanId?: string;
  basePlanVersion?: string;
  basePlanProfileId?: string;
  assignmentRuleVersion?: string;
  conditionOrder?: ('non_adaptive' | 'adaptive')[];
  pairedBasePlanId?: string;
  basePlanExecutionMode?:
    'structured-runtime' | 'prerendered-compatible-fallback';
}
export interface RecordedCalibrationProfile {
  profileId: string;
  participantId?: string;
  baselineLogTbr: number;
  baselineMad: number;
  baselineScale: number;
  effectiveBaselineScale: number;
  expectedEpochCount: 30;
  validEpochCount: number;
  invalidEpochCount: number;
  baselineAvailable: boolean;
  qualityStatus: 'pass' | 'fail';
  qualityIssues: string[];
  selfReportedFocus: number | null;
  selfReportedDrowsiness: number | null;
  featureVersion: string;
}
export interface TimestampedRecord<T> {
  timestampMs: number;
  value: T;
}
export interface RecordedEegMetric {
  timestampMs: number;
  theta: number | null;
  beta: number | null;
  tbr: number | null;
  tbrBaseline: number;
  valid: boolean;
  qualityScore: number;
  artifactFlags: string[];
}
export interface RecordedDecisionEvent {
  timestampMs: number;
  type: 'decision-1' | 'decision-2';
}
export interface AdaptiveTraceRecord {
  timestampMs: number;
  kind:
    | 'eeg-epoch'
    | 'attention-state'
    | 'eligibility'
    | 'decision-1'
    | 'decision-2'
    | 'llm-error'
    | 'plan-error'
    | 'plan-applied'
    | 'base-plan'
    | 'patch-lifecycle'
    | 'reflection-outcome';
  source: 'deterministic' | 'live-eeg' | 'mock-llm' | 'openai';
  summary: string;
  data: Record<string, unknown>;
}
export interface RecordedSession {
  metadata: RecordedSessionMetadata;
  calibrationProfile?: RecordedCalibrationProfile;
  runtimeSnapshots: RuntimeWorldState[];
  neuroStates: NeuroState[];
  sceneJourneyPlans: TimestampedRecord<SceneJourneyPlan>[];
  sessionEvents: TimestampedRecord<SessionStatusPayload>[];
  plannerEvents: TimestampedRecord<PlannerStatusPayload>[];
  /** Structured, user-study-safe rationale and inputs/outputs; never hidden chain-of-thought. */
  adaptiveTrace: AdaptiveTraceRecord[];
  eegMetrics?: RecordedEegMetric[];
  decisionEvents?: RecordedDecisionEvent[];
  audioPlaybackEvidence?: AudioPlaybackEvidence[];
  audioExecutionDiagnostics?: AudioExecutionDiagnostic[];
}
