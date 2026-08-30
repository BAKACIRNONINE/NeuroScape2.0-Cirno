import semanticData from './audio_library_semantic_v1.json' with { type: 'json' };

export const AUDIO_ASSET_ALIASES = Object.freeze({
  ocean_waves: 'ocean_waves_soft_01',
} as const);

export type SemanticQualityTier =
  'preferred' | 'standard' | 'limited_use' | null;

export interface SemanticAudioAsset {
  asset_id: string;
  label: string;
  description: string;
  layer: 'ambient' | 'event' | 'action';
  source_environment: string;
  semantic_function: string;
  semantic_tags: string[];
  spatial_character: {
    behaviors: string[];
    default_distance: string;
  };
  quality_tier: SemanticQualityTier;
  hard_dependencies: Record<string, unknown>;
}

type SemanticFile = {
  schema_version: string;
  assets: SemanticAudioAsset[];
};

export function canonicalAudioAssetId(assetId: string): string {
  return (
    AUDIO_ASSET_ALIASES[assetId as keyof typeof AUDIO_ASSET_ALIASES] ?? assetId
  );
}

const source = semanticData as SemanticFile;
const normalized = new Map<string, SemanticAudioAsset>();
for (const record of source.assets) {
  const canonicalId = canonicalAudioAssetId(record.asset_id);
  const existing = normalized.get(canonicalId);
  // Prefer the explicitly canonical semantic record over a legacy alias.
  if (existing && record.asset_id !== canonicalId) continue;
  normalized.set(
    canonicalId,
    Object.freeze({
      ...structuredClone(record),
      asset_id: canonicalId,
    }),
  );
}

export const semanticAudioSchemaVersion = source.schema_version;
export const semanticAudioLibrary: readonly SemanticAudioAsset[] =
  Object.freeze([...normalized.values()]);
export const semanticAudioById: ReadonlyMap<string, SemanticAudioAsset> =
  normalized;

export function getSemanticAudioAsset(
  assetId: string,
): SemanticAudioAsset | undefined {
  return semanticAudioById.get(canonicalAudioAssetId(assetId));
}
