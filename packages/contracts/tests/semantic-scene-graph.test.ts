import { describe, expect, it } from 'vitest';
import {
  getReachableSceneNodes,
  getSemanticAudioAsset,
  sceneGraph,
  semanticAudioById,
  validateSemanticSceneGraph,
} from '../src/index.js';

describe('semantic scene graph resources', () => {
  it('normalizes aliases and validates authored graph relations', () => {
    expect(validateSemanticSceneGraph()).toEqual([]);
    expect(sceneGraph.start_node_id).toBe('forest_clearing');
    expect(semanticAudioById.has('ocean_waves')).toBe(false);
    expect(getSemanticAudioAsset('ocean_waves')?.asset_id).toBe(
      'ocean_waves_soft_01',
    );
    expect(getReachableSceneNodes('clearing').map((x) => x.id)).toEqual(
      expect.arrayContaining(['dense_forest', 'stream_bank', 'forest_edge']),
    );
  });

  it('keeps the stable waterfall id but exposes waterfall semantics', () => {
    const waterfall = getSemanticAudioAsset('forest_water_drop_far_01');
    expect(
      `${waterfall?.label} ${waterfall?.description}`.toLowerCase(),
    ).toContain('waterfall');
  });
});
