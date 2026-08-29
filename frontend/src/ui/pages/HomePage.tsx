import { useEffect, useState } from 'react';
import {
  api,
  type SavedCalibrationSession,
} from '../../calibration/services/api.js';
import type { Profile } from '../../calibration/types.js';
import { recordingStore } from '../../recording/recordingStore.js';
import { EegTimelinePlot } from '../components/EegTimelinePlot.js';

export interface CalibrationSessionIntent {
  participantId: string;
  durationMinutes: number;
}
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

export function HomePage({
  onCalibration,
  onRealTime,
  onNonAdaptive,
}: {
  onCalibration: (intent: CalibrationSessionIntent) => void;
  onRealTime: (profile: Profile, replayFile?: File) => void | Promise<void>;
  onNonAdaptive: (profile: Profile, replayFile?: File) => void | Promise<void>;
}) {
  const [participantId, setParticipantId] = useState('P001');
  const [sessions, setSessions] = useState<SavedCalibrationSession[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [eegSource, setEegSource] = useState<'realtime' | 'prerecorded'>('realtime');
  const [replayFile, setReplayFile] = useState<File | null>(null);
  const normalized = participantId.trim().toUpperCase();
  const valid = /^P0*[1-9][0-9]*$/.test(normalized);

  useEffect(() => {
    void api
      .sessions()
      .then((items) => {
        const completed = items.filter((item) => item.completed_at);
        setSessions(completed);
        setSelected(completed[0]?.session_id ?? '');
      })
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : String(reason)),
      );
  }, []);

  const startRealTime = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const details = await api.session(selected);
      if (!details.profile || details.profile_compatible === false)
        throw new Error(
          details.profile_error ||
            'This session has no compatible calibration profile.',
        );
      await onRealTime(details.profile, eegSource === 'prerecorded' ? replayFile ?? undefined : undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const startNonAdaptive = async () => {
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const details = await api.session(selected);
      if (!details.profile || details.profile_compatible === false)
        throw new Error(details.profile_error || 'A compatible baseline profile is required.');
      await onNonAdaptive(details.profile, eegSource === 'prerecorded' ? replayFile ?? undefined : undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally { setBusy(false); }
  };
  const completed = recordingStore.completed();

  return (
    <main className="flow-page home-page">
      <p className="flow-brand">NeuroScape</p>
      <h1>Study Home</h1>
      <label className="home-participant">
        Participant ID
        <input
          aria-label="Participant ID"
          value={participantId}
          onChange={(event) => setParticipantId(event.target.value)}
        />
      </label>
      {!valid && (
        <small>Use P followed by a positive integer, for example P001.</small>
      )}
      {error && (
        <p role="alert" className="summary-error">
          {error}
        </p>
      )}
      <section className="glass-panel eeg-source-panel">
        <h2>EEG Source</h2>
        <label><input type="radio" checked={eegSource === 'realtime'} onChange={() => setEegSource('realtime')} /> Real-time EEG</label>
        <label><input type="radio" checked={eegSource === 'prerecorded'} onChange={() => setEegSource('prerecorded')} /> Pre-recorded EEG</label>
        {eegSource === 'prerecorded' && <>
          <input aria-label="Raw EEG CSV" type="file" accept=".csv,text/csv" onChange={(event) => setReplayFile(event.target.files?.[0] ?? null)} />
          <small>Expected: NeuroScape raw_eeg.csv at 256 Hz with sample_index, monotonic_timestamp, TP9, AF7, AF8, and TP10; approximately 10 minutes (9–10 accepted). Replay runs at 10× while preserving original session timestamps.</small>
        </>}
      </section>
      <section className="home-entry-grid">
        <article className="glass-panel">
          <span>01</span>
          <h2>Calibration</h2>
          <p>Create and save an EEG calibration profile.</p>
          <button
            disabled={!valid}
            onClick={() =>
              onCalibration({ participantId: normalized, durationMinutes: 10 })
            }
          >
            Enter Calibration
          </button>
        </article>
        <article className="glass-panel">
          <span>02</span>
          <h2>10 min Real-Time Adaptive Meditation</h2>
          <p>Uses live EEG and the selected saved calibration profile.</p>
          <select
            aria-label="Calibration profile"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
          >
            {!sessions.length && (
              <option value="">No completed profiles found</option>
            )}
            {sessions.map((item) => (
              <option key={item.session_id} value={item.session_id}>
                {item.participant_id} · {item.session_id}
              </option>
            ))}
          </select>
          <button
            disabled={!selected || busy || (eegSource === 'prerecorded' && !replayFile)}
            onClick={() => void startRealTime()}
          >
            {busy ? 'Starting…' : 'Start Adaptive Meditation'}
          </button>
        </article>
        <article className="glass-panel">
          <span>03</span>
          <h2>10 min Non-Adaptive Meditation</h2>
          <p>Uses the shared opening voice and continuous forest ambience; EEG is logged but never changes playback.</p>
          <button disabled={!valid || !selected || busy || (eegSource === 'prerecorded' && !replayFile)} onClick={() => void startNonAdaptive()}>
            Start Non-Adaptive Meditation
          </button>
        </article>
      </section>
      {completed.adaptive && completed.nonAdaptive && (
        <section className="summary-panel home-comparison">
          <h2>Completed Session EEG Comparison</h2>
          <EegTimelinePlot recording={completed.adaptive} title="Adaptive" compact />
          <EegTimelinePlot recording={completed.nonAdaptive} title="Non-Adaptive" compact />
        </section>
      )}
    </main>
  );
}
