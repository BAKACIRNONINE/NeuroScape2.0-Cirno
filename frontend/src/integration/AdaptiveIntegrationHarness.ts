import {
  AdaptivePlannerEngine,
  MockDecisionProvider,
  MockPlanningProvider,
  createMockTbrReplay,
  initialForestPlan,
  mockCalibrationProfile,
  phase1Config,
  type AdaptiveCheckpointResult,
  type AttentionState,
} from '@neuroscape/adaptive-planner';
import {
  NEUROSCAPE_PROTOCOL_VERSION,
  type AdaptiveTraceRecord,
  type NeuroState,
  type ServerMessage,
} from '@neuroscape/contracts';
import {
  ActionController,
  AmbientController,
  EventController,
  JourneyController,
  PlanValidator,
  RuntimeController,
  RuntimeEventBus,
  RuntimeWorldStateBuilder,
  SceneGraph,
  SemanticLocationMapper,
  TransitionController,
} from '@neuroscape/runtime-scene-controller';
import { runtimeDiagnostics } from '../debug/index.js';
import {
  dispatchServerMessage,
  parseServerMessage,
} from '../network/protocol.js';
import { sessionRecorder } from '../recording/recordingStore.js';
import { runtimeStore, type RuntimeStore } from '../runtime/RuntimeStore.js';
import { forestSceneGraph } from './canonicalForestScenario.js';

export interface AdaptiveHarnessState {
  status: 'idle' | 'running' | 'paused' | 'ended';
  timestampMs: number;
  checkpointCount: number;
  adaptationCount: number;
}
export interface AdaptiveIntervalApi {
  set(callback: () => void, milliseconds: number): unknown;
  clear(handle: unknown): void;
}
const intervals: AdaptiveIntervalApi = {
  set: (callback, milliseconds) => setInterval(callback, milliseconds),
  clear: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
};

