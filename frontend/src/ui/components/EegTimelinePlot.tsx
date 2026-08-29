import type { RecordedSession } from '@neuroscape/contracts';

const WIDTH = 900;
const TRACK_HEIGHT = 82;
const LEFT = 72;
const RIGHT = 18;
const plotWidth = WIDTH - LEFT - RIGHT;

function finite(values: Array<number | null>) {
  return values.filter((value): value is number => value !== null && Number.isFinite(value));
}

export function EegTimelinePlot({ recording, title, compact = false }: {
  recording: RecordedSession;
  title: string;
  compact?: boolean;
}) {
  const metrics = recording.eegMetrics ?? [];
  const series = [
    { key: 'theta', label: 'Theta', color: '#71d8ff', values: metrics.map((item) => item.theta) },
    { key: 'beta', label: 'Beta', color: '#f7bf69', values: metrics.map((item) => item.beta) },
    { key: 'tbr', label: 'log-TBR', color: '#c6ff8f', values: metrics.map((item) => item.tbr) },
    ...(!compact ? [{ key: 'baseline', label: 'TBR baseline', color: '#e6a5ff', values: metrics.map((item) => item.tbrBaseline as number | null) }] : []),
  ];
  if (!metrics.length) return <section className="eeg-plot"><h3>{title}</h3><p>No EEG metric history recorded.</p></section>;
  const height = series.length * TRACK_HEIGHT + 42;
  return <section className="eeg-plot">
    <h3>{title}</h3>
    <svg viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={`${title} EEG time series from zero to ten minutes`}>
      {series.map((item, track) => {
        const values = finite(item.values);
        const min = Math.min(...values);
        const max = Math.max(...values);
        const span = Math.max(max - min, 1e-12);
        const top = 12 + track * TRACK_HEIGHT;
        const points = metrics.flatMap((metric, index) => {
          const value = item.values[index];
          return value == null || !Number.isFinite(value) ? [] : [`${LEFT + Math.min(600_000, metric.timestampMs) / 600_000 * plotWidth},${top + 55 - (value - min) / span * 48}`];
        }).join(' ');
        return <g key={item.key}>
          <line x1={LEFT} y1={top + 58} x2={WIDTH - RIGHT} y2={top + 58} stroke="rgba(255,255,255,.18)" />
          <text x="4" y={top + 20} fill={item.color}>{item.label}</text>
          <text x="4" y={top + 38} fill="rgba(255,255,255,.55)" fontSize="10">{min.toPrecision(3)}–{max.toPrecision(3)}</text>
          <polyline points={points} fill="none" stroke={item.color} strokeWidth="2" />
        </g>;
      })}
      {!compact && (recording.decisionEvents ?? []).map((event, index) => {
        const x = LEFT + Math.min(600_000, event.timestampMs) / 600_000 * plotWidth;
        const color = event.type === 'decision-1' ? '#ff7ea8' : '#fff176';
        return <g key={`${event.type}-${event.timestampMs}-${index}`}>
          <line x1={x} y1="2" x2={x} y2={height - 24} stroke={color} strokeDasharray={event.type === 'decision-1' ? '5 3' : '2 3'} />
          <text x={x + 3} y={12 + (index % 2) * 12} fill={color} fontSize="9">{event.type === 'decision-1' ? 'D1' : 'D2'}</text>
        </g>;
      })}
      {[0, 2, 4, 6, 8, 10].map((minute) => <g key={minute}>
        <line x1={LEFT + minute / 10 * plotWidth} y1={height - 22} x2={LEFT + minute / 10 * plotWidth} y2={height - 17} stroke="white" />
        <text x={LEFT + minute / 10 * plotWidth} y={height - 4} fill="rgba(255,255,255,.65)" fontSize="10" textAnchor="middle">{minute} min</text>
      </g>)}
    </svg>
    {!compact && <p className="eeg-plot-legend">Separate Y ranges preserve each signal's recorded values. D1 = Decision 1; D2 = Decision 2.</p>}
  </section>;
}
