import { audioLibrary, audioLibraryById } from '@neuroscape/contracts';
import type { AudioLibraryAsset } from '@neuroscape/contracts';
import type { AdaptivePlannerConfig } from './config.js';
import type {
  AdaptationDecision,
  Decision2Candidate,
  Decision2Input,
  DecisionContext,
  OperationGuidance,
  PlanningResult,
} from './types.js';

export const DECISION_2_PROMPT_VERSION = 'decision-2-spatial-contract-v9';

function authoredEventDurationMs(candidate: Decision2Candidate): number {
  const asset = audioLibraryById.get(candidate.assetId);
  return (
    (asset?.playback_contract?.resolved_lifecycle_sec ??
      candidate.defaultMotion.durationSec ??
      candidate.autoDeleteAfterSec ??
      0) * 1_000
  );
}

const locationScene: Readonly<Record<string, string>> = Object.freeze({
  forest_entry: 'forest',
  clearing: 'forest',
  stream_bank: 'forest',
  waterfall: 'forest',
});

const locationNeighbors: Readonly<Record<string, readonly string[]>> =
  Object.freeze({
    forest_entry: ['clearing'],
    clearing: ['forest_entry', 'stream_bank'],
    stream_bank: ['clearing', 'waterfall'],
    waterfall: ['stream_bank'],
  });

const goalTags: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'gently-reorient': ['attention_low', 'adaptive_shift', 'immersion'],
  'support-grounding': ['grounding', 'settling', 'stability_low'],
  'reduce-stimulation': ['anxiety_high', 'stability_low', 'settling'],
  'refresh-engagement': ['attention_low', 'adaptive_shift', 'immersion'],
  'support-sustained-focus': ['stability_high', 'settling', 'immersion'],
  'preserve-recovery': ['stability_high', 'settling'],
  maintain: ['settling', 'stability_high'],
});

export function audioFamilyId(assetId: string): string {
  return assetId.replace(/_\d+$/, '');
}

function inferCurrentScene(context: DecisionContext): string {
  for (const ambient of context.currentPlan.soundscape.ambient) {
    const asset = audioLibraryById.get(ambient.assetId);
    if (ambient.active && asset?.scene[0]) return asset.scene[0];
  }
  const location = context.currentPlan.userJourney.waypoints.at(-1)?.locationId;
  return (location && locationScene[location]) || 'forest';
}

function candidateFromAsset(
  asset: AudioLibraryAsset,
  appearanceCount: number,
  cooldownRemainingSec: number,
  active?: {
    id: string;
    gain: number;
    position?: [number, number, number];
    allowedOperations?: Array<'ADJUST' | 'REPLACE' | 'SUPPRESS'>;
  },
): Decision2Candidate {
  const limits = asset.session_limits;
  const gainProfile = asset.gain_profile;
  return {
    assetId: asset.asset_id,
    familyId: audioFamilyId(asset.asset_id),
    label: asset.label,
    description: asset.description,
    scene: [...asset.scene],
    layer: asset.layer,
    tags: [...asset.tags],
    loop: asset.loop,
    suddenness: asset.suddenness,
    intensity: asset.intensity,
    recommendedDistance: asset.recommended_distance,
    recommendedVolume: asset.recommended_volume,
    useWhen: [...asset.use_when],
    avoidWhen: [...asset.avoid_when],
    spatialBehavior: [...asset.spatial_behavior],
    defaultPosition: [...asset.default_position],
    defaultMotion: {
      type: asset.default_motion.type,
      durationSec: asset.default_motion.duration ?? null,
      ...(asset.default_motion.start
        ? { start: [...asset.default_motion.start] as [number, number, number] }
        : {}),
      ...(asset.default_motion.mid
        ? { mid: [...asset.default_motion.mid] as [number, number, number] }
        : {}),
      ...(asset.default_motion.end
        ? { end: [...asset.default_motion.end] as [number, number, number] }
        : {}),
    },
    autoDeleteAfterSec: asset.auto_delete_after_sec,
    fadeInSec: asset.fade_in_sec,
    fadeOutSec: asset.fade_out_sec,
    priority: asset.priority,
    isPrimaryAmbient: asset.is_primary_ambient,
    isRareEvent: asset.is_rare_event,
    qualityTier: asset.quality_tier ?? 'standard',
    selectionWeight: asset.selection_weight ?? 1,
    remainingSessionAppearances:
      limits?.max_appearances == null
        ? null
        : Math.max(0, limits.max_appearances - appearanceCount),
    cooldownRemainingSec,
    maxSafeGain: gainProfile?.max_safe_gain ?? 1,
    qualityAttenuation: gainProfile?.quality_attenuation ?? 1,
    playbackContractSummary: asset.playback_contract
      ? `${asset.playback_contract.mode}; repeats ${asset.playback_contract.repeat_count_options.join('|')}; ${asset.playback_contract.envelope_kind}`
      : 'single; metadata fade',
    compatibleEnvironmentalBonds:
      asset.narrative_compatibility?.requires_related_active_family != null
        ? [asset.narrative_compatibility.requires_related_active_family]
        : [],
    gainRange: {
      min: 0,
      recommended: asset.recommended_volume,
      max: gainProfile?.max_safe_gain ?? 1,
    },
    currentlyActive: Boolean(active),
    ...(active
      ? {
          activeElementId: active.id,
          currentGain: active.gain,
          ...(active.position ? { currentPosition: active.position } : {}),
          currentLayer: asset.layer,
        }
      : {}),
    allowedOperations: active
      ? (active.allowedOperations ?? ['ADJUST', 'REPLACE', 'SUPPRESS'])
      : ['INSERT'],
  };
}

