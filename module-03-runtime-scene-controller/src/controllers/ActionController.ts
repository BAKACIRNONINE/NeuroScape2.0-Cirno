import type {
  ActionPlanItem,
  ActionState,
  ListenerState,
  TransitionPolicy,
  Vector3,
} from '@neuroscape/contracts';
import { addVector, distance, EPSILON, rotateVector, vectorLength } from '../core/math.js';
import type { TransitionController } from './TransitionController.js';

interface ActionRuntimeObject {
  plan: ActionPlanItem;
  worldPosition: Vector3;
  transitionKey: string;
  runtimeActive: boolean;
  pendingRemoval: boolean;
  replacement?: ActionPlanItem;
}

export class ActionController {
  readonly #objects = new Map<string, ActionRuntimeObject>();
  #policy: TransitionPolicy = { defaultDurationMs: 1, curve: 'linear' };

  constructor(private readonly transitions: TransitionController) {}

  initialize(
    items: readonly ActionPlanItem[],
    policy: TransitionPolicy,
    listener: ListenerState,
  ): void {
    this.#objects.clear();
    this.#policy = policy;
    items.forEach((item) => this.create(item, listener));
  }

  merge(items: readonly ActionPlanItem[], policy: TransitionPolicy, listener: ListenerState): void {
    this.#policy = policy;
    const incoming = new Map(items.map((item) => [item.id, item]));
    for (const object of this.#objects.values()) {
      const item = incoming.get(object.plan.id);
      if (!item) {
        this.beginRemoval(object);
        continue;
      }
      incoming.delete(item.id);
      if (!isCompatible(object.plan, item)) {
        object.replacement = item;
        this.beginRemoval(object);
        continue;
      }
      const currentGain = this.transitions.getValue(object.transitionKey, 0);
      object.plan = { ...item, relativePosition: [...item.relativePosition] };
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
    incoming.forEach((item) => this.create(item, listener));
  }

  update(_deltaTimeMs: number, listener: ListenerState): void {
    for (const [id, object] of this.#objects) {
      if (object.pendingRemoval && this.transitions.isComplete(object.transitionKey)) {
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
    }
  }

  getStates(): ActionState[] {
    return [...this.#objects.values()].map((object) => ({
      id: object.plan.id,
      assetId: object.plan.assetId,
      attachment: object.plan.attachment,
      relativePosition: [...object.plan.relativePosition],
      worldPosition: [...object.worldPosition],
      gain: this.transitions.getValue(object.transitionKey, 0),
      active: this.transitions.getValue(object.transitionKey, 0) > EPSILON,
    }));
  }

  get size(): number {
    return this.#objects.size;
  }

  reset(): void {
    this.#objects.clear();
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
    };
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

  private syncActivation(object: ActionRuntimeObject, listener: ListenerState): void {
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

function shouldBeActive(item: ActionPlanItem, listener: ListenerState): boolean {
  if (!item.active) return false;
  return item.attachment !== 'feet' || vectorLength(listener.velocity) > EPSILON;
}

function isCompatible(current: ActionPlanItem, next: ActionPlanItem): boolean {
  return (
    current.assetId === next.assetId &&
    current.attachment === next.attachment &&
    distance(current.relativePosition, next.relativePosition) <= EPSILON
  );
}
