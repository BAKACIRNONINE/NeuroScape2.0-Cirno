import type { NeuroState, RuntimeWorldState, SceneJourneyPlan } from '@neuroscape/contracts';
import { createStore } from 'zustand/vanilla';
import { immutableCopy, validateNeuroState, validateRuntimeWorldState, validateSceneJourneyPlan } from './validation.js';

export interface SessionRuntime { elapsedTimeMs: number; status: 'idle' | 'loading' | 'preview' | 'running' | 'paused' | 'ended'; message?: string; plannerStatus: 'idle' | 'planning' | 'ready' | 'error'; plannerMessage?: string }
export interface AudioRuntime { status: 'idle' | 'suspended' | 'running' | 'error' }
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'degraded' | 'reconnecting' | 'closed';
export interface ConnectionState { status: ConnectionStatus; attempt: number; latencyMs: number | null; lastMessageAtMs: number | null; error?: string }
export type PublishResult = { accepted: true } | { accepted: false; reason: 'invalid' | 'stale'; errors: string[] };

export interface RuntimeStoreState {
  neuroState: Readonly<NeuroState> | null; neuroStateReceivedAtMs: number | null;
  sceneJourneyPlan: Readonly<SceneJourneyPlan> | null; sceneJourneyPlanReceivedAtMs: number | null;
  runtimeWorldState: Readonly<RuntimeWorldState> | null; runtimeValidationErrors: readonly string[];
  sessionRuntime: SessionRuntime; audioRuntime: AudioRuntime; connectionState: ConnectionState;
  publishRuntimeWorldState: (candidate: unknown) => PublishResult;
  publishNeuroState: (candidate: unknown, receivedAtMs: number) => PublishResult;
  publishSceneJourneyPlan: (candidate: unknown, receivedAtMs: number) => PublishResult;
  setSessionRuntime: (value: Partial<SessionRuntime>) => void;
  setConnectionState: (value: Partial<ConnectionState>) => void;
  setAudioRuntime: (value: AudioRuntime) => void;
  resetRuntimeWorldState: () => void;
  resetSessionStreams: () => void;
}

export const createRuntimeStore = () => createStore<RuntimeStoreState>((set, get) => ({
  neuroState: null, neuroStateReceivedAtMs: null, sceneJourneyPlan: null, sceneJourneyPlanReceivedAtMs: null,
  runtimeWorldState: null, runtimeValidationErrors: [],
  sessionRuntime: { elapsedTimeMs: 0, status: 'idle', plannerStatus: 'idle' }, audioRuntime: { status: 'idle' },
  connectionState: { status: 'disconnected', attempt: 0, latencyMs: null, lastMessageAtMs: null },
  publishRuntimeWorldState: (candidate) => {
    const result = validateRuntimeWorldState(candidate);
    if (!result.valid) { set({ runtimeValidationErrors: Object.freeze([...result.errors]) }); return { accepted: false, reason: 'invalid', errors: result.errors }; }
    const current = get().runtimeWorldState;
    if (current && result.state.timestampMs <= current.timestampMs) { const errors = [`timestampMs ${result.state.timestampMs} is not newer than ${current.timestampMs}`]; set({ runtimeValidationErrors: Object.freeze(errors) }); return { accepted: false, reason: 'stale', errors }; }
    set({ runtimeWorldState: result.state, runtimeValidationErrors: [] }); return { accepted: true };
  },
  publishNeuroState: (candidate, receivedAtMs) => {
    if (!validateNeuroState(candidate)) return { accepted: false, reason: 'invalid', errors: ['Invalid NeuroState'] };
    if (get().neuroState && candidate.timestampMs <= get().neuroState!.timestampMs) return { accepted: false, reason: 'stale', errors: ['Stale NeuroState'] };
    set({ neuroState: immutableCopy(candidate), neuroStateReceivedAtMs: receivedAtMs }); return { accepted: true };
  },
  publishSceneJourneyPlan: (candidate, receivedAtMs) => {
    if (!validateSceneJourneyPlan(candidate)) return { accepted: false, reason: 'invalid', errors: ['Invalid SceneJourneyPlan'] };
    const previous = get().sceneJourneyPlanReceivedAtMs;
    if (previous !== null && receivedAtMs <= previous) return { accepted: false, reason: 'stale', errors: ['Stale SceneJourneyPlan'] };
    set({ sceneJourneyPlan: immutableCopy(candidate), sceneJourneyPlanReceivedAtMs: receivedAtMs }); return { accepted: true };
  },
  setSessionRuntime: (value) => set((state) => ({ sessionRuntime: { ...state.sessionRuntime, ...value } })),
  setConnectionState: (value) => set((state) => ({ connectionState: { ...state.connectionState, ...value } })),
  setAudioRuntime: (audioRuntime) => set({ audioRuntime }),
  resetRuntimeWorldState: () => set({ runtimeWorldState: null, runtimeValidationErrors: [] }),
  resetSessionStreams: () => set({ neuroState: null, neuroStateReceivedAtMs: null, sceneJourneyPlan: null, sceneJourneyPlanReceivedAtMs: null, runtimeWorldState: null, runtimeValidationErrors: [], sessionRuntime: { elapsedTimeMs: 0, status: 'idle', plannerStatus: 'idle' } }),
}));
export type RuntimeStore = ReturnType<typeof createRuntimeStore>;
export const runtimeStore = createRuntimeStore();
