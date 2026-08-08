import { describe, expect, it } from 'vitest';
import { NEUROSCAPE_PROTOCOL_VERSION } from '@neuroscape/contracts';
import { createStartSessionCommand, parseServerMessage } from '../src/network/protocol.js';
import { snapshot } from './fixtures.js';
describe('WebSocket protocol', () => {
  it('validates version, session, timestamps, and runtime payloads', () => {
    const message = { type: 'RuntimeWorldState', protocolVersion: NEUROSCAPE_PROTOCOL_VERSION, sessionId: 's1', timestampMs: 100, payload: snapshot(100) };
    expect(parseServerMessage(JSON.stringify(message), 's1').valid).toBe(true);
    expect(parseServerMessage({ ...message, sessionId: 'wrong' }, 's1').valid).toBe(false);
    expect(parseServerMessage({ ...message, protocolVersion: '9' }, 's1').valid).toBe(false);
    expect(parseServerMessage({ ...message, timestampMs: 101 }, 's1').valid).toBe(false);
  });
  it('generates a typed start command without planner logic', () => expect(createStartSessionCommand('s1', '  forest  ', 10, 'muse', 5)).toEqual({ type: 'ClientCommand', protocolVersion: '1.0', sessionId: 's1', timestampMs: 5, payload: { command: 'startSession', worldDescription: 'forest', durationMinutes: 10, eegSource: 'muse' } }));
});
