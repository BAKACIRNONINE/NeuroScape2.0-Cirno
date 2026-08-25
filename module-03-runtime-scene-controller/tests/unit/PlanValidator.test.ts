import { describe, expect, it } from 'vitest';
import { SceneGraph } from '../../src/scene-graph/SceneGraph.js';
import { PlanValidator } from '../../src/validation/PlanValidator.js';
import {
  sceneGraphDefinitionFixture,
  sceneJourneyPlanFixture,
} from '../fixtures/phase1Fixtures.js';

describe('PlanValidator', () => {
  const validator = new PlanValidator(
    new SceneGraph(sceneGraphDefinitionFixture),
  );

  it('accepts a complete semantic plan', () => {
    const result = validator.validate(sceneJourneyPlanFixture);
    expect(result.valid).toBe(true);
    expect(result.plan?.planId).toBe('plan-001');
  });

  it('rejects unknown and disconnected journey locations', () => {
    const unknownResult = validator.validate({
      ...sceneJourneyPlanFixture,
      userJourney: {
        ...sceneJourneyPlanFixture.userJourney,
        waypoints: [{ locationId: 'unknown' }],
      },
    });
    const disconnectedResult = validator.validate({
      ...sceneJourneyPlanFixture,
      userJourney: {
        ...sceneJourneyPlanFixture.userJourney,
        waypoints: [
          { locationId: 'forest_entry' },
          { locationId: 'stream_bank' },
        ],
      },
    });

    expect(unknownResult.errors.join(' ')).toMatch(/unknown location/);
    expect(disconnectedResult.errors.join(' ')).toMatch(/not connected/);
  });

  it('rejects invalid gains, duplicate object ids, and non-monotonic event timing', () => {
    const result = validator.validate({
      ...sceneJourneyPlanFixture,
      soundscape: {
        ambient: [
          {
            id: 'duplicate',
            assetId: 'ambient.forest-wind',
            mode: 'global',
            gain: 2,
            active: true,
          },
        ],
        action: [
          {
            id: 'duplicate',
            assetId: 'action.breathing',
            attachment: 'chest',
            relativePosition: [0, 0, 0],
            gain: 0.2,
            active: true,
          },
        ],
        event: [
          {
            id: 'event',
            assetId: 'event.bird',
            activationTimeMs: 0,
            durationMs: 1_000,
            gain: 0.5,
            trajectory: [
              { locationId: 'clearing', timestampMs: 500 },
              { locationId: 'forest_entry', timestampMs: 100 },
            ],
          },
        ],
      },
    });

    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/between 0 and 1/);
    expect(result.errors.join(' ')).toMatch(/duplicates runtime object id/);
    expect(result.errors.join(' ')).toMatch(/monotonic/);
  });

  it('rejects malformed external input without throwing', () => {
    expect(validator.validate(null)).toEqual({
      valid: false,
      errors: ['Plan must be an object.'],
    });
  });

  it('rejects canonical assets in the wrong layer and water cues without water context', () => {
    const wrongLayer = structuredClone(sceneJourneyPlanFixture);
    wrongLayer.soundscape.ambient[0]!.assetId = 'forest_bird_far_01';
    expect(validator.validate(wrongLayer).errors.join(' ')).toMatch(
      /belongs to event, not ambient/,
    );

    const dryWaterCue = structuredClone(sceneJourneyPlanFixture);
    dryWaterCue.soundscape.ambient = [];
    dryWaterCue.soundscape.event = [
      {
        id: 'dry-water',
        assetId: 'forest_water_drop_far_01',
        activationTimeMs: 1_000,
        durationMs: 16_823,
        gain: 0.2,
        trajectory: [{ locationId: 'clearing', timestampMs: 1_000 }],
      },
    ];
    expect(validator.validate(dryWaterCue).errors.join(' ')).toMatch(
      /requires an established stream\/water context/,
    );
  });
});
