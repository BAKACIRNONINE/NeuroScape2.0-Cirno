import type { RuntimeWorldState } from '@neuroscape/contracts';
import type { RuntimeStore } from '../runtime/RuntimeStore.js';
import { runtimeStore } from '../runtime/RuntimeStore.js';
import { AudioAssetManager } from './AudioAssetManager.js';
import { AudioContextManager } from './AudioContextManager.js';
import { audioAssetManifest } from './audioAssetManifest.js';
import { GainManager } from './GainManager.js';
import { HRTFRenderer } from './HRTFRenderer.js';
import { PlaybackScheduler } from './PlaybackScheduler.js';
import { SourceManager, type AudioSourceDiagnostics } from './SourceManager.js';

export interface AudioEngineState { status: 'disabled' | 'enabling' | 'running' | 'suspended' | 'error'; masterGain: number; sourceCount: number; error?: string }

export class AudioEngine {
  readonly #store: RuntimeStore;
  readonly #contexts: AudioContextManager;
  readonly #listeners = new Set<() => void>();
  #unsubscribe: (() => void) | null = null;
  #master: GainNode | null = null;
  #sources: SourceManager | null = null;
  #hrtf: HRTFRenderer | null = null;
  #assets: AudioAssetManager | null = null;
  #state: AudioEngineState = { status: 'disabled', masterGain: 0.8, sourceCount: 0 };

  constructor(store: RuntimeStore = runtimeStore, contexts = new AudioContextManager()) { this.#store = store; this.#contexts = contexts; }
  getState = (): AudioEngineState => this.#state;
  subscribe = (listener: () => void) => { this.#listeners.add(listener); return () => this.#listeners.delete(listener); };
  diagnostics(): AudioSourceDiagnostics[] { return this.#sources?.diagnostics() ?? []; }

  async enable(): Promise<void> {
    if (this.#state.status === 'running') return;
    this.#set({ ...this.#state, status: 'enabling', error: undefined });
    try {
      await this.#contexts.resume();
      if (!this.#sources) this.#initializeGraph();
      await this.#assets?.preload();
      this.#unsubscribe ??= this.#store.subscribe((state, previous) => {
        if (state.runtimeWorldState !== previous.runtimeWorldState && state.runtimeWorldState) this.update(state.runtimeWorldState);
      });
      const snapshot = this.#store.getState().runtimeWorldState; if (snapshot) this.update(snapshot);
      this.#set({ ...this.#state, status: 'running' });
      this.#store.getState().setAudioRuntime({ status: 'running' });
    } catch (error) { this.#set({ ...this.#state, status: 'error', error: error instanceof Error ? error.message : String(error) }); this.#store.getState().setAudioRuntime({ status: 'error' }); }
  }

  async suspend(): Promise<void> { await this.#contexts.suspend(); this.#set({ ...this.#state, status: 'suspended' }); this.#store.getState().setAudioRuntime({ status: 'suspended' }); }
  update(state: Readonly<RuntimeWorldState>): void {
    this.#sources?.reconcile(state);
    this.#set({ ...this.#state, sourceCount: this.#sources?.sources.size ?? 0 });
  }
  setMasterGain(gain: number): void {
    const value = Math.min(1, Math.max(0, gain)); this.#state = { ...this.#state, masterGain: value };
    if (this.#master) new GainManager().setMaster(this.#master.gain, value, this.#contexts.currentTime);
    this.#emit();
  }
  async dispose(): Promise<void> {
    this.#unsubscribe?.(); this.#unsubscribe = null; this.#sources?.dispose(); this.#hrtf?.dispose(); this.#master?.disconnect(); this.#assets?.clear();
    this.#sources = null; this.#hrtf = null; this.#master = null; this.#assets = null;
    await this.#contexts.close(); this.#set({ status: 'disabled', masterGain: this.#state.masterGain, sourceCount: 0 }); this.#store.getState().setAudioRuntime({ status: 'idle' });
  }

  #initializeGraph(): void {
    const context = this.#contexts.context;
    this.#master = context.createGain(); this.#master.gain.setValueAtTime(this.#state.masterGain, context.currentTime); this.#master.connect(context.destination);
    this.#assets = new AudioAssetManager(audioAssetManifest, (data) => context.decodeAudioData(data));
    this.#hrtf = new HRTFRenderer(context, this.#master);
    this.#sources = new SourceManager(context, this.#master, this.#assets, new GainManager(), new PlaybackScheduler(context), this.#hrtf, () => this.#emit());
  }
  #set(state: AudioEngineState): void { this.#state = state; this.#emit(); }
  #emit(): void { this.#listeners.forEach((listener) => listener()); }
}

export const audioEngine = new AudioEngine();
