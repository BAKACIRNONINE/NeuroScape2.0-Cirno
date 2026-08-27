import type {
  ActionPlanItem,
  ActionState,
  ListenerState,
  TransitionPolicy,
  Vector3,
} from '@neuroscape/contracts';
import {
  addVector,
  distance,
  EPSILON,
  rotateVector,
  vectorLength,
  plannedDistanceGain,
} from '../core/math.js';
import type { TransitionController } from './TransitionController.js';

interface ActionRuntimeObject {
  plan: ActionPlanItem;
  worldPosition: Vector3;
  transitionKey: string;
  runtimeActive: boolean;
  pendingRemoval: boolean;
  replacement?: ActionPlanItem;
  startMs: number;
  endMs: number;
  lifecycle: 'waiting' | 'active' | 'finished';
  runtimeActivationMs?: number;
  runtimeFinishedMs?: number;
}

export class ActionController {
  readonly #objects = new Map<string, ActionRuntimeObject>();
  #policy: TransitionPolicy = { defaultDurationMs: 1, curve: 'linear' };
  #timestampMs = 0;

  constructor(private readonly transitions: TransitionController) {}

  initialize(
    items: readonly ActionPlanItem[],
    policy: TransitionPolicy,
    listener: ListenerState,
  ): void {
    this.#objects.clear();
    this.#policy = policy;
    this.#timestampMs = 0;
    items.forEach((item) => this.create(item, listener));
  }

  merge(
    items: readonly ActionPlanItem[],
    policy: TransitionPolicy,
    listener: ListenerState,
  ): void {
    this.#policy = policy;
    const incoming = new Map(items.map((item) => [item.id, item]));
    const replacements: ActionPlanItem[] = [];
    for (const object of this.#objects.values()) {
      const item = incoming.get(object.plan.id);
      if (!item) {
        this.beginRemoval(object);
        continue;
      }
      incoming.delete(item.id);
      if (!isCompatible(object.plan, item)) {
        this.#objects.delete(object.plan.id);
        this.transitions.release(object.transitionKey);
        replacements.push(item);
        continue;
      }
      const currentGain = this.transitions.getValue(object.transitionKey, 0);
      object.plan = { ...item, relativePosition: [...item.relativePosition] };
      object.startMs = item.startMs ?? 0;
      object.endMs = item.endMs ?? Number.POSITIVE_INFINITY;
      object.pendingRemoval = false;
      object.replacement = undefined;
      const nextActive = shouldBeActive(object.plan, listener);
      object.runtimeActive = nextActive;
      this.transitions.scheduleGain(
        object.transitionKey,
        currentGain,
        nextActive ? item.gain : 0,
        policy.defaultDurationMs,
        policy.curve,
      );
    }
    [...incoming.values(), ...replacements].forEach((item) =>
      this.create(item, listener),
    );
  }

  update(deltaTimeMs: number, listener: ListenerState): void {
    this.#timestampMs += deltaTimeMs;
    for (const [id, object] of this.#objects) {
      if (
        object.pendingRemoval &&
        this.transitions.isComplete(object.transitionKey)
      ) {
        this.#objects.delete(id);
        this.transitions.release(object.transitionKey);
        if (object.replacement) this.create(object.replacement, listener);
        continue;
      }
      object.worldPosition = addVector(
        listener.worldPosition,
        rotateVector(listener.orientation, object.plan.relativePosition),
      );
      this.syncActivation(object, listener);
      const nextLifecycle = executionLifecycle(object, this.#timestampMs);
      if (nextLifecycle !== object.lifecycle) {
        object.lifecycle = nextLifecycle;
        if (nextLifecycle === 'active')
          object.runtimeActivationMs = this.#timestampMs;
        if (nextLifecycle === 'finished')
          object.runtimeFinishedMs = this.#timestampMs;
        this.transitions.scheduleGain(
          object.transitionKey,
          this.transitions.getValue(object.transitionKey, 0),
          nextLifecycle === 'active' ? object.plan.gain : 0,
          nextLifecycle === 'finished' ? 0 : this.#policy.defaultDurationMs,
          this.#policy.curve,
        );
      }
    }
  }

  getStates(): ActionState[] {
    return [...this.#objects.values()].map((object) => {
      const lifecycle = object.lifecycle;
      const gain =
        this.transitions.getValue(object.transitionKey, 0) *
        plannedDistanceGain(
          vectorLength(object.plan.relativePosition),
          object.plan.distancePolicy,
        );
      return {
        id: object.plan.id,
        adaptationId: object.plan.adaptationId,
        assetId: object.plan.assetId,
        attachment: object.plan.attachment,
        relativePosition: [...object.plan.relativePosition],
        worldPosition: [...object.worldPosition],
        gain,
        active: lifecycle === 'active' && gain > EPSILON,
        lifecycle,
        distancePolicy: structuredClone(object.plan.distancePolicy),
        playback: structuredClone(object.plan.playback),
        plannedStartMs: object.startMs,
        runtimeActivationMs: object.runtimeActivationMs,
        plannedEndMs: Number.isFinite(object.endMs) ? object.endMs : undefined,
        runtimeFinishedMs: object.runtimeFinishedMs,
      };
    });
  }

