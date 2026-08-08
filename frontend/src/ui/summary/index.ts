import type { RecordedSession, RuntimeWorldState } from '@neuroscape/contracts';

const average = (values: readonly number[]): number | null => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
export interface SummaryMetrics { averageArousal: number | null; durationMs: number; journeyDistance: number; locationsVisited: string[]; eventCount: number }
export interface AudioPeriod { key: string; category: 'ambient' | 'action' | 'event'; assetId: string; startMs: number; endMs: number; durationMs: number }

export function deriveSummary(recording: RecordedSession): SummaryMetrics {
  const neuro = recording.neuroStates, runtime = recording.runtimeSnapshots;
  const locations = [...new Set(runtime.map((item) => item.listener.semanticLocation))];
  const eventCount = new Set(runtime.flatMap((item) => item.event.filter((event) => event.active).map((event) => event.id))).size;
  return { averageArousal: average(neuro.map((item) => item.arousal.value)), durationMs: recording.metadata.durationMs, journeyDistance: journeyDistance(runtime), locationsVisited: locations, eventCount };
}
export function journeyDistance(snapshots: readonly RuntimeWorldState[]): number { let total = 0; for (let index = 1; index < snapshots.length; index += 1) { const a = snapshots[index - 1]!.listener.worldPosition, b = snapshots[index]!.listener.worldPosition; total += Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]); } return total; }
export function semanticLocationDurations(recording: RecordedSession): Record<string, number> { const totals: Record<string, number> = {}; recording.runtimeSnapshots.forEach((snapshot, index) => { const end = recording.runtimeSnapshots[index + 1]?.timestampMs ?? recording.metadata.durationMs; totals[snapshot.listener.semanticLocation] = (totals[snapshot.listener.semanticLocation] ?? 0) + Math.max(0, end - snapshot.timestampMs); }); return totals; }
export function audioActivePeriods(recording: RecordedSession): AudioPeriod[] {
  const open = new Map<string, Omit<AudioPeriod, 'endMs' | 'durationMs'>>(), periods: AudioPeriod[] = [];
  recording.runtimeSnapshots.forEach((snapshot, index) => {
    const values = [
      ...snapshot.ambient.map((item) => ({ ...item, category: 'ambient' as const })),
      ...snapshot.action.map((item) => ({ ...item, category: 'action' as const })),
      ...snapshot.event.map((item) => ({ ...item, category: 'event' as const })),
    ];
    const active = new Set(values.filter((item) => item.active).map((item) => `${item.category}:${item.id}`));
    values.filter((item) => item.active).forEach((item) => { const key = `${item.category}:${item.id}`, existing = open.get(key); if (existing && existing.assetId !== item.assetId) { periods.push({ ...existing, endMs: snapshot.timestampMs, durationMs: Math.max(0, snapshot.timestampMs - existing.startMs) }); open.delete(key); } if (!open.has(key)) open.set(key, { key, category: item.category, assetId: item.assetId, startMs: snapshot.timestampMs }); });
    const finalEnd = recording.runtimeSnapshots[index + 1]?.timestampMs ?? recording.metadata.durationMs;
    for (const [key, item] of open) if (!active.has(key) || index === recording.runtimeSnapshots.length - 1) { const endMs = active.has(key) ? finalEnd : snapshot.timestampMs; periods.push({ ...item, endMs, durationMs: Math.max(0, endMs - item.startMs) }); open.delete(key); }
  }); return periods;
}
export function plannerTimeline(recording: RecordedSession) { return recording.sceneJourneyPlans.map((entry) => ({ timestampMs: entry.timestampMs, goal: entry.value.userJourney.goal, reasoningSummary: entry.value.reasoningSummary, journey: entry.value.userJourney.waypoints.map((point) => point.locationId), transitionPolicy: entry.value.transitionPolicy, soundCounts: { ambient: entry.value.soundscape.ambient.length, action: entry.value.soundscape.action.length, event: entry.value.soundscape.event.length } })); }
export function descriptiveReflection(recording: RecordedSession): string {
  if (!recording.neuroStates.length) return 'Neuro-state observations were unavailable for this recording.';
  const midpoint = Math.ceil(recording.neuroStates.length / 2), first = average(recording.neuroStates.slice(0, midpoint).map((item) => item.arousal.value))!, second = average(recording.neuroStates.slice(midpoint).map((item) => item.arousal.value)) ?? first;
  const direction = second > first ? 'higher' : second < first ? 'lower' : 'stable'; const location = recording.runtimeSnapshots.at(-1)?.listener.semanticLocation;
  return `Arousal was ${direction} in the latter portion of the recorded session${location ? ` while the listener journey ended at ${location}` : ''}. This is a descriptive coincidence, not a causal interpretation.`;
}
