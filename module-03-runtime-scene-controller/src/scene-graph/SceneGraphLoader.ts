import type { Vector3 } from '@neuroscape/contracts';
import { SceneGraph, type SceneGraphDefinition, type SceneNode } from './SceneGraph.js';

export class SceneGraphLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneGraphLoadError';
  }
}

export class SceneGraphLoader {
  load(source: unknown): SceneGraph {
    const parsed = parseSource(source);
    if (!isRecord(parsed) || !Array.isArray(parsed.nodes)) {
      throw new SceneGraphLoadError('Scene Graph must be an object containing a nodes array.');
    }

    const definition: SceneGraphDefinition = {
      nodes: parsed.nodes.map((candidate, index) => parseNode(candidate, index)),
    };

    try {
      return new SceneGraph(definition);
    } catch (error) {
      throw new SceneGraphLoadError(error instanceof Error ? error.message : 'Invalid Scene Graph.');
    }
  }
}

function parseSource(source: unknown): unknown {
  if (typeof source !== 'string') return source;
  try {
    return JSON.parse(source) as unknown;
  } catch {
    throw new SceneGraphLoadError('Scene Graph source is not valid JSON.');
  }
}

function parseNode(candidate: unknown, index: number): SceneNode {
  if (!isRecord(candidate)) {
    throw new SceneGraphLoadError(`Scene Graph node at index ${index} must be an object.`);
  }
  const id = readNonEmptyString(candidate.id, `nodes[${index}].id`);
  return {
    id,
    worldPosition: readVector3(candidate.worldPosition, `${id}.worldPosition`),
    neighbors: readStringArray(candidate.neighbors, `${id}.neighbors`),
    ambientAssetIds: readStringArray(candidate.ambientAssetIds, `${id}.ambientAssetIds`),
    eventAssetIds: readStringArray(candidate.eventAssetIds, `${id}.eventAssetIds`),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new SceneGraphLoadError(`${path} must be a non-empty string.`);
  }
  return value;
}

function readStringArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item)) {
    throw new SceneGraphLoadError(`${path} must be an array of non-empty strings.`);
  }
  if (new Set(value).size !== value.length) {
    throw new SceneGraphLoadError(`${path} must not contain duplicates.`);
  }
  return [...value];
}

function readVector3(value: unknown, path: string): Vector3 {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(isFiniteNumber)) {
    throw new SceneGraphLoadError(`${path} must be a finite three-number tuple.`);
  }
  return [value[0]!, value[1]!, value[2]!];
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
