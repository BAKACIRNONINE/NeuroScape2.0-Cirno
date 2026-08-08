export interface RuntimeDiagnosticSnapshot {
  module03UpdateHz: number; averageModule03UpdateMs: number; averageWorldStateBuildMs: number; averageStoreUpdateMs: number;
  threeFps: number; averageThreeFrameMs: number; rejectedMessages: number; lastRejection?: string; estimatedHeapBytes: number | null;
}
const average = (values: readonly number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const trim = (values: number[]) => { if (values.length > 240) values.splice(0, values.length - 240); };
class RuntimeDiagnostics {
  readonly #updates: number[] = []; readonly #updateTimes: number[] = []; readonly #buildTimes: number[] = []; readonly #storeTimes: number[] = []; readonly #frames: number[] = []; readonly #frameTimes: number[] = [];
  readonly #listeners = new Set<() => void>(); #rejected = 0; #lastRejection?: string;
  #state: RuntimeDiagnosticSnapshot = { module03UpdateHz: 0, averageModule03UpdateMs: 0, averageWorldStateBuildMs: 0, averageStoreUpdateMs: 0, threeFps: 0, averageThreeFrameMs: 0, rejectedMessages: 0, estimatedHeapBytes: null };
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  getState = (): RuntimeDiagnosticSnapshot => this.#state;
  recordModule03Update(durationMs: number): void { this.#updates.push(performance.now()); this.#updateTimes.push(durationMs); trim(this.#updates); trim(this.#updateTimes); this.#emit(); }
  recordWorldStateBuild(durationMs: number): void { this.#buildTimes.push(durationMs); trim(this.#buildTimes); }
  recordStoreUpdate(durationMs: number): void { this.#storeTimes.push(durationMs); trim(this.#storeTimes); }
  recordThreeFrame(durationMs: number): void { this.#frames.push(performance.now()); this.#frameTimes.push(durationMs); trim(this.#frames); trim(this.#frameTimes); this.#emit(); }
  recordRejected(message: string): void { this.#rejected += 1; this.#lastRejection = message; this.#emit(); }
  reset(): void { this.#updates.length = this.#updateTimes.length = this.#buildTimes.length = this.#storeTimes.length = this.#frames.length = this.#frameTimes.length = 0; this.#rejected = 0; this.#lastRejection = undefined; this.#emit(); }
  #rate(values: readonly number[]): number { if (values.length < 2) return 0; const elapsed = values.at(-1)! - values[0]!; return elapsed > 0 ? (values.length - 1) * 1000 / elapsed : 0; }
  #heap(): number | null { const memory = performance as Performance & { memory?: { usedJSHeapSize: number } }; return memory.memory?.usedJSHeapSize ?? null; }
  #emit(): void {
    this.#state = { module03UpdateHz: this.#rate(this.#updates), averageModule03UpdateMs: average(this.#updateTimes), averageWorldStateBuildMs: average(this.#buildTimes), averageStoreUpdateMs: average(this.#storeTimes), threeFps: this.#rate(this.#frames), averageThreeFrameMs: average(this.#frameTimes), rejectedMessages: this.#rejected, lastRejection: this.#lastRejection, estimatedHeapBytes: this.#heap() };
    this.#listeners.forEach((listener) => listener());
  }
}
export const runtimeDiagnostics = new RuntimeDiagnostics();
