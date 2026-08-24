import { afterEach, describe, expect, it } from 'vitest';
import { AdaptiveIntegrationHarness } from '../src/integration/AdaptiveIntegrationHarness.js';
import { recordingStore } from '../src/recording/recordingStore.js';
import { runtimeStore } from '../src/runtime/RuntimeStore.js';

describe('Phase 1 adaptive end-to-end harness', () => {
  afterEach(() => {
    if (recordingStore.stop()) runtimeStore.getState().resetSessionStreams();
  });

  it('replays mock EEG through Decisions 1/2, Module 03, recording, and closing phase', async () => {
    const harness = new AdaptiveIntegrationHarness(runtimeStore, {
      set: () => 1,
      clear: () => undefined,
    });
    recordingStore.start({
      sessionId: 'adaptive-e2e',
      participantId: 'P001',
      runMode: 'mock-fast',
      userPrompt: 'adaptive e2e test',
      eegMode: 'recorded',
    });
    harness.start({
      sessionId: 'adaptive-e2e',
      runMode: 'mock-fast',
      plannerMode: 'mock',
    });
    for (let index = 0; index < 600; index += 1) await harness.tick(1_000);
    const recording = recordingStore.stop();
    expect(harness.getState().status).toBe('ended');
    expect(recording?.metadata.durationMs).toBe(600_000);
    expect(recording?.neuroStates).toHaveLength(60);
    expect(recording?.sceneJourneyPlans.length).toBeGreaterThan(1);
    expect(
      recording?.adaptiveTrace.some((entry) => entry.kind === 'decision-1'),
    ).toBe(true);
    expect(
      recording?.adaptiveTrace.some((entry) => entry.kind === 'decision-2'),
    ).toBe(true);
    expect(
      recording?.adaptiveTrace.some((entry) => entry.kind === 'plan-applied'),
    ).toBe(true);
    expect(
      recording?.adaptiveTrace.some(
        (entry) =>
          entry.kind === 'eligibility' &&
          entry.summary.includes('closing_phase'),
      ),
    ).toBe(true);
    expect(recording?.runtimeSnapshots.at(-1)?.timestampMs).toBe(600_000);
  });
});
