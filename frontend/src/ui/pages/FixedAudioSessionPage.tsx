import { useRef, useState } from 'react';
import { useStore } from 'zustand';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

const AUDIO_URL = '/audio/control/non-adaptive-10min.mp3';
const clock = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
};

export function FixedAudioSessionPage({ onHome }: { onHome: () => void }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playbackError, setPlaybackError] = useState('');
  const session = useStore(runtimeStore, (state) => state.sessionRuntime);
  const updateTime = () =>
    runtimeStore
      .getState()
      .setSessionRuntime({
        elapsedTimeMs: Math.min(
          600_000,
          Math.round((audioRef.current?.currentTime ?? 0) * 1000),
        ),
      });
  const play = async () => {
    try {
      await audioRef.current?.play();
      setPlaybackError('');
      runtimeStore.getState().setSessionRuntime({ status: 'running' });
    } catch (error) {
      setPlaybackError(error instanceof Error ? error.message : String(error));
    }
  };
  const pause = () => {
    audioRef.current?.pause();
    runtimeStore.getState().setSessionRuntime({ status: 'paused' });
  };
  const end = () => {
    audioRef.current?.pause();
    updateTime();
    runtimeStore.getState().setSessionRuntime({ status: 'ended' });
  };
  return (
    <main className="flow-page fixed-audio-page">
      <header>
        <p className="flow-brand">NeuroScape</p>
        <button
          onClick={() => {
            end();
            onHome();
          }}
        >
          Return Home
        </button>
      </header>
      <section className="glass-panel fixed-audio-card">
        <span className="panel-kicker">10 MIN NON-ADAPTIVE CONTROL</span>
        <h1>Fixed Meditation</h1>
        <p>
          Every participant hears the same pre-rendered control audio. EEG and
          LLM services are not used.
        </p>
        <strong className="fixed-audio-clock">
          {clock(session.elapsedTimeMs)} / 10:00
        </strong>
        <audio
          ref={audioRef}
          src={AUDIO_URL}
          autoPlay
          preload="auto"
          onTimeUpdate={updateTime}
          onPlay={() =>
            runtimeStore.getState().setSessionRuntime({ status: 'running' })
          }
          onPause={() => {
            if (runtimeStore.getState().sessionRuntime.status !== 'ended')
              runtimeStore.getState().setSessionRuntime({ status: 'paused' });
          }}
          onEnded={() =>
            runtimeStore
              .getState()
              .setSessionRuntime({ elapsedTimeMs: 600_000, status: 'ended' })
          }
          onError={() =>
            setPlaybackError('The fixed control audio could not be loaded.')
          }
        />
        <div className="session-controls">
          <button onClick={() => void play()}>Play</button>
          <button onClick={pause}>Pause</button>
          <button onClick={end}>End Session</button>
        </div>
        {playbackError && (
          <p role="alert" className="summary-error">
            {playbackError}
          </p>
        )}
      </section>
    </main>
  );
}
