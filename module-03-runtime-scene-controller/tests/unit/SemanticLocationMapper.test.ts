import { describe, expect, it } from 'vitest';
import { SceneGraph } from '../../src/scene-graph/SceneGraph.js';
import { SemanticLocationMapper } from '../../src/scene-graph/SemanticLocationMapper.js';
import { sceneGraphDefinitionFixture } from '../fixtures/phase1Fixtures.js';

describe('SemanticLocationMapper', () => {
  it('resolves semantic locations without exposing graph-owned vectors', () => {
    const graph = new SceneGraph(sceneGraphDefinitionFixture);
    const mapper = new SemanticLocationMapper(graph);
    const position = mapper.resolve('clearing');
    position[2] = -99;
    expect(graph.requireNode('clearing').worldPosition).toEqual([0, 0, -6]);
  });

  it('rejects unknown locations', () => {
    const mapper = new SemanticLocationMapper(new SceneGraph(sceneGraphDefinitionFixture));
    expect(() => mapper.resolve('unknown')).toThrow(/Unknown semantic location/);
  });
});
