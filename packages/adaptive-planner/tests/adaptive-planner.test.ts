import { describe, expect, it } from 'vitest';
import {
  AdaptivePlannerEngine,
  MockDecisionProvider,
  MockPlanningProvider,
  createMockTbrReplay,
  createForestBasePlan,
  initialForestPlan,
  mergePlanPatch,
  mockCalibrationProfile,
  phase1Config,
  type SoundscapePlanPatch,
} from '../src/index.js';

const engine = () =>
  new AdaptivePlannerEngine({
    config: phase1Config,
    profile: mockCalibrationProfile,
    initialPlan: initialForestPlan,
    decisionProvider: new MockDecisionProvider(),
    planningProvider: new MockPlanningProvider(),
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
    expect(checkpoints.slice(0, 5).map((item) => item.state.timestampMs)).toEqual(
      [60_000, 80_000, 100_000, 120_000, 140_000],
    );
    const lastCheckpointMs =
      phase1Config.openingDurationMs +
      Math.floor(
        (phase1Config.sessionDurationMs - phase1Config.openingDurationMs) /
          phase1Config.checkpointIntervalMs,
      ) *
        phase1Config.checkpointIntervalMs;
    expect(checkpoints.at(-1)?.state.timestampMs).toBe(lastCheckpointMs);
    expect(checkpoints.at(-1)?.state.phase).toBe('adaptive');
    expect(checkpoints.at(-1)?.eligibility.reasons).not.toContain(
      'closing_phase',
    );
    expect(checkpoints.some((item) => item.decision?.shouldAdapt)).toBe(true);
    expect(checkpoints.some((item) => item.plan?.soundscape.event.length)).toBe(
      true,
    );
    expect(
      checkpoints.some((item) =>
        item.plan?.soundscape.action.some(
          (sound) => sound.assetId === 'body_slow_breath_01',
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

  it('uses checkpoint deadlines when epoch timestamps are not aligned', async () => {
    const planner = engine();
    const template = createMockTbrReplay()[0]!;
    const checkpoints = [];
    for (const timestampMs of [10_000, 30_000, 59_000, 61_000, 79_000, 81_000, 101_000]) {
      const result = await planner.ingest({ ...template, timestampMs });
      if (result) checkpoints.push(result.state.timestampMs);
    }
    expect(checkpoints).toEqual([61_000, 81_000, 101_000]);
  });

  it('does not let a later checkpoint invalidate an in-flight planner transaction', async () => {
    let releaseDecision!: (value: unknown) => void;
    const decision = new Promise((resolve) => {
      releaseDecision = resolve;
    });
    let calls = 0;
    const planner = new AdaptivePlannerEngine({
      config: phase1Config,
      profile: mockCalibrationProfile,
      initialPlan: initialForestPlan,
      decisionProvider: {
        decide: async () => {
          calls += 1;
          return decision as never;
        },
      },
      planningProvider: new MockPlanningProvider(),
    });
    const replay = createMockTbrReplay();
    for (const epoch of replay.filter((item) => item.timestampMs < 60_000))
      await planner.ingest(epoch);
    const first = planner.ingest(
      replay.find((item) => item.timestampMs === 60_000)!,
    );
    let busyResult;
    for (const epoch of replay.filter(
      (item) => item.timestampMs > 60_000 && item.timestampMs <= 100_000,
    ))
      busyResult = await planner.ingest(epoch);
    expect(busyResult?.eligibility).toMatchObject({
      eligible: false,
      reasons: ['planner_request_in_progress'],
    });
    expect(calls).toBe(1);
    releaseDecision({
      shouldAdapt: false,
      goal: 'maintain',
      scope: 'maintain',
      rationale: 'complete first transaction',
      provider: 'test',
    });
    await first;
  });

  it('removes schema-required null locations from global ambient patches', () => {
    const patch = {
      reasoningSummary: 'Replace the global forest bed.',
      upsertAmbient: [
        {
          id: 'forest-bed',
          assetId: 'forest_ambient_bed_02',
          mode: 'global',
          locationId: null,
          gain: 0.44,
          active: true,
        },
      ],
    } as unknown as SoundscapePlanPatch;

    const plan = mergePlanPatch(initialForestPlan, patch, 330_000);
    const forestBed = plan.soundscape.ambient.find(
      (item) => item.id === 'forest-bed',
    );
    expect(forestBed).toEqual({
      id: 'forest-bed',
      adaptationId: 'adapt-330000',
      assetId: 'forest_ambient_bed_02',
      mode: 'global',
      gain: 0.44,
      active: true,
    });
    expect(forestBed).not.toHaveProperty('locationId');
  });

  it.each(['APPLIED', 'FAILED'] as const)(
    'commits a Base Plan proposal only after runtime reports %s',
    async (applicationStatus) => {
      const basePlan = createForestBasePlan(phase1Config);
      const planner = new AdaptivePlannerEngine({
        config: phase1Config,
        profile: mockCalibrationProfile,
        initialPlan: initialForestPlan,
        basePlan,
        decisionProvider: {
          decide: async () => ({
            decision: 'adapt',
            intent: 'support_sustained_focus',
            salience: 'minimal',
            evidenceSummary: {
              position: 'focus-leaning',
              trajectory: 'stable',
              confidence: 'low',
            },
            reason: 'test proposal',
            maintainReason: null,
            constraintsForDecision2: [],
            shouldAdapt: true,
            goal: 'support-sustained-focus',
            scope: 'within-scene',
            rationale: 'test proposal',
            provider: 'test',
          }),
        },
        planningProvider: {
          plan: async (_context, _decision, input) => {
            const candidate = input.candidates.find(
              (item) => item.layer === 'ambient' && !item.currentlyActive,
            )!;
            return {
              patch: {
                reasoningSummary: 'Add a quiet stream.',
                upsertAmbient: [
                  {
                    id: 'pending-stream',
                    assetId: candidate.assetId,
                    mode: 'global',
                    gain: candidate.recommendedVolume,
                    active: true,
                  },
                ],
                transitionDurationMs: 4_000,
              },
              selectedAssetIds: [candidate.assetId],
              candidateAssetIds: input.candidates.map((item) => item.assetId),
              promptVersion: 'test',
              prompt: 'test',
              outputSchema: {},
              rationale: 'test',
              provider: 'test',
            };
          },
        },
      });
      let proposal;
      for (const epoch of createMockTbrReplay()) {
        const result = await planner.ingest(epoch);
        if (result?.futurePatch) {
          proposal = result;
          break;
        }
      }
      expect(proposal?.plan?.soundscape.ambient).toContainEqual(
        expect.objectContaining({ id: 'pending-stream' }),
      );
      expect(planner.currentPlan.soundscape.ambient).not.toContainEqual(
        expect.objectContaining({ id: 'pending-stream' }),
      );
      expect(planner.history).toHaveLength(0);

      planner.acknowledgeApplication(
        proposal!.futurePatch!.adaptationId,
        applicationStatus,
        proposal!.state.timestampMs,
      );

      const committed = applicationStatus === 'APPLIED';
      expect(
        planner.currentPlan.soundscape.ambient.some(
          (item) => item.id === 'pending-stream',
        ),
      ).toBe(committed);
      expect(planner.history).toHaveLength(committed ? 1 : 0);
      expect(planner.acceptedPatches).toHaveLength(committed ? 1 : 0);
    },
  );
});
