import type { ActionAttachment, Vector3 } from './runtime-world-state.js';

export type TransitionCurve = 'linear' | 'smoothstep' | 'cubic' | 'catmull-rom';

export interface JourneyWaypoint {
  locationId: string;
  arrivalTimeMs?: number;
  pauseDurationMs?: number;
}

export interface UserJourneyPlan {
  goal: string;
  waypoints: JourneyWaypoint[];
}

export interface AmbientPlanItem {
  id: string;
  assetId: string;
  mode: 'global' | 'localized';
  locationId?: string;
  gain: number;
  active: boolean;
}

export interface ActionPlanItem {
  id: string;
  assetId: string;
  attachment: ActionAttachment;
  relativePosition: Vector3;
  gain: number;
  active: boolean;
}

export interface EventTrajectoryWaypoint {
  locationId: string;
  timestampMs: number;
}

export interface EventPlanItem {
  id: string;
  assetId: string;
  activationTimeMs: number;
  durationMs: number;
  trajectory: EventTrajectoryWaypoint[];
  gain: number;
}

export interface SoundscapePlan {
  ambient: AmbientPlanItem[];
  action: ActionPlanItem[];
  event: EventPlanItem[];
}

export interface TransitionPolicy {
  defaultDurationMs: number;
  curve: TransitionCurve;
}

export interface SceneJourneyPlan {
  planId: string;
  planningHorizonSec: number;
  reasoningSummary?: string;
  userJourney: UserJourneyPlan;
  soundscape: SoundscapePlan;
  transitionPolicy: TransitionPolicy;
}
