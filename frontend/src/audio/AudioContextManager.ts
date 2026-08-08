export type AudioContextFactory = () => AudioContext;

const browserFactory: AudioContextFactory = () => {
  const Constructor = globalThis.AudioContext;
  if (!Constructor) throw new Error('Web Audio API is unavailable in this browser');
  return new Constructor();
};

export class AudioContextManager {
  readonly #factory: AudioContextFactory;
  #context: AudioContext | null = null;

  constructor(factory: AudioContextFactory = browserFactory) { this.#factory = factory; }
  get context(): AudioContext { return this.#context ??= this.#factory(); }
  get state(): AudioContextState | 'uninitialized' { return this.#context?.state ?? 'uninitialized'; }
  get currentTime(): number { return this.#context?.currentTime ?? 0; }
  async resume(): Promise<void> { if (this.context.state !== 'running') await this.context.resume(); }
  async suspend(): Promise<void> { if (this.#context?.state === 'running') await this.#context.suspend(); }
  async close(): Promise<void> {
    const context = this.#context;
    this.#context = null;
    if (context && context.state !== 'closed') await context.close();
  }
}
