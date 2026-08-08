import { useStore } from 'zustand';
import { runtimeStore } from '../../runtime/RuntimeStore.js';

export function NeuroStatePanel() {
  const neuro = useStore(runtimeStore, (state) => state.neuroState);
  const metrics = [{ name: 'Arousal', value: neuro?.arousal.value, trend: neuro?.arousal.trend }];
  return <section className="glass-panel data-panel neuro-panel"><h2>Neuro State</h2><div className="metric-grid">{metrics.map((metric) => <article key={metric.name}><span>{metric.name}</span><strong>{metric.value === undefined ? '—' : `${Math.round(metric.value * 100)}%`}</strong><small>{metric.trend ?? 'Backend value'}</small><i style={{ width: `${(metric.value ?? 0) * 100}%` }} /></article>)}</div></section>;
}
