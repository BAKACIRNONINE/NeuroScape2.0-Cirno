import { useState, type FormEvent } from 'react';

export interface SessionIntent {
  worldDescription: string;
  durationMinutes: number;
  eegSource: 'muse' | 'recorded';
}
export type AdaptiveRunMode = 'mock-fast' | 'study-realtime';
export interface AdaptiveSessionIntent {
  participantId: string;
  runMode: AdaptiveRunMode;
  plannerMode: 'openai' | 'mock';
}
export interface CalibrationSessionIntent {
  participantId: string;
  durationMinutes: number;
}

export function HomePage({
  onStart,
  onAdaptiveDemo,
  onDemo,
  onLongDemo,
  onSpatialDiagnostic,
  onCalibration,
}: {
  onStart: (intent: SessionIntent) => void;
  onAdaptiveDemo?: (intent: AdaptiveSessionIntent) => void;
  onDemo?: () => void;
  onLongDemo?: () => void;
  onSpatialDiagnostic?: () => void;
  onCalibration?: (intent: CalibrationSessionIntent) => void;
}) {
  const [durationMinutes, setDuration] = useState(10);
  const [participantId, setParticipantId] = useState('P001');
  const normalizedParticipantId = participantId.trim().toUpperCase();
  const validParticipantId = /^P0*[1-9][0-9]*$/.test(normalizedParticipantId);
  const validDuration =
    Number.isFinite(durationMinutes) &&
    durationMinutes >= 1 &&
    durationMinutes <= 180;
  const startCalibration = (event: FormEvent) => {
    event.preventDefault();
    if (validParticipantId && validDuration)
      onCalibration?.({
        participantId: normalizedParticipantId,
        durationMinutes,
      });
  };

  return (
    <main className="flow-page home-page">
      <p className="flow-brand">NeuroScape</p>
      <form className="study-launch glass-panel" onSubmit={startCalibration}>
        <label>
          Participant ID
          <input
            aria-label="Participant ID"
            value={participantId}
            onChange={(event) => setParticipantId(event.target.value)}
            placeholder="P001"
          />
        </label>
        <label>
          Meditation duration
          <span className="duration-input">
            <input
              aria-label="Meditation duration"
              type="number"
              min="1"
              max="180"
              value={durationMinutes}
              onChange={(event) => setDuration(Number(event.target.value))}
            />
            minutes
          </span>
        </label>
        {!validParticipantId && (
          <small>Use P followed by a positive integer, for example P001.</small>
        )}
        <button
          className="primary-study-launch"
          disabled={!validParticipantId || !validDuration}
        >
          Start Muse calibration
        </button>
      </form>

      {(onAdaptiveDemo || onDemo || onLongDemo || onSpatialDiagnostic) && (
        <details className="developer-launches">
          <summary>Developer tools</summary>
          <div>
            {onAdaptiveDemo && (
              <button
                className="demo-launch"
                onClick={() =>
                  onAdaptiveDemo({
                    participantId: normalizedParticipantId,
                    runMode: 'mock-fast',
                    plannerMode: 'mock',
                  })
                }
                disabled={!validParticipantId}
              >
                Mock adaptive session · 10×
              </button>
            )}
            {onDemo && (
              <button className="demo-launch" onClick={onDemo}>
                Demo / Integration · deterministic forest
              </button>
            )}
            {onLongDemo && (
              <button className="demo-launch" onClick={onLongDemo}>
                Demo / Integration · long forest validation
              </button>
            )}
            {onSpatialDiagnostic && (
              <button className="demo-launch" onClick={onSpatialDiagnostic}>
                Demo / Diagnostic · spatial event stress test
              </button>
            )}
            <button
              className="demo-launch"
              onClick={() =>
                onStart({
                  worldDescription: 'A quiet forest',
                  durationMinutes,
                  eegSource: 'recorded',
                })
              }
            >
              Legacy runtime preview
            </button>
          </div>
        </details>
      )}
    </main>
  );
}
