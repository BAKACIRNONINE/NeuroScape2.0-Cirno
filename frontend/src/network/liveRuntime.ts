import { WebSocketClient } from './WebSocketClient.js';

export const liveSessionId = globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}`;
const defaultUrl = `${globalThis.location?.protocol === 'https:' ? 'wss' : 'ws'}://${globalThis.location?.host ?? 'localhost:8080'}/runtime`;
const configuredUrl = (import.meta as ImportMeta & { env?: { VITE_RUNTIME_WS_URL?: string } }).env?.VITE_RUNTIME_WS_URL;
export const liveRuntimeClient = new WebSocketClient(configuredUrl ?? defaultUrl, liveSessionId);
