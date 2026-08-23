import type {
  ActionPlanItem,
  AmbientPlanItem,
  EventPlanItem,
} from '@neuroscape/contracts';
import type { AdaptivePlannerConfig } from './config.js';
import type {
  AdaptationDecision,
  DecisionContext,
  DecisionProvider,
  PlanningProvider,
  PlanningResult,
} from './types.js';

export interface SoundAssetKnowledge {
  assetId: string;
  family: string;
  layer: 'ambient' | 'event' | 'body-anchor';
  description: string;
  durationMs?: number;
}

export const phase1SoundKnowledge: readonly SoundAssetKnowledge[] =
  Object.freeze([
    {
      assetId: 'ambient.forest.light',
      family: 'forest-bed',
      layer: 'ambient',
      description: 'Quiet continuous forest bed.',
    },
    {
      assetId: 'ambient.forest.wind',
      family: 'forest-wind',
      layer: 'ambient',
      description: 'Localized wind through leaves.',
    },
    {
      assetId: 'ambient.stream.near',
      family: 'water',
      layer: 'ambient',
      description: 'Nearby flowing water.',
    },
    {
      assetId: 'ambient.waterfall',
      family: 'water',
      layer: 'ambient',
      description: 'Broad waterfall ambience.',
    },
    {
      assetId: 'event.bird-pass',
      family: 'bird',
      layer: 'event',
      description: 'One sparse directional bird pass.',
      durationMs: 6_000,
    },
    {
      assetId: 'event.leaves',
      family: 'leaves',
      layer: 'event',
      description: 'Short localized leaf movement.',
      durationMs: 5_000,
    },
    {
      assetId: 'action.guided-breath',
      family: 'breath',
      layer: 'body-anchor',
      description: 'Near-chest paced breathing anchor.',
    },
  ]);

export class MockDecisionProvider implements DecisionProvider {
  async decide(context: DecisionContext): Promise<AdaptationDecision> {
    const state = context.state;
    const mindWandering = state.mindWanderingPosition ?? 0;
    if (
      mindWandering >= 0.84 &&
      state.sustainedMindWanderingWindows >= 3 &&
      context.restrictions.allowSceneTransition
    ) {
      return {
        shouldAdapt: true,
        goal: 'refresh-engagement',
        scope: 'scene-transition',
        rationale:
          'Sustained high calibration-relative mind-wandering followed lighter interventions; a low-frequency scene transition is allowed.',
        provider: 'mock-decision-v1',
      };
    }
    if (
      mindWandering >= 0.7 &&
      state.sustainedMindWanderingWindows >= 2 &&
      context.restrictions.allowBodyAnchor
    ) {
      return {
        shouldAdapt: true,
        goal: 'support-grounding',
        scope: 'within-scene',
        rationale:
          'Mind-wandering is sustained across windows; use a body-relative anchor while keeping the semantic scene stable.',
        provider: 'mock-decision-v1',
      };
    }
    if (
      mindWandering >= 0.52 &&
      state.trend === 'toward-mind-wandering' &&
      context.restrictions.allowEvent
    ) {
      return {
        shouldAdapt: true,
        goal: 'gently-reorient',
        scope: 'within-scene',
        rationale:
          'Attention is moving toward the personal mind-wandering reference; use one sparse directional event.',
        provider: 'mock-decision-v1',
      };
    }
    return {
      shouldAdapt: false,
      goal: 'maintain',
      scope: 'maintain',
      rationale:
        'The current calibration-relative state does not justify a new intervention at this checkpoint.',
      provider: 'mock-decision-v1',
    };
  }
}

export class MockPlanningProvider implements PlanningProvider {
  constructor(private readonly config: AdaptivePlannerConfig) {}

  async plan(
    context: DecisionContext,
    decision: AdaptationDecision,
  ): Promise<PlanningResult> {
    if (!decision.shouldAdapt)
      throw new Error(
        'PlanningProvider must not be called for a maintain decision.',
      );
    const now = context.state.timestampMs;
    if (decision.scope === 'scene-transition') {
      const current =
        context.currentPlan.userJourney.waypoints.at(-1)?.locationId ??
        'clearing';
      const destination =
        current === 'waterfall'
          ? 'waterfall'
          : current === 'stream_bank'
            ? 'waterfall'
            : 'stream_bank';
      const ambient: AmbientPlanItem =
        destination === 'waterfall'
          ? {
              id: 'water-anchor',
              assetId: 'ambient.waterfall',
              mode: 'localized',
              locationId: 'waterfall',
              gain: 0.5,
              active: true,
            }
          : {
              id: 'water-anchor',
              assetId: 'ambient.stream.near',
              mode: 'localized',
              locationId: 'stream_bank',
              gain: 0.42,
              active: true,
            };
      return {
        patch: {
          reasoningSummary: decision.rationale,
          journey: {
            goal: `Move gently from ${current} toward ${destination}`,
            waypoints: [{ locationId: current }, { locationId: destination }],
          },
          upsertAmbient: [ambient],
          transitionDurationMs: 8_000,
        },
        selectedAssetIds: [ambient.assetId],
        rationale: `Water ambience and a connected semantic journey realize the ${destination} transition.`,
        provider: 'mock-planner-v1',
      };
    }
    if (decision.goal === 'support-grounding') {
      const action: ActionPlanItem = {
        id: 'breathing',
        assetId: 'action.guided-breath',
        attachment: 'chest',
        relativePosition: [0, -0.25, -0.12],
        gain: 0.28,
        active: true,
      };
      return {
        patch: {
          reasoningSummary: decision.rationale,
          upsertAction: [action],
          transitionDurationMs: 3_000,
        },
        selectedAssetIds: [action.assetId],
        rationale:
          'A listener-relative breath cue provides grounding without implying listener movement.',
        provider: 'mock-planner-v1',
      };
    }
    const recentAssets = new Set(
      context.history
        .filter(
          (item) => now - item.timestampMs < this.config.exactAssetCooldownMs,
        )
        .flatMap((item) => item.assetIds),
    );
    const assetFamily = new Map(
      phase1SoundKnowledge.map((asset) => [asset.assetId, asset.family]),
    );
    const recentFamilies = new Set(
      context.history
        .filter(
          (item) => now - item.timestampMs < this.config.assetFamilyCooldownMs,
        )
        .flatMap((item) =>
          item.assetIds.map((assetId) => assetFamily.get(assetId)),
        )
        .filter((family): family is string => family !== undefined),
    );
    const assetId = ['event.bird-pass', 'event.leaves'].find(
      (candidate) =>
        !recentAssets.has(candidate) &&
        !recentFamilies.has(assetFamily.get(candidate)!),
    );
    if (!assetId) {
      throw new Error(
        'No event asset satisfies the exact-asset and asset-family cooldowns.',
      );
    }
    const event: EventPlanItem = {
      id: `event-${now}`,
      assetId,
      activationTimeMs: now + 2_000,
      durationMs: assetId === 'event.bird-pass' ? 6_000 : 5_000,
      trajectory: [
        { locationId: 'forest_entry', timestampMs: now + 2_000 },
        { locationId: 'clearing', timestampMs: now + 8_000 },
      ],
      gain: 0.3,
    };
    return {
      patch: {
        reasoningSummary: decision.rationale,
        upsertEvent: [event],
        transitionDurationMs: 2_000,
      },
      selectedAssetIds: [assetId],
      rationale:
        'A single low-gain moving event gently reorients attention while the listener and scene remain unchanged.',
      provider: 'mock-planner-v1',
    };
  }
}