  get size(): number {
    return this.#objects.size;
  }

  reset(): void {
    this.#objects.clear();
    this.#timestampMs = 0;
  }

  private create(item: ActionPlanItem, listener: ListenerState): void {
    const transitionKey = `action:${item.id}:gain`;
    const runtimeActive = shouldBeActive(item, listener);
    const object: ActionRuntimeObject = {
      plan: { ...item, relativePosition: [...item.relativePosition] },
      worldPosition: addVector(
        listener.worldPosition,
        rotateVector(listener.orientation, item.relativePosition),
      ),
      transitionKey,
      runtimeActive,
      pendingRemoval: false,
      startMs: item.startMs ?? 0,
      endMs: item.endMs ?? Number.POSITIVE_INFINITY,
      lifecycle: 'waiting',
    };
    object.lifecycle = executionLifecycle(object, this.#timestampMs);
    if (object.lifecycle === 'active')
      object.runtimeActivationMs = this.#timestampMs;
    if (object.lifecycle === 'finished')
      object.runtimeFinishedMs = this.#timestampMs;
    this.#objects.set(item.id, object);
    if (runtimeActive) {
      this.transitions.scheduleActivation(
        transitionKey,
        item.gain,
        this.#policy.defaultDurationMs,
        this.#policy.curve,
      );
    }
  }

  private syncActivation(
    object: ActionRuntimeObject,
    listener: ListenerState,
  ): void {
    if (object.pendingRemoval) return;
    const nextActive = shouldBeActive(object.plan, listener);
    if (nextActive !== object.runtimeActive) {
      const currentGain = this.transitions.getValue(object.transitionKey, 0);
      this.transitions.scheduleGain(
        object.transitionKey,
        currentGain,
        nextActive ? object.plan.gain : 0,
        this.#policy.defaultDurationMs,
        this.#policy.curve,
      );
      object.runtimeActive = nextActive;
    }
  }

  private beginRemoval(object: ActionRuntimeObject): void {
    if (object.pendingRemoval) return;
    object.pendingRemoval = true;
    this.transitions.scheduleRemoval(
      object.transitionKey,
      this.transitions.getValue(object.transitionKey, 0),
      this.#policy.defaultDurationMs,
      this.#policy.curve,
    );
  }
}

function shouldBeActive(
  item: ActionPlanItem,
  listener: ListenerState,
): boolean {
  if (!item.active) return false;
  return (
    item.activationCondition !== 'listener-moving' ||
    vectorLength(listener.velocity) > EPSILON
  );
}

function executionLifecycle(
  object: Pick<ActionRuntimeObject, 'startMs' | 'endMs' | 'runtimeActive'>,
  timestampMs: number,
): 'waiting' | 'active' | 'finished' {
  if (timestampMs < object.startMs) return 'waiting';
  if (timestampMs >= object.endMs) return 'finished';
  return object.runtimeActive ? 'active' : 'waiting';
}

function isCompatible(current: ActionPlanItem, next: ActionPlanItem): boolean {
  return (
    current.assetId === next.assetId &&
    current.attachment === next.attachment &&
    distance(current.relativePosition, next.relativePosition) <= EPSILON
  );
}