function densityFor(count: number): 'low' | 'medium' | 'high' {
  return count <= 1 ? 'low' : count === 2 ? 'medium' : 'high';
}

export function computeOperationGuidance(
  context: DecisionContext,
  config: AdaptivePlannerConfig,
): OperationGuidance {
  const now = context.state.timestampMs;
  const active = [
    ...context.currentPlan.soundscape.ambient.filter((item) => item.active),
    ...context.currentPlan.soundscape.action.filter((item) => item.active),
    ...context.currentPlan.soundscape.event.filter(
      (item) =>
        item.activationTimeMs <= now &&
        now < item.activationTimeMs + item.durationMs,
    ),
  ];
  const upcoming = context.upcomingBaseHorizon ?? [];
  const currentDensity = densityFor(active.length);
  const upcomingDensity = densityFor(
    Math.max(active.length, ...upcoming.map(() => active.length + 1), 0),
  );
  const complexityHeadroom = Math.max(
    0,
    config.maxConcurrentSources - active.length,
  );
  const currentSalience = active.reduce(
    (sum, item) => sum + (item.gain ?? 0),
    0,
  );
  const salienceHeadroom = Math.max(
    0,
    config.maxSalienceLoad - currentSalience,
  );
  const high = currentDensity === 'high' || upcomingDensity === 'high';
  const medium = currentDensity === 'medium' || upcomingDensity === 'medium';
  return {
    currentDensity,
    upcomingDensity,
    complexityHeadroom,
    salienceHeadroom,
    prolongedStasis: context.stasisPressure,
    preferredOperations: high
      ? ['SUPPRESS', 'RESCHEDULE', 'ADJUST', 'REPLACE', 'KEEP']
      : medium
        ? ['ADJUST', 'RESCHEDULE', 'REPLACE', 'INSERT', 'SUPPRESS']
        : ['INSERT', 'ADJUST', 'REPLACE', 'RESCHEDULE', 'KEEP'],
  };
}

