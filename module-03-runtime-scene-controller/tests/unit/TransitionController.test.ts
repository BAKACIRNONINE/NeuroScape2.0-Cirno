import { describe, expect, it } from 'vitest';
import { TransitionController } from '../../src/controllers/TransitionController.js';
import { RuntimeEventBus } from '../../src/events/RuntimeEvents.js';

describe('TransitionController', () => {
  it('applies deterministic time-based gain transitions', () => {
    const events = new RuntimeEventBus();
    const transitions = new TransitionController(events);
    transitions.initialize();
    transitions.scheduleGain('ambient:a:gain', 0, 1, 1_000, 'linear');
    transitions.update(250);
    expect(transitions.getValue('ambient:a:gain')).toBeCloseTo(0.25);
    transitions.update(750);
    expect(transitions.getValue('ambient:a:gain')).toBe(1);
    expect(transitions.isComplete('ambient:a:gain')).toBe(true);
  });

  it('supports activation, removal, and completion events', () => {
    const events = new RuntimeEventBus();
    const transitions = new TransitionController(events);
    transitions.initialize();
    transitions.scheduleActivation('event:e:gain', 0.8, 100, 'smoothstep');
    transitions.update(100);
    transitions.scheduleRemoval('event:e:gain', 0.8, 100, 'smoothstep');
    transitions.update(100);
    expect(transitions.getValue('event:e:gain')).toBe(0);
    expect(events.history.filter((event) => event.type === 'TransitionStarted')).toHaveLength(2);
    expect(events.history.filter((event) => event.type === 'TransitionCompleted')).toHaveLength(2);
  });
});
