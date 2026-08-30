import { describe, expect, it } from 'vitest';
import {
  createForestBasePlan,
  phase1Config,
} from '../src/index.js';

describe('constrained Base Plan journey', () => {
  it('starts at the canonical forest clearing', () => {
    const plan = createForestBasePlan(phase1Config);

    expect(plan.version).toBe('base_plan_v5_constrained_journey');
    expect(plan.journey.waypoints).toEqual([
      {
        locationId: 'forest_clearing',
        arrivalTimeMs: 0,
      },
    ]);
  });
});