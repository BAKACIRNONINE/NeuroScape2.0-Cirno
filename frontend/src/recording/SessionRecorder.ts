import {
  NEUROSCAPE_PROTOCOL_VERSION,
  RECORDED_SESSION_SCHEMA_VERSION,
  type AdaptiveTraceRecord,
  type RecordedSession,
  type RecordedCalibrationProfile,
  type SessionStatusPayload,
  type AudioPlaybackEvidence,
  type AudioExecutionDiagnostic,
} from '@neuroscape/contracts';
import type {
  RuntimeStore,
  RuntimeStoreState,
} from '../runtime/RuntimeStore.js';
import { immutableCopy } from '../runtime/validation.js';

export interface RecordingStartOptions {
  sessionId: string;
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
  calibrationProfile?: RecordedCalibrationProfile;
}
export class SessionRecorder {
  readonly #store: RuntimeStore;
  #unsubscribe: (() => void) | null = null;
  #recording: RecordedSession | null = null;
  constructor(store: RuntimeStore) {
    this.#store = store;
  }
  get active(): boolean {
    return this.#unsubscribe !== null;
  }
  start(options: RecordingStartOptions): void {
    if (this.active) return;
    const initial = this.#store.getState();
    this.#recording = {
      metadata: {
        sessionId: options.sessionId,
        protocolVersion: NEUROSCAPE_PROTOCOL_VERSION,
        schemaVersion: RECORDED_SESSION_SCHEMA_VERSION,
        durationMs: 0,
        startState: initial.sessionRuntime.status,
        endState: initial.sessionRuntime.status,
        userPrompt: options.userPrompt,
        eegMode: options.eegMode,
        participantId: options.participantId,
        runMode: options.runMode,
        plannerMode: options.plannerMode,
        startedAtIso: options.startedAtIso,
        controlAudioId: options.controlAudioId,
        controlTrajectoryId: options.controlTrajectoryId,
        basePlanId: options.basePlanId,
        basePlanVersion: options.basePlanVersion,
        basePlanProfileId: options.basePlanProfileId,
        assignmentRuleVersion: options.assignmentRuleVersion,
        conditionOrder: options.conditionOrder,
        pairedBasePlanId: options.pairedBasePlanId,
        basePlanExecutionMode: options.basePlanExecutionMode,
      },
      calibrationProfile: options.calibrationProfile
        ? structuredClone(options.calibrationProfile)
        : undefined,
      runtimeSnapshots: [],
      neuroStates: [],
      sceneJourneyPlans: [],
      sessionEvents: [],
      plannerEvents: [],
      adaptiveTrace: [],
      eegMetrics: [],
      decisionEvents: [],
      audioPlaybackEvidence: [],
      audioExecutionDiagnostics: [],
    };
    this.#unsubscribe = this.#store.subscribe((state, previous) =>
      this.#capture(state, previous),
    );
  }
  stop(): RecordedSession | null {
    this.#unsubscribe?.();
    this.#unsubscribe = null;
    if (!this.#recording) return null;
    const session = this.#store.getState().sessionRuntime;
    this.#recording.metadata.durationMs = Math.max(
      session.elapsedTimeMs,
      this.#recording.runtimeSnapshots.at(-1)?.timestampMs ?? 0,
      this.#recording.neuroStates.at(-1)?.timestampMs ?? 0,
    );
    this.#recording.metadata.endState = session.status;
    this.#recording.adaptiveSummary = deriveAdaptiveSummary(
      this.#recording.adaptiveTrace,
    );
    this.#recording.appliedAudioExposures = deriveAppliedAudioExposures(
      this.#recording.audioPlaybackEvidence ?? [],
    );
    return immutableCopy(this.#recording) as RecordedSession;
  }
  snapshot(): RecordedSession | null {
    return this.#recording ? structuredClone(this.#recording) : null;
  }
  appendAdaptiveTrace(record: AdaptiveTraceRecord): void {
    if (this.#recording) {
      this.#recording.adaptiveTrace.push(structuredClone(record));
      if (record.kind === 'decision-1' || record.kind === 'decision-2')
        (this.#recording.decisionEvents ??= []).push({
          timestampMs: record.timestampMs,
          type: record.kind,
        });
    }
  }
  appendEegMetric(
    metric: NonNullable<RecordedSession['eegMetrics']>[number],
  ): void {
    if (this.#recording)
      (this.#recording.eegMetrics ??= []).push(structuredClone(metric));
  }
  appendAudioPlaybackEvidence(evidence: AudioPlaybackEvidence): void {
    if (this.#recording)
      (this.#recording.audioPlaybackEvidence ??= []).push(
        structuredClone(evidence),
      );
  }
  appendAudioExecutionDiagnostic(diagnostic: AudioExecutionDiagnostic): void {
    if (this.#recording)
      (this.#recording.audioExecutionDiagnostics ??= []).push(
        structuredClone(diagnostic),
      );
  }
  #capture(state: RuntimeStoreState, previous: RuntimeStoreState): void {
    const output = this.#recording;
    if (!output) return;
    if (
      state.runtimeWorldState !== previous.runtimeWorldState &&
      state.runtimeWorldState
    )
      output.runtimeSnapshots.push(structuredClone(state.runtimeWorldState));
    if (state.neuroState !== previous.neuroState && state.neuroState)
      output.neuroStates.push(structuredClone(state.neuroState));
    if (
      state.sceneJourneyPlan !== previous.sceneJourneyPlan &&
      state.sceneJourneyPlan &&
      state.sceneJourneyPlanReceivedAtMs !== null
    )
      output.sceneJourneyPlans.push({
        timestampMs: state.sceneJourneyPlanReceivedAtMs,
        value: structuredClone(state.sceneJourneyPlan),
      });
    if (
      state.sessionRuntime.status !== previous.sessionRuntime.status ||
      state.sessionRuntime.elapsedTimeMs !==
        previous.sessionRuntime.elapsedTimeMs
    ) {
      const status = state.sessionRuntime.status;
      if (status !== 'idle')
        output.sessionEvents.push({
          timestampMs: state.sessionRuntime.elapsedTimeMs,
          value: {
            status,
            elapsedTimeMs: state.sessionRuntime.elapsedTimeMs,
            message: state.sessionRuntime.message,
          } as SessionStatusPayload,
        });
    }
    if (
      state.sessionRuntime.plannerStatus !==
        previous.sessionRuntime.plannerStatus ||
      state.sessionRuntime.plannerMessage !==
        previous.sessionRuntime.plannerMessage
    )
      output.plannerEvents.push({
        timestampMs: state.sessionRuntime.elapsedTimeMs,
        value: {
          status: state.sessionRuntime.plannerStatus,
          message: state.sessionRuntime.plannerMessage,
        },
      });
  }
}

function deriveAdaptiveSummary(
  trace: RecordedSession['adaptiveTrace'],
): NonNullable<RecordedSession['adaptiveSummary']> {
  const terminals = trace.filter((item) => item.kind === 'adaptation-terminal');
  const countTerminal = (status: string) =>
    terminals.filter((item) => item.data.terminalStatus === status).length;
  const decision1 = trace.filter((item) => item.kind === 'decision-1');
  return {
    checkpointCount: trace.filter((item) => item.kind === 'attention-state')
      .length,
    gateEligibleCount: trace.filter(
      (item) => item.kind === 'eligibility' && item.data.eligible === true,
    ).length,
    decision1MaintainCount: decision1.filter(
      (item) => item.data.shouldAdapt === false,
    ).length,
    decision1AdaptCount: decision1.filter(
      (item) => item.data.shouldAdapt === true,
    ).length,
    decision2CallCount:
      trace.filter((item) => item.kind === 'decision-2').length +
      countTerminal('D2_SCHEMA_REJECTED'),
    decision2NoSafeChangeCount: countTerminal('D2_NO_SAFE_CHANGE'),
    materializationFailureCount: countTerminal('MATERIALIZATION_FAILED'),
    patchValidationRejectCount: countTerminal('PATCH_VALIDATION_REJECTED'),
    patchBudgetRejectCount: countTerminal('PATCH_BUDGET_EXHAUSTED'),
    runtimeRejectCount:
      countTerminal('RUNTIME_REJECTED') + countTerminal('RUNTIME_TIMEOUT'),
    appliedAdaptationCount: countTerminal('APPLIED'),
    sceneTransitionProposedCount: decision1.filter(
      (item) => item.data.scope === 'scene-transition',
    ).length,
    sceneTransitionAppliedCount: terminals.filter(
      (item) =>
        item.data.terminalStatus === 'APPLIED' &&
        typeof item.data.destinationNodeId === 'string',
    ).length,
  };
}

function deriveAppliedAudioExposures(
  evidence: AudioPlaybackEvidence[],
): NonNullable<RecordedSession['appliedAudioExposures']> {
  const groups = new Map<string, AudioPlaybackEvidence[]>();
  evidence.forEach((item) => {
    const key = `${item.adaptationId}:${item.elementId}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });
  return [...groups.values()].map((items) => {
    const plan = items.find((item) => item.status === 'PLAN_APPLIED');
    const activated = items.some((item) => item.status === 'RUNTIME_ACTIVATED');
    const start = items.find(
      (item) => item.status === 'AUDIO_STARTED',
    )?.audioStartMs;
    const finish = items.find(
      (item) => item.status === 'AUDIO_FINISHED',
    )?.audioEndMs;
    return {
      assetId: items[0]!.assetId,
      adaptationId: items[0]!.adaptationId,
      selectedByDecision2: plan?.selectedByDecision2 ?? false,
      systemGenerated: plan?.systemGenerated ?? false,
      validated: plan?.validated ?? false,
      runtimeActivated: activated,
      ...(start !== undefined ? { audioStartedAtMs: start } : {}),
      ...(finish !== undefined ? { audioFinishedAtMs: finish } : {}),
      ...(start !== undefined && finish !== undefined
        ? { effectiveExposureMs: Math.max(0, finish - start) }
        : {}),
    };
  });
}
