import type {
  SemanticSceneGraph,
  Vector3,
} from '@neuroscape/contracts';
import type {
  SceneGraphDefinition,
  SceneNode,
} from './SceneGraph.js';

export type RuntimeSceneLayout = Readonly<Record<string, Vector3>>;

export interface RuntimeSceneNodeExtension {
  readonly neighbors?: readonly string[];
  readonly ambientAssetIds?: readonly string[];
  readonly eventAssetIds?: readonly string[];
}

export type RuntimeSceneNodeExtensions = Readonly<
  Record<string, RuntimeSceneNodeExtension>
>;

export interface SemanticSceneGraphProjectionOptions {
  readonly semanticGraph: Readonly<SemanticSceneGraph>;
  readonly layout: RuntimeSceneLayout;
  readonly extensions?: RuntimeSceneNodeExtensions;
}

export class SemanticSceneGraphAdapterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SemanticSceneGraphAdapterError';
  }
}

/**
 * Projects the semantic planning graph into the Runtime SceneGraph shape.
 *
 * Authority boundary:
 * - Semantic graph owns node IDs, adjacency, and semantic audio coverage.
 * - Runtime layout owns world-space coordinates.
 * - Extensions are only for Runtime compatibility, such as legacy fixtures.
 */
export function projectSemanticSceneGraph(
  options: SemanticSceneGraphProjectionOptions,
): SceneGraphDefinition {
  const {
    semanticGraph,
    layout,
    extensions = {},
  } = options;

  const semanticNodeIds = new Set(
    semanticGraph.nodes.map((node) => node.id),
  );

  for (const extensionId of Object.keys(extensions)) {
    if (!semanticNodeIds.has(extensionId)) {
      throw new SemanticSceneGraphAdapterError(
        `Runtime extension references unknown semantic node: ${extensionId}`,
      );
    }
  }

  const nodes: SceneNode[] = semanticGraph.nodes.map((node) => {
    const worldPosition = layout[node.id];

    if (!worldPosition) {
      throw new SemanticSceneGraphAdapterError(
        `Missing runtime layout for semantic scene node: ${node.id}`,
      );
    }

    const extension = extensions[node.id];

    return {
      id: node.id,
      worldPosition: [...worldPosition] as Vector3,
      neighbors: unique([
        ...node.neighbors,
        ...(extension?.neighbors ?? []),
      ]),
      ambientAssetIds: unique([
        ...node.audio_coverage.foundation,
        ...node.audio_coverage.supporting_ambient,
        ...(extension?.ambientAssetIds ?? []),
      ]),
      eventAssetIds: unique([
        ...node.audio_coverage.events,
        ...(extension?.eventAssetIds ?? []),
      ]),
    };
  });

  return { nodes };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}