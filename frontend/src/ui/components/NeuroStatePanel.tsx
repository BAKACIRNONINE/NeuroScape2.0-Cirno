import { useStore } from 'zustand';
import type { BaselineRelativeAttentionState } from '@neuroscape/contracts';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

function baselineAttention(value: unknown): value is BaselineRelativeAttentionState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'stateEstimationVersion' in value &&
    value.stateEstimationVersion === 'guided_baseline_delta_v1'
  );
}

export function NeuroStatePanel() {
  const neuro = useStore(runtimeStore, (state) => state.neuroState);
  const attention = baselineAttention(neuro?.attention)
    ? neuro.attention
    : undefined;
  const metrics = [
    ['TBR delta from baseline', attention?.deltaFromBaseline, attention?.baselineRelation],
    ['TBR ratio to baseline', attention?.tbrRatioToBaseline, attention?.trend],
    ['TBR change relative to baseline', attention?.tbrPercentChange, '%'],
    ['Robust baseline deviation', attention?.robustDeltaFromBaseline, 'operational estimate'],
  ] as const;
  return (
    <section className="glass-panel data-panel neuro-panel">
      <h2>Baseline-Relative Neuro State</h2>
      <div className="metric-grid">
        {metrics.map(([name, value, detail]) => (
          <article key={name}>
            <span>{name}</span>
            <strong>{value == null ? '—' : value.toFixed(2)}</strong>
            <small>{detail ?? 'Unavailable'}</small>
          </article>
        ))}
      </div>
      <p>
        Signal: {attention?.signalQuality ?? 'unavailable'} · Confidence:{' '}
        {attention?.measurementConfidence ?? 'low'}
      </p>
    </section>
  );
}
