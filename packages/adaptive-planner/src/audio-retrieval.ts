import { audioLibrary, audioLibraryById } from '@neuroscape/contracts';
import type { AudioLibraryAsset } from '@neuroscape/contracts';
import type { AdaptivePlannerConfig } from './config.js';
import type {
  AdaptationDecision,
  Decision2Candidate,
  Decision2Input,
  DecisionContext,
  PlanningResult,
} from './types.js';

export const DECISION_2_PROMPT_VERSION = 'decision-2-audio-library-v1';

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

function allowedLayers(
  decision: AdaptationDecision,
  context: DecisionContext,
): Set<AudioLibraryAsset['layer']> {
  if (decision.scope === 'scene-transition') return new Set(['ambient']);
  if (decision.goal === 'support-grounding')
    return new Set(context.restrictions.allowBodyAnchor ? ['action'] : []);
  if (decision.goal === 'reduce-stimulation') return new Set(['ambient']);
  return new Set(context.restrictions.allowEvent ? ['event'] : []);
}

function candidateFromAsset(asset: AudioLibraryAsset): Decision2Candidate {
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
  };
}

export function retrieveDecision2Candidates(
  context: DecisionContext,
  decision: AdaptationDecision,
  config: AdaptivePlannerConfig,
): { currentScene: string; candidates: Decision2Candidate[] } {
  const now = context.state.timestampMs;
  const currentScene = inferCurrentScene(context);
  const layers = allowedLayers(decision, context);
  const activeAssets = new Set(
    [
      ...context.currentPlan.soundscape.ambient.filter((item) => item.active),
      ...context.currentPlan.soundscape.action.filter((item) => item.active),
      ...context.currentPlan.soundscape.event.filter(
        (item) => now < item.activationTimeMs + item.durationMs,
      ),
    ].map((item) => item.assetId),
  );
  const recentAssets = new Set(
    context.history
      .filter((item) => now - item.timestampMs < config.exactAssetCooldownMs)
      .flatMap((item) => item.assetIds),
  );
  const recentFamilies = new Set(
    context.history
      .filter((item) => now - item.timestampMs < config.assetFamilyCooldownMs)
      .flatMap((item) => item.assetIds.map(audioFamilyId)),
  );
  const desiredTags = goalTags[decision.goal] ?? [];
  const stateTags = new Set([
    ...desiredTags,
    context.state.phase,
    context.state.label === 'mind-wandering-leaning'
      ? 'attention_low'
      : 'stability_high',
  ]);

  const scored = audioLibrary
    .filter(
      (asset) =>
        layers.has(asset.layer) &&
        asset.scene.some((scene) => scene === currentScene) &&
        !activeAssets.has(asset.asset_id) &&
        !recentAssets.has(asset.asset_id) &&
        !recentFamilies.has(audioFamilyId(asset.asset_id)) &&
        !asset.avoid_when.some((tag) => stateTags.has(tag)),
    )
    .map((asset) => ({
      asset,
      score:
        asset.priority +
        asset.use_when.filter((tag) => stateTags.has(tag)).length * 2 -
        asset.suddenness -
        asset.intensity * 0.25,
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
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
    .map(({ asset }) => candidateFromAsset(asset));
  return { currentScene, candidates };
}

export function buildDecision2Prompt(
  context: DecisionContext,
  decision: AdaptationDecision,
  currentScene: string,
  candidates: readonly Decision2Candidate[],
): string {
  const currentLocation =
    context.currentPlan.userJourney.waypoints.at(-1)?.locationId ?? 'clearing';
  const listenerReachableLocations = [
    currentLocation,
    ...(locationNeighbors[currentLocation] ?? []),
  ];
  const payload = {
    decision,
    attentionState: context.state,
    currentScene,
    currentLocation,
    listenerReachableLocations,
    soundSourceLocationIds: Object.keys(locationScene),
    currentPlan: context.currentPlan,
    restrictions: context.restrictions,
    recentAdaptations: context.history.slice(-6),
    candidates,
  };
  return [
    'You are NeuroScape Decision 2: How to Adapt.',
    'Plan a minimal, neuro-informed soundscape patch that realizes the supplied Decision 1 goal and scope.',
    'Use only assetId values in candidates. Never invent an asset, location, motion, duration, gain, or numerical range.',
    'Treat candidate metadata as authoritative: description, scene, layer, tags, loop, intensity, suddenness, useWhen, avoidWhen, spatialBehavior, defaultPosition, defaultMotion.durationSec, autoDeleteAfterSec, fades, and recommendedVolume.',
    'defaultMotion.durationSec is the authored duration of the default spatial motion. autoDeleteAfterSec is the authored event lifecycle. A looping asset may remain active until a later patch removes it.',
    'Prefer an unused compatible variant and respect the already-applied exact-asset and family cooldown filtering.',
    'Add at most one new salient event in one patch. Event-source movement is not listener movement. A body-anchored action does not require a scene transition. Footsteps imply listener movement only when explicitly assigned a locomotion role.',
    'For within-scene adaptation, preserve the listener location and semantic scene. For scene-transition scope, preserve narrative continuity and use only scene-compatible candidates.',
    'Journey waypoints must use only listenerReachableLocations. Sound-source waypoints must use only soundSourceLocationIds.',
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
  const vector3 = {
    type: 'array',
    items: { type: 'number' },
    minItems: 3,
    maxItems: 3,
  };
  return {
    name: 'neuroscape_decision_2',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['patch', 'selectedAssetIds', 'rationale'],
      properties: {
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
              maxItems: 2,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'id',
                  'assetId',
                  'mode',
                  'locationId',
                  'gain',
                  'active',
                ],
                properties: {
                  id: { type: 'string' },
                  assetId: { type: 'string', enum: assetIds },
                  mode: { type: 'string', enum: ['global', 'localized'] },
                  locationId: {
                    anyOf: [
                      { type: 'null' },
                      { type: 'string', enum: sourceLocations },
                    ],
                  },
                  gain: { type: 'number', minimum: 0, maximum: 1 },
                  active: { type: 'boolean' },
                },
              },
            },
            upsertAction: {
              type: 'array',
              maxItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'id',
                  'assetId',
                  'attachment',
                  'relativePosition',
                  'gain',
                  'active',
                ],
                properties: {
                  id: { type: 'string' },
                  assetId: { type: 'string', enum: assetIds },
                  attachment: {
                    type: 'string',
                    enum: ['head', 'chest', 'feet', 'body'],
                  },
                  relativePosition: vector3,
                  gain: { type: 'number', minimum: 0, maximum: 1 },
                  active: { type: 'boolean' },
                },
              },
            },
            upsertEvent: {
              type: 'array',
              maxItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'id',
                  'assetId',
                  'activationTimeMs',
                  'durationMs',
                  'trajectory',
                  'gain',
                ],
                properties: {
                  id: { type: 'string' },
                  assetId: { type: 'string', enum: assetIds },
                  activationTimeMs: { type: 'number', minimum: 0 },
                  durationMs: { type: 'number', minimum: 0, maximum: 120000 },
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
                  gain: { type: 'number', minimum: 0, maximum: 1 },
                },
              },
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
          uniqueItems: true,
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
  const { currentScene, candidates } = retrieveDecision2Candidates(
    context,
    decision,
    config,
  );
  return {
    promptVersion: DECISION_2_PROMPT_VERSION,
    currentScene,
    candidates,
    prompt: buildDecision2Prompt(context, decision, currentScene, candidates),
    outputSchema: buildDecision2OutputSchema(candidates, context),
  };
}

export function validateDecision2Selection(
  result: PlanningResult,
  input: Decision2Input,
): void {
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
  const gainErrors = [
    ...(result.patch.upsertAmbient ?? []),
    ...(result.patch.upsertAction ?? []),
    ...(result.patch.upsertEvent ?? []),
  ].filter(
    (item) =>
      Math.abs(
        item.gain - (candidateById.get(item.assetId)?.recommendedVolume ?? -1),
      ) > 1e-6,
  );
  if (gainErrors.length)
    throw new Error(
      `Decision 2 must use authored recommendedVolume: ${gainErrors.map((item) => item.assetId).join(', ')}`,
    );
  const durationErrors = (result.patch.upsertEvent ?? []).filter((item) => {
    const candidate = candidateById.get(item.assetId);
    const authoredSeconds =
      candidate?.defaultMotion.durationSec ?? candidate?.autoDeleteAfterSec;
    return (
      authoredSeconds !== null &&
      authoredSeconds !== undefined &&
      item.durationMs !== authoredSeconds * 1_000
    );
  });
  if (durationErrors.length)
    throw new Error(
      `Decision 2 must use authored event motion/lifecycle duration: ${durationErrors.map((item) => item.assetId).join(', ')}`,
    );
}
