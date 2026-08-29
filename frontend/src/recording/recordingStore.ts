import type { RecordedSession } from '@neuroscape/contracts';
import { runtimeStore } from '../runtime/RuntimeStore.js';
import {
  SessionRecorder,
  type RecordingStartOptions,
} from './SessionRecorder.js';

let current: RecordedSession | null = null;
const completed = new Map<'adaptive' | 'non-adaptive', RecordedSession>();
const listeners = new Set<() => void>();
export const sessionRecorder = new SessionRecorder(runtimeStore);
export const recordingStore = {
  getState: () => current,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  start: (options: RecordingStartOptions) => {
    sessionRecorder.start(options);
    current = null;
    listeners.forEach((listener) => listener());
  },
  stop: () => {
    current = sessionRecorder.stop();
    if (current?.metadata.runMode === 'non-adaptive')
      completed.set('non-adaptive', structuredClone(current));
    else if (current?.metadata.runMode === 'study-realtime')
      completed.set('adaptive', structuredClone(current));
    listeners.forEach((listener) => listener());
    return current;
  },
  completed: () => ({
    adaptive: completed.get('adaptive') ?? null,
    nonAdaptive: completed.get('non-adaptive') ?? null,
  }),
  set: (recording: RecordedSession) => {
    current = recording;
    listeners.forEach((listener) => listener());
  },
};
