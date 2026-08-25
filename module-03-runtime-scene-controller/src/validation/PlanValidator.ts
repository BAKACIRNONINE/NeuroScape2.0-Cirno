import { audioLibraryById, type SceneJourneyPlan } from '@neuroscape/contracts';
import type { SceneGraph } from '../scene-graph/SceneGraph.js';

export interface PlanValidationResult {
  valid: boolean;
  errors: string[];
  plan?: SceneJourneyPlan;
}

export class PlanValidator {
  constructor(private readonly sceneGraph: SceneGraph) {}

  validate(candidate: unknown): PlanValidationResult {
    const errors: string[] = [];
    if (!isRecord(candidate)) {
      return { valid: false, errors: ['Plan must be an object.'] };
    }

    requireString(candidate.planId, 'planId', errors);
    const planningHorizonSec = requirePositiveNumber(
      candidate.planningHorizonSec,
      'planningHorizonSec',
      errors,
    );
    if (candidate.reasoningSummary !== undefined) {
      requireString(candidate.reasoningSummary, 'reasoningSummary', errors);
    }

    this.validateJourney(candidate.userJourney, planningHorizonSec, errors);
    this.validateSoundscape(candidate.soundscape, errors);
    validateTransitionPolicy(candidate.transitionPolicy, errors);

    if (errors.length > 0) return { valid: false, errors };
    return {
      valid: true,
      errors: [],
      plan: candidate as unknown as SceneJourneyPlan,
    };
  }

  private validateJourney(
    value: unknown,
    horizonSec: number | undefined,
    errors: string[],
  ): void {
    if (!isRecord(value)) {
      errors.push('userJourney must be an object.');
      return;
    }
    requireString(value.goal, 'userJourney.goal', errors);
    if (!Array.isArray(value.waypoints) || value.waypoints.length === 0) {
      errors.push('userJourney.waypoints must contain at least one waypoint.');
      return;
    }

    let previousArrival = -1;
    let previousLocation: string | undefined;
    value.waypoints.forEach((waypoint, index) => {
      const path = `userJourney.waypoints[${index}]`;
      if (!isRecord(waypoint)) {
        errors.push(`${path} must be an object.`);
        return;
      }
      const locationId = requireString(
        waypoint.locationId,
        `${path}.locationId`,
        errors,
      );
      if (locationId && !this.sceneGraph.hasNode(locationId)) {
        errors.push(
          `${path}.locationId references unknown location ${locationId}.`,
        );
      }
      if (locationId && previousLocation && locationId !== previousLocation) {
        const previousNode = this.sceneGraph.getNode(previousLocation);
        if (previousNode && !previousNode.neighbors.includes(locationId)) {
          errors.push(
            `${path}.locationId is not connected to previous location ${previousLocation}.`,
          );
        }
      }
      if (locationId) previousLocation = locationId;

      if (waypoint.arrivalTimeMs !== undefined) {
        const arrival = requireNonNegativeNumber(
          waypoint.arrivalTimeMs,
          `${path}.arrivalTimeMs`,
          errors,
        );
        if (arrival !== undefined) {
          if (arrival < previousArrival)
            errors.push(`${path}.arrivalTimeMs must be monotonic.`);
          if (horizonSec !== undefined && arrival > horizonSec * 1000) {
            errors.push(`${path}.arrivalTimeMs exceeds the planning horizon.`);
          }
          previousArrival = arrival;
        }
      }
      if (waypoint.pauseDurationMs !== undefined) {
        requireNonNegativeNumber(
          waypoint.pauseDurationMs,
          `${path}.pauseDurationMs`,
          errors,
        );
      }
    });
  }

  private validateSoundscape(value: unknown, errors: string[]): void {
    if (!isRecord(value)) {
      errors.push('soundscape must be an object.');
      return;
    }
    const ids = new Set<string>();
    this.validateAmbient(value.ambient, ids, errors);
    validateAction(value.action, ids, errors);
    this.validateEvents(value.event, ids, errors);
    const ambient = Array.isArray(value.ambient) ? value.ambient : [];
    const events = Array.isArray(value.event) ? value.event : [];
    const hasStream = ambient.some(
      (item) =>
        isRecord(item) &&
        typeof item.assetId === 'string' &&
        item.assetId.includes('stream'),
    );
    events.forEach((item, index) => {
      if (!isRecord(item) || item.assetId !== 'forest_water_drop_far_01')
        return;
      const hasWaterLocation =
        Array.isArray(item.trajectory) &&
        item.trajectory.some(
          (waypoint) =>
            isRecord(waypoint) &&
            (waypoint.locationId === 'stream_bank' ||
              waypoint.locationId === 'waterfall'),
        );
      if (!hasStream && !hasWaterLocation)
        errors.push(
          `soundscape.event[${index}] requires an established stream/water context.`,
        );
    });
  }

  private validateAmbient(
    value: unknown,
    ids: Set<string>,
    errors: string[],
  ): void {
    if (!Array.isArray(value)) {
      errors.push('soundscape.ambient must be an array.');
      return;
    }
    value.forEach((item, index) => {
      const path = `soundscape.ambient[${index}]`;
      if (!isRecord(item)) return errors.push(`${path} must be an object.`);
      validateRuntimeObjectIdentity(item, path, ids, errors);
      validateAssetLayer(item.assetId, 'ambient', path, errors);
      if (item.mode !== 'global' && item.mode !== 'localized') {
        errors.push(`${path}.mode must be global or localized.`);
      }
      validateGain(item.gain, `${path}.gain`, errors);
      if (typeof item.active !== 'boolean')
        errors.push(`${path}.active must be boolean.`);
      if (item.mode === 'localized') {
        const locationId = requireString(
          item.locationId,
          `${path}.locationId`,
          errors,
        );
        if (locationId && !this.sceneGraph.hasNode(locationId)) {
          errors.push(
            `${path}.locationId references unknown location ${locationId}.`,
          );
        }
      } else if (item.locationId !== undefined) {
        errors.push(`${path}.locationId must be omitted for global ambient.`);
      }
    });
  }

