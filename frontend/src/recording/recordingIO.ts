import type { RecordedSession } from '@neuroscape/contracts';
import { runtimeReplay } from '../replay/index.js';
import { recordingStore } from './recordingStore.js';
import { validateRecordedSession, type RecordingValidation } from './recordingValidation.js';

export function exportRecordingJson(recording: RecordedSession): string { return JSON.stringify(recording, null, 2); }
export function importRecordingJson(json: string): RecordingValidation {
  let parsed: unknown; try { parsed = JSON.parse(json); } catch { return { valid: false, errors: ['Recording is not valid JSON'] }; }
  return validateRecordedSession(parsed);
}
export function activateImportedRecording(json: string): RecordingValidation {
  const result = importRecordingJson(json); if (!result.valid) return result;
  runtimeReplay.load(result.recording.runtimeSnapshots); recordingStore.set(result.recording); return result;
}
export function loadRecordingReplay(recording: RecordedSession, fromTimestampMs = 0): void { runtimeReplay.load(recording.runtimeSnapshots.filter((snapshot) => snapshot.timestampMs >= fromTimestampMs)); }
export function downloadRecording(recording: RecordedSession): void {
  const url = URL.createObjectURL(new Blob([exportRecordingJson(recording)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `neuroscape-${recording.metadata.sessionId}.json`; anchor.click(); URL.revokeObjectURL(url);
}
export function printSummary(): void { globalThis.print(); }