export function retrieveDecision2Candidates(
  context: DecisionContext,
  decision: AdaptationDecision,
  config: AdaptivePlannerConfig,
): {
  currentScene: string;
  candidates: Decision2Candidate[];
  eligibleCandidateCount: number;
  recentlyUsedAssets: import('./types.js').RecentlyUsedAsset[];
  retrievalAudit: import('./types.js').Decision2RetrievalAudit[];
} {
  const now = context.state.timestampMs;
  const currentScene = inferCurrentScene(context);
  const activeAssets = new Map<
    string,
    {
      id: string;
      gain: number;
      position?: [number, number, number];
      allowedOperations?: Array<'ADJUST' | 'REPLACE' | 'SUPPRESS'>;
    }
  >();
  const activeCapabilities = (id: string) => {
    const authored = context.basePlan?.scheduledElements.find(
      (element) => element.elementId === id,
    );
    if (!authored) return undefined;
    return [
      ...(authored.adjustable ? (['ADJUST'] as const) : []),
      ...(authored.replaceable ? (['REPLACE'] as const) : []),
      ...(authored.suppressible ? (['SUPPRESS'] as const) : []),
    ];
  };
  context.currentPlan.soundscape.ambient
    .filter((item) => item.active)
    .forEach((item) =>
      activeAssets.set(item.assetId, {
        id: item.id,
        gain: item.gain,
        allowedOperations: activeCapabilities(item.id),
      }),
    );
  context.currentPlan.soundscape.action
    .filter((item) => item.active)
    .forEach((item) =>
      activeAssets.set(item.assetId, {
        id: item.id,
        gain: item.gain,
        position: [...item.relativePosition],
        allowedOperations: activeCapabilities(item.id),
      }),
    );
  context.currentPlan.soundscape.event
    .filter(
      (item) =>
        item.activationTimeMs <= now &&
        now < item.activationTimeMs + item.durationMs,
    )
    .forEach((item) =>
      activeAssets.set(item.assetId, {
        id: item.id,
        gain: item.gain,
        allowedOperations: activeCapabilities(item.id),
      }),
    );
  const recentlyUsedById = new Map<
    string,
    import('./types.js').RecentlyUsedAsset
  >();
  context.history.forEach((item) => {
    if (item.experiencedAtMs === undefined) return;
    item.assetIds.forEach((assetId) => {
      const previous = recentlyUsedById.get(assetId);
      recentlyUsedById.set(assetId, {
        assetId,
        family: audioFamilyId(assetId),
        lastPlayedMs: Math.max(
          previous?.lastPlayedMs ?? 0,
          item.experiencedAtMs!,
        ),
        useCount: (previous?.useCount ?? 0) + 1,
        ...(item.intent ? { lastIntent: item.intent } : {}),
      });
    });
  });
  const recentlyUsedAssets = [...recentlyUsedById.values()].sort(
    (left, right) => right.lastPlayedMs - left.lastPlayedMs,
  );
  const desiredTags = goalTags[decision.goal] ?? [];
  const stateTags = new Set([
    ...desiredTags,
    context.state.phase,
    context.state.baselineRelation === 'tbr-elevated'
      ? 'attention_low'
      : 'stability_high',
  ]);
  const currentLocation =
    context.currentPlan.userJourney.waypoints.at(-1)?.locationId ?? 'clearing';
  const hasWaterBond =
    currentLocation === 'stream_bank' ||
    currentLocation === 'waterfall' ||
    context.currentPlan.soundscape.ambient.some(
      (item) => item.active && audioFamilyId(item.assetId).includes('stream'),
    );
  const appearanceTimes = (assetId: string): number[] => [
    ...context.history
      .filter(
        (item) =>
          item.experiencedAtMs !== undefined && item.assetIds.includes(assetId),
      )
      .map((item) => item.experiencedAtMs!),
    ...context.currentPlan.soundscape.event
      .filter(
        (item) => item.assetId === assetId && item.activationTimeMs <= now,
      )
      .map((item) => item.activationTimeMs),
  ];

  const auditById = new Map<
    string,
    import('./types.js').Decision2RetrievalAudit
  >();
  const scored = audioLibrary
    .map((asset) => {
      const times = appearanceTimes(asset.asset_id);
      const limits = asset.session_limits;
      const last = times.length ? Math.max(...times) : null;
      const cooldownRemainingSec =
        last == null || limits?.min_interval_sec_exclusive == null
          ? 0
          : Math.max(
              0,
              limits.min_interval_sec_exclusive - (now - last) / 1_000,
            );
      const limitReached =
        limits?.max_appearances != null &&
        times.length >= limits.max_appearances;
      const recent = recentlyUsedById.get(asset.asset_id);
      const familyUses = recentlyUsedAssets
        .filter((item) => item.family === audioFamilyId(asset.asset_id))
        .reduce((sum, item) => sum + item.useCount, 0);
      const exactRecent =
        recent && now - recent.lastPlayedMs < config.exactAssetCooldownMs;
      const familyRecent = recentlyUsedAssets.some(
        (item) =>
          item.family === audioFamilyId(asset.asset_id) &&
          now - item.lastPlayedMs < config.assetFamilyCooldownMs,
      );
      const basePriorityScore =
        asset.priority * (asset.selection_weight ?? 1);
      const intentTagScore =
        asset.use_when.filter((tag) => stateTags.has(tag)).length * 2;
      const qualityPenalty =
        asset.quality_tier === 'limited_use' ? 1.5 : 0;
      const recencyPenalty = (exactRecent ? 2 : 0) + (familyRecent ? 1 : 0);
      const repetitionPenalty =
        Math.min(recent?.useCount ?? 0, 3) * 0.75 +
        Math.min(familyUses, 3) * 0.25;
      const contextPenalty =
        (asset.scene.includes(currentScene as 'forest' | 'ocean_beach')
          ? 0
          : 3) +
        (asset.avoid_when.some((tag) => stateTags.has(tag)) ? 2 : 0) +
        (asset.narrative_compatibility?.locations.length &&
        !asset.narrative_compatibility.locations.includes(currentLocation)
          ? 1.5
          : 0) +
        (asset.narrative_compatibility?.requires_related_active_family &&
        !hasWaterBond
          ? 2
          : 0);
      const finalScore =
        basePriorityScore +
        intentTagScore -
        asset.suddenness -
        asset.intensity * 0.25 -
        qualityPenalty -
        recencyPenalty -
        repetitionPenalty -
        contextPenalty;
      const intervalValid =
        last == null ||
        now - last >
          (limits?.min_interval_sec_exclusive ?? -1) * 1_000;
      const technicallyValid =
        !limitReached && cooldownRemainingSec === 0 && intervalValid;
      auditById.set(asset.asset_id, {
        assetId: asset.asset_id,
        technicallyValid,
        filteringStages: [
          'canonical_asset',
          'runtime_layer_supported',
          ...(limitReached ? ['session_appearance_limit'] : []),
          ...(cooldownRemainingSec > 0 ? ['session_interval_limit'] : []),
          ...(asset.scene.includes(currentScene as 'forest' | 'ocean_beach')
            ? ['scene_match']
            : ['scene_mismatch_soft_penalty']),
          ...(activeAssets.has(asset.asset_id)
            ? ['active_asset_exposed_for_modification']
            : []),
        ],
        basePriorityScore,
        intentTagScore,
        qualityPenalty,
        recencyPenalty,
        repetitionPenalty,
        finalScore,
        currentlyActive: activeAssets.has(asset.asset_id),
        ...(recent ? { lastPlayedMs: recent.lastPlayedMs } : {}),
        useCount: recent?.useCount ?? 0,
        includedInFinalCandidates: false,
        ...(!technicallyValid
          ? {
              exclusionReason: limitReached
                ? 'session_appearance_limit'
                : 'session_interval_limit',
            }
          : {}),
      });
      return {
        asset,
        appearanceCount: times.length,
        cooldownRemainingSec,
        legal: technicallyValid,
        score: finalScore,
      };
    })
    .filter((item) => item.legal)
    .sort(
      (left, right) =>
        right.score - left.score ||
        (left.asset.selection_rank_within_family ?? 99) -
          (right.asset.selection_rank_within_family ?? 99) ||
        left.asset.asset_id.localeCompare(right.asset.asset_id),
    );

  const perLayer = new Map<string, number>();
  const candidates = scored
    .filter(({ asset }) => {
      const count = perLayer.get(asset.layer) ?? 0;
      if (count >= 8) return false;
      perLayer.set(asset.layer, count + 1);
      return true;
    })
    .map(({ asset, appearanceCount, cooldownRemainingSec }) => {
      auditById.get(asset.asset_id)!.includedInFinalCandidates = true;
      return candidateFromAsset(
        asset,
        appearanceCount,
        cooldownRemainingSec,
        activeAssets.get(asset.asset_id),
      );
    });
  scored
    .filter(({ asset }) => !candidates.some((c) => c.assetId === asset.asset_id))
    .forEach(({ asset }) => {
      const audit = auditById.get(asset.asset_id)!;
      audit.exclusionReason ??= 'top_k_limit';
    });
  return {
    currentScene,
    candidates,
    eligibleCandidateCount: scored.length,
    recentlyUsedAssets,
    retrievalAudit: audioLibrary.map((asset) => auditById.get(asset.asset_id)!),
  };
}

