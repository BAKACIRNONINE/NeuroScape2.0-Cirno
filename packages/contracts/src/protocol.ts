import type { NeuroState, SessionTimestampMs } from './neuro-state.js';
import type { RuntimeWorldState } from './runtime-world-state.js';
import type { SceneJourneyPlan } from './scene-journey-plan.js';

export const NEUROSCAPE_PROTOCOL_VERSION = '1.0';

export interface MessageEnvelope<TType extends string, TPayload> {
  type: TType; protocolVersion: string; sessionId: string; timestampMs: SessionTimestampMs; payload: TPayload;
}
export interface SessionStatusPayload { status: 'loading' | 'preview' | 'running' | 'paused' | 'ended'; elapsedTimeMs: number; message?: string }
export interface PlannerStatusPayload { status: 'idle' | 'planning' | 'ready' | 'error'; message?: string }
export interface ProtocolErrorPayload { code: string; message: string; recoverable: boolean }
export interface HeartbeatPayload { nonce: string }

export type NeuroStateMessage = MessageEnvelope<'NeuroState', NeuroState>;
export type SceneJourneyPlanMessage = MessageEnvelope<'SceneJourneyPlan', SceneJourneyPlan>;
export type RuntimeWorldStateMessage = MessageEnvelope<'RuntimeWorldState', RuntimeWorldState>;
export type SessionStatusMessage = MessageEnvelope<'SessionStatus', SessionStatusPayload>;
export type PlannerStatusMessage = MessageEnvelope<'PlannerStatus', PlannerStatusPayload>;
export type PingMessage = MessageEnvelope<'Ping', HeartbeatPayload>;
export type PongMessage = MessageEnvelope<'Pong', HeartbeatPayload>;
export type ErrorMessage = MessageEnvelope<'Error', ProtocolErrorPayload>;

export type ClientCommandPayload =
  | { command: 'startSession'; worldDescription: string; durationMinutes: number; eegSource: 'muse' | 'recorded' }
  | { command: 'pauseSession' | 'resumeSession' | 'endSession' | 'requestDiagnostics' }
  | { command: 'updateSettings'; settings: Record<string, string | number | boolean> };
export type ClientCommandMessage = MessageEnvelope<'ClientCommand', ClientCommandPayload>;
export type ServerMessage = RuntimeWorldStateMessage | NeuroStateMessage | SceneJourneyPlanMessage | SessionStatusMessage | PlannerStatusMessage | PingMessage | PongMessage | ErrorMessage;
export type NeuroScapeMessage = ServerMessage | ClientCommandMessage;
