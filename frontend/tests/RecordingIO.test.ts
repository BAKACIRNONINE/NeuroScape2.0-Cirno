import { describe, expect, it } from 'vitest';
import { activateImportedRecording, exportRecordingJson, importRecordingJson } from '../src/recording/recordingIO.js';
import { runtimeStore } from '../src/runtime/RuntimeStore.js';
import { snapshot } from './fixtures.js';
import { recordedSession } from './recordingFixtures.js';
import { runtimeReplay } from '../src/replay/index.js';
import { LEGACY_RECORDED_SESSION_SCHEMA_VERSION } from '@neuroscape/contracts';
describe('recording import/export', () => {
  it('round-trips a versioned deterministic JSON replay file', () => { const recording = recordedSession(), json = exportRecordingJson(recording), result = importRecordingJson(json); expect(result.valid).toBe(true); if (result.valid) expect(result.recording).toEqual(recording); expect(exportRecordingJson(recording)).toBe(json); });
  it('keeps schema 1.3 recordings replayable during the 1.4 migration', () => { const recording = recordedSession(); recording.metadata.schemaVersion = LEGACY_RECORDED_SESSION_SCHEMA_VERSION; expect(importRecordingJson(JSON.stringify(recording)).valid).toBe(true); });
  it('rejects invalid or unordered recordings without modifying runtime state', () => { runtimeStore.getState().resetRuntimeWorldState(); runtimeStore.getState().publishRuntimeWorldState(snapshot(500)); const before = runtimeStore.getState().runtimeWorldState; const invalid = recordedSession(); invalid.runtimeSnapshots.reverse(); const result = activateImportedRecording(JSON.stringify(invalid)); expect(result.valid).toBe(false); expect(runtimeStore.getState().runtimeWorldState).toBe(before); });
  it('replays imported authoritative snapshots through the existing Runtime Store', () => { const result = activateImportedRecording(exportRecordingJson(recordedSession())); expect(result.valid).toBe(true); expect(runtimeStore.getState().runtimeWorldState).toBeNull(); runtimeReplay.step(); expect(runtimeStore.getState().runtimeWorldState?.timestampMs).toBe(0); });
});