export function buildDecision2Prompt(
  context: DecisionContext,
  decision: AdaptationDecision,
  currentScene: string,
  candidates: readonly Decision2Candidate[],
  operationGuidance: OperationGuidance,
  recentlyUsedAssets: readonly import('./types.js').RecentlyUsedAsset[] = [],
): string {
  const currentLocation =
    context.currentPlan.userJourney.waypoints.at(-1)?.locationId ?? 'clearing';
  const listenerReachableLocations = [
    currentLocation,
    ...(locationNeighbors[currentLocation] ?? []),
  ];
  const payload = {
    decision1: {
      intent: decision.intent,
      salience: decision.salience,
      scope: decision.scope,
      constraintsForDecision2: decision.constraintsForDecision2,
    },
    executionContext: {
      baselineFallback: {
        active:
          context.state.measurementConfidence === 'low' ||
          context.state.baselineRelation === 'uncertain',
        baselineAvailable:
          context.state.baselineRelation !== 'uncertain',
        measurementConfidence: context.state.measurementConfidence,
        priority: 'system_sound_hierarchy_and_asset_quality',
      },
      phase: context.state.phase,
      currentScene,
      currentLocation,
      reachableLocations: listenerReachableLocations,
      soundSourceLocationIds: Object.keys(locationScene),
      activeJourney: context.currentPlan.userJourney,
      activeSceneSummary: {
        ambient: context.currentPlan.soundscape.ambient.map((item) => ({
          id: item.id,
          assetId: item.assetId,
          gain: item.gain,
          active: item.active,
          mode: item.mode,
          ...(item.locationId ? { locationId: item.locationId } : {}),
        })),
        action: context.currentPlan.soundscape.action.map((item) => ({
          id: item.id,
          assetId: item.assetId,
          gain: item.gain,
          active: item.active,
          attachment: item.attachment,
        })),
        event: context.currentPlan.soundscape.event
          .filter(
            (item) =>
              item.activationTimeMs + item.durationMs >=
              context.state.timestampMs,
          )
          .map((item) => ({
            id: item.id,
            assetId: item.assetId,
            gain: item.gain,
            activationTimeMs: item.activationTimeMs,
            durationMs: item.durationMs,
          })),
      },
      upcomingHorizonSummary: (context.upcomingBaseHorizon ?? []).map(
        (item) => ({
          elementId: item.elementId,
          assetId: item.assetId,
          layer: item.layer,
          startMs: item.startMs,
          endMs: item.endMs,
          gain: item.gain,
          salience: item.salience,
        }),
      ),
      operationGuidance,
      restrictions: context.restrictions,
      recentlyUsedAssets,
    },
    relevantPriorOutcomes: context.relevantPriorOutcomes?.slice(0, 3) ?? [],
    candidates,
  };
  return [
    'You are NeuroScape Decision 2: How to Adapt.',
    'Decision 1 has already decided whether and why to adapt. You must not change its intent, reinterpret EEG, or override the code eligibility gate.',
    'Produce only a minimal future-facing local patch for the supplied upcoming Base Plan horizon. Past content and the execution freeze buffer are immutable.',
    'Maintain means the Base Plan continues its scheduled evolution; NO_SAFE_PATCH also safely continues that Base Plan.',
    'Maintain a coherent spatial world, not just a collection of individually appropriate sounds.',
    'Use the supplied currentLocation, reachableLocations, active journey, upcoming Base Plan horizon, and environmental-bond summaries to decide whether the listener remains stationary or undergoes a meaningful adjacent waypoint transition.',
    'Do not imply listener movement unless a transition is explicitly selected. Footsteps support a physically meaningful transition and must not be inserted mechanically.',
    'Waterfall-like sounds require an established stream/water context. Bird, owl, insect, leaf, and rustle events may occur independently of listener locomotion.',
    'Prefer minimal sufficient changes. Adaptation is not synonymous with adding sound, but do not globally prefer editing existing sounds over insertion.',
    'Follow operationGuidance: at low density a restrained INSERT is a first-class option; at medium density prefer adjustment, rescheduling, or replacement unless insertion fills a missing role; at high density simplify, suppress, remove, or reschedule.',
    'Optimize temporal richness across the session, not simultaneous source density. New layers should normally be temporary or explicitly removed when their role is complete.',
    'Sustained focus does not automatically require maintain. Prolonged stasis may justify minimal supportive evolution without claiming mind wandering.',
    'Exact envelopes, repeats, gain limits, cooldowns, and session limits are enforced by shared metadata and code; select only supplied legal candidates.',
    'Treat every patch as a provisional hypothesis, never a proven intervention. Use only supplied structured prior outcomes and never infer causality from temporal order.',
    'Plan a restrained but perceptibly layered soundscape patch that realizes the supplied Decision 1 intent, salience, scope, and constraintsForDecision2. When appropriate, combine one subtle ambient adjustment with at most one event or body-anchored action.',
    'Apply this goal-to-layer policy whenever restrictions permit and a compatible candidate exists:',
    '- gently-reorient: prioritize one perceptible event. An ambient adjustment may accompany it, but ambient-only changes should not satisfy this goal.',
    '- support-grounding: prioritize one body-anchored action. An ambient adjustment may accompany it, but ambient-only changes should not satisfy this goal.',
    '- refresh-engagement: prioritize a novel event for within-scene scope, or combine a continuous scene transition with one compatible event when scene-transition scope is authorized.',
    '- reduce-stimulation: remove or reduce event/action activity; do not add a salient cue merely to create change.',
    '- support-sustained-focus: make a minimal continuous within-scene evolution; preserve meditation continuity and avoid framing the change as correction.',
    '- preserve-recovery: normally preserve the current plan; if Decision 1 requested adaptation, use only a minimal continuity-preserving adjustment.',
    'These goal-to-layer relationships are semantic preferences, not hard exclusions. Any supplied layer remains possible when Decision 2 gives a coherent low-risk justification consistent with Decision 1.',
    'If the most recent adaptation selected only ambient assets, prioritize an eligible event or action in this patch instead of making another ambient-only change.',
    'At least one newly selected asset should create an actually audible source change; do not claim adaptation while merely restating the current plan.',
    'Candidates marked currentlyActive are modification targets, not INSERT choices. Use their activeElementId and allowedOperations to ADJUST, REPLACE, or SUPPRESS without duplicating the source.',
    'Use only assetId values in candidates. Never invent an asset, location, motion, duration, gain, or numerical range.',
    'Treat candidate summaries as authoritative. Choose gain within gainRange, using recommended as the default reference; do not exceed max. Do not override authored duration, playback contract, technical limits, or quality attenuation.',
    'Explicitly declare a supported distancePolicy (none or bounded inverse) and playback for every inserted sound. Also declare activationCondition for Actions and interpolation plus trajectoryUpdatePolicy for Events. These fields are authoritative downstream.',
    'When executionContext.baselineFallback.active is true, do not optimize against EEG position or trajectory. Optimize the system soundscape itself: preserve a stable primary ambient foundation, allow at most one clearly subordinate supporting ambient role, keep body/action cues intentional, keep events sparse and foregrounded only briefly, and avoid simultaneous competition between layers.',
    'In calibration fallback mode, rank compatible candidates by authored quality and system suitability: prefer qualityTier=preferred, then standard, and use limited_use only when no safer compatible candidate fills the required role. Use priority, selectionWeight, qualityAttenuation, recommendedVolume, suddenness, and intensity together; never replace a coherent layer with a lower-quality asset merely to create change.',
    'For an event, durationMs MUST equal defaultMotion.durationSec * 1000 when defaultMotion.durationSec is non-null; otherwise it MUST equal autoDeleteAfterSec * 1000. autoDeleteAfterSec is only the fallback lifecycle when no authored motion duration exists. A looping asset may remain active until a later patch removes it.',
    'Prefer an unused compatible variant and respect the already-applied exact-asset and family cooldown filtering.',
    'Use recentlyUsedAssets as actual participant-experience history: when multiple candidates are equally appropriate, prefer a perceptually distinct candidate that was heard less recently or less often. Reuse remains allowed when it is clearly the strongest semantic choice; never add randomness merely for novelty.',
    'Add at most one new salient event in one patch. Event-source movement is not listener movement. A body-anchored action does not require a scene transition. Footsteps imply listener movement only when explicitly assigned a locomotion role.',
    'For within-scene adaptation, preserve the listener location and semantic scene. For scene-transition scope, preserve narrative continuity and use only scene-compatible candidates.',
    'Journey waypoints must use only reachableLocations. Sound-source waypoints must use only soundSourceLocationIds.',
    'If no candidate can safely realize the requested adaptation, return no selected assets and explain that the planner must maintain rather than invent content.',
    'Return only a strict SoundscapePlanPatch-compatible JSON object plus selectedAssetIds and a concise inspectable rationale. Do not expose hidden chain-of-thought.',
    `INPUT_JSON=${JSON.stringify(payload)}`,
  ].join('\n');
}

