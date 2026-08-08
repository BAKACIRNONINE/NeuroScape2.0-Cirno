import type { AudioAssetDefinition } from './AudioAssetManager.js';

/**
 * Physical audio paths are intentionally confined to this catalog. Runtime
 * contracts and scenarios refer only to these stable semantic asset IDs.
 */
const catalog = [
  ['ambient.forest.light', 'forest/ambient/forest_ambient_bed_01.mp3', true],
  ['ambient.forest.wind', 'forest/ambient/forest_wind_leaves_01.mp3', true],
  ['ambient.stream.near', 'ocean_beach/ambient/ocean_shoreline_wash_01.wav', true],
  ['ambient.waterfall', 'ocean_beach/ambient/ocean_waves_soft_01.wav', true],
  ['action.guided-breath', 'common/action/body_slow_breath_01.wav', false],
  ['action.footsteps', 'forest/action/forest_grass_footstep_01.wav', false],
  ['event.bird-pass', 'forest/event/forest_bird_far_01.wav', false],
  ['event.leaves', 'forest/event/forest_leaf_rustle_mid_01.wav', false],
] as const;

export const forestDemoAssetIds = catalog.map(([assetId]) => assetId);

export function createProductionAudioManifest(baseUrl: string): AudioAssetDefinition[] {
  const base = baseUrl.replace(/\/$/, '');
  return catalog.map(([assetId, relativePath, preload]) => ({
    assetId,
    url: `${base}/${relativePath}`,
    preload,
  }));
}

const configuredBase = (import.meta as ImportMeta & { env?: { VITE_AUDIO_ASSET_BASE_URL?: string } }).env?.VITE_AUDIO_ASSET_BASE_URL;

/** Local Vite development serves frontend/public/audio at /audio. */
export const audioAssetManifest = createProductionAudioManifest(configuredBase || '/audio');
