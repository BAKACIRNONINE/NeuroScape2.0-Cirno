import { describe, expect, it } from 'vitest';
import { SessionRecorder } from '../src/recording/SessionRecorder.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { journeyPlan, neuroState, snapshot } from './fixtures.js';
describe('SessionRecorder', () => {
  it('records accepted independent streams and ignores stale/rejected updates', () => {
    const store = createRuntimeStore(), recorder = new SessionRecorder(store); recorder.start({ sessionId: 's1', userPrompt: 'forest', eegMode: 'muse' });
    store.getState().publishRuntimeWorldState(snapshot(100)); store.getState().publishRuntimeWorldState(snapshot(90)); store.getState().publishRuntimeWorldState({ nope: true });
    store.getState().publishNeuroState(neuroState(100), 100); store.getState().publishNeuroState(neuroState(90), 110);
    store.getState().publishSceneJourneyPlan(journeyPlan(), 120); store.getState().setSessionRuntime({ status: 'running', elapsedTimeMs: 100, plannerStatus: 'ready' });
    const recording = recorder.stop()!; expect(recording.runtimeSnapshots).toHaveLength(1); expect(recording.neuroStates).toHaveLength(1); expect(recording.sceneJourneyPlans).toHaveLength(1); expect(recording.sessionEvents.at(-1)?.value.status).toBe('running'); expect(recording.plannerEvents.at(-1)?.value.status).toBe('ready');
  });
  it('stops observing after shutdown', () => { const store = createRuntimeStore(), recorder = new SessionRecorder(store); recorder.start({ sessionId: 's1' }); recorder.stop(); store.getState().publishRuntimeWorldState(snapshot()); expect(recorder.snapshot()?.runtimeSnapshots).toHaveLength(0); });
});