export function buildDecision2OutputSchema(
  candidates: readonly Decision2Candidate[],
  context: DecisionContext,
): Record<string, unknown> {
  const assetIds = candidates.map((candidate) => candidate.assetId);
  const currentLocation =
    context.currentPlan.userJourney.waypoints.at(-1)?.locationId ?? 'clearing';
  const journeyLocations = [
    currentLocation,
    ...(locationNeighbors[currentLocation] ?? []),
  ];
  const sourceLocations = Object.keys(locationScene);
  const ambientCandidates = candidates.filter(
    (candidate) => candidate.layer === 'ambient',
  );
  const actionCandidates = candidates.filter(
    (candidate) => candidate.layer === 'action',
  );
  const eventCandidates = candidates.filter(
    (candidate) => candidate.layer === 'event',
  );
  const vector3 = {
    type: 'array',
    items: { type: 'number' },
    minItems: 3,
    maxItems: 3,
  };
  const distancePolicy = {
    anyOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['mode'],
        properties: { mode: { type: 'string', enum: ['none'] } },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['mode', 'referenceDistance', 'maxDistance', 'minGain'],
        properties: {
          mode: { type: 'string', enum: ['inverse'] },
          referenceDistance: {
            type: 'number',
            exclusiveMinimum: 0,
            maximum: 100,
          },
          maxDistance: {
            type: 'number',
            exclusiveMinimum: 0,
            maximum: 10_000,
          },
          minGain: { type: 'number', minimum: 0, maximum: 1 },
        },
      },
    ],
  };
  const playbackPolicy = (candidate: Decision2Candidate) => {
    const authored = audioLibraryById.get(candidate.assetId)?.playback_contract;
    const mode =
      authored?.mode === 'burst' ? 'repeat' : candidate.loop ? 'loop' : 'once';
    const properties: Record<string, unknown> = {
      mode: { type: 'string', enum: [mode] },
      durationPolicy: {
        type: 'string',
        enum: [mode === 'loop' ? 'loop-until-end' : 'truncate-at-end'],
      },
    };
    const required = ['mode', 'durationPolicy'];
    if (mode === 'repeat') {
      properties.repeatCount = {
        type: 'number',
        enum: authored?.repeat_count_options ?? [1],
      };
      properties.repeatGapMs = {
        type: 'number',
        enum: [(authored?.inter_repeat_gap_sec ?? 0) * 1_000],
      };
      properties.perRepeatGain = {
        type: 'array',
        items: {
          type: 'number',
          minimum: candidate.gainRange.min,
          maximum: candidate.gainRange.max,
        },
      };
      required.push('repeatCount', 'repeatGapMs', 'perRepeatGain');
    }
    return {
      type: 'object',
      additionalProperties: false,
      required,
      properties,
    };
  };
  const emptyItemSchema = {
    type: 'object',
    additionalProperties: false,
    required: [],
    properties: {},
  };
  const ambientItemSchema = ambientCandidates.length
    ? {
        anyOf: ambientCandidates.map((candidate) => ({
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'assetId',
            'mode',
            'locationId',
            'gain',
            'active',
            'distancePolicy',
            'playback',
          ],
          properties: {
            id: { type: 'string' },
            assetId: { type: 'string', enum: [candidate.assetId] },
            mode: { type: 'string', enum: ['global', 'localized'] },
            locationId: {
              anyOf: [
                { type: 'null' },
                { type: 'string', enum: sourceLocations },
              ],
            },
            gain: {
              type: 'number',
              minimum: candidate.gainRange.min,
              maximum: candidate.gainRange.max,
            },
            active: { type: 'boolean' },
            distancePolicy,
            playback: playbackPolicy(candidate),
          },
        })),
      }
    : emptyItemSchema;
  const actionItemSchema = actionCandidates.length
    ? {
        anyOf: actionCandidates.map((candidate) => ({
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'assetId',
            'attachment',
            'relativePosition',
            'gain',
            'active',
            'activationCondition',
            'distancePolicy',
            'playback',
          ],
          properties: {
            id: { type: 'string' },
            assetId: { type: 'string', enum: [candidate.assetId] },
            attachment: {
              type: 'string',
              enum: ['head', 'chest', 'feet', 'body'],
            },
            relativePosition: vector3,
            gain: {
              type: 'number',
              minimum: candidate.gainRange.min,
              maximum: candidate.gainRange.max,
            },
            active: { type: 'boolean' },
            activationCondition: {
              type: 'string',
              enum: ['always', 'listener-moving'],
            },
            distancePolicy,
            playback: playbackPolicy(candidate),
          },
        })),
      }
    : emptyItemSchema;
  const eventItemSchema = eventCandidates.length
    ? {
        anyOf: eventCandidates.map((candidate) => ({
          type: 'object',
          additionalProperties: false,
          required: [
            'id',
            'assetId',
            'activationTimeMs',
            'durationMs',
            'trajectory',
            'gain',
            'interpolation',
            'trajectoryUpdatePolicy',
            'distancePolicy',
            'playback',
          ],
          properties: {
            id: { type: 'string' },
            assetId: { type: 'string', enum: [candidate.assetId] },
            activationTimeMs: { type: 'number', minimum: 0 },
            durationMs: {
              type: 'number',
              enum: [authoredEventDurationMs(candidate)],
            },
            trajectory: {
              type: 'array',
              minItems: 1,
              maxItems: 3,
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['locationId', 'timestampMs'],
                properties: {
                  locationId: { type: 'string', enum: sourceLocations },
                  timestampMs: { type: 'number', minimum: 0 },
                },
              },
            },
            gain: {
              type: 'number',
              minimum: candidate.gainRange.min,
              maximum: candidate.gainRange.max,
            },
            interpolation: { type: 'string', enum: ['linear', 'smoothstep'] },
            trajectoryUpdatePolicy: {
              type: 'string',
              enum: [
                'replace-at-effective-time',
                'continue-from-current-position',
              ],
            },
            distancePolicy,
            playback: playbackPolicy(candidate),
          },
        })),
      }
    : emptyItemSchema;
  return {
    name: 'neuroscape_decision_2',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: [
        'status',
        'intent',
        'patchOperations',
        'preservedElementIds',
        'adaptationHypothesis',
        'reflectionUsed',
        'reasonCodes',
        'patch',
        'selectedAssetIds',
        'rationale',
      ],
      properties: {
        status: { type: 'string', enum: ['PATCH_PROPOSED', 'NO_SAFE_PATCH'] },
        intent: {
          type: 'string',
          enum: [
            'gently_reorient_attention',
            'support_grounding',
            'reduce_stimulation',
            'support_sustained_focus',
            'refresh_engagement',
            'preserve_recovery',
          ],
        },
        patchOperations: {
          type: 'array',
          maxItems: 3,
          items: {
            type: 'object',
            additionalProperties: false,
            required: [
              'operation',
              'targetElementId',
              'effectiveStartMs',
              'transitionMs',
              'replacementAssetId',
            ],
            properties: {
              operation: {
                type: 'string',
                enum: [
                  'KEEP',
                  'ADJUST',
                  'RESCHEDULE',
                  'REPLACE',
                  'SUPPRESS',
                  'INSERT',
                ],
              },
              targetElementId: { type: ['string', 'null'] },
              effectiveStartMs: { type: 'number', minimum: 0 },
              transitionMs: { type: 'number', minimum: 0, maximum: 30000 },
              replacementAssetId: {
                anyOf: [{ type: 'null' }, { type: 'string', enum: assetIds }],
              },
            },
          },
        },
        preservedElementIds: { type: 'array', items: { type: 'string' } },
        adaptationHypothesis: {
          type: 'object',
          additionalProperties: false,
          required: [
            'mechanismCode',
            'expectedResponseCode',
            'failureSignalCode',
          ],
          properties: {
            mechanismCode: { type: 'string' },
            expectedResponseCode: {
              type: 'string',
              enum: [
                'REDUCE_VARIABILITY_OR_HALT_DECLINE',
                'PRESERVE_STABILITY',
                'GENTLE_REORIENTATION',
              ],
            },
            failureSignalCode: {
              type: 'string',
              enum: [
                'CONTINUED_DECLINE_WITH_VALID_SIGNAL',
                'INCREASED_VARIABILITY',
                'LOSS_OF_STABILITY',
              ],
            },
          },
        },
        reflectionUsed: {
          type: 'object',
          additionalProperties: false,
          required: ['priorAdaptationIds', 'lessonCode', 'lessonConfidence'],
          properties: {
            priorAdaptationIds: {
              type: 'array',
              maxItems: 3,
              items: { type: 'string' },
            },
            lessonCode: { type: ['string', 'null'] },
            lessonConfidence: {
              type: 'string',
              enum: ['high', 'medium', 'low', 'unavailable'],
            },
          },
        },
        reasonCodes: { type: 'array', maxItems: 5, items: { type: 'string' } },
        patch: {
          type: 'object',
          additionalProperties: false,
          required: [
            'reasoningSummary',
            'journey',
            'upsertAmbient',
            'upsertAction',
            'upsertEvent',
            'removeIds',
            'transitionDurationMs',
          ],
          properties: {
            reasoningSummary: { type: 'string' },
            journey: {
              anyOf: [
                { type: 'null' },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['goal', 'waypoints'],
                  properties: {
                    goal: { type: 'string' },
                    waypoints: {
                      type: 'array',
                      minItems: 1,
                      maxItems: 2,
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['locationId'],
                        properties: {
                          locationId: {
                            type: 'string',
                            enum: journeyLocations,
                          },
                        },
                      },
                    },
                  },
                },
              ],
            },
            upsertAmbient: {
              type: 'array',
              maxItems: ambientCandidates.length ? 2 : 0,
              items: ambientItemSchema,
            },
            upsertAction: {
              type: 'array',
              maxItems: actionCandidates.length ? 1 : 0,
              items: actionItemSchema,
            },
            upsertEvent: {
              type: 'array',
              maxItems: eventCandidates.length ? 1 : 0,
              items: eventItemSchema,
            },
            removeIds: { type: 'array', items: { type: 'string' } },
            transitionDurationMs: {
              type: 'number',
              minimum: 0,
              maximum: 30000,
            },
          },
        },
        selectedAssetIds: {
          type: 'array',
          maxItems: 3,
          items: { type: 'string', enum: assetIds },
        },
        rationale: { type: 'string' },
      },
    },
  };
}

