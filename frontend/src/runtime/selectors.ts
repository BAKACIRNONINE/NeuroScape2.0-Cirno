import type { RuntimeStoreState } from './RuntimeStore.js';

export const selectRuntimeWorldState = (state: RuntimeStoreState) => state.runtimeWorldState;
export const selectListener = (state: RuntimeStoreState) => state.runtimeWorldState?.listener ?? null;
export const selectJourney = (state: RuntimeStoreState) => state.runtimeWorldState?.journey ?? null;
export const selectAmbient = (state: RuntimeStoreState) => state.runtimeWorldState?.ambient ?? [];
export const selectActions = (state: RuntimeStoreState) => state.runtimeWorldState?.action ?? [];
export const selectEvents = (state: RuntimeStoreState) => state.runtimeWorldState?.event ?? [];
export const selectActiveCounts = (state: RuntimeStoreState) => ({
  ambient: state.runtimeWorldState?.ambient.filter((item) => item.active).length ?? 0,
  action: state.runtimeWorldState?.action.filter((item) => item.active).length ?? 0,
  event: state.runtimeWorldState?.event.filter((item) => item.active).length ?? 0,
});
