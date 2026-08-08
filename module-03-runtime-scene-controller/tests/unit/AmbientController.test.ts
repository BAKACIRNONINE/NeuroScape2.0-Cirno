import { describe, expect, it } from 'vitest';
import { AmbientController } from '../../src/controllers/AmbientController.js';
import { gentleDistanceGain } from '../../src/core/math.js';
import { TransitionController } from '../../src/controllers/TransitionController.js';
import { RuntimeEventBus } from '../../src/events/RuntimeEvents.js';
import { SceneGraph } from '../../src/scene-graph/SceneGraph.js';
import { SemanticLocationMapper } from '../../src/scene-graph/SemanticLocationMapper.js';
import { sceneGraphDefinitionFixture } from '../fixtures/phase1Fixtures.js';

const listener = {
  worldPosition: [0, 0, 0] as [number, number, number],
  orientation: [0, 0, 0, 1] as [number, number, number, number],
  velocity: [0, 0, 0] as [number, number, number],
  semanticLocation: 'forest_entry',
};

describe('AmbientController', () => {
  it('transitions global ambient gain without a world position', () => {
    const transitions = new TransitionController(new RuntimeEventBus());
    transitions.initialize();
    const ambient = new AmbientController(
      new SemanticLocationMapper(new SceneGraph(sceneGraphDefinitionFixture)),
      transitions,
    );
    ambient.initialize(
      [{ id: 'wind', assetId: 'ambient.wind', mode: 'global', gain: 0.8, active: true }],
      { defaultDurationMs: 1_000, curve: 'linear' },
    );
    ambient.update(500, listener);
    transitions.update(500);
    expect(ambient.getStates(listener)[0]).toMatchObject({ gain: 0.4, active: true });
    expect(ambient.getStates(listener)[0]?.worldPosition).toBeUndefined();
  });

  it('anchors localized ambient and applies gentle distance attenuation', () => {
    const transitions = new TransitionController(new RuntimeEventBus());
    transitions.initialize();
    const ambient = new AmbientController(
      new SemanticLocationMapper(new SceneGraph(sceneGraphDefinitionFixture)),
      transitions,
    );
    ambient.initialize(
      [
        {
          id: 'stream',
          assetId: 'ambient.stream',
          mode: 'localized',
          locationId: 'stream_bank',
          gain: 1,
          active: true,
        },
      ],
      { defaultDurationMs: 1, curve: 'linear' },
    );
    transitions.update(1);
    const state = ambient.getStates(listener)[0]!;
    expect(state.worldPosition).toEqual([0, 0, -12]);
    expect(state.gain).toBeCloseTo(gentleDistanceGain(12));
    expect(gentleDistanceGain(1_000)).toBe(0.15);
  });
});