export function prepareDecision2Input(
  context: DecisionContext,
  decision: AdaptationDecision,
  config: AdaptivePlannerConfig,
): Decision2Input {
  const {
    currentScene,
    candidates,
    eligibleCandidateCount,
    recentlyUsedAssets,
    retrievalAudit,
  } = retrieveDecision2Candidates(
    context,
    decision,
    config,
  );
  const operationGuidance = computeOperationGuidance(context, config);
  return {
    promptVersion: DECISION_2_PROMPT_VERSION,
    currentScene,
    candidates,
    prompt: buildDecision2Prompt(
      context,
      decision,
      currentScene,
      candidates,
      operationGuidance,
      recentlyUsedAssets,
    ),
    outputSchema: buildDecision2OutputSchema(candidates, context),
    reasoningEffort: assessPatchComplexity(context, decision),
    operationGuidance,
    fullLibrarySize: audioLibrary.length,
    eligibleCandidateCount,
    retrievedCandidateIds: candidates.map((candidate) => candidate.assetId),
    recentlyUsedAssets,
    retrievalAudit,
  };
}

export function assessPatchComplexity(
  context: DecisionContext,
  decision: AdaptationDecision,
): 'low' | 'medium' {
  const priorConflict = (context.relevantPriorOutcomes ?? []).some(
    (item) =>
      item.outcome.observedResponse === 'opposed_to_hypothesis' &&
      item.outcome.confidence !== 'low',
  );
  const multipleLayers =
    new Set((context.upcomingBaseHorizon ?? []).map((item) => item.layer))
      .size > 1;
  const phaseBoundary = (context.upcomingBaseHorizon ?? []).some((item) =>
    context.basePlan?.phases.some((phase) => phase.startMs === item.startMs),
  );
  return priorConflict ||
    multipleLayers ||
    phaseBoundary ||
    decision.scope === 'scene-transition'
    ? 'medium'
    : 'low';
}

