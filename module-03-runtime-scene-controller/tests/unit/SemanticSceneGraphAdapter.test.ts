import { sceneGraph } from '@neuroscape/contracts';
import { describe, expect, it } from 'vitest';
import {
  projectSemanticSceneGraph,
  type RuntimeSceneLayout,
} from '../../src/scene-graph/SemanticSceneGraphAdapter.js';

const layout = {
  forest_clearing: [0, 0, -7],
  dense_forest: [-5, 0, -12],
  stream_bank: [2, 0, -14],
  waterfall_vicinity: [7, 1, -20],
  lakeside_river: [-3, 0, -20],
  forest_edge: [6, 0, -10],
  city_park: [12, 0, -10],
  beach_shore: [12, 0, -18],
} satisfies RuntimeSceneLayout;

describe('SemanticSceneGraphAdapter', () => {
  it('projects semantic topology and audio coverage into runtime nodes', () => {
    const projected = projectSemanticSceneGraph({
      semanticGraph: sceneGraph,
      layout,
    });

    expect(projected.nodes.map((node) => node.id)).toEqual(
      sceneGraph.nodes.map((node) => node.id),
    );

    const clearing = projected.nodes.find(
      (node) => node.id === 'forest_clearing',
    )!;

    const semanticClearing = sceneGraph.nodes.find(
      (node) => node.id === 'forest_clearing',
    )!;

    expect(clearing.worldPosition).toEqual([0, 0, -7]);
    expect(clearing.neighbors).toEqual(
      semanticClearing.neighbors,
    );
    expect(clearing.ambientAssetIds).toEqual([
      ...new Set([
        ...semanticClearing.audio_coverage.foundation,
        ...semanticClearing.audio_coverage.supporting_ambient,
      ]),
    ]);
    expect(clearing.eventAssetIds).toEqual(
      semanticClearing.audio_coverage.events,
    );
  });

  it('adds runtime compatibility extensions without mutating semantic data', () => {
    const semanticStream = sceneGraph.nodes.find(
      (node) => node.id === 'stream_bank',
    )!;
    const originalNeighbors = [...semanticStream.neighbors];

    const projected = projectSemanticSceneGraph({
      semanticGraph: sceneGraph,
      layout,
      extensions: {
        stream_bank: {
          neighbors: ['clearing', 'waterfall'],
          ambientAssetIds: ['ambient.stream.near'],
          eventAssetIds: ['event.bird-pass'],
        },
      },
    });

    const runtimeStream = projected.nodes.find(
      (node) => node.id === 'stream_bank',
    )!;

    expect(runtimeStream.neighbors).toContain('clearing');
    expect(runtimeStream.neighbors).toContain('waterfall');
    expect(runtimeStream.ambientAssetIds).toContain(
      'ambient.stream.near',
    );
    expect(runtimeStream.eventAssetIds).toContain(
      'event.bird-pass',
    );

    expect(semanticStream.neighbors).toEqual(originalNeighbors);
  });

  it('fails fast when a semantic node has no runtime layout', () => {
    const incompleteLayout = {
      ...layout,
    } as Record<string, [number, number, number]>;

    delete incompleteLayout.beach_shore;

    expect(() =>
      projectSemanticSceneGraph({
        semanticGraph: sceneGraph,
        layout: incompleteLayout,
      }),
    ).toThrow(
      'Missing runtime layout for semantic scene node: beach_shore',
    );
  });
});