import { describe, expect, it } from 'vitest';
import { RuntimeWorldStateBuilder } from '../../src/core/RuntimeWorldStateBuilder.js';
import { runtimeWorldStateFixture } from '../fixtures/runtime-world-state.fixture.js';

describe('RuntimeWorldStateBuilder', () => {
  it('assembles a deeply immutable snapshot', () => {
    const state = new RuntimeWorldStateBuilder().build(runtimeWorldStateFixture);
    expect(state).toEqual(runtimeWorldStateFixture);
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(state.listener)).toBe(true);
    expect(Object.isFrozen(state.listener.worldPosition)).toBe(true);
    expect(Object.isFrozen(state.journey?.plannedPath)).toBe(true);
    expect(Object.isFrozen(state.ambient)).toBe(true);
  });

  it('does not retain mutable input arrays', () => {
    const input = structuredClone(runtimeWorldStateFixture);
    const state = new RuntimeWorldStateBuilder().build(input);
    input.listener.worldPosition[0] = 99;
    input.journey!.plannedPath[0]![0] = 99;
    expect(state.listener.worldPosition[0]).toBe(0);
    expect(state.journey?.plannedPath[0]?.[0]).toBe(0);
  });
});
