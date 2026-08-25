import { describe, expect, it } from 'vitest';
import {
  AdaptivePlannerEngine,
  MockDecisionProvider,
  MockPlanningProvider,
  createMockTbrReplay,
  createMatchedForestBasePlans,
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
    const lastCheckpointMs =
      phase1Config.openingDurationMs +
      Math.floor(
        (phase1Config.sessionDurationMs - phase1Config.openingDurationMs) /
          phase1Config.checkpointIntervalMs,
      ) *
        phase1Config.checkpointIntervalMs;
    expect(checkpoints.at(-1)?.state.timestampMs).toBe(lastCheckpointMs);
    expect(checkpoints.at(-1)?.eligibility.reasons).toContain('closing_phase');
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
      const [basePlan] = createMatchedForestBasePlans(phase1Config);
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
          plan: async () => ({
            patch: {
              reasoningSummary: 'Add a quiet stream.',
              upsertAmbient: [
                {
                  id: 'pending-stream',
                  assetId: 'forest_stream_ambient_bed_01',
                  mode: 'global',
                  gain: 0.58,
                  active: true,
                },
              ],
              transitionDurationMs: 4_000,
            },
            selectedAssetIds: ['forest_stream_ambient_bed_01'],
            candidateAssetIds: ['forest_stream_ambient_bed_01'],
            promptVersion: 'test',
            prompt: 'test',
            outputSchema: {},
            rationale: 'test',
            provider: 'test',
          }),
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