  private validateEvents(
    value: unknown,
    ids: Set<string>,
    errors: string[],
  ): void {
    if (!Array.isArray(value)) {
      errors.push('soundscape.event must be an array.');
      return;
    }
    value.forEach((item, index) => {
      const path = `soundscape.event[${index}]`;
      if (!isRecord(item)) return errors.push(`${path} must be an object.`);
      validateRuntimeObjectIdentity(item, path, ids, errors);
      validateAssetLayer(item.assetId, 'event', path, errors);
      requireNonNegativeNumber(
        item.activationTimeMs,
        `${path}.activationTimeMs`,
        errors,
      );
      requirePositiveNumber(item.durationMs, `${path}.durationMs`, errors);
      validateGain(item.gain, `${path}.gain`, errors);
      if (!Array.isArray(item.trajectory) || item.trajectory.length === 0) {
        errors.push(`${path}.trajectory must contain at least one waypoint.`);
        return;
      }
      let previousTimestamp = -1;
      item.trajectory.forEach((waypoint, waypointIndex) => {
        const waypointPath = `${path}.trajectory[${waypointIndex}]`;
        if (!isRecord(waypoint))
          return errors.push(`${waypointPath} must be an object.`);
        const locationId = requireString(
          waypoint.locationId,
          `${waypointPath}.locationId`,
          errors,
        );
        if (locationId && !this.sceneGraph.hasNode(locationId)) {
          errors.push(
            `${waypointPath}.locationId references unknown location ${locationId}.`,
          );
        }
        const timestamp = requireNonNegativeNumber(
          waypoint.timestampMs,
          `${waypointPath}.timestampMs`,
          errors,
        );
        if (timestamp !== undefined) {
          if (timestamp < previousTimestamp) {
            errors.push(`${waypointPath}.timestampMs must be monotonic.`);
          }
          previousTimestamp = timestamp;
        }
      });
    });
  }
}

function validateAction(
  value: unknown,
  ids: Set<string>,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push('soundscape.action must be an array.');
    return;
  }
  const attachments = new Set(['head', 'chest', 'feet', 'body']);
  value.forEach((item, index) => {
    const path = `soundscape.action[${index}]`;
    if (!isRecord(item)) return errors.push(`${path} must be an object.`);
    validateRuntimeObjectIdentity(item, path, ids, errors);
    validateAssetLayer(item.assetId, 'action', path, errors);
    if (
      typeof item.attachment !== 'string' ||
      !attachments.has(item.attachment)
    ) {
      errors.push(`${path}.attachment is invalid.`);
    }
    if (!isVector3(item.relativePosition))
      errors.push(`${path}.relativePosition must be a Vector3.`);
    validateGain(item.gain, `${path}.gain`, errors);
    if (typeof item.active !== 'boolean')
      errors.push(`${path}.active must be boolean.`);
  });
}

function validateAssetLayer(
  assetId: unknown,
  expectedLayer: 'ambient' | 'action' | 'event',
  path: string,
  errors: string[],
): void {
  if (typeof assetId !== 'string') return;
  const asset = audioLibraryById.get(assetId);
  // Legacy demo aliases remain accepted; canonical IDs must match their layer.
  if (asset && asset.layer !== expectedLayer)
    errors.push(
      `${path}.assetId ${assetId} belongs to ${asset.layer}, not ${expectedLayer}.`,
    );
}

function validateTransitionPolicy(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push('transitionPolicy must be an object.');
    return;
  }
  requirePositiveNumber(
    value.defaultDurationMs,
    'transitionPolicy.defaultDurationMs',
    errors,
  );
  const curves = new Set(['linear', 'smoothstep', 'cubic', 'catmull-rom']);
  if (typeof value.curve !== 'string' || !curves.has(value.curve)) {
    errors.push('transitionPolicy.curve is invalid.');
  }
}

function validateRuntimeObjectIdentity(
  value: Record<string, unknown>,
  path: string,
  ids: Set<string>,
  errors: string[],
): void {
  const id = requireString(value.id, `${path}.id`, errors);
  requireString(value.assetId, `${path}.assetId`, errors);
  if (id) {
    if (ids.has(id))
      errors.push(`${path}.id duplicates runtime object id ${id}.`);
    ids.add(id);
  }
}

function validateGain(value: unknown, path: string, errors: string[]): void {
  if (!isFiniteNumber(value) || value < 0 || value > 1) {
    errors.push(`${path} must be between 0 and 1.`);
  }
}

function requireString(
  value: unknown,
  path: string,
  errors: string[],
): string | undefined {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${path} must be a non-empty string.`);
    return undefined;
  }
  return value;
}

function requirePositiveNumber(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (!isFiniteNumber(value) || value <= 0) {
    errors.push(`${path} must be a positive finite number.`);
    return undefined;
  }
  return value;
}

function requireNonNegativeNumber(
  value: unknown,
  path: string,
  errors: string[],
): number | undefined {
  if (!isFiniteNumber(value) || value < 0) {
    errors.push(`${path} must be a non-negative finite number.`);
    return undefined;
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isVector3(value: unknown): boolean {
  return (
    Array.isArray(value) && value.length === 3 && value.every(isFiniteNumber)
  );
}
