import { describe, expect, it } from 'vitest';
import { SessionRecorder } from '../src/recording/SessionRecorder.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { journeyPlan, neuroState, snapshot } from './fixtures.js';
describe('SessionRecorder', () => {
  it('records accepted independent streams and ignores stale/rejected updates', () => {
    const store = createRuntimeStore(),
      recorder = new SessionRecorder(store);
    recorder.start({ sessionId: 's1', userPrompt: 'forest', eegMode: 'muse' });
    store.getState().publishRuntimeWorldState(snapshot(100));
    store.getState().publishRuntimeWorldState(snapshot(90));
    store.getState().publishRuntimeWorldState({ nope: true });
    store.getState().publishNeuroState(neuroState(100), 100);
    store.getState().publishNeuroState(neuroState(90), 110);
    store.getState().publishSceneJourneyPlan(journeyPlan(), 120);
    store.getState().setSessionRuntime({
      status: 'running',
      elapsedTimeMs: 100,
      plannerStatus: 'ready',
    });
    const recording = recorder.stop()!;
    expect(recording.runtimeSnapshots).toHaveLength(1);
    expect(recording.neuroStates).toHaveLength(1);
    expect(recording.sceneJourneyPlans).toHaveLength(1);
    expect(recording.sessionEvents.at(-1)?.value.status).toBe('running');
    expect(recording.plannerEvents.at(-1)?.value.status).toBe('ready');
  });
  it('stops observing after shutdown', () => {
    const store = createRuntimeStore(),
      recorder = new SessionRecorder(store);
    recorder.start({ sessionId: 's1' });
    recorder.stop();
    store.getState().publishRuntimeWorldState(snapshot());
    expect(recorder.snapshot()?.runtimeSnapshots).toHaveLength(0);
  });
  it('persists audible execution evidence in the session recording', () => {
    const store = createRuntimeStore();
    const recorder = new SessionRecorder(store);
    recorder.start({ sessionId: 's-audio' });
    recorder.appendAudioPlaybackEvidence({
      adaptationId: 'adapt-1',
      elementId: 'bird',
      assetId: 'event.bird',
      layer: 'event',
      status: 'AUDIO_STARTED',
      timestampMs: 2_050,
      plannedStartMs: 2_000,
      runtimeActivationMs: 2_010,
      audioStartMs: 2_050,
    });
    expect(recorder.stop()?.audioPlaybackEvidence).toEqual([
      expect.objectContaining({
        adaptationId: 'adapt-1',
        status: 'AUDIO_STARTED',
        audioStartMs: 2_050,
      }),
    ]);
  });
  it('derives terminal counters and applied exposure from raw evidence without removing it', () => {
    const recorder = new SessionRecorder(createRuntimeStore());
    recorder.start({ sessionId: 'summary' });
    recorder.appendAdaptiveTrace({
      timestampMs: 80_000,
      kind: 'attention-state',
      source: 'deterministic',
      summary: 'checkpoint',
      data: {},
    });
    recorder.appendAdaptiveTrace({
      timestampMs: 80_000,
      kind: 'eligibility',
      source: 'deterministic',
      summary: 'eligible',
      data: { eligible: true },
    });
    recorder.appendAdaptiveTrace({
      timestampMs: 80_000,
      kind: 'decision-1',
      source: 'mock-llm',
      summary: 'adapt',
      data: { shouldAdapt: true, scope: 'within-scene' },
    });
    recorder.appendAdaptiveTrace({
      timestampMs: 80_000,
      kind: 'decision-2',
      source: 'mock-llm',
      summary: 'change',
      data: {},
    });
    recorder.appendAdaptiveTrace({
      timestampMs: 80_000,
      kind: 'adaptation-terminal',
      source: 'deterministic',
      summary: 'applied',
      data: { terminalStatus: 'APPLIED' },
    });
    const base = {
      adaptationId: 'adapt-1',
      elementId: 'steps',
      assetId: 'forest_grass_footstep_01',
      layer: 'action' as const,
    };
    recorder.appendAudioPlaybackEvidence({
      ...base,
      status: 'PLAN_APPLIED',
      timestampMs: 80_000,
      selectedByDecision2: false,
      systemGenerated: 'scene_transition_locomotion',
      validated: true,
    });
    recorder.appendAudioPlaybackEvidence({
      ...base,
      status: 'RUNTIME_ACTIVATED',
      timestampMs: 80_250,
    });
    recorder.appendAudioPlaybackEvidence({
      ...base,
      status: 'AUDIO_STARTED',
      timestampMs: 80_300,
      audioStartMs: 80_300,
    });
    recorder.appendAudioPlaybackEvidence({
      ...base,
      status: 'AUDIO_FINISHED',
      timestampMs: 85_300,
      audioEndMs: 85_300,
    });
    const recording = recorder.stop()!;
    expect(recording.adaptiveSummary).toMatchObject({
      decision1AdaptCount: 1,
      decision2CallCount: 1,
      appliedAdaptationCount: 1,
    });
    expect(recording.appliedAudioExposures?.[0]).toMatchObject({
      systemGenerated: 'scene_transition_locomotion',
      runtimeActivated: true,
      effectiveExposureMs: 5_000,
    });
    expect(recording.audioPlaybackEvidence).toHaveLength(4);
  });
});
