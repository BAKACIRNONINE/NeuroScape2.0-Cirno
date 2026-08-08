import { describe, expect, it } from 'vitest';
import { audioActivePeriods, deriveSummary, descriptiveReflection, journeyDistance, plannerTimeline, semanticLocationDurations } from '../src/ui/summary/index.js';
import { recordedSession } from './recordingFixtures.js';
describe('recorded summary derivation', () => {
  it('calculates the direct Arousal average and actual recorded journey distance', () => { const recording = recordedSession(), summary = deriveSummary(recording); expect(summary.averageArousal).toBeCloseTo(.455); expect(journeyDistance(recording.runtimeSnapshots)).toBe(7); });
  it('calculates semantic and audio durations only between evidenced snapshots', () => { const recording = recordedSession(); expect(semanticLocationDurations(recording)).toEqual({ clearing: 1000, 'stream-bank': 2000 }); const periods = audioActivePeriods(recording); expect(periods.find((item) => item.key === 'ambient:wind')?.durationMs).toBe(2000); expect(periods.find((item) => item.key === 'event:bird')?.durationMs).toBe(2000); });
  it('derives planner timeline and non-causal descriptive reflection', () => { const recording = recordedSession(); expect(plannerTimeline(recording)[0]?.goal).toBe('Support sustained calm'); const reflection = descriptiveReflection(recording); expect(reflection).toContain('Arousal was higher'); expect(reflection).not.toContain('caused'); });
});
