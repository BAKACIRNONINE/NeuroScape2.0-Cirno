import { afterEach, describe, expect, it, vi } from 'vitest';
import { NEUROSCAPE_PROTOCOL_VERSION } from '@neuroscape/contracts';
import { AudioContextManager } from '../src/audio/AudioContextManager.js';
import { AudioEngine } from '../src/audio/AudioEngine.js';
import { runtimeDiagnostics } from '../src/debug/index.js';
import { IntegrationHarness, type IntervalApi } from '../src/integration/IntegrationHarness.js';
import { dispatchServerMessage, parseServerMessage } from '../src/network/protocol.js';
import { SessionRecorder } from '../src/recording/SessionRecorder.js';
import { RuntimeReplayController } from '../src/replay/index.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { ThreeScene } from '../src/scene/ThreeScene.js';
import { deriveSummary } from '../src/ui/summary/index.js';
import { FakeAudioContext } from './audioFakes.js';

afterEach(() => vi.unstubAllGlobals());
describe('NeuroScape Module 03 → Module 04 acceptance path', () => {
  it('pauses, resumes, and ends the deterministic controller clock without advancing while paused', () => { const store = createRuntimeStore(), harness = new IntegrationHarness(store,'controls-session',{ set:() => 1, clear:() => undefined }); harness.start(); harness.tick(250); harness.pause(); const pausedAt = harness.getState().timestampMs; harness.tick(250); expect(harness.getState().timestampMs).toBe(pausedAt); harness.resume(); harness.tick(250); expect(harness.getState().timestampMs).toBe(pausedAt + 250); harness.end(); expect(store.getState().sessionRuntime.status).toBe('ended'); });
  it('runs real Module 03 output through protocol, store, Three.js, audio, recorder, summary, and replay', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok:true, status:200, arrayBuffer:async () => new ArrayBuffer(1) })));
    const store = createRuntimeStore(), interval: IntervalApi = { set:() => 1, clear:() => undefined }, harness = new IntegrationHarness(store,'acceptance-session',interval);
    const recorder = new SessionRecorder(store); recorder.start({ sessionId:'acceptance-session', userPrompt:'Simulated forest', eegMode:'recorded' });
    const audioContext = new FakeAudioContext(), audio = new AudioEngine(store,new AudioContextManager(() => audioContext as unknown as AudioContext)); await audio.enable();
    harness.start(); const initialWorld = store.getState().runtimeWorldState; expect(initialWorld?.listener.semanticLocation).toBe('forest_entry');
    const independentNeuro = { timestampMs:1, attention:{ value:.6, trend:'stable' }, arousal:{ value:.45, trend:'stable' }, stability:.65, confidence:.9 };
    const neuroEnvelope = parseServerMessage({ type:'NeuroState', protocolVersion:NEUROSCAPE_PROTOCOL_VERSION, sessionId:'acceptance-session', timestampMs:1, payload:independentNeuro },'acceptance-session');
    expect(neuroEnvelope.valid).toBe(true); if (neuroEnvelope.valid) dispatchServerMessage(neuroEnvelope.message,store,performance.now()); expect(store.getState().runtimeWorldState).toBe(initialWorld);
    while (harness.getState().status !== 'ended') harness.tick(250);
    await new Promise<void>((resolve) => setTimeout(resolve,0));
    const finalWorld = store.getState().runtimeWorldState!; expect(finalWorld.listener.semanticLocation).toBe('waterfall'); expect(finalWorld.journey?.plannedPath.at(-1)).toEqual([7,1,-20]); expect(store.getState().sceneJourneyPlan?.planId).toBe('forest-plan-3');
    const three = new ThreeScene(); three.update(finalWorld); expect(three.scene.getObjectByName('listener')?.position.toArray()).toEqual(finalWorld.listener.worldPosition); three.dispose();
    expect(audio.getState().sourceCount).toBeGreaterThan(0); expect(audio.diagnostics().some((item) => item.runtimeId === 'water-anchor')).toBe(true);
    const recording = recorder.stop()!; expect(recording.runtimeSnapshots.length).toBeGreaterThan(50); expect(recording.neuroStates.length).toBeGreaterThan(3); expect(recording.sceneJourneyPlans).toHaveLength(3); expect(deriveSummary(recording).locationsVisited).toEqual(['forest_entry','clearing','stream_bank','waterfall']);
    const replay = new RuntimeReplayController(store); replay.load(recording.runtimeSnapshots); replay.step(); expect(store.getState().runtimeWorldState).toEqual(recording.runtimeSnapshots[0]);
    expect(runtimeDiagnostics.getState().averageModule03UpdateMs).toBeGreaterThanOrEqual(0); expect(runtimeDiagnostics.getState().averageStoreUpdateMs).toBeGreaterThanOrEqual(0); await audio.dispose();
  });
});
