import graphData from './scene_graph_v1.json' with { type: 'json' };
import { canonicalAudioAssetId, semanticAudioById } from './semantic-audio.js';

export interface SemanticSceneAudioCoverage {
  foundation: string[];
  supporting_ambient: string[];
  events: string[];
  actions: string[];
}

export interface SemanticSceneNode {
  id: string;
  label: string;
  family: string;
  graph_role: string;
  description: string;
  acoustic_character: string[];
  neighbors: string[];
  coverage_status: string;
  audio_coverage: SemanticSceneAudioCoverage;
}

export interface SemanticSceneEdge {
  id: string;
  between: [string, string];
  bidirectional: boolean;
  semantic_transition: string;
  available_transition_cues: string[];
}

export interface SemanticSceneGraph {
  schema_version: string;
  start_node_id: string;
  recommended_major_transitions_per_10min_session: {
    min: number;
    max: number;
    note: string;
  };
  nodes: SemanticSceneNode[];
  edges: SemanticSceneEdge[];
}

const legacyLocations: Readonly<Record<string, string>> = Object.freeze({
  clearing: 'forest_clearing',
  forest_entry: 'forest_clearing',
  waterfall: 'waterfall_vicinity',
  stream_bank: 'stream_bank',
});

export function normalizeLegacyLocationId(id: string): string {
  return legacyLocations[id] ?? id;
}

function normalizeCoverage(
  coverage: SemanticSceneAudioCoverage,
): SemanticSceneAudioCoverage {
  const normalize = (ids: string[]) => [
    ...new Set(ids.map(canonicalAudioAssetId)),
  ];
  return {
    foundation: normalize(coverage.foundation),
    supporting_ambient: normalize(coverage.supporting_ambient),
    events: normalize(coverage.events),
    actions: normalize(coverage.actions),
  };
}

const raw = graphData as unknown as SemanticSceneGraph;
export const sceneGraph: Readonly<SemanticSceneGraph> = Object.freeze({
  ...structuredClone(raw),
  start_node_id: normalizeLegacyLocationId(raw.start_node_id),
  nodes: raw.nodes.map((node) =>
    Object.freeze({
      ...structuredClone(node),
      id: normalizeLegacyLocationId(node.id),
      neighbors: [...new Set(node.neighbors.map(normalizeLegacyLocationId))],
      audio_coverage: normalizeCoverage(node.audio_coverage),
    }),
  ),
  edges: raw.edges.map((edge) =>
    Object.freeze({
      ...structuredClone(edge),
      between: edge.between.map(normalizeLegacyLocationId) as [string, string],
      available_transition_cues: [
        ...new Set(edge.available_transition_cues.map(canonicalAudioAssetId)),
      ],
    }),
  ),
});

export const sceneNodeById: ReadonlyMap<string, SemanticSceneNode> = new Map(
  sceneGraph.nodes.map((node) => [node.id, node]),
);
export const sceneEdgeById: ReadonlyMap<string, SemanticSceneEdge> = new Map(
  sceneGraph.edges.map((edge) => [edge.id, edge]),
);

export function getSceneNode(id: string): SemanticSceneNode | undefined {
  return sceneNodeById.get(normalizeLegacyLocationId(id));
}

export function getSceneEdgeBetween(
  a: string,
  b: string,
): SemanticSceneEdge | undefined {
  const left = normalizeLegacyLocationId(a);
  const right = normalizeLegacyLocationId(b);
  return sceneGraph.edges.find(
    (edge) =>
      (edge.between[0] === left && edge.between[1] === right) ||
      (edge.bidirectional &&
        edge.between[0] === right &&
        edge.between[1] === left),
  );
}

export function getReachableSceneNodes(
  currentId: string,
): readonly SemanticSceneNode[] {
  const current = getSceneNode(currentId);
  if (!current) return [];
  return current.neighbors.flatMap((id) => {
    const node = getSceneNode(id);
    return node ? [node] : [];
  });
}

export function validateSemanticSceneGraph(): string[] {
  const errors: string[] = [];
  if (!sceneNodeById.has(sceneGraph.start_node_id))
    errors.push('missing_start_node');
  for (const edge of sceneGraph.edges) {
    if (edge.between.some((id) => !sceneNodeById.has(id)))
      errors.push(`edge_missing_node:${edge.id}`);
    for (const assetId of edge.available_transition_cues)
      if (!semanticAudioById.has(assetId))
        errors.push(`edge_missing_audio:${edge.id}:${assetId}`);
  }
  for (const node of sceneGraph.nodes) {
    for (const neighbor of node.neighbors)
      if (!getSceneEdgeBetween(node.id, neighbor))
        errors.push(`neighbor_missing_edge:${node.id}:${neighbor}`);
    for (const assetId of Object.values(node.audio_coverage).flat())
      if (!semanticAudioById.has(assetId))
        errors.push(`node_missing_audio:${node.id}:${assetId}`);
  }
  if (semanticAudioById.has('ocean_waves'))
    errors.push('legacy_ocean_waves_selectable');
  return [...new Set(errors)];
}
