import type { Vector3 } from '@neuroscape/contracts';
import type { SceneGraph } from './SceneGraph.js';

export class SemanticLocationMapper {
  constructor(private readonly sceneGraph: SceneGraph) {}

  resolve(semanticLocation: string): Vector3 {
    const position = this.sceneGraph.requireNode(semanticLocation).worldPosition;
    return [...position];
  }

  resolvePath(semanticLocations: readonly string[]): Vector3[] {
    return semanticLocations.map((location) => this.resolve(location));
  }
}
