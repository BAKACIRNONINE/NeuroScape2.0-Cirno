import type { SessionTimestampMs } from './neuro-state.js';

export type Vector3 = [number, number, number];
export type Quaternion = [number, number, number, number];

export interface ListenerState {
  worldPosition: Vector3;
  orientation: Quaternion;
  velocity: Vector3;
  semanticLocation: string;
}

export interface AmbientState {
  id: string;
  assetId: string;
  mode: 'global' | 'localized';
  worldPosition?: Vector3;
  gain: number;
  active: boolean;
}

export type ActionAttachment = 'head' | 'chest' | 'feet' | 'body';

export interface ActionState {
  id: string;
  assetId: string;
  attachment: ActionAttachment;
  relativePosition: Vector3;
  worldPosition: Vector3;
  gain: number;
  active: boolean;
}

export type EventLifecycle = 'waiting' | 'active' | 'finished';

export interface EventState {
  id: string;
  assetId: string;
  worldPosition: Vector3;
  velocity: Vector3;
  gain: number;
  lifecycle: EventLifecycle;
  active: boolean;
}

export interface RuntimeJourneyState {
  plannedPath: Vector3[];
  currentSegmentIndex: number;
  remainingWaypoints: Vector3[];
}

export interface RuntimeWorldState {
  timestampMs: SessionTimestampMs;
  listener: ListenerState;
  journey?: RuntimeJourneyState;
  ambient: AmbientState[];
  action: ActionState[];
  event: EventState[];
}