export function validateDecision2Selection(
  result: PlanningResult,
  input: Decision2Input,
): void {
  if (new Set(result.selectedAssetIds).size !== result.selectedAssetIds.length)
    throw new Error('Decision 2 selectedAssetIds must not contain duplicates.');

  const allowed = new Set(
    input.candidates.map((candidate) => candidate.assetId),
  );
  const patchAssetIds = [
    ...(result.patch.upsertAmbient ?? []),
    ...(result.patch.upsertAction ?? []),
    ...(result.patch.upsertEvent ?? []),
  ].map((item) => item.assetId);
  const allOutputAssetIds = [...result.selectedAssetIds, ...patchAssetIds];
  const invalid = allOutputAssetIds.filter((assetId) => !allowed.has(assetId));
  if (invalid.length)
    throw new Error(
      `Decision 2 selected assets outside the retrieved candidate set: ${invalid.join(', ')}`,
    );
  const selected = new Set(result.selectedAssetIds);
  const unreported = patchAssetIds.filter((assetId) => !selected.has(assetId));
  if (unreported.length)
    throw new Error(
      `Decision 2 patch assets are missing from selectedAssetIds: ${unreported.join(', ')}`,
    );
  const candidateById = new Map(
    input.candidates.map((candidate) => [candidate.assetId, candidate]),
  );
  const layerErrors = [
    ...(result.patch.upsertAmbient ?? []).map((item) => ({
      assetId: item.assetId,
      expected: 'ambient',
    })),
    ...(result.patch.upsertAction ?? []).map((item) => ({
      assetId: item.assetId,
      expected: 'action',
    })),
    ...(result.patch.upsertEvent ?? []).map((item) => ({
      assetId: item.assetId,
      expected: 'event',
    })),
  ].filter(
    ({ assetId, expected }) => candidateById.get(assetId)?.layer !== expected,
  );
  if (layerErrors.length)
    throw new Error(
      `Decision 2 placed assets in the wrong sound layer: ${layerErrors
        .map(({ assetId, expected }) => `${assetId}→${expected}`)
        .join(', ')}`,
    );
  const attachmentErrors = (result.patch.upsertAction ?? []).filter((item) => {
    const asset = audioLibraryById.get(item.assetId);
    if (asset?.tags.includes('footstep')) return item.attachment !== 'feet';
    if (asset?.tags.includes('breath'))
      return item.attachment !== 'chest' && item.attachment !== 'body';
    return false;
  });
  if (attachmentErrors.length)
    throw new Error(
      `Decision 2 action attachment violates the authored narrative contract: ${attachmentErrors.map((item) => item.assetId).join(', ')}`,
    );
  const gainErrors = [
    ...(result.patch.upsertAmbient ?? []),
    ...(result.patch.upsertAction ?? []),
    ...(result.patch.upsertEvent ?? []),
  ].filter((item) => {
    const range = candidateById.get(item.assetId)?.gainRange;
    return !range || item.gain < range.min || item.gain > range.max;
  });
  if (gainErrors.length)
    throw new Error(
      `Decision 2 gain exceeds the authored safe range: ${gainErrors.map((item) => item.assetId).join(', ')}`,
    );
  const durationErrors = (result.patch.upsertEvent ?? []).filter((item) => {
    const candidate = candidateById.get(item.assetId);
    return (
      candidate !== undefined &&
      item.durationMs !== authoredEventDurationMs(candidate)
    );
  });
  if (durationErrors.length)
    throw new Error(
      `Decision 2 must use authored event motion/lifecycle duration: ${durationErrors.map((item) => item.assetId).join(', ')}`,
    );
}
