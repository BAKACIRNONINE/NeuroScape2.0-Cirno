import { NEUROSCAPE_PROTOCOL_VERSION, type ClientCommandMessage, type ClientCommandPayload, type ServerMessage } from '@neuroscape/contracts';
import { validateNeuroState, validateRuntimeWorldState, validateSceneJourneyPlan } from '../runtime/validation.js';
import type { RuntimeStore } from '../runtime/RuntimeStore.js';
import { runtimeDiagnostics } from '../debug/index.js';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

export type ProtocolResult = { valid: true; message: ServerMessage } | { valid: false; error: string };
export function parseServerMessage(raw: unknown, expectedSessionId: string): ProtocolResult {
  let value: unknown = raw;
  if (typeof raw === 'string') { try { value = JSON.parse(raw); } catch { return { valid: false, error: 'Invalid JSON' }; } }
  if (!record(value) || !text(value.type) || value.protocolVersion !== NEUROSCAPE_PROTOCOL_VERSION || value.sessionId !== expectedSessionId || !finite(value.timestampMs) || !record(value.payload)) return { valid: false, error: 'Invalid protocol envelope, version, session, or timestamp' };
  const payload = value.payload;
  switch (value.type) {
    case 'RuntimeWorldState': if (!validateRuntimeWorldState(payload).valid || payload.timestampMs !== value.timestampMs) return { valid: false, error: 'Invalid RuntimeWorldState message' }; break;
    case 'NeuroState': if (!validateNeuroState(payload) || payload.timestampMs !== value.timestampMs) return { valid: false, error: 'Invalid NeuroState message' }; break;
    case 'SceneJourneyPlan': if (!validateSceneJourneyPlan(payload)) return { valid: false, error: 'Invalid SceneJourneyPlan message' }; break;
    case 'SessionStatus': if (!['loading', 'preview', 'running', 'paused', 'ended'].includes(String(payload.status)) || !finite(payload.elapsedTimeMs)) return { valid: false, error: 'Invalid SessionStatus message' }; break;
    case 'PlannerStatus': if (!['idle', 'planning', 'ready', 'error'].includes(String(payload.status))) return { valid: false, error: 'Invalid PlannerStatus message' }; break;
    case 'Ping': case 'Pong': if (!text(payload.nonce)) return { valid: false, error: `Invalid ${value.type} message` }; break;
    case 'Error': if (!text(payload.code) || !text(payload.message) || typeof payload.recoverable !== 'boolean') return { valid: false, error: 'Invalid Error message' }; break;
    default: return { valid: false, error: `Unsupported message type: ${value.type}` };
  }
  return { valid: true, message: value as unknown as ServerMessage };
}

export function dispatchServerMessage(message: ServerMessage, store: RuntimeStore, receivedAtMs: number): boolean {
  const state = store.getState(); const startedAt = performance.now(); let accepted = true;
  switch (message.type) {
    case 'RuntimeWorldState': accepted = state.publishRuntimeWorldState(message.payload).accepted; break;
    case 'NeuroState': accepted = state.publishNeuroState(message.payload, message.timestampMs).accepted; break;
    case 'SceneJourneyPlan': accepted = state.publishSceneJourneyPlan(message.payload, message.timestampMs).accepted; break;
    case 'SessionStatus': state.setSessionRuntime({ ...message.payload }); break;
    case 'PlannerStatus': state.setSessionRuntime({ plannerStatus: message.payload.status, plannerMessage: message.payload.message }); break;
    case 'Error': state.setConnectionState({ error: `${message.payload.code}: ${message.payload.message}`, status: 'degraded' }); break;
    case 'Ping': case 'Pong': break;
  }
  runtimeDiagnostics.recordStoreUpdate(performance.now() - startedAt);
  if (!accepted) runtimeDiagnostics.recordRejected(`Rejected ${message.type} at ${message.timestampMs} ms`);
  state.setConnectionState({ lastMessageAtMs: receivedAtMs }); return accepted;
}

export function createClientCommand(sessionId: string, payload: ClientCommandPayload, timestampMs = Date.now()): ClientCommandMessage {
  return { type: 'ClientCommand', protocolVersion: NEUROSCAPE_PROTOCOL_VERSION, sessionId, timestampMs, payload };
}
export function createStartSessionCommand(sessionId: string, worldDescription: string, durationMinutes: number, eegSource: 'muse' | 'recorded', timestampMs = Date.now()): ClientCommandMessage {
  return createClientCommand(sessionId, { command: 'startSession', worldDescription: worldDescription.trim(), durationMinutes, eegSource }, timestampMs);
}
