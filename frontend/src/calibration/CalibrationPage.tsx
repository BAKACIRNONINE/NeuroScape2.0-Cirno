import { useEffect, useRef, useState } from 'react';
import './calibration.css';
import { useLive } from './hooks/useLive';
import { api, type SelfReportPayload } from './services/api';
import type { Profile, Status } from './types';

const GUIDANCE_URL = '/calibration/guided-breathing-baseline.mp3';
const EXPECTED_GUIDANCE_SECONDS = 300;
const timer = (value = 0) => {
  const seconds = Math.max(0, Math.ceil(value));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, '0')}`;
};
const fmt = (value: number | null | undefined, digits = 3) =>
  value == null ? '—' : value.toFixed(digits);

function Shell({
  children,
  status,
  onHome,
}: {
  children: React.ReactNode;
  status: Status | null;
  onHome?: () => void;
}) {
  return (
    <div className="calibration-root app-shell">
      <header>
        <div className="brand-mark">N</div>
        <div>
          <p className="eyebrow">LOCAL INVESTIGATOR TOOL</p>
          <h1>Guided-Breathing Baseline</h1>
        </div>
        {onHome && <button onClick={onHome}>Return Home</button>}
        <div className={`connection-pill ${status?.connection.connected ? 'online' : ''}`}>
          <i />
          {status?.connection.connected ? 'Muse streaming' : 'Not connected'}
        </div>
      </header>
      <main>{children}</main>
      <footer>
        Local processing only <span>•</span> Mind Monitor OSC <span>•</span>{' '}
        Single empirical guided-breathing reference
      </footer>
    </div>
  );
}

function Rating({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number | null;
  setValue: (value: number) => void;
}) {
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="rating-row">
        {[1, 2, 3, 4, 5, 6, 7].map((number) => (
          <label key={number}>
            <input
              type="radio"
              checked={value === number}
              onChange={() => setValue(number)}
            />
            {number}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function CalibrationPage({
  onContinue,
  onHome,
  initialParticipantId = '',
}: {
  onContinue: (profile: Profile) => void | Promise<void>;
  onHome?: () => void;
  initialParticipantId?: string;
}) {
  const [initial, setInitial] = useState<Status | null>(null);
  const status = useLive(initial);
  const [participantId, setParticipantId] = useState(initialParticipantId);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mediaStatus, setMediaStatus] = useState<
    'checking' | 'ready' | 'blocked'
  >('checking');
  const [mediaMessage, setMediaMessage] = useState('Checking five-minute guidance media…');
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    void api.status().then(setInitial).catch((reason) => setError(String(reason)));
  }, []);
  useEffect(() => {
    if (status?.state === 'COMPLETE')
      void api.result().then(setProfile).catch((reason) => setError(String(reason)));
  }, [status?.state]);
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ready = () => {
      if (
        Number.isFinite(audio.duration) &&
        Math.abs(audio.duration - EXPECTED_GUIDANCE_SECONDS) <= 2
      ) {
        setMediaStatus('ready');
        setMediaMessage('Five-minute guidance media is ready.');
      } else {
        setMediaStatus('blocked');
        setMediaMessage(
          `Guidance duration must be 300 seconds; decoded ${audio.duration.toFixed(1)} seconds.`,
        );
      }
    };
    const failed = () => {
      setMediaStatus('blocked');
      setMediaMessage(
        `Required guidance media is missing or undecodable: ${GUIDANCE_URL}`,
      );
    };
    audio.addEventListener('loadedmetadata', ready);
    audio.addEventListener('error', failed);
    audio.load();
    return () => {
      audio.removeEventListener('loadedmetadata', ready);
      audio.removeEventListener('error', failed);
    };
  }, []);
  useEffect(() => {
    if (!status?.session || mediaStatus === 'checking') return;
    void api
      .guidanceEvent(
        mediaStatus === 'ready'
          ? 'BASELINE_GUIDANCE_READY'
          : 'BASELINE_GUIDANCE_ERROR',
      )
      .catch((reason) => setError(String(reason)));
  }, [mediaStatus, status?.session?.session_id]);

  const act = async (task: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    try {
      await task();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  if (!status)
    return (
      <Shell status={null} onHome={onHome}>
        <div className="loading">Opening local receiver…</div>
      </Shell>
    );

  const current = status.protocol.current_block;
  const latestAcclimation = status.protocol.acclimation_attempts.at(-1);
  const startBaseline = async () => {
    const audio = audioRef.current;
    if (!audio || mediaStatus !== 'ready')
      throw new Error('Guidance-media preflight must pass before baseline start.');
    const startedAt = performance.now();
    try {
      await audio.play();
      await api.guidanceEvent(
        'BASELINE_GUIDANCE_PLAYBACK_START',
        performance.now() - startedAt,
      );
      await api.startBaseline(false);
    } catch (reason) {
      audio.pause();
      audio.currentTime = 0;
      throw reason;
    }
  };

  let content: React.ReactNode;
  if (status.state === 'IDLE' || status.state === 'CONNECTION_CHECK')
    content = (
      <section className="panel">
        <p className="eyebrow">STEP 1 · CONNECTION</p>
        <h2>Connect Muse and create one baseline session</h2>
        <p>
          Send Mind Monitor RAW EEG/OSC to <strong>{status.local_ipv4}:{status.osc_port}</strong>.
        </p>
        <input
          aria-label="Participant ID"
          value={participantId}
          onChange={(event) => setParticipantId(event.target.value)}
          placeholder="P001"
        />
        <div className="control-row">
          <button
            disabled={busy || status.state !== 'IDLE'}
            onClick={() => void act(() => api.create(participantId.trim().toUpperCase()))}
          >
            Create Session
          </button>
          <button
            disabled={busy || status.state !== 'CONNECTION_CHECK'}
            onClick={() => void act(api.test)}
          >
            Run 10-second Connection Test
          </button>
        </div>
      </section>
    );
  else if (status.state === 'READY')
    content = (
      <section className="panel">
        <p className="eyebrow">STEP 2 · ACCLIMATION</p>
        <h2>One-minute acclimation</h2>
        <p>These samples are stored but never enter the guided baseline.</p>
        <button disabled={busy} onClick={() => void act(() => api.startAcclimation(false))}>
          Start Acclimation · 1:00
        </button>
      </section>
    );
  else if (status.state === 'ACCLIMATION')
    content = (
      <section className="panel">
        <h2>Acclimation recording</h2>
        <div className="active-timer">{timer(status.timing.active_remaining_seconds)}</div>
        <button className="danger ghost" onClick={() => void act(api.endAcclimationEarly)}>
          End Early
        </button>
      </section>
    );
  else if (status.state === 'ACCLIMATION_COMPLETE')
    content = (
      <section className="panel">
        <h2>Review acclimation</h2>
        <button
          disabled={busy || !latestAcclimation?.completed_automatically}
          onClick={() => void act(api.acceptAcclimation)}
        >
          Accept Full Acclimation
        </button>
        <button onClick={() => void act(() => api.repeatAcclimation(false))}>
          Repeat Acclimation
        </button>
      </section>
    );
  else if (status.state === 'BLOCK_READY')
    content = (
      <section className="panel">
        <p className="eyebrow">STEP 3 · GUIDED BASELINE</p>
        <h2>Single five-minute guided-breathing baseline</h2>
        <p>
          This is an empirical reference, not maximum focus or a physiological bound.
        </p>
        <div className={`alert ${mediaStatus === 'ready' ? '' : 'warning'}`}>
          <strong>Guidance preflight: {mediaStatus}</strong>
          <p>{mediaMessage}</p>
        </div>
        <button
          disabled={busy || mediaStatus !== 'ready'}
          onClick={() => void act(startBaseline)}
        >
          Start Guidance + EEG Baseline · 5:00
        </button>
      </section>
    );
  else if (status.state === 'BLOCK_RECORDING')
    content = (
      <section className="panel">
        <h2>Guided baseline recording</h2>
        <div className="active-timer">{timer(status.timing.active_remaining_seconds)}</div>
        <p>No investigator prompts during recording.</p>
        <button
          className="danger ghost"
          onClick={() => {
            audioRef.current?.pause();
            void api.guidanceEvent('BASELINE_GUIDANCE_ERROR');
            void act(api.endBaselineEarly);
          }}
        >
          Emergency End
        </button>
      </section>
    );
  else if (status.state === 'SELF_REPORT' && current)
    content = <SelfReport submit={(payload) => void act(() => api.submitSelfReport(payload))} />;
  else if (status.state === 'PROCESSING')
    content = <section className="panel"><h2>Computing baseline median and technical quality…</h2></section>;
  else if (status.state === 'COMPLETE' && profile)
    content = (
      <section className="panel result-panel">
        <p className="eyebrow">SINGLE BASELINE RESULT</p>
        <h2>{profile.baseline_available ? 'Ready for adaptive session' : 'Baseline unavailable'}</h2>
        <div className="metric-grid">
          <Metric label="Baseline log-TBR" value={fmt(profile.baseline_log_tbr)} />
          <Metric label="Baseline MAD" value={fmt(profile.baseline_mad)} />
          <Metric label="Effective scale" value={fmt(profile.effective_baseline_scale)} />
          <Metric label="Valid epochs" value={`${profile.valid_epoch_count}/30`} />
          <Metric label="Packet completeness" value={`${(profile.quality.packet_completeness * 100).toFixed(1)}%`} />
          <Metric label="Self-reported focus" value={profile.self_reported_focus ?? '—'} />
          <Metric label="Self-reported drowsiness" value={profile.self_reported_drowsiness ?? '—'} />
          <Metric label="Quality" value={profile.quality_status} />
        </div>
        {!!profile.quality_issues.length && <p>{profile.quality_issues.join(', ')}</p>}
        <button
          disabled={!profile.ready_to_continue || !profile.baseline_available}
          onClick={() => void onContinue(profile)}
        >
          Continue to Adaptive Session
        </button>
      </section>
    );
  else content = <section className="panel"><h2>Calibration error</h2></section>;

  return (
    <Shell status={status} onHome={onHome}>
      <audio
        ref={audioRef}
        src={GUIDANCE_URL}
        preload="metadata"
        hidden
        onEnded={() => {
          if (status.session)
            void api
              .guidanceEvent('BASELINE_GUIDANCE_ENDED')
              .catch((reason) => setError(String(reason)));
        }}
      />
      {error && <div className="alert error global-error">{error}</div>}
      {content}
    </Shell>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function SelfReport({ submit }: { submit: (payload: SelfReportPayload) => void }) {
  const [focus, setFocus] = useState<number | null>(null);
  const [drowsiness, setDrowsiness] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [unable, setUnable] = useState(false);
  return (
    <section className="panel">
      <h2>Post-baseline self-report</h2>
      <p>Ratings are contextual metadata and do not alter or select EEG epochs.</p>
      <Rating label="During the five-minute breathing practice, how focused did you feel?" value={focus} setValue={setFocus} />
      <Rating label="During the five-minute breathing practice, how drowsy did you feel?" value={drowsiness} setValue={setDrowsiness} />
      <label><input type="checkbox" checked={unable} onChange={(event) => setUnable(event.target.checked)} /> Unable to judge</label>
      <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Investigator notes" />
      <button
        disabled={!unable && (focus === null || drowsiness === null)}
        onClick={() => submit({ focus: unable ? null : focus, drowsiness: unable ? null : drowsiness, investigator_notes: notes, unable_to_judge: unable })}
      >
        Submit Baseline Report
      </button>
    </section>
  );
}
