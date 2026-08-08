export type RuntimeLogSeverity = 'debug' | 'info' | 'warning' | 'error';

export interface RuntimeLogEntry {
  timestampMs: number;
  module: string;
  severity: RuntimeLogSeverity;
  eventType: string;
  message: string;
  payload?: unknown;
}

export interface RuntimeLogger {
  log(entry: RuntimeLogEntry): void;
}

export const noopRuntimeLogger: RuntimeLogger = {
  log: () => undefined,
};
