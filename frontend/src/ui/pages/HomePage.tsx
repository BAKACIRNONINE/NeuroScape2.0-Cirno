import { useState, type FormEvent } from 'react';
export interface SessionIntent {
  worldDescription: string;
  durationMinutes: number;
  eegSource: 'muse' | 'recorded';
}
export function HomePage({
  onStart,
  onAdaptiveDemo,
  onDemo,
  onLongDemo,
  onSpatialDiagnostic,
}: {
  onStart: (intent: SessionIntent) => void;
  onAdaptiveDemo?: () => void;
  onDemo?: () => void;
  onLongDemo?: () => void;
  onSpatialDiagnostic?: () => void;
}) {
  const [worldDescription, setWorldDescription] = useState('');
  const [durationMinutes, setDuration] = useState(10);
  const [eegSource, setEegSource] = useState<'muse' | 'recorded'>('muse');
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
        <button className="demo-launch" onClick={onAdaptiveDemo}>
          Phase 1 · adaptive EEG mock → spatial audio
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
