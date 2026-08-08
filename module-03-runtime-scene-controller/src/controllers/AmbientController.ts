import type {
  AmbientPlanItem,
  AmbientState,
  ListenerState,
  TransitionPolicy,
  Vector3,
} from '@neuroscape/contracts';
import { clamp, distance, EPSILON, gentleDistanceGain } from '../core/math.js';
import type { SemanticLocationMapper } from '../scene-graph/SemanticLocationMapper.js';
import type { TransitionController } from './TransitionController.js';

interface AmbientRuntimeObject {
  id: string;
  assetId: string;
  mode: 'global' | 'localized';
  worldPosition?: Vector3;
  targetGain: number;
  desiredActive: boolean;
  transitionKey: string;
  pendingRemoval: boolean;
  replacement?: AmbientPlanItem;
}

export class AmbientController {
  readonly #objects = new Map<string, AmbientRuntimeObject>();
  #policy: TransitionPolicy = { defaultDurationMs: 1, curve: 'linear' };

  constructor(
    private readonly locationMapper: SemanticLocationMapper,
    private readonly transitions: TransitionController,
  ) {}

  initialize(items: readonly AmbientPlanItem[], policy: TransitionPolicy): void {
    this.#objects.clear();
    this.#policy = policy;
    items.forEach((item) => this.create(item));
  }

  merge(items: readonly AmbientPlanItem[], policy: TransitionPolicy): void {
    this.#policy = policy;
    const incoming = new Map(items.map((item) => [item.id, item]));
    for (const object of this.#objects.values()) {
      const item = incoming.get(object.id);
      if (!item) {
        this.beginRemoval(object);
        continue;
      }
      incoming.delete(object.id);
      if (!this.isCompatible(object, item)) {
        object.replacement = item;
        this.beginRemoval(object);
        continue;
      }
      object.targetGain = item.gain;
      object.desiredActive = item.active;
      object.pendingRemoval = false;
      object.replacement = undefined;
      const currentGain = this.transitions.getValue(object.transitionKey, 0);
      this.transitions.scheduleGain(
        object.transitionKey,
        currentGain,
        item.active ? item.gain : 0,
        policy.defaultDurationMs,
        policy.curve,
      );
    }
    incoming.forEach((item) => this.create(item));
  }

  update(_deltaTimeMs: number, _listener: ListenerState): void {
    for (const [id, object] of this.#objects) {
      if (!object.pendingRemoval || !this.transitions.isComplete(object.transitionKey)) continue;
      this.#objects.delete(id);
      this.transitions.release(object.transitionKey);
      if (object.replacement) this.create(object.replacement);
    }
  }

  getStates(listener: ListenerState): AmbientState[] {
    return [...this.#objects.values()].map((object) => {
      const transitionedGain = this.transitions.getValue(object.transitionKey, 0);
      const distanceGain = object.worldPosition
        ? gentleDistanceGain(distance(listener.worldPosition, object.worldPosition))
        : 1;
      const gain = clamp(transitionedGain * distanceGain);
      const state: AmbientState = {
        id: object.id,
        assetId: object.assetId,
        mode: object.mode,
        gain,
        active: gain > EPSILON,
      };
      if (object.worldPosition) state.worldPosition = [...object.worldPosition];
      return state;
    });
  }

  get size(): number {
    return this.#objects.size;
  }

  reset(): void {
    this.#objects.clear();
  }

  private create(item: AmbientPlanItem): void {
    const transitionKey = `ambient:${item.id}:gain`;
    const object: AmbientRuntimeObject = {
      id: item.id,
      assetId: item.assetId,
      mode: item.mode,
      targetGain: item.gain,
      desiredActive: item.active,
      transitionKey,
      pendingRemoval: false,
    };
    if (item.mode === 'localized' && item.locationId) {
      object.worldPosition = this.locationMapper.resolve(item.locationId);
    }
    this.#objects.set(item.id, object);
    if (item.active) {
      this.transitions.scheduleActivation(
        transitionKey,
        item.gain,
        this.#policy.defaultDurationMs,
        this.#policy.curve,
      );
    }
  }

  private beginRemoval(object: AmbientRuntimeObject): void {
    if (object.pendingRemoval) return;
    object.pendingRemoval = true;
    object.desiredActive = false;
    this.transitions.scheduleRemoval(
      object.transitionKey,
      this.transitions.getValue(object.transitionKey, 0),
      this.#policy.defaultDurationMs,
      this.#policy.curve,
    );
  }

  private isCompatible(object: AmbientRuntimeObject, item: AmbientPlanItem): boolean {
    if (object.assetId !== item.assetId || object.mode !== item.mode) return false;
    if (item.mode === 'localized' && item.locationId) {
      const nextPosition = this.locationMapper.resolve(item.locationId);
      return distance(object.worldPosition ?? [0, 0, 0], nextPosition) <= EPSILON;
    }
    return true;
  }
}
