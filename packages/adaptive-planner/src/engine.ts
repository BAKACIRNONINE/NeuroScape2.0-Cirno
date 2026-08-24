import type { SceneJourneyPlan } from '@neuroscape/contracts';
import type { AdaptivePlannerConfig } from './config.js';
import {
  prepareDecision2Input,
  validateDecision2Selection,
} from './audio-retrieval.js';
import { evaluateEligibility, restrictionsFor } from './gate.js';
import { AttentionInterpreter } from './interpreter.js';
import { mergePlanPatch } from './plan-merge.js';
import type {
  AdaptationHistoryItem,
  AdaptiveCheckpointResult,
  AttentionState,
  CalibrationProfile,
  DecisionProvider,
  PlanningProvider,
  TbrEpoch,
} from './types.js';

export class AdaptivePlannerEngine {
  readonly #config: AdaptivePlannerConfig;
  readonly #profile: CalibrationProfile;
  readonly #interpreter: AttentionInterpreter;
  readonly #decisionProvider: DecisionProvider;
  readonly #planningProvider: PlanningProvider;
  readonly #checkpointStates: AttentionState[] = [];
  readonly #history: AdaptationHistoryItem[] = [];
  #currentPlan: SceneJourneyPlan;
  #transitionUntilMs = 0;

  constructor(options: {
    config: AdaptivePlannerConfig;
    profile: CalibrationProfile;
    initialPlan: SceneJourneyPlan;
    decisionProvider: DecisionProvider;
    planningProvider: PlanningProvider;
  }) {
    this.#config = options.config;
    this.#profile = options.profile;
    this.#currentPlan = structuredClone(options.initialPlan);
    this.#decisionProvider = options.decisionProvider;
    this.#planningProvider = options.planningProvider;
    this.#interpreter = new AttentionInterpreter(
      options.profile,
      options.config,
    );
  }

  async ingest(epoch: TbrEpoch): Promise<AdaptiveCheckpointResult | null> {
    const rawState = this.#interpreter.ingest(epoch);
    if (!this.isCheckpoint(epoch.timestampMs)) return null;
    const state = this.withCheckpointTrend(rawState);
    this.#checkpointStates.push(state);
    const lastMeaningfulChange =
      this.#history.at(-1)?.timestampMs ?? this.#config.openingDurationMs;
    const secondsSinceLastMeaningfulChange = Math.max(
      0,
      (state.timestampMs - lastMeaningfulChange) / 1_000,
    );
    const stasisPressure =
      state.timestampMs - lastMeaningfulChange >=
      this.#config.maxMeaningfulStasisMs;
    const eligibility = {
      ...evaluateEligibility(
        state,
        this.#profile,
        this.#history,
        this.#config,
        this.#transitionUntilMs,
        stasisPressure,
      ),
      secondsSinceLastMeaningfulChange,
      stasisPressure,
      transitionInProgress: state.timestampMs < this.#transitionUntilMs,
    };
    const result: AdaptiveCheckpointResult = { state, eligibility };
    if (!eligibility.eligible) return result;
    const context = {
      state,
      recentStates: structuredClone(this.#checkpointStates.slice(-6)),
      currentPlan: structuredClone(this.#currentPlan),
      history: structuredClone(this.#history),
      restrictions: restrictionsFor(state, this.#history, this.#config),
      secondsSinceLastMeaningfulChange,
      stasisPressure,
      transitionInProgress: state.timestampMs < this.#transitionUntilMs,
    };
    const decision = await this.#decisionProvider.decide(context);
    result.decision = decision;
    if (!decision.shouldAdapt) return result;
    const decision2Input = prepareDecision2Input(
      context,
      decision,
      this.#config,
    );
    const planning = await this.#planningProvider.plan(
      context,
      decision,
      decision2Input,
    );
    validateDecision2Selection(planning, decision2Input);
    const plan = mergePlanPatch(
      this.#currentPlan,
      planning.patch,
      state.timestampMs,
    );
    this.#currentPlan = plan;
    this.#transitionUntilMs =
      state.timestampMs +
      Math.max(
        planning.patch.transitionDurationMs ?? 0,
        plan.planningHorizonSec * 1_000,
      );
    this.#history.push({
      timestampMs: state.timestampMs,
      goal: decision.goal,
      scope: decision.scope,
      assetIds: planning.selectedAssetIds,
      rationale: `${decision.rationale} ${planning.rationale}`,
      intent: decision.intent,
      salience: decision.salience,
    });
    result.planning = planning;
    result.plan = structuredClone(plan);
    return result;
  }

  get currentPlan(): SceneJourneyPlan {
    return structuredClone(this.#currentPlan);
  }
  get history(): readonly AdaptationHistoryItem[] {
    return structuredClone(this.#history);
  }
  get attentionStates(): readonly AttentionState[] {
    return structuredClone(this.#interpreter.states);
  }

  private isCheckpoint(timestampMs: number): boolean {
    if (timestampMs < this.#config.openingDurationMs) return false;
    return (
      (timestampMs - this.#config.openingDurationMs) %
        this.#config.checkpointIntervalMs ===
      0
    );
  }

  private withCheckpointTrend(state: AttentionState): AttentionState {
    const recent = [
      ...this.#checkpointStates.slice(-(this.#config.trendWindowCount - 1)),
      state,
    ];
    const first = recent[0]?.relativePosition;
    const current = state.relativePosition;
    const delta =
      recent.length < this.#config.trendWindowCount ||
      first === null ||
      first === undefined ||
      current === null
        ? null
        : (current - first) / (recent.length - 1);
    const trend =
      delta === null
        ? 'insufficient-history'
        : delta > this.#config.trendDeltaThreshold
          ? 'toward-focus'
          : delta < -this.#config.trendDeltaThreshold
            ? 'toward-mind-wandering'
            : 'stable';
    const previous =
      this.#checkpointStates.at(-1)?.sustainedMindWanderingWindows ?? 0;
    const sustained =
      current !== null &&
      current <= 1 - this.#config.mindWanderingLeaningThreshold
        ? previous + 1
        : 0;
    return {
      ...state,
      trend,
      trendDeltaPerCheckpoint: delta,
      relativePositionPrevious: recent.at(-2)?.relativePosition ?? null,
      relativePositionSlope: delta,
      trajectory:
        delta === null
          ? 'unavailable'
          : state.variabilityMad !== null &&
              state.variabilityMad > this.#config.highVariabilityMad
            ? 'volatile'
            : delta > this.#config.trendDeltaThreshold
              ? 'improving'
              : delta < -this.#config.trendDeltaThreshold
                ? 'declining'
                : 'stable',
      sustainedMindWanderingWindows: sustained,
    };
  }
}
