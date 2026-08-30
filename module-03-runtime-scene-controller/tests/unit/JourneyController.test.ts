import { describe, expect, it } from 'vitest';
import { JourneyController } from '../../src/controllers/JourneyController.js';
import { RuntimeEventBus } from '../../src/events/RuntimeEvents.js';
import { SceneGraph } from '../../src/scene-graph/SceneGraph.js';
import { SemanticLocationMapper } from '../../src/scene-graph/SemanticLocationMapper.js';
import {
  sceneGraphDefinitionFixture,
  sceneJourneyPlanFixture,
} from '../fixtures/phase1Fixtures.js';

function createJourney(events = new RuntimeEventBus()) {
  return new JourneyController(
    new SemanticLocationMapper(new SceneGraph(sceneGraphDefinitionFixture)),
    events,
  );
}

describe('JourneyController', () => {
  it('is frame-rate independent and estimates smoothstep velocity', () => {
    const oneStep = createJourney();
    const manySteps = createJourney();
    oneStep.initialize(sceneJourneyPlanFixture);
    manySteps.initialize(sceneJourneyPlanFixture);

    const direct = oneStep.update(5_000);
    let subdivided = manySteps.getListenerState();
    for (let index = 0; index < 50; index += 1)
      subdivided = manySteps.update(100);

    expect(subdivided.worldPosition).toEqual(direct.worldPosition);
    expect(subdivided.velocity).toEqual(direct.velocity);
    expect(direct.worldPosition).toEqual([0, 0, -3]);
    expect(direct.velocity[2]).toBeLessThan(0);
  });

  it('keeps orientation stable while paused', () => {
    const journey = createJourney();
    journey.initialize({
      ...sceneJourneyPlanFixture,
      userJourney: {
        goal: 'pause then move',
        waypoints: [
          { locationId: 'forest_entry', pauseDurationMs: 2_000 },
          { locationId: 'clearing', arrivalTimeMs: 10_000 },
        ],
      },
    });
    const before = journey.getListenerState().orientation;
    const paused = journey.update(1_000);
    expect(paused.worldPosition).toEqual([0, 0, 0]);
    expect(paused.velocity).toEqual([0, 0, 0]);
    expect(paused.orientation).toEqual(before);
  });

  it('emits waypoint and semantic-location events on arrival', () => {
    const events = new RuntimeEventBus();
    const journey = createJourney(events);
    journey.initialize(sceneJourneyPlanFixture);
    journey.update(10_000);
    expect(
      events.history.some((event) => event.type === 'WaypointReached'),
    ).toBe(true);
    expect(
      events.history.some((event) => event.type === 'SemanticLocationChanged'),
    ).toBe(true);
    expect(journey.getListenerState().semanticLocation).toBe('clearing');
  });

  it('replaces plans without teleporting the listener', () => {
    const journey = createJourney();
    journey.initialize(sceneJourneyPlanFixture);
    const before = journey.update(4_000).worldPosition;
    journey.replacePlan({
      ...sceneJourneyPlanFixture,
      userJourney: {
        goal: 'return',
        waypoints: [{ locationId: 'forest_entry' }],
      },
    });
    expect(journey.update(0).worldPosition).toEqual(before);
  });

  it('preserves absolute replacement arrival time and commits semantic location only on arrival', () => {
    const journey = createJourney();
    journey.initialize({
      ...sceneJourneyPlanFixture,
      userJourney: {
        goal: 'origin',
        waypoints: [{ locationId: 'forest_entry', arrivalTimeMs: 0 }],
      },
    });
    journey.replacePlan({
      ...sceneJourneyPlanFixture,
      userJourney: {
        goal: 'move to clearing',
        waypoints: [
          { locationId: 'forest_entry', arrivalTimeMs: 0 },
          { locationId: 'clearing', arrivalTimeMs: 5_000 },
        ],
      },
    });
    expect(journey.update(4_999).semanticLocation).toBe('forest_entry');
    const arrived = journey.update(1);
    expect(arrived.semanticLocation).toBe('clearing');
    expect(arrived.worldPosition).toEqual([0, 0, -6]);
  });
});
