import type { TransitionCurve } from '@neuroscape/contracts';
import type {
  RuntimeEventBus,
  RuntimeTransitionType,
} from '../events/RuntimeEvents.js';
import { clamp, lerp, smoothstep } from '../core/math.js';

export interface RuntimeTransition {
  readonly id: string;
  readonly targetKey: string;
  readonly type: RuntimeTransitionType;
  readonly startValue: number;
  readonly targetValue: number;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly value: number;
  readonly completed: boolean;
}

interface MutableTransition extends RuntimeTransition {
  elapsedMs: number;
  value: number;
  completed: boolean;
  curve: TransitionCurve;
}

export class TransitionController {
  readonly #transitions = new Map<string, MutableTransition>();
  readonly #values = new Map<string, number>();
  #timestampMs = 0;
  #nextId = 1;

  constructor(private readonly events: RuntimeEventBus) {}

  initialize(timestampMs = 0): void {
    this.#transitions.clear();
    this.#values.clear();
    this.#timestampMs = timestampMs;
    this.#nextId = 1;
  }

  scheduleGain(
    targetKey: string,
    startValue: number,
    targetValue: number,
    durationMs: number,
    curve: TransitionCurve,
  ): string {
    return this.schedule(
      'gain',
      targetKey,
      startValue,
      targetValue,
      durationMs,
      curve,
    );
  }

  scheduleActivation(
    targetKey: string,
    targetValue: number,
    durationMs: number,
    curve: TransitionCurve,
  ): string {
    return this.schedule(
      'activation',
      targetKey,
      0,
      targetValue,
      durationMs,
      curve,
    );
  }

  scheduleRemoval(
    targetKey: string,
    startValue: number,
    durationMs: number,
    curve: TransitionCurve,
  ): string {
    return this.schedule(
      'removal',
      targetKey,
      startValue,
      0,
      durationMs,
      curve,
    );
  }

  update(deltaTimeMs: number): void {
    assertDeltaTime(deltaTimeMs);
    this.#timestampMs += deltaTimeMs;
    for (const transition of this.#transitions.values()) {
      if (transition.completed) continue;
      transition.elapsedMs = Math.min(
        transition.durationMs,
        transition.elapsedMs + deltaTimeMs,
      );
      const linearProgress =
        transition.durationMs === 0
          ? 1
          : clamp(transition.elapsedMs / transition.durationMs);
      transition.value = lerp(
        transition.startValue,
        transition.targetValue,
        applyCurve(linearProgress, transition.curve),
      );
      this.#values.set(transition.targetKey, transition.value);
      if (linearProgress >= 1) {
        transition.completed = true;
        transition.value = transition.targetValue;
        this.events.emit({
          type: 'TransitionCompleted',
          timestampMs: this.#timestampMs,
          transitionId: transition.id,
          targetKey: transition.targetKey,
          transitionType: transition.type,
        });
        this.#transitions.delete(transition.targetKey);
      }
    }
  }

  getValue(targetKey: string, fallback = 0): number {
    return (
      this.#transitions.get(targetKey)?.value ??
      this.#values.get(targetKey) ??
      fallback
    );
  }

  isComplete(targetKey: string): boolean {
    return !this.#transitions.has(targetKey);
  }

  getTransition(targetKey: string): RuntimeTransition | undefined {
    const transition = this.#transitions.get(targetKey);
    return transition ? Object.freeze({ ...transition }) : undefined;
  }

  get activeTransitions(): readonly RuntimeTransition[] {
    return Object.freeze(
      [...this.#transitions.values()]
        .filter((transition) => !transition.completed)
        .map((transition) => Object.freeze({ ...transition })),
    );
  }

  reset(): void {
    this.initialize(0);
  }

  release(targetKey: string): void {
    this.#transitions.delete(targetKey);
    this.#values.delete(targetKey);
  }

  private schedule(
    type: RuntimeTransitionType,
    targetKey: string,
    requestedStartValue: number,
    targetValue: number,
    durationMs: number,
    curve: TransitionCurve,
  ): string {
    if (!Number.isFinite(durationMs) || durationMs < 0) {
      throw new Error(
        'Transition durationMs must be a non-negative finite number.',
      );
    }
    const existing = this.#transitions.get(targetKey);
    const startValue =
      existing?.value ?? this.#values.get(targetKey) ?? requestedStartValue;
    const id = `transition-${this.#nextId++}`;
    const transition: MutableTransition = {
      id,
      targetKey,
      type,
      startValue,
      targetValue,
      durationMs,
      elapsedMs: 0,
      value: durationMs === 0 ? targetValue : startValue,
      completed: durationMs === 0,
      curve,
    };
    this.#transitions.set(targetKey, transition);
    this.#values.set(targetKey, transition.value);
    this.events.emit({
      type: 'TransitionStarted',
      timestampMs: this.#timestampMs,
      transitionId: id,
      targetKey,
      transitionType: type,
    });
    if (transition.completed) {
      this.events.emit({
        type: 'TransitionCompleted',
        timestampMs: this.#timestampMs,
        transitionId: id,
        targetKey,
        transitionType: type,
      });
      this.#transitions.delete(targetKey);
    }
    return id;
  }
}

function applyCurve(progress: number, curve: TransitionCurve): number {
  if (curve === 'smoothstep') {
    return smoothstep(progress);
  }
  return clamp(progress);
}

function assertDeltaTime(deltaTimeMs: number): void {
  if (!Number.isFinite(deltaTimeMs) || deltaTimeMs < 0) {
    throw new Error('deltaTimeMs must be a non-negative finite number.');
  }
}
