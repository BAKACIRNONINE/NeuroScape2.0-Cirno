import type {
  ListenerState,
  RuntimeJourneyState,
  SceneJourneyPlan,
  Vector3,
} from '@neuroscape/contracts';
import type { RuntimeEventBus } from '../events/RuntimeEvents.js';
import type { SemanticLocationMapper } from '../scene-graph/SemanticLocationMapper.js';
import {
  EPSILON,
  lerpVector,
  lookRotation,
  normalizeVector,
  scaleVector,
  slerpQuaternion,
  smoothstep,
  smoothstepDerivative,
  subtractVector,
  vectorLength,
} from '../core/math.js';

interface ResolvedWaypoint {
  locationId: string;
  position: Vector3;
  arrivalTimeMs: number;
  pauseDurationMs: number;
}

export class JourneyController {
  readonly #orientationResponsePerSecond = 8;
  #waypoints: ResolvedWaypoint[] = [];
  #listener: ListenerState | undefined;
  #timestampMs = 0;
  #lastReachedIndex = 0;
  #currentSegmentIndex = -1;

  constructor(
    private readonly locationMapper: SemanticLocationMapper,
    private readonly events: RuntimeEventBus,
  ) {}

  initialize(plan: SceneJourneyPlan, timestampMs = 0): void {
    this.#timestampMs = timestampMs;
    this.#waypoints = resolveInitialWaypoints(plan, timestampMs, this.locationMapper);
    const first = this.#waypoints[0];
    if (!first) throw new Error('JourneyController requires at least one waypoint.');
    this.#listener = {
      worldPosition: [...first.position],
      orientation: [0, 0, 0, 1],
      velocity: [0, 0, 0],
      semanticLocation: first.locationId,
    };
    this.#lastReachedIndex = 0;
    this.#currentSegmentIndex = this.#waypoints.length > 1 ? 0 : -1;
    this.events.emit({ type: 'JourneyStarted', timestampMs, planId: plan.planId });
  }

  replacePlan(plan: SceneJourneyPlan): void {
    const listener = this.requireListener();
    const authoredFutureExists = plan.userJourney.waypoints.some(
      (waypoint) =>
        waypoint.arrivalTimeMs !== undefined &&
        waypoint.arrivalTimeMs > this.#timestampMs,
    );
    const relevantWaypoints = authoredFutureExists
      ? plan.userJourney.waypoints.filter(
          (waypoint, index, all) =>
            index === all.length - 1 ||
            (waypoint.arrivalTimeMs !== undefined &&
              waypoint.arrivalTimeMs > this.#timestampMs),
        )
      : plan.userJourney.waypoints;
    const planned = relevantWaypoints.map((waypoint) => ({
      locationId: waypoint.locationId,
      position: this.locationMapper.resolve(waypoint.locationId),
      pauseDurationMs: waypoint.pauseDurationMs ?? 0,
      arrivalTimeMs: waypoint.arrivalTimeMs,
    }));
    // Runtime position is authoritative at a plan-merge boundary. Historical
    // journey waypoints must never pull the listener backwards through an old
    // path, and the current semantic node does not need a duplicate waypoint.
    const firstPlanned = planned[0];
    const future =
      firstPlanned?.locationId === listener.semanticLocation &&
      (firstPlanned.arrivalTimeMs === undefined ||
        firstPlanned.arrivalTimeMs <= this.#timestampMs)
        ? planned.slice(1)
        : planned;
    const anchors = [
      {
        locationId: listener.semanticLocation,
        position: [...listener.worldPosition] as Vector3,
        pauseDurationMs: 0,
        arrivalTimeMs: this.#timestampMs,
      },
      ...future,
    ];
    const segmentDurationMs =
      anchors.length > 1 ? (plan.planningHorizonSec * 1000) / (anchors.length - 1) : 0;
    let previousArrival = this.#timestampMs;
    let previousPause = 0;
    this.#waypoints = anchors.map((waypoint, index) => {
      const earliestArrival =
        index === 0
          ? this.#timestampMs
          : previousArrival + previousPause + 1;
      const fallbackArrival = this.#timestampMs + index * segmentDurationMs;
      const arrivalTimeMs =
        index === 0
          ? this.#timestampMs
          : Math.max(
              earliestArrival,
              waypoint.arrivalTimeMs ?? fallbackArrival,
            );
      previousArrival = arrivalTimeMs;
      previousPause = waypoint.pauseDurationMs;
      return { ...waypoint, arrivalTimeMs };
    });
    this.#lastReachedIndex = 0;
    this.#currentSegmentIndex = anchors.length > 1 ? 0 : -1;
    this.#listener = { ...listener, velocity: [0, 0, 0] };
    this.events.emit({ type: 'JourneyStarted', timestampMs: this.#timestampMs, planId: plan.planId });
  }

  update(deltaTimeMs: number): ListenerState {
    assertDeltaTime(deltaTimeMs);
    const listener = this.requireListener();
    this.#timestampMs += deltaTimeMs;
    this.emitReachedWaypoints();
    const sample = this.sampleJourney(this.#timestampMs);
    let orientation = listener.orientation;
    if (vectorLength(sample.velocity) > EPSILON && deltaTimeMs > 0) {
      const targetOrientation = lookRotation(normalizeVector(sample.velocity));
      const response = 1 - Math.exp(-this.#orientationResponsePerSecond * (deltaTimeMs / 1000));
      orientation = slerpQuaternion(listener.orientation, targetOrientation, response);
    }
    this.#listener = {
      worldPosition: sample.position,
      velocity: sample.velocity,
      orientation,
      semanticLocation: this.#waypoints[this.#lastReachedIndex]?.locationId ?? listener.semanticLocation,
    };
    this.#currentSegmentIndex = sample.segmentIndex;
    return this.getListenerState();
  }

  getListenerState(): ListenerState {
    const listener = this.requireListener();
    return {
      ...listener,
      worldPosition: [...listener.worldPosition],
      orientation: [...listener.orientation],
      velocity: [...listener.velocity],
    };
  }

  getJourneyState(): RuntimeJourneyState {
    return {
      plannedPath: this.#waypoints.map((waypoint) => [...waypoint.position]),
      currentSegmentIndex: this.#currentSegmentIndex,
      remainingWaypoints: this.#waypoints
        .slice(this.#lastReachedIndex + 1)
        .map((waypoint) => [...waypoint.position]),
    };
  }

  reset(): void {
    this.#waypoints = [];
    this.#listener = undefined;
    this.#timestampMs = 0;
    this.#lastReachedIndex = 0;
    this.#currentSegmentIndex = -1;
  }

  private sampleJourney(timestampMs: number): {
    position: Vector3;
    velocity: Vector3;
    segmentIndex: number;
  } {
    const first = this.#waypoints[0];
    if (!first) throw new Error('JourneyController is not initialized.');
    for (let index = 0; index < this.#waypoints.length - 1; index += 1) {
      const from = this.#waypoints[index]!;
      const to = this.#waypoints[index + 1]!;
      const startTimeMs = from.arrivalTimeMs + from.pauseDurationMs;
      if (timestampMs < startTimeMs) {
        return { position: [...from.position], velocity: [0, 0, 0], segmentIndex: index };
      }
      if (timestampMs <= to.arrivalTimeMs) {
        const durationMs = Math.max(1, to.arrivalTimeMs - startTimeMs);
        const progress = Math.max(0, Math.min(1, (timestampMs - startTimeMs) / durationMs));
        const delta = subtractVector(to.position, from.position);
        const velocityScale = (smoothstepDerivative(progress) / durationMs) * 1000;
        return {
          position: lerpVector(from.position, to.position, smoothstep(progress)),
          velocity: scaleVector(delta, velocityScale),
          segmentIndex: index,
        };
      }
    }
    const last = this.#waypoints[this.#waypoints.length - 1]!;
    return { position: [...last.position], velocity: [0, 0, 0], segmentIndex: -1 };
  }

  private emitReachedWaypoints(): void {
    while (
      this.#lastReachedIndex + 1 < this.#waypoints.length &&
      this.#waypoints[this.#lastReachedIndex + 1]!.arrivalTimeMs <= this.#timestampMs
    ) {
      const previous = this.#waypoints[this.#lastReachedIndex]!;
      this.#lastReachedIndex += 1;
      const reached = this.#waypoints[this.#lastReachedIndex]!;
      this.events.emit({
        type: 'WaypointReached',
        timestampMs: this.#timestampMs,
        waypointIndex: this.#lastReachedIndex,
        locationId: reached.locationId,
      });
      if (previous.locationId !== reached.locationId) {
        this.events.emit({
          type: 'SemanticLocationChanged',
          timestampMs: this.#timestampMs,
          previousLocationId: previous.locationId,
          locationId: reached.locationId,
        });
      }
    }
  }

  private requireListener(): ListenerState {
    if (!this.#listener) throw new Error('JourneyController is not initialized.');
    return this.#listener;
  }
}

function resolveInitialWaypoints(
  plan: SceneJourneyPlan,
  startTimeMs: number,
  mapper: SemanticLocationMapper,
): ResolvedWaypoint[] {
  const count = plan.userJourney.waypoints.length;
  const defaultSegmentDurationMs = count > 1 ? (plan.planningHorizonSec * 1000) / (count - 1) : 0;
  let previousArrival = startTimeMs;
  let previousPause = 0;
  return plan.userJourney.waypoints.map((waypoint, index) => {
    const requestedArrival = waypoint.arrivalTimeMs;
    const earliestArrival = index === 0 ? startTimeMs : previousArrival + previousPause + 1;
    const derivedArrival = startTimeMs + index * defaultSegmentDurationMs;
    const arrivalTimeMs =
      index === 0
        ? startTimeMs
        : Math.max(earliestArrival, requestedArrival ?? derivedArrival);
    previousArrival = arrivalTimeMs;
    previousPause = waypoint.pauseDurationMs ?? 0;
    return {
      locationId: waypoint.locationId,
      position: mapper.resolve(waypoint.locationId),
      arrivalTimeMs,
      pauseDurationMs: previousPause,
    };
  });
}

function assertDeltaTime(deltaTimeMs: number): void {
  if (!Number.isFinite(deltaTimeMs) || deltaTimeMs < 0) {
    throw new Error('deltaTimeMs must be a non-negative finite number.');
  }
}
