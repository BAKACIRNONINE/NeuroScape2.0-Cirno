import { describe, expect, it } from 'vitest';
import { runtimeDiagnostics } from '../src/debug/index.js';
import { IntegrationHarness, type IntervalApi } from '../src/integration/IntegrationHarness.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { ThreeScene } from '../src/scene/ThreeScene.js';

describe('integration performance acceptance', () => {
  it('keeps the external-store diagnostic snapshot stable until an update is emitted', () => {
    runtimeDiagnostics.reset();
    const before = runtimeDiagnostics.getState();
    expect(runtimeDiagnostics.getState()).toBe(before);
    runtimeDiagnostics.recordRejected('expected test rejection');
    const after = runtimeDiagnostics.getState();
    expect(after).not.toBe(before);
    expect(runtimeDiagnostics.getState()).toBe(after);
  });
  it('keeps measured Module 03, builder, store, and Three.js work below generous regression budgets', () => {
    const store = createRuntimeStore(), interval: IntervalApi = { set:() => 1, clear:() => undefined }, harness = new IntegrationHarness(store,'performance-session',interval); harness.start();
    while (harness.getState().status !== 'ended') harness.tick(250);
    const scene = new ThreeScene(), snapshots = [store.getState().runtimeWorldState!];
    for (let index = 0; index < 60; index += 1) { const startedAt = performance.now(); scene.update(snapshots[0]!); runtimeDiagnostics.recordThreeFrame(performance.now() - startedAt); }
    scene.dispose(); const measured = runtimeDiagnostics.getState();
    console.info(`[integration-performance] module03=${measured.averageModule03UpdateMs.toFixed(3)}ms build=${measured.averageWorldStateBuildMs.toFixed(3)}ms store=${measured.averageStoreUpdateMs.toFixed(3)}ms three=${measured.averageThreeFrameMs.toFixed(3)}ms`);
    expect(measured.averageModule03UpdateMs).toBeLessThan(20); expect(measured.averageWorldStateBuildMs).toBeLessThan(10); expect(measured.averageStoreUpdateMs).toBeLessThan(10); expect(measured.averageThreeFrameMs).toBeLessThan(20);
  });
});
