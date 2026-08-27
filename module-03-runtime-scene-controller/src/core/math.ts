import type {
  DistancePolicy,
  Quaternion,
  Vector3,
} from '@neuroscape/contracts';

export const EPSILON = 1e-6;

export function clamp(value: number, minimum = 0, maximum = 1): number {
  return Math.max(minimum, Math.min(maximum, value));
}

export function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * clamp(progress);
}

export function smoothstep(progress: number): number {
  const value = clamp(progress);
  return value * value * (3 - 2 * value);
}

export function smoothstepDerivative(progress: number): number {
  const value = clamp(progress);
  return 6 * value * (1 - value);
}

export function addVector(left: Vector3, right: Vector3): Vector3 {
  return [left[0] + right[0], left[1] + right[1], left[2] + right[2]];
}

export function subtractVector(left: Vector3, right: Vector3): Vector3 {
  return [left[0] - right[0], left[1] - right[1], left[2] - right[2]];
}

export function scaleVector(vector: Vector3, scalar: number): Vector3 {
  return [vector[0] * scalar, vector[1] * scalar, vector[2] * scalar];
}

export function lerpVector(
  start: Vector3,
  end: Vector3,
  progress: number,
): Vector3 {
  return [
    lerp(start[0], end[0], progress),
    lerp(start[1], end[1], progress),
    lerp(start[2], end[2], progress),
  ];
}

export function vectorLength(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function distance(left: Vector3, right: Vector3): number {
  return vectorLength(subtractVector(left, right));
}

export function plannedDistanceGain(
  distanceMeters: number,
  policy: DistancePolicy | undefined,
): number {
  if (!policy || policy.mode === 'none') return 1;
  const reference = policy.referenceDistance ?? 1;
  const bounded = Math.min(
    Math.max(0, distanceMeters),
    policy.maxDistance ?? Number.POSITIVE_INFINITY,
  );
  return Math.max(
    policy.minGain ?? 0,
    reference / Math.max(reference, bounded),
  );
}

export function normalizeVector(vector: Vector3): Vector3 {
  const length = vectorLength(vector);
  return length <= EPSILON ? [0, 0, 0] : scaleVector(vector, 1 / length);
}

export function vectorsEqual(
  left: Vector3,
  right: Vector3,
  epsilon = EPSILON,
): boolean {
  return distance(left, right) <= epsilon;
}

export function normalizeQuaternion(quaternion: Quaternion): Quaternion {
  const length = Math.hypot(...quaternion);
  if (length <= EPSILON) return [0, 0, 0, 1];
  return [
    quaternion[0] / length,
    quaternion[1] / length,
    quaternion[2] / length,
    quaternion[3] / length,
  ];
}

export function lookRotation(direction: Vector3): Quaternion {
  const target = normalizeVector(direction);
  if (vectorLength(target) <= EPSILON) return [0, 0, 0, 1];
  const forward: Vector3 = [0, 0, -1];
  const dot =
    forward[0] * target[0] + forward[1] * target[1] + forward[2] * target[2];
  if (dot < -1 + EPSILON) return [0, 1, 0, 0];
  const cross: Vector3 = [
    forward[1] * target[2] - forward[2] * target[1],
    forward[2] * target[0] - forward[0] * target[2],
    forward[0] * target[1] - forward[1] * target[0],
  ];
  return normalizeQuaternion([cross[0], cross[1], cross[2], 1 + dot]);
}

export function slerpQuaternion(
  start: Quaternion,
  end: Quaternion,
  progress: number,
): Quaternion {
  const amount = clamp(progress);
  let target: Quaternion = [...end];
  let cosine =
    start[0] * target[0] +
    start[1] * target[1] +
    start[2] * target[2] +
    start[3] * target[3];
  if (cosine < 0) {
    cosine = -cosine;
    target = [-target[0], -target[1], -target[2], -target[3]];
  }
  if (cosine > 0.9995) {
    return normalizeQuaternion([
      lerp(start[0], target[0], amount),
      lerp(start[1], target[1], amount),
      lerp(start[2], target[2], amount),
      lerp(start[3], target[3], amount),
    ]);
  }
  const angle = Math.acos(clamp(cosine, -1, 1));
  const sine = Math.sin(angle);
  const startWeight = Math.sin((1 - amount) * angle) / sine;
  const endWeight = Math.sin(amount * angle) / sine;
  return normalizeQuaternion([
    start[0] * startWeight + target[0] * endWeight,
    start[1] * startWeight + target[1] * endWeight,
    start[2] * startWeight + target[2] * endWeight,
    start[3] * startWeight + target[3] * endWeight,
  ]);
}

export function rotateVector(quaternion: Quaternion, vector: Vector3): Vector3 {
  const [qx, qy, qz, qw] = normalizeQuaternion(quaternion);
  const [vx, vy, vz] = vector;
  const ix = qw * vx + qy * vz - qz * vy;
  const iy = qw * vy + qz * vx - qx * vz;
  const iz = qw * vz + qx * vy - qy * vx;
  const iw = -qx * vx - qy * vy - qz * vz;
  return [
    ix * qw + iw * -qx + iy * -qz - iz * -qy,
    iy * qw + iw * -qy + iz * -qx - ix * -qz,
    iz * qw + iw * -qz + ix * -qy - iy * -qx,
  ];
}
