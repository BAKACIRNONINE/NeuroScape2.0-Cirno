import { describe, expect, it } from 'vitest';
import { NEUROSCAPE_PROTOCOL_VERSION } from '@neuroscape/contracts';
import { WebSocketClient } from '../src/network/WebSocketClient.js';
import { createRuntimeStore } from '../src/runtime/RuntimeStore.js';
import { journeyPlan, neuroState, snapshot } from './fixtures.js';
import { FakeTimers, MockSocket } from './networkFakes.js';
const envelope = (type: string, timestampMs: number, payload: unknown, sessionId = 's1') => ({ type, protocolVersion: NEUROSCAPE_PROTOCOL_VERSION, sessionId, timestampMs, payload });
describe('WebSocketClient', () => {
  it('routes ordered independent streams and preserves spatial state on wrong/stale messages', () => {
    const store = createRuntimeStore(), socket = new MockSocket(), timers = new FakeTimers(); const client = new WebSocketClient('ws://test', 's1', store, () => socket, timers); client.connect(); socket.open();
    socket.receive(envelope('RuntimeWorldState', 100, snapshot(100))); socket.receive(envelope('NeuroState', 100, neuroState(100))); socket.receive(envelope('SceneJourneyPlan', 110, journeyPlan()));
    expect(store.getState().runtimeWorldState?.timestampMs).toBe(100); expect(store.getState().neuroState?.arousal.value).toBe(.41); expect(store.getState().sceneJourneyPlan?.planId).toBe('plan-1');
    const world = store.getState().runtimeWorldState; socket.receive(envelope('RuntimeWorldState', 90, snapshot(90))); socket.receive(envelope('RuntimeWorldState', 200, snapshot(200), 'wrong'));
    expect(store.getState().runtimeWorldState).toBe(world); client.disconnect(); expect(store.getState().runtimeWorldState).toBe(world);
  });
  it('queues commands, reconnects exponentially, detects heartbeat timeout, and shuts down cleanly', () => {
    const store = createRuntimeStore(), timers = new FakeTimers(), sockets: MockSocket[] = []; const client = new WebSocketClient('ws://test', 's1', store, () => { const socket = new MockSocket(); sockets.push(socket); return socket; }, timers, { heartbeatIntervalMs: 100, heartbeatTimeoutMs: 20, reconnectBaseMs: 50 });
    client.sendCommand({ command: 'pauseSession' }); expect(sockets).toHaveLength(1); sockets[0]!.open(); expect(sockets[0]!.sent.some((item) => item.includes('pauseSession'))).toBe(true);
    timers.runDelay(100); timers.runDelay(20); expect(store.getState().connectionState.status).toBe('reconnecting'); expect(store.getState().connectionState.attempt).toBe(1);
    timers.runDelay(50); expect(sockets).toHaveLength(2); sockets[1]!.open(); client.disconnect(); expect(store.getState().connectionState.status).toBe('closed'); expect(sockets[1]!.closes).toEqual([1000]);
  });
});
