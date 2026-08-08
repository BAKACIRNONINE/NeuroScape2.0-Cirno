import { describe, expect, it } from 'vitest';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { journeyPlan, neuroState, snapshot } from './fixtures.js';
describe('independent runtime streams', () => {
  it('orders NeuroState and SceneJourneyPlan independently without changing spatial truth', () => { const store = createRuntimeStore(); store.getState().publishRuntimeWorldState(snapshot(500)); const world = store.getState().runtimeWorldState; expect(store.getState().publishNeuroState(neuroState(100), 100).accepted).toBe(true); expect(store.getState().publishNeuroState(neuroState(90), 110)).toMatchObject({ accepted: false, reason: 'stale' }); expect(store.getState().publishSceneJourneyPlan(journeyPlan(), 200).accepted).toBe(true); expect(store.getState().publishSceneJourneyPlan({ ...journeyPlan(), planId: 'older' }, 100)).toMatchObject({ accepted: false, reason: 'stale' }); expect(store.getState().runtimeWorldState).toBe(world); });
});
