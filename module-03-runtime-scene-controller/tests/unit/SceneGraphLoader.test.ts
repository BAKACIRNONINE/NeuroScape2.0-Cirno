import { describe, expect, it } from 'vitest';
import { SceneGraphLoadError, SceneGraphLoader } from '../../src/scene-graph/SceneGraphLoader.js';
import { sceneGraphDefinitionFixture } from '../fixtures/phase1Fixtures.js';

describe('SceneGraphLoader', () => {
  it('loads object and JSON sources', () => {
    const loader = new SceneGraphLoader();
    expect(loader.load(sceneGraphDefinitionFixture).size).toBe(3);
    expect(loader.load(JSON.stringify(sceneGraphDefinitionFixture)).hasNode('stream_bank')).toBe(true);
  });

  it('rejects malformed vectors and invalid JSON', () => {
    const loader = new SceneGraphLoader();
    expect(() => loader.load('{')).toThrow(SceneGraphLoadError);
    expect(() =>
      loader.load({
        nodes: [{ ...sceneGraphDefinitionFixture.nodes[0], worldPosition: [0, 0] }],
      }),
    ).toThrow(/Vector|tuple/);
  });
});
