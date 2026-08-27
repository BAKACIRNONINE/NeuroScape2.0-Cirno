import { describe, expect, it } from 'vitest';
import { ActionController } from '../../src/controllers/ActionController.js';
import { TransitionController } from '../../src/controllers/TransitionController.js';
import { RuntimeEventBus } from '../../src/events/RuntimeEvents.js';

describe('ActionController', () => {
  it('derives world position from listener position, orientation, and relative position', () => {
    const transitions = new TransitionController(new RuntimeEventBus());
    transitions.initialize();
    const actions = new ActionController(transitions);
    const listener = {
      worldPosition: [2, 0, 3] as [number, number, number],
      orientation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] as [
        number,
        number,
        number,
        number,
      ],
      velocity: [0, 0, 0] as [number, number, number],
      semanticLocation: 'forest_entry',
    };
    actions.initialize(
      [
        {
          id: 'breath',
          assetId: 'action.breath',
          attachment: 'chest',
          relativePosition: [0, 0, -1],
          gain: 0.5,
          active: true,
        },
      ],
      { defaultDurationMs: 1, curve: 'linear' },
      listener,
    );
    actions.update(0, listener);
    const position = actions.getStates()[0]!.worldPosition;
    expect(position[0]).toBeCloseTo(1);
    expect(position[1]).toBeCloseTo(0);
    expect(position[2]).toBeCloseTo(3);
  });

  it('does not suppress feet actions unless the validated condition requires movement', () => {
    const transitions = new TransitionController(new RuntimeEventBus());
    transitions.initialize();
    const actions = new ActionController(transitions);
    const still = {
      worldPosition: [0, 0, 0] as [number, number, number],
      orientation: [0, 0, 0, 1] as [number, number, number, number],
      velocity: [0, 0, 0] as [number, number, number],
      semanticLocation: 'forest_entry',
    };
    actions.initialize(
      [
        {
          id: 'steps',
          assetId: 'action.steps',
          attachment: 'feet',
          relativePosition: [0, -1.5, 0],
          gain: 0.5,
          active: true,
        },
      ],
      { defaultDurationMs: 100, curve: 'linear' },
      still,
    );
    transitions.update(100);
    expect(actions.getStates()[0]!.active).toBe(true);

    actions.merge(
      [
        {
          id: 'steps',
          assetId: 'action.steps',
          attachment: 'feet',
          relativePosition: [0, -1.5, 0],
          gain: 0.5,
          active: true,
          activationCondition: 'listener-moving',
        },
      ],
      { defaultDurationMs: 100, curve: 'linear' },
      still,
    );
    actions.update(0, still);
    transitions.update(100);
    expect(actions.getStates()[0]!.active).toBe(false);
    actions.update(10, { ...still, velocity: [0, 0, -1] });
    transitions.update(100);
    expect(actions.getStates()[0]!.active).toBe(true);
  });
});
