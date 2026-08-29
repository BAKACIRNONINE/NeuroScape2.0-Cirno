import { describe, expect, it } from 'vitest';
import {
  AttentionInterpreter, MockDecisionProvider, evaluateEligibility,
  initialForestPlan, phase1Config,
  type CalibrationProfile, type TbrEpoch,
} from '../src/index.js';

const profile = (baseline = 1, mad = 0.08): CalibrationProfile => ({
  profileId: 'test', baselineLogTbr: baseline, baselineMad: mad,
  baselineScale: mad * 1.4826, effectiveBaselineScale: Math.max(0.05, mad * 1.4826),
  expectedEpochCount: 30, validEpochCount: 28, invalidEpochCount: 2,
  baselineAvailable: true, qualityStatus: 'pass', qualityIssues: [],
  selfReportedFocus: 5, selfReportedDrowsiness: 2,
  featureVersion: 'raw_welch_frontal_log_tbr_guided_baseline_protocol_v5',
});
const epoch = (logTbr: number, timestampMs = 70_000): TbrEpoch => ({
  timestampMs, logTbr, valid: true, qualityScore: 1, artifactFlags: [],
});

describe('guided-baseline-relative state', () => {
  it('computes raw, ratio, percent, and robust baseline deltas', () => {
    const state = new AttentionInterpreter(profile(), { ...phase1Config, minimumValidEpochs: 1 }).ingest(epoch(1.1));
    expect(state.deltaFromBaseline).toBeCloseTo(0.1);
    expect(state.tbrRatioToBaseline).toBeCloseTo(Math.exp(0.1));
    expect(state.tbrPercentChange).toBeCloseTo((Math.exp(0.1) - 1) * 100);
    expect(state.robustDeltaFromBaseline).toBeCloseTo(0.1 / 0.118608);
    expect(state.baselineRelation).toBe('baseline-consistent');
  });

  it('uses the effective scale floor for a low-MAD baseline', () => {
    const state = new AttentionInterpreter(profile(1, 0), { ...phase1Config, minimumValidEpochs: 1 }).ingest(epoch(1.1));
    expect(state.effectiveBaselineScale).toBe(0.05);
    expect(state.robustDeltaFromBaseline).toBeCloseTo(2);
    expect(state.baselineRelation).toBe('tbr-elevated');
  });

  it('marks unusable or undersampled input uncertain', () => {
    const unusableProfile = { ...profile(), baselineAvailable: false, qualityStatus: 'fail' as const };
    const unusable = new AttentionInterpreter(unusableProfile, phase1Config).ingest(epoch(1.2));
    expect(unusable.robustDeltaFromBaseline).toBeNull();
    expect(unusable.baselineRelation).toBe('uncertain');
    const undersampled = new AttentionInterpreter(profile(), phase1Config).ingest(epoch(1.2));
    expect(undersampled.baselineRelation).toBe('uncertain');
    expect(undersampled.measurementConfidence).toBe('low');
  });

  it('detects a decreasing robust deviation across three checkpoints', () => {
    const config = { ...phase1Config, analysisWindowMs: 1, minimumValidEpochs: 1 };
    const interpreter = new AttentionInterpreter(profile(), config);
    const states = [1.5, 1.35, 1.2].map((value, index) => interpreter.ingest(epoch(value, 70_000 + index * 40_000)));
    expect(states[2]!.robustDeltaSlope).toBeLessThan(0);
    expect(states[2]!.trend).toBe('decreasing');
    expect(states[2]!.trajectory).toBe('improving');
  });

  it('allows sustained reduced TBR to request minimal supportive evolution after stasis', async () => {
    const interpreter = new AttentionInterpreter(profile(), { ...phase1Config, minimumValidEpochs: 1 });
    const state = interpreter.ingest(epoch(0.75, 180_000));
    const decision = await new MockDecisionProvider().decide({
      state: { ...state, baselineRelation: 'tbr-reduced', trajectory: 'stable' },
      profile: profile(), recentStates: [], currentPlan: structuredClone(initialForestPlan), history: [],
      restrictions: { allowEvent: true, allowBodyAnchor: true, allowSceneTransition: true, sceneTransitionsRemaining: 5 },
      secondsSinceLastMeaningfulChange: 180, stasisPressure: true, transitionInProgress: false,
    });
    expect(decision.decision).toBe('adapt');
    expect(decision.intent).toBe('support_sustained_focus');
    expect(decision.salience).toBe('minimal');
  });

  it('blocks planning during a protected transition window', () => {
    const config = { ...phase1Config, minimumValidEpochs: 1 };
    const state = new AttentionInterpreter(profile(), config).ingest(epoch(1, 180_000));
    const gate = evaluateEligibility(state, profile(), [], config, 200_000, true);
    expect(gate.eligible).toBe(false);
    expect(gate.reasons).toContain('protected_transition_in_progress');
  });
});
