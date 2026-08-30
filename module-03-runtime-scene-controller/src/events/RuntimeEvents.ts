export type SceneTransitionPhase =
  | 'traversing'
  | 'arriving'
  | 'stabilizing'
  | 'complete';

export type RuntimeEvent =
  | { type: 'JourneyStarted'; timestampMs: number; planId: string }
  | { type: 'WaypointReached'; timestampMs: number; waypointIndex: number; locationId: string }
  | {
      type: 'SemanticLocationChanged';
      timestampMs: number;
      previousLocationId: string;
      locationId: string;
    }
  | {
      type: 'SceneTransitionStarted';
      timestampMs: number;
      transitionId: string;
      fromLocationId: string;
      toLocationId: string;
      arrivalTimeMs: number;
    }
  | {
      type: 'SceneTransitionPhaseChanged';
      timestampMs: number;
      transitionId: string;
      fromLocationId: string;
      toLocationId: string;
      phase: SceneTransitionPhase;
    }
  | {
      type: 'SceneTransitionCompleted';
      timestampMs: number;
      transitionId: string;
      fromLocationId: string;
      toLocationId: string;
      arrivalTimeMs: number;
      completedAtMs: number;
    }
  | { type: 'EventSpawned'; timestampMs: number; eventId: string }
  | { type: 'EventFinished'; timestampMs: number; eventId: string }
  | {
      type: 'TransitionStarted';
      timestampMs: number;
      transitionId: string;
      targetKey: string;
      transitionType: RuntimeTransitionType;
    }
  | {
      type: 'TransitionCompleted';
      timestampMs: number;
      transitionId: string;
      targetKey: string;
      transitionType: RuntimeTransitionType;
    };

export type RuntimeTransitionType = 'gain' | 'activation' | 'removal';
export type RuntimeEventListener = (event: RuntimeEvent) => void;

export class RuntimeEventBus {
  readonly #listeners = new Set<RuntimeEventListener>();
  readonly #history: RuntimeEvent[] = [];

  emit(event: RuntimeEvent): void {
    const immutableEvent = Object.freeze({ ...event });
    this.#history.push(immutableEvent);
    this.#listeners.forEach((listener) => listener(immutableEvent));
  }

  subscribe(listener: RuntimeEventListener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  get history(): readonly RuntimeEvent[] {
    return Object.freeze([...this.#history]);
  }

  clearHistory(): void {
    this.#history.length = 0;
  }
}
