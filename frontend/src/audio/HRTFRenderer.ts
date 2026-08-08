import type { Quaternion, Vector3 } from '@neuroscape/contracts';

export interface SpatialDiagnostics {
  relativePosition: Vector3;
  listenerSpacePosition: Vector3;
  azimuthDegrees: number;
  elevationDegrees: number;
  distance: number;
}

export function relativePosition(source: readonly number[], listener: readonly number[]): Vector3 {
  return [source[0]! - listener[0]!, source[1]! - listener[1]!, source[2]! - listener[2]!];
}

export function inverseRotateVector(vector: Vector3, quaternion: Quaternion): Vector3 {
  const [x, y, z] = vector, [qx, qy, qz, qw] = quaternion;
  const ix = qw * x - qy * z + qz * y;
  const iy = qw * y - qz * x + qx * z;
  const iz = qw * z - qx * y + qy * x;
  const iw = qx * x + qy * y + qz * z;
  return [
    ix * qw + iw * qx + iy * qz - iz * qy,
    iy * qw + iw * qy + iz * qx - ix * qz,
    iz * qw + iw * qz + ix * qy - iy * qx,
  ];
}

export function computeSpatialDiagnostics(source: Vector3, listener: Vector3, orientation: Quaternion): SpatialDiagnostics {
  const relative = relativePosition(source, listener);
  const local = inverseRotateVector(relative, orientation);
  const distance = Math.hypot(...local);
  return {
    relativePosition: relative,
    listenerSpacePosition: local,
    azimuthDegrees: Math.atan2(local[0], -local[2]) * 180 / Math.PI,
    elevationDegrees: Math.atan2(local[1], Math.hypot(local[0], local[2])) * 180 / Math.PI,
    distance,
  };
}

export class HRTFRenderer {
  readonly #context: BaseAudioContext;
  readonly #destination: AudioNode;
  readonly #nodes = new Set<PannerNode>();
  readonly #diagnostics = new Map<string, SpatialDiagnostics>();

  constructor(context: BaseAudioContext, destination: AudioNode) { this.#context = context; this.#destination = destination; }
  createSpatializer(): PannerNode {
    const node = this.#context.createPanner();
    node.panningModel = 'HRTF'; node.distanceModel = 'inverse'; node.refDistance = 1; node.maxDistance = 10_000; node.rolloffFactor = 0;
    node.connect(this.#destination); this.#nodes.add(node); return node;
  }
  update(id: string, node: PannerNode, source: Vector3, listener: Vector3, orientation: Quaternion, time: number): SpatialDiagnostics {
    const diagnostics = computeSpatialDiagnostics(source, listener, orientation);
    const [x, y, z] = diagnostics.listenerSpacePosition;
    node.positionX.setValueAtTime(x, time); node.positionY.setValueAtTime(y, time); node.positionZ.setValueAtTime(z, time);
    this.#diagnostics.set(id, diagnostics); return diagnostics;
  }
  getDiagnostics(id: string): SpatialDiagnostics | undefined { return this.#diagnostics.get(id); }
  release(id: string, node: PannerNode): void { node.disconnect(); this.#nodes.delete(node); this.#diagnostics.delete(id); }
  dispose(): void { this.#nodes.forEach((node) => node.disconnect()); this.#nodes.clear(); this.#diagnostics.clear(); }
}
