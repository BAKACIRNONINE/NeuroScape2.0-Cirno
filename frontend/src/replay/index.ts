import type { RuntimeWorldState } from '@neuroscape/contracts';
import { runtimeStore, type PublishResult, type RuntimeStore } from '../runtime/RuntimeStore.js';
import { validateRuntimeWorldState } from '../runtime/validation.js';
import { demoRuntimeSnapshots } from './runtimeWorldState.fixture.js';

export type ReplayStatus = 'empty' | 'ready' | 'playing' | 'paused' | 'complete';
export interface ReplayState { status: ReplayStatus; nextIndex: number; total: number }
export interface ReplayScheduler {
  set(callback: () => void, delayMs: number): unknown;
  clear(handle: unknown): void;
}

const defaultScheduler: ReplayScheduler = {
  set: (callback, delayMs) => globalThis.setTimeout(callback, delayMs),
  clear: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export class RuntimeReplayController {
  readonly #store: RuntimeStore;
  readonly #scheduler: ReplayScheduler;
  readonly #listeners = new Set<() => void>();
  #snapshots: Readonly<RuntimeWorldState>[] = [];
  #state: ReplayState = { status: 'empty', nextIndex: 0, total: 0 };
  #timer: unknown;

  constructor(store: RuntimeStore, scheduler: ReplayScheduler = defaultScheduler) {
    this.#store = store;
    this.#scheduler = scheduler;
  }

  getState = (): ReplayState => this.#state;
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };

  load(snapshots: readonly unknown[]): void {
    this.pause();
    const validated = snapshots.map((snapshot, index) => {
      const result = validateRuntimeWorldState(snapshot);
      if (!result.valid) throw new Error(`Invalid replay snapshot ${index}: ${result.errors.join('; ')}`);
      return result.state;
    }).sort((a, b) => a.timestampMs - b.timestampMs);
    for (let index = 1; index < validated.length; index += 1) {
      if (validated[index]?.timestampMs === validated[index - 1]?.timestampMs) throw new Error('Replay timestamps must be unique');
    }
    this.#snapshots = validated;
    this.#store.getState().resetRuntimeWorldState();
    this.#update({ status: validated.length ? 'ready' : 'empty', nextIndex: 0, total: validated.length });
  }

  play(): void {
    if (this.#state.status === 'playing' || this.#state.nextIndex >= this.#snapshots.length) return;
    this.#update({ ...this.#state, status: 'playing' });
    this.#publishNext();
  }

  pause(): void {
    if (this.#timer !== undefined) this.#scheduler.clear(this.#timer);
    this.#timer = undefined;
    if (this.#state.status === 'playing') this.#update({ ...this.#state, status: 'paused' });
  }

  reset(): void {
    this.pause();
    this.#store.getState().resetRuntimeWorldState();
    this.#update({ status: this.#snapshots.length ? 'ready' : 'empty', nextIndex: 0, total: this.#snapshots.length });
  }

  step(): PublishResult | null {
    this.pause();
    if (this.#state.nextIndex >= this.#snapshots.length) return null;
    return this.#publish(false);
  }

  #publishNext(): void {
    const publishedIndex = this.#state.nextIndex;
    this.#publish(true);
    if (this.#state.status !== 'playing') return;
    const current = this.#snapshots[publishedIndex];
    const next = this.#snapshots[this.#state.nextIndex];
    if (!current || !next) return;
    this.#timer = this.#scheduler.set(() => { this.#timer = undefined; this.#publishNext(); }, next.timestampMs - current.timestampMs);
  }

  #publish(continuePlaying: boolean): PublishResult {
    const snapshot = this.#snapshots[this.#state.nextIndex];
    if (!snapshot) return { accepted: false, reason: 'invalid', errors: ['No replay snapshot available'] };
    const result = this.#store.getState().publishRuntimeWorldState(snapshot);
    const nextIndex = this.#state.nextIndex + (result.accepted ? 1 : 0);
    const finished = nextIndex >= this.#snapshots.length;
    this.#update({ status: finished ? 'complete' : continuePlaying ? 'playing' : 'paused', nextIndex, total: this.#snapshots.length });
    return result;
  }

  #update(state: ReplayState): void {
    this.#state = state;
    this.#listeners.forEach((listener) => listener());
  }
}

export const runtimeReplay = new RuntimeReplayController(runtimeStore);
runtimeReplay.load(demoRuntimeSnapshots);
