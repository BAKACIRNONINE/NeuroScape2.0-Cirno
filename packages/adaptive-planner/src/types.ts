import type {
  ActionPlanItem,
  AmbientPlanItem,
  EventPlanItem,
  SceneJourneyPlan,
  UserJourneyPlan,
} from '@neuroscape/contracts';

export type SessionPhase = 'opening' | 'adaptive' | 'closing';
export type AttentionLabel =
  'focus-leaning' | 'intermediate' | 'mind-wandering-leaning' | 'uncertain';
export type AttentionTrend =
  'toward-focus' | 'toward-mind-wandering' | 'stable' | 'insufficient-history';

export interface CalibrationProfile {
  profileId: string;
  focusedAnchorLogTbr: number;
  mindWanderingAnchorLogTbr: number;
  pooledMad: number;
  mappingAvailable: boolean;
  qualityStatus: 'pass' | 'provisional' | 'fail';
  featureVersion: string;
}

export interface TbrEpoch {
  timestampMs: number;
  logTbr: number | null;
  valid: boolean;
  qualityScore: number;
  artifactFlags: string[];
}

export interface AttentionState {
  timestampMs: number;
  phase: SessionPhase;
  currentLogTbr: number | null;
  focusPosition: number | null;
  mindWanderingPosition: number | null;
  unboundedMindWanderingPosition: number | null;
  label: AttentionLabel;
  trend: AttentionTrend;
  trendDeltaPerCheckpoint: number | null;
  variabilityMad: number | null;
  sustainedMindWanderingWindows: number;
  confidence: number;
  validEpochCount: number;
}

export interface EligibilityResult {
  eligible: boolean;
  timestampMs: number;
  reasons: string[];
}

export interface AdaptationRestrictions {
  allowEvent: boolean;
  allowBodyAnchor: boolean;
  allowSceneTransition: boolean;
  sceneTransitionsRemaining: number;
}

export interface AdaptationHistoryItem {
  timestampMs: number;
  goal: AdaptationGoal;
  scope: AdaptationScope;
  assetIds: string[];
  rationale: string;
}

export type AdaptationGoal =
  | 'maintain'
  | 'gently-reorient'
  | 'support-grounding'
  | 'reduce-stimulation'
  | 'refresh-engagement';
export type AdaptationScope = 'maintain' | 'within-scene' | 'scene-transition';

export interface DecisionContext {
  state: AttentionState;
  recentStates: AttentionState[];
  currentPlan: SceneJourneyPlan;
  history: AdaptationHistoryItem[];
  restrictions: AdaptationRestrictions;
}

export interface AdaptationDecision {
  shouldAdapt: boolean;
  goal: AdaptationGoal;
  scope: AdaptationScope;
  rationale: string;
  provider: string;
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
}

export interface Decision2Input {
  promptVersion: string;
  prompt: string;
  outputSchema: Record<string, unknown>;
  currentScene: string;
  candidates: Decision2Candidate[];
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
}
