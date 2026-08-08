import { useStore } from 'zustand';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

export function NeuroStatePanel() {
  const neuro = useStore(runtimeStore, (state) => state.neuroState);
  const metrics = [
    { name: 'Attention', value: neuro?.attention.value, trend: neuro?.attention.trend },
    { name: 'Arousal', value: neuro?.arousal.value, trend: neuro?.arousal.trend },
    { name: 'Stability', value: neuro?.stability }, { name: 'Confidence', value: neuro?.confidence },
  ];
  return <section className="glass-panel data-panel neuro-panel"><h2>Neuro State</h2><div className="metric-grid">{metrics.map((metric) => <article key={metric.name}><span>{metric.name}</span><strong>{metric.value === undefined ? '—' : `${Math.round(metric.value * 100)}%`}</strong><small>{metric.trend ?? 'Backend value'}</small><i style={{ width: `${(metric.value ?? 0) * 100}%` }} /></article>)}</div></section>;
}
