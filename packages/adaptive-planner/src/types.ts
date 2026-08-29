import type {
  ActionPlanItem,
  AmbientPlanItem,
  EventPlanItem,
  SceneJourneyPlan,
  UserJourneyPlan,
} from '@neuroscape/contracts';
import type { BaseScenePlan } from './base-plan.js';
import type {
  ComplexityProjection,
  FutureScenePatch,
  PatchValidationResult,
} from './patching.js';
import type {
  AdaptationLifecycle,
  AdaptationMemoryCase,
  AdaptationOutcome,
} from './reflection.js';

export type SessionPhase = 'opening' | 'adaptive' | 'closing';
export type StateTrajectory =
  'improving' | 'stable' | 'declining' | 'volatile' | 'unavailable';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface CalibrationProfile {
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

export interface TbrEpoch {
  timestampMs: number;
  logTbr: number | null;
  valid: boolean;
  qualityScore: number;
  artifactFlags: string[];
  theta?: number | null;
  beta?: number | null;
}

export interface AttentionState {
  timestampMs: number;
  phase: SessionPhase;
  currentLogTbr: number | null;
  baselineLogTbr: number;
  baselineMad: number;
  baselineScale: number;
  effectiveBaselineScale: number;
  measurementConfidence: ConfidenceLevel;
  signalQuality: 'good' | 'fair' | 'poor' | 'unavailable';
  deltaFromBaseline: number | null;
  tbrRatioToBaseline: number | null;
  tbrPercentChange: number | null;
  robustDeltaFromBaseline: number | null;
  baselineRelation:
    | 'baseline-consistent'
    | 'tbr-elevated'
    | 'tbr-reduced'
    | 'uncertain';
  robustDeltaPrevious: number | null;
  robustDeltaSlope: number | null;
  trajectory: StateTrajectory;
  stateEstimationVersion: 'guided_baseline_delta_v1';
  trend: 'increasing' | 'decreasing' | 'stable' | 'insufficient-history';
  variabilityMad: number | null;
  sustainedElevatedWindows: number;
  sustainedReducedWindows: number;
  confidence: number;
  validEpochCount: number;
}

export interface EligibilityResult {
  eligible: boolean;
  timestampMs: number;
  reasons: string[];
  secondsSinceLastMeaningfulChange?: number;
  stasisPressure?: boolean;
  transitionInProgress?: boolean;
}

export interface AdaptationRestrictions {
  allowEvent: boolean;
  allowBodyAnchor: boolean;
  allowSceneTransition: boolean;
  sceneTransitionsRemaining: number;
}

export interface AdaptationHistoryItem {
  adaptationId?: string;
  timestampMs: number;
  goal: AdaptationGoal;
  scope: AdaptationScope;
  assetIds: string[];
  rationale: string;
  intent?: AdaptationIntent;
  salience?: AdaptationSalience;
  /** Set only after at least one sound belonging to this adaptation started. */
  experiencedAtMs?: number;
}

export interface RecentlyUsedAsset {
  assetId: string;
  family: string;
  lastPlayedMs: number;
  useCount: number;
  lastIntent?: AdaptationIntent;
}

export function reasoningAttentionState(state: AttentionState) {
  return structuredClone(state);
}

export type AdaptationGoal =
  | 'maintain'
  | 'gently-reorient'
  | 'support-grounding'
  | 'support-sustained-focus'
  | 'preserve-recovery'
  | 'reduce-stimulation'
  | 'refresh-engagement';
export type AdaptationScope = 'maintain' | 'within-scene' | 'scene-transition';

export interface DecisionContext {
  state: AttentionState;
  profile: CalibrationProfile;
  recentStates: AttentionState[];
  currentPlan: SceneJourneyPlan;
  history: AdaptationHistoryItem[];
  restrictions: AdaptationRestrictions;
  secondsSinceLastMeaningfulChange: number;
  stasisPressure: boolean;
  transitionInProgress: boolean;
  adaptationProgress?: {
    applied: number;
    targetMin: number;
    targetMax: number;
    expectedByNow: number;
    behindPace: boolean;
  };
  basePlan?: BaseScenePlan;
  upcomingBaseHorizon?: BaseScenePlan['scheduledElements'];
  relevantPriorOutcomes?: AdaptationMemoryCase[];
  complexityHeadroom?: ComplexityProjection;
}

export type AdaptationIntent =
  | 'gently_reorient_attention'
  | 'support_grounding'
  | 'reduce_stimulation'
  | 'support_sustained_focus'
  | 'refresh_engagement'
  | 'preserve_recovery'
  | 'maintain';
export type AdaptationSalience = 'minimal' | 'low' | 'moderate';

export interface AdaptationDecision {
  decision: 'adapt' | 'maintain';
  intent: AdaptationIntent;
  salience: AdaptationSalience;
  evidenceSummary: {
    relation: AttentionState['baselineRelation'];
    trajectory: StateTrajectory;
    confidence: ConfidenceLevel;
  };
  reason: string;
  maintainReason: string | null;
  constraintsForDecision2: string[];
  shouldAdapt: boolean;
  goal: AdaptationGoal;
  scope: AdaptationScope;
  rationale: string;
  provider: string;
  promptVersion?: string;
  prompt?: string;
  outputSchema?: Record<string, unknown>;
  model?: string;
  responseId?: string;
  usage?: LlmUsage;
  latencyMs?: number;
}

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  reasoningTokens?: number;
}

