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
export function HomePage({
  onStart,
  onAdaptiveDemo,
  onDemo,
  onLongDemo,
  onSpatialDiagnostic,
}: {
  onStart: (intent: SessionIntent) => void;
  onAdaptiveDemo?: (intent: AdaptiveSessionIntent) => void;
  onDemo?: () => void;
  onLongDemo?: () => void;
  onSpatialDiagnostic?: () => void;
}) {
  const [worldDescription, setWorldDescription] = useState('');
  const [durationMinutes, setDuration] = useState(10);
  const [eegSource, setEegSource] = useState<'muse' | 'recorded'>('muse');
  const [participantId, setParticipantId] = useState('P001');
  const [adaptiveRunMode, setAdaptiveRunMode] =
    useState<AdaptiveRunMode>('mock-fast');
  const [plannerMode, setPlannerMode] = useState<'openai' | 'mock'>('openai');
  const validParticipantId = /^[A-Za-z0-9_-]{1,64}$/.test(participantId);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (worldDescription.trim())
      onStart({
        worldDescription: worldDescription.trim(),
        durationMinutes,
        eegSource,
      });
  };
  return (
    <main className="flow-page home-page">
      <p className="flow-brand">NeuroScape</p>
      <form className="intent-form" onSubmit={submit}>
        <input
          aria-label="World description"
          value={worldDescription}
          onChange={(event) => setWorldDescription(event.target.value)}
          placeholder="Describe your world..."
        />
        <div className="source-toggle">
          <button
            type="button"
            className={eegSource === 'recorded' ? 'selected' : ''}
            onClick={() => setEegSource('recorded')}
          >
            Recorded
          </button>
          <button
            type="button"
            className={eegSource === 'muse' ? 'selected' : ''}
            onClick={() => setEegSource('muse')}
          >
            Muse
          </button>
        </div>
        <button className="start-arrow" aria-label="Start session">
          →
        </button>
      </form>
      <label className="duration-field">
        Meditation duration{' '}
        <input
          type="number"
          min="1"
          max="180"
          value={durationMinutes}
          onChange={(event) => setDuration(Number(event.target.value))}
        />{' '}
        minutes
      </label>
      {onAdaptiveDemo && (
        <section className="adaptive-launch glass-panel">
          <label>
            Participant ID{' '}
            <input
              aria-label="Participant ID"
              value={participantId}
              onChange={(event) => setParticipantId(event.target.value.trim())}
            />
          </label>
          <div className="source-toggle" aria-label="Adaptive run mode">
            <button
              type="button"
              className={adaptiveRunMode === 'mock-fast' ? 'selected' : ''}
              onClick={() => setAdaptiveRunMode('mock-fast')}
            >
              Fast test · 10×
            </button>
            <button
              type="button"
              className={adaptiveRunMode === 'study-realtime' ? 'selected' : ''}
              onClick={() => setAdaptiveRunMode('study-realtime')}
            >
              Study · realtime
            </button>
          </div>
          <div className="source-toggle" aria-label="Planner provider">
            <button
              type="button"
              className={plannerMode === 'openai' ? 'selected' : ''}
              onClick={() => setPlannerMode('openai')}
            >
              OpenAI · GPT-5.6
            </button>
            <button
              type="button"
              className={plannerMode === 'mock' ? 'selected' : ''}
              onClick={() => setPlannerMode('mock')}
            >
              Offline mock
            </button>
          </div>
          {!validParticipantId && (
            <small>Use 1–64 letters, numbers, hyphens, or underscores.</small>
          )}
          <button
            className="demo-launch"
            disabled={!validParticipantId}
            onClick={() =>
              onAdaptiveDemo({
                participantId,
                runMode: adaptiveRunMode,
                plannerMode,
              })
            }
          >
            Phase 1 · adaptive EEG mock → spatial audio
          </button>
        </section>
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
      <div className="examples">
        <p>
          <strong>Example 1</strong> A quiet forest with wind moving through
          tall trees.
        </p>
        <p>
          <strong>Example 2</strong> A completely natural place that feels calm
          and grounded.
        </p>
        <p>
          <strong>Example 3</strong> Somewhere playful that inspires
          imagination.
        </p>
      </div>
    </main>
  );
}