export class AdaptiveIntegrationHarness {
  readonly #store: RuntimeStore;
  readonly #intervals: AdaptiveIntervalApi;
  readonly #listeners = new Set<() => void>();
  readonly #sessionId = 'adaptive-mock-session';
  #runtime: RuntimeController | null = null;
  #planner: AdaptivePlannerEngine | null = null;
  #timer: unknown;
  #busy = false;
  #epochIndex = 0;
  #replay = createMockTbrReplay();
  #state: AdaptiveHarnessState = {
    status: 'idle',
    timestampMs: 0,
    checkpointCount: 0,
    adaptationCount: 0,
  };

  constructor(
    store: RuntimeStore = runtimeStore,
    intervalApi: AdaptiveIntervalApi = intervals,
  ) {
    this.#store = store;
    this.#intervals = intervalApi;
  }
  getState = () => this.#state;
  subscribe = (listener: () => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  start(): void {
    this.end(false);
    this.#store.getState().resetSessionStreams();
    runtimeDiagnostics.reset();
    this.#runtime = this.createRuntime();
    this.#planner = new AdaptivePlannerEngine({
      config: phase1Config,
      profile: mockCalibrationProfile,
      initialPlan: initialForestPlan,
      decisionProvider: new MockDecisionProvider(),
      planningProvider: new MockPlanningProvider(phase1Config),
    });
    this.#runtime.initialize(initialForestPlan);
    this.#epochIndex = 0;
    this.#state = {
      status: 'running',
      timestampMs: 0,
      checkpointCount: 0,
      adaptationCount: 0,
    };
    this.dispatch('PlannerStatus', 0, {
      status: 'ready',
      message: 'Module 01/02 mock providers ready · opening phase',
    });
    this.dispatch('SceneJourneyPlan', 0, initialForestPlan);
    this.dispatch('RuntimeWorldState', 0, this.#runtime.currentState!);
    this.dispatch('SessionStatus', 0, {
      status: 'running',
      elapsedTimeMs: 0,
      message: '10-minute adaptive mock replay · 10× accelerated',
    });
    this.startTimer();
    this.emit();
  }

  pause(): void {
    if (this.#state.status !== 'running') return;
    this.clearTimer();
    this.#state = { ...this.#state, status: 'paused' };
    this.dispatch('SessionStatus', this.#state.timestampMs, {
      status: 'paused',
      elapsedTimeMs: this.#state.timestampMs,
    });
    this.emit();
  }
  resume(): void {
    if (this.#state.status !== 'paused') return;
    this.#state = { ...this.#state, status: 'running' };
    this.dispatch('SessionStatus', this.#state.timestampMs, {
      status: 'running',
      elapsedTimeMs: this.#state.timestampMs,
    });
    this.startTimer();
    this.emit();
  }
  end(publish = true): void {
    this.clearTimer();
    this.#runtime?.shutdown();
    this.#runtime = null;
    this.#planner = null;
    if (publish) {
      this.dispatch('SessionStatus', this.#state.timestampMs, {
        status: 'ended',
        elapsedTimeMs: this.#state.timestampMs,
        message: 'Adaptive mock session complete; recording bundle is ready.',
      });
      this.#state = { ...this.#state, status: 'ended' };
      this.emit();
    }
  }

  async tick(deltaTimeMs = 1_000): Promise<void> {
    if (
      this.#busy ||
      !this.#runtime ||
      !this.#planner ||
      this.#state.status !== 'running'
    )
      return;
    this.#busy = true;
    try {
      const nextTimestamp = Math.min(
        phase1Config.sessionDurationMs,
        this.#state.timestampMs + deltaTimeMs,
      );
      while (
        this.#epochIndex < this.#replay.length &&
        this.#replay[this.#epochIndex]!.timestampMs <= nextTimestamp
      ) {
        const epoch = this.#replay[this.#epochIndex++]!;
        const result = await this.#planner.ingest(epoch);
        const state = result?.state ?? this.#planner.attentionStates.at(-1)!;
        this.dispatch(
          'NeuroState',
          epoch.timestampMs,
          this.toProtocolNeuroState(state),
        );
        if (result) this.handleCheckpoint(result);
      }
      const startedAt = performance.now();
      const snapshot = this.#runtime.update(
        nextTimestamp - this.#state.timestampMs,
      );
      runtimeDiagnostics.recordModule03Update(performance.now() - startedAt);
      this.dispatch('RuntimeWorldState', snapshot.timestampMs, snapshot);
      this.dispatch('SessionStatus', snapshot.timestampMs, {
        status: 'running',
        elapsedTimeMs: snapshot.timestampMs,
        message: 'Adaptive mock replay',
      });
      this.#state = { ...this.#state, timestampMs: snapshot.timestampMs };
      this.emit();
      if (snapshot.timestampMs >= phase1Config.sessionDurationMs) this.end();
    } finally {
      this.#busy = false;
    }
  }

  private handleCheckpoint(result: AdaptiveCheckpointResult): void {
    this.#state = {
      ...this.#state,
      checkpointCount: this.#state.checkpointCount + 1,
    };
    this.trace(
      result.state.timestampMs,
      'attention-state',
      'deterministic',
      `${result.state.label}; trend ${result.state.trend}`,
      result.state,
    );
    this.trace(
      result.state.timestampMs,
      'eligibility',
      'deterministic',
      result.eligibility.eligible
        ? 'Eligible for Decision 1'
        : `Maintain: ${result.eligibility.reasons.join(', ')}`,
      result.eligibility,
    );
    if (!result.eligibility.eligible) {
      this.dispatch('PlannerStatus', result.state.timestampMs, {
        status: 'ready',
        message: `Eligibility gate: ${result.eligibility.reasons.join(', ')}. Maintain current soundscape.`,
      });
      return;
    }
    if (result.decision) {
      this.trace(
        result.state.timestampMs,
        'decision-1',
        'mock-llm',
        result.decision.rationale,
        result.decision,
      );
      this.dispatch('PlannerStatus', result.state.timestampMs, {
        status: result.decision.shouldAdapt ? 'planning' : 'ready',
        message: `Decision 1 · ${result.decision.shouldAdapt ? 'adapt' : 'maintain'}: ${result.decision.rationale}`,
      });
    }
    if (result.planning && result.plan && this.#runtime) {
      this.trace(
        result.state.timestampMs,
        'decision-2',
        'mock-llm',
        result.planning.rationale,
        result.planning,
      );
      this.#runtime.applyPlan(result.plan);
      this.dispatch('SceneJourneyPlan', result.state.timestampMs, result.plan);
      this.trace(
        result.state.timestampMs,
        'plan-applied',
        'deterministic',
        `Module 03 accepted ${result.plan.planId}`,
        {
          planId: result.plan.planId,
          selectedAssetIds: result.planning.selectedAssetIds,
        },
      );
      this.dispatch('PlannerStatus', result.state.timestampMs, {
        status: 'ready',
        message: `Decision 2 · ${result.planning.rationale}`,
      });
      this.#state = {
        ...this.#state,
        adaptationCount: this.#state.adaptationCount + 1,
      };
    }
  }

  private toProtocolNeuroState(state: AttentionState): NeuroState {
    const focus = state.focusPosition ?? 0.5;
    return {
      timestampMs: state.timestampMs,
      arousal: {
        value: focus,
        trend:
          state.trend === 'toward-focus'
            ? 'increasing'
            : state.trend === 'toward-mind-wandering'
              ? 'decreasing'
              : 'stable',
      },
      confidence: state.confidence,
      attention: {
        focusPosition: state.focusPosition,
        mindWanderingPosition: state.mindWanderingPosition,
        label: state.label,
        trend: state.trend,
        variabilityMad: state.variabilityMad,
        phase: state.phase,
        validEpochCount: state.validEpochCount,
      },
    };
  }

  private trace(
    timestampMs: number,
    kind: AdaptiveTraceRecord['kind'],
    source: AdaptiveTraceRecord['source'],
    summary: string,
    data: object,
  ): void {
    sessionRecorder.appendAdaptiveTrace({
      timestampMs,
      kind,
      source,
      summary,
      data: structuredClone(data) as Record<string, unknown>,
    });
  }
  private createRuntime(): RuntimeController {
    const graph = new SceneGraph(forestSceneGraph),
      mapper = new SemanticLocationMapper(graph),
      events = new RuntimeEventBus(),
      transitions = new TransitionController(events);
    return new RuntimeController({
      validator: new PlanValidator(graph),
      stateBuilder: new RuntimeWorldStateBuilder(),
      journey: new JourneyController(mapper, events),
      ambient: new AmbientController(mapper, transitions),
      action: new ActionController(transitions),
      event: new EventController(mapper, transitions, events),
      transitions,
      events,
    });
  }
  private dispatch(
    type: ServerMessage['type'],
    timestampMs: number,
    payload: unknown,
  ): void {
    const parsed = parseServerMessage(
      {
        type,
        protocolVersion: NEUROSCAPE_PROTOCOL_VERSION,
        sessionId: this.#sessionId,
        timestampMs,
        payload,
      },
      this.#sessionId,
    );
    if (!parsed.valid)
      throw new Error(`Adaptive protocol failure: ${parsed.error}`);
    dispatchServerMessage(parsed.message, this.#store, performance.now());
  }
  private startTimer(): void {
    this.#timer = this.#intervals.set(() => void this.tick(), 100);
  }
  private clearTimer(): void {
    if (this.#timer !== undefined) this.#intervals.clear(this.#timer);
    this.#timer = undefined;
  }
  private emit(): void {
    this.#listeners.forEach((listener) => listener());
  }
}

export const adaptiveIntegrationHarness = new AdaptiveIntegrationHarness();
