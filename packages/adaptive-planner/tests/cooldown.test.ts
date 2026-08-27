import { describe, expect, it } from 'vitest';
import { evaluateEligibility, phase1Config } from '../src/index.js';
import { mockCalibrationProfile } from '../src/fixtures.js';
import type { AdaptationHistoryItem, AttentionState } from '../src/index.js';

const stateAt = (timestampMs: number): AttentionState =>
  ({
    timestampMs,
    phase: 'adaptive',
    validEpochCount: 6,
  }) as AttentionState;

const historyItem = (
  experiencedAtMs?: number,
): AdaptationHistoryItem => ({
  adaptationId: 'adapt-1',
  timestampMs: 1_000,
  ...(experiencedAtMs === undefined ? {} : { experiencedAtMs }),
  goal: 'gently-reorient',
  scope: 'within-scene',
  assetIds: ['forest_bird_far_01'],
  rationale: 'test',
});

describe('experienced-adaptation cooldown', () => {
  it('does not delay the accepted adaptation before audio has started', () => {
    expect(
      evaluateEligibility(
        stateAt(5_000),
        mockCalibrationProfile,
        [historyItem()],
        phase1Config,
      ),
    ).toMatchObject({ eligible: true, reasons: ['eligible'] });
  });

  it('blocks for ten seconds after AUDIO_STARTED and allows equality', () => {
    expect(
      evaluateEligibility(
        stateAt(19_999),
        mockCalibrationProfile,
        [historyItem(10_000)],
        phase1Config,
      ).reasons,
    ).toContain('adaptation_cooldown');
    expect(
      evaluateEligibility(
        stateAt(20_000),
        mockCalibrationProfile,
        [historyItem(10_000)],
        phase1Config,
      ).reasons,
    ).not.toContain('adaptation_cooldown');
  });

  it('does not start cooldown for a plan whose audio failed', () => {
    expect(
      evaluateEligibility(
        stateAt(2_000),
        mockCalibrationProfile,
        [historyItem()],
        phase1Config,
      ).eligible,
    ).toBe(true);
  });
});
