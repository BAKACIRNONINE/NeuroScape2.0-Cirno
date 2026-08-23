import { describe, expect, it } from 'vitest';
import {
  AdaptivePlannerEngine,
  MockDecisionProvider,
  MockPlanningProvider,
  createMockTbrReplay,
  initialForestPlan,
  mockCalibrationProfile,
  phase1Config,
} from '../src/index.js';

const engine = () =>
  new AdaptivePlannerEngine({
    config: phase1Config,
    profile: mockCalibrationProfile,
    initialPlan: initialForestPlan,
    decisionProvider: new MockDecisionProvider(),
    planningProvider: new MockPlanningProvider(phase1Config),
  });

describe('adaptive planner Phase 1', () => {
  it('normalizes mock TBR, applies hard gates, and emits Module 03 plans', async () => {
    const planner = engine();
    const checkpoints = [];
    for (const epoch of createMockTbrReplay()) {
      const result = await planner.ingest(epoch);
      if (result) checkpoints.push(result);
    }
    expect(checkpoints[0]?.state.timestampMs).toBe(60_000);
    expect(checkpoints.at(-1)?.state.timestampMs).toBe(580_000);
    expect(checkpoints.at(-1)?.eligibility.reasons).toContain('closing_phase');
    expect(checkpoints.some((item) => item.decision?.shouldAdapt)).toBe(true);
    expect(checkpoints.some((item) => item.plan?.soundscape.event.length)).toBe(
      true,
    );
    expect(
      checkpoints.some((item) =>
        item.plan?.soundscape.action.some(
          (sound) => sound.assetId === 'action.guided-breath',
        ),
      ),
    ).toBe(true);
    expect(
      checkpoints.some((item) => item.decision?.scope === 'scene-transition'),
    ).toBe(true);
    expect(
      planner.history.filter((item) => item.scope === 'scene-transition')
        .length,
    ).toBeLessThanOrEqual(phase1Config.maxSceneTransitions);
  });

  it('does not call Decision 2 when Decision 1 maintains', async () => {
    let planningCalls = 0;
    const planner = new AdaptivePlannerEngine({
      config: phase1Config,
      profile: mockCalibrationProfile,
      initialPlan: initialForestPlan,
      decisionProvider: {
        decide: async () => ({
          shouldAdapt: false,
          goal: 'maintain',
          scope: 'maintain',
          rationale: 'test maintain',
          provider: 'test',
        }),
      },
      planningProvider: {
        plan: async () => {
          planningCalls += 1;
          throw new Error('must not run');
        },
      },
    });
    for (const epoch of createMockTbrReplay().slice(0, 10))
      await planner.ingest(epoch);
    expect(planningCalls).toBe(0);
  });
});
