import type {
  ActionState,
  AmbientState,
  EventState,
  ListenerState,
  RuntimeJourneyState,
  RuntimeWorldState,
  Vector3,
} from '@neuroscape/contracts';

export interface RuntimeWorldStateComponents {
  timestampMs: number;
  listener: ListenerState;
  journey: RuntimeJourneyState;
  ambient: AmbientState[];
  action: ActionState[];
  event: EventState[];
}

export class RuntimeWorldStateBuilder {
  constructor(
    private readonly onBuildDurationMs?: (durationMs: number) => void,
  ) {}

  build(components: RuntimeWorldStateComponents): RuntimeWorldState {
    const startedAt = performance.now();
    const snapshot = freezeSnapshot(components);
    this.onBuildDurationMs?.(performance.now() - startedAt);
    return snapshot;
  }
}

function cloneVector(vector: Vector3): Vector3 {
  return [vector[0], vector[1], vector[2]];
}

function freezeAudiblePolicies<
  T extends AmbientState | ActionState | EventState,
>(item: T): T {
  const copy = { ...item };
  if (copy.distancePolicy)
    copy.distancePolicy = Object.freeze({ ...copy.distancePolicy });
  if (copy.playback)
    copy.playback = Object.freeze({
      ...copy.playback,
      ...(copy.playback.perRepeatGain
        ? {
            perRepeatGain: Object.freeze([
              ...copy.playback.perRepeatGain,
            ]) as unknown as number[],
          }
        : {}),
    });
  return copy;
}

function freezeSnapshot(state: RuntimeWorldState): RuntimeWorldState {
  const ambient = state.ambient.map((item): AmbientState => {
    const copy: AmbientState = freezeAudiblePolicies(item);
    if (item.worldPosition)
      copy.worldPosition = cloneVector(item.worldPosition);
    return Object.freeze(copy);
  });
  const snapshot = {
    ...state,
    listener: Object.freeze({
      ...state.listener,
      worldPosition: Object.freeze(cloneVector(state.listener.worldPosition)),
      orientation: Object.freeze([...state.listener.orientation]),
      velocity: Object.freeze(cloneVector(state.listener.velocity)),
    }),
    journey: state.journey
      ? Object.freeze({
          ...state.journey,
          plannedPath: Object.freeze(
            state.journey.plannedPath.map((point) =>
              Object.freeze(cloneVector(point)),
            ),
          ),
          remainingWaypoints: Object.freeze(
            state.journey.remainingWaypoints.map((point) =>
              Object.freeze(cloneVector(point)),
            ),
          ),
        })
      : undefined,
    ambient: Object.freeze(ambient),
    action: Object.freeze(
      state.action.map((item) =>
        Object.freeze({
          ...freezeAudiblePolicies(item),
          relativePosition: Object.freeze(cloneVector(item.relativePosition)),
          worldPosition: Object.freeze(cloneVector(item.worldPosition)),
        }),
      ),
    ),
    event: Object.freeze(
      state.event.map((item) =>
        Object.freeze({
          ...freezeAudiblePolicies(item),
          worldPosition: Object.freeze(cloneVector(item.worldPosition)),
          velocity: Object.freeze(cloneVector(item.velocity)),
        }),
      ),
    ),
  };
  return Object.freeze(snapshot) as unknown as RuntimeWorldState;
}
