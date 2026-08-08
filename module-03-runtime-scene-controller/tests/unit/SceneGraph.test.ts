import { describe, expect, it } from 'vitest';
import { SceneGraph } from '../../src/scene-graph/SceneGraph.js';
import { sceneGraphDefinitionFixture } from '../fixtures/phase1Fixtures.js';

describe('SceneGraph', () => {
  it('indexes valid nodes and exposes their connections', () => {
    const graph = new SceneGraph(sceneGraphDefinitionFixture);
    expect(graph.size).toBe(3);
    expect(graph.requireNode('clearing').neighbors).toContain('stream_bank');
  });

  it('rejects duplicate node identifiers', () => {
    expect(
      () =>
        new SceneGraph({
          nodes: [sceneGraphDefinitionFixture.nodes[0]!, sceneGraphDefinitionFixture.nodes[0]!],
        }),
    ).toThrow(/Duplicate/);
  });

  it('rejects dangling neighbor references', () => {
    expect(
      () =>
        new SceneGraph({
          nodes: [
            {
              ...sceneGraphDefinitionFixture.nodes[0]!,
              neighbors: ['missing'],
            },
          ],
        }),
    ).toThrow(/unknown neighbor/);
  });
});
