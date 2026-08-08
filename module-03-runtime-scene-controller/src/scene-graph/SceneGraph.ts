import type { Vector3 } from '@neuroscape/contracts';

export interface SceneNode {
  readonly id: string;
  readonly worldPosition: Vector3;
  readonly neighbors: readonly string[];
  readonly ambientAssetIds: readonly string[];
  readonly eventAssetIds: readonly string[];
}

export interface SceneGraphDefinition {
  readonly nodes: readonly SceneNode[];
}

export class SceneGraph {
  readonly #nodes: ReadonlyMap<string, SceneNode>;

  constructor(definition: SceneGraphDefinition) {
    if (definition.nodes.length === 0) {
      throw new Error('Scene Graph must contain at least one node.');
    }

    const nodes = new Map<string, SceneNode>();
    for (const node of definition.nodes) {
      if (nodes.has(node.id)) {
        throw new Error(`Duplicate Scene Graph node id: ${node.id}`);
      }
      nodes.set(node.id, freezeNode(node));
    }

    for (const node of nodes.values()) {
      for (const neighborId of node.neighbors) {
        if (!nodes.has(neighborId)) {
          throw new Error(`Scene Graph node ${node.id} references unknown neighbor ${neighborId}`);
        }
      }
    }

    this.#nodes = nodes;
  }

  get size(): number {
    return this.#nodes.size;
  }

  hasNode(id: string): boolean {
    return this.#nodes.has(id);
  }

  getNode(id: string): SceneNode | undefined {
    return this.#nodes.get(id);
  }

  requireNode(id: string): SceneNode {
    const node = this.getNode(id);
    if (!node) {
      throw new Error(`Unknown semantic location: ${id}`);
    }
    return node;
  }

  getNodes(): readonly SceneNode[] {
    return Object.freeze([...this.#nodes.values()]);
  }
}

function freezeNode(node: SceneNode): SceneNode {
  return Object.freeze({
    id: node.id,
    worldPosition: Object.freeze([...node.worldPosition]) as Vector3,
    neighbors: Object.freeze([...node.neighbors]),
    ambientAssetIds: Object.freeze([...node.ambientAssetIds]),
    eventAssetIds: Object.freeze([...node.eventAssetIds]),
  });
}