export interface SoundscapePlanPatch {
  reasoningSummary: string;
  journey?: UserJourneyPlan;
  upsertAmbient?: AmbientPlanItem[];
  upsertAction?: ActionPlanItem[];
  upsertEvent?: EventPlanItem[];
  removeIds?: string[];
  transitionDurationMs?: number;
}

export interface PlanningResult {
  patch: SoundscapePlanPatch;
  selectedAssetIds: string[];
  candidateAssetIds: string[];
  promptVersion: string;
  prompt: string;
  outputSchema: Record<string, unknown>;
  rationale: string;
  provider: string;
  model?: string;
  responseId?: string;
  usage?: LlmUsage;
  latencyMs?: number;
  normalizedFuturePatch?: FutureScenePatch;
}

export interface Decision2Candidate {
  assetId: string;
  familyId: string;
  label: string;
  description: string;
  scene: string[];
  layer: 'ambient' | 'event' | 'action';
  tags: string[];
  loop: boolean;
  suddenness: number;
  intensity: number;
  recommendedDistance: string;
  recommendedVolume: number;
  useWhen: string[];
  avoidWhen: string[];
  spatialBehavior: string[];
  defaultPosition: [number, number, number];
  defaultMotion: {
    type: string;
    durationSec: number | null;
    start?: [number, number, number];
    mid?: [number, number, number];
    end?: [number, number, number];
  };
  autoDeleteAfterSec: number | null;
  fadeInSec: number;
  fadeOutSec: number;
  priority: number;
  isPrimaryAmbient: boolean;
  isRareEvent: boolean;
  qualityTier: 'preferred' | 'standard' | 'limited_use';
  selectionWeight: number;
  remainingSessionAppearances: number | null;
  cooldownRemainingSec: number;
  maxSafeGain: number;
  qualityAttenuation: number;
  playbackContractSummary: string;
  compatibleEnvironmentalBonds: string[];
  gainRange: { min: number; recommended: number; max: number };
  currentlyActive: boolean;
  activeElementId?: string;
  currentGain?: number;
  currentPosition?: [number, number, number];
  currentLayer?: 'ambient' | 'event' | 'action';
  allowedOperations: Array<'ADJUST' | 'REPLACE' | 'SUPPRESS' | 'INSERT'>;
}

export interface Decision2RetrievalAudit {
  assetId: string;
  technicallyValid: boolean;
  filteringStages: string[];
  basePriorityScore: number;
  intentTagScore: number;
  qualityPenalty: number;
  recencyPenalty: number;
  repetitionPenalty: number;
  finalScore: number;
  currentlyActive: boolean;
  lastPlayedMs?: number;
  useCount: number;
  includedInFinalCandidates: boolean;
  exclusionReason?: string;
}

export interface OperationGuidance {
  currentDensity: 'low' | 'medium' | 'high';
  upcomingDensity: 'low' | 'medium' | 'high';
  complexityHeadroom: number;
  salienceHeadroom: number;
  prolongedStasis: boolean;
  preferredOperations: Array<
    'KEEP' | 'ADJUST' | 'RESCHEDULE' | 'REPLACE' | 'SUPPRESS' | 'INSERT'
  >;
}

export interface Decision2Input {
  promptVersion: string;
  prompt: string;
  outputSchema: Record<string, unknown>;
  currentScene: string;
  candidates: Decision2Candidate[];
  reasoningEffort: 'low' | 'medium';
  operationGuidance: OperationGuidance;
  fullLibrarySize: number;
  eligibleCandidateCount: number;
  retrievedCandidateIds: string[];
  recentlyUsedAssets: RecentlyUsedAsset[];
  retrievalAudit: Decision2RetrievalAudit[];
}

export interface AdaptationTimingTrace {
  decision1RequestStartMs?: number;
  decision1ResponseMs?: number;
  decision2RequestStartMs?: number;
  decision2ResponseMs?: number;
  patchValidationCompleteMs?: number;
  planAppliedMs?: number;
}

export interface DecisionProvider {
  decide(context: DecisionContext): Promise<AdaptationDecision>;
}

export interface PlanningProvider {
  plan(
    context: DecisionContext,
    decision: AdaptationDecision,
    input: Decision2Input,
  ): Promise<PlanningResult>;
}

export interface AdaptiveCheckpointResult {
  state: AttentionState;
  eligibility: EligibilityResult;
  decision?: AdaptationDecision;
  planning?: PlanningResult;
  plan?: SceneJourneyPlan;
  futurePatch?: FutureScenePatch;
  patchValidation?: PatchValidationResult;
  lifecycle?: AdaptationLifecycle;
  outcome?: AdaptationOutcome;
  timing: AdaptationTimingTrace;
  selectionTrace?: {
    fullLibrarySize: number;
    eligibleCandidateCount: number;
    retrievedCandidateIds: string[];
    recentlyUsedAssetIds: string[];
    selectedAssetIds?: string[];
    retrievalAudit: Decision2RetrievalAudit[];
  };
}
