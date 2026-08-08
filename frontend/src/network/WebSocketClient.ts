import { NEUROSCAPE_PROTOCOL_VERSION, type ClientCommandPayload, type HeartbeatPayload, type PingMessage, type PongMessage, type ServerMessage } from '@neuroscape/contracts';
import type { RuntimeStore } from '../runtime/RuntimeStore.js';
import { runtimeStore } from '../runtime/RuntimeStore.js';
import { createClientCommand, dispatchServerMessage, parseServerMessage } from './protocol.js';
import { runtimeDiagnostics } from '../debug/index.js';

export interface SocketLike {
  readyState: number; onopen: (() => void) | null; onmessage: ((event: { data: unknown }) => void) | null; onerror: (() => void) | null; onclose: (() => void) | null;
  send(data: string): void; close(code?: number, reason?: string): void;
}
export interface TimerApi { set(callback: () => void, delayMs: number): unknown; clear(handle: unknown): void; now(): number }
const timers: TimerApi = { set: (callback, delay) => setTimeout(callback, delay), clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>), now: () => Date.now() };
export interface WebSocketClientOptions { heartbeatIntervalMs?: number; heartbeatTimeoutMs?: number; reconnectBaseMs?: number; reconnectMaxMs?: number }

export class WebSocketClient {
  readonly #url: string; readonly #sessionId: string; readonly #store: RuntimeStore; readonly #factory: (url: string) => SocketLike; readonly #timers: TimerApi;
  readonly #options: Required<WebSocketClientOptions>;
  #socket: SocketLike | null = null; #heartbeat: unknown; #heartbeatTimeout: unknown; #reconnect: unknown; #manualClose = false; #attempt = 0; #lastPingAt = 0;
  #pendingCommands: ClientCommandPayload[] = [];
  constructor(url: string, sessionId: string, store: RuntimeStore = runtimeStore, factory: (url: string) => SocketLike = (target) => new WebSocket(target) as unknown as SocketLike, timerApi: TimerApi = timers, options: WebSocketClientOptions = {}) {
    this.#url = url; this.#sessionId = sessionId; this.#store = store; this.#factory = factory; this.#timers = timerApi;
    this.#options = { heartbeatIntervalMs: options.heartbeatIntervalMs ?? 10_000, heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 5_000, reconnectBaseMs: options.reconnectBaseMs ?? 500, reconnectMaxMs: options.reconnectMaxMs ?? 15_000 };
  }
  connect(): void {
    if (this.#socket && (this.#socket.readyState === 0 || this.#socket.readyState === 1)) return;
    this.#manualClose = false; this.#store.getState().setConnectionState({ status: this.#attempt ? 'reconnecting' : 'connecting', attempt: this.#attempt, error: undefined });
    const socket = this.#factory(this.#url); this.#socket = socket;
    socket.onopen = () => this.#opened(socket); socket.onmessage = (event) => this.#received(socket, event.data);
    socket.onerror = () => this.#store.getState().setConnectionState({ status: 'degraded', error: 'WebSocket transport error' });
    socket.onclose = () => this.#closed(socket);
  }
  sendCommand(payload: ClientCommandPayload): boolean { if (!this.#socket || this.#socket.readyState !== 1) { this.#pendingCommands.push(payload); this.connect(); return true; } return this.#send(createClientCommand(this.#sessionId, payload, this.#timers.now())); }
  disconnect(): void {
    this.#manualClose = true; this.#clearTimers(); const socket = this.#socket; this.#socket = null;
    if (socket && socket.readyState < 2) socket.close(1000, 'Client shutdown');
    this.#store.getState().setConnectionState({ status: 'closed' });
  }
  #opened(socket: SocketLike): void {
    if (socket !== this.#socket) return; this.#attempt = 0;
    this.#store.getState().setConnectionState({ status: 'connected', attempt: 0, error: undefined }); this.#scheduleHeartbeat();
    this.#pendingCommands.splice(0).forEach((payload) => this.#send(createClientCommand(this.#sessionId, payload, this.#timers.now())));
  }
  #received(socket: SocketLike, raw: unknown): void {
    if (socket !== this.#socket) return;
    const parsed = parseServerMessage(raw, this.#sessionId);
    if (!parsed.valid) { this.#store.getState().setConnectionState({ status: 'degraded', error: parsed.error }); runtimeDiagnostics.recordRejected(parsed.error); return; }
    const now = this.#timers.now(); this.#store.getState().setConnectionState({ lastMessageAtMs: now }); this.#route(parsed.message, now);
  }
  #route(message: ServerMessage, receivedAtMs: number): void {
    switch (message.type) {
      case 'Ping': this.#send({ ...message, type: 'Pong' } as PongMessage); break;
      case 'Pong': this.#pong(message.payload, receivedAtMs); break;
      default: dispatchServerMessage(message, this.#store, receivedAtMs);
    }
  }
  #scheduleHeartbeat(): void { this.#heartbeat = this.#timers.set(() => { const nonce = String(this.#timers.now()); this.#lastPingAt = this.#timers.now(); const message: PingMessage = { type: 'Ping', protocolVersion: NEUROSCAPE_PROTOCOL_VERSION, sessionId: this.#sessionId, timestampMs: this.#lastPingAt, payload: { nonce } }; this.#send(message); this.#heartbeatTimeout = this.#timers.set(() => this.#heartbeatExpired(), this.#options.heartbeatTimeoutMs); this.#scheduleHeartbeat(); }, this.#options.heartbeatIntervalMs); }
  #pong(payload: HeartbeatPayload, now: number): void { if (payload.nonce !== String(this.#lastPingAt)) return; if (this.#heartbeatTimeout !== undefined) this.#timers.clear(this.#heartbeatTimeout); this.#heartbeatTimeout = undefined; this.#store.getState().setConnectionState({ status: 'connected', latencyMs: now - this.#lastPingAt, error: undefined }); }
  #heartbeatExpired(): void { this.#store.getState().setConnectionState({ status: 'degraded', error: 'Heartbeat timeout' }); this.#socket?.close(4000, 'Heartbeat timeout'); }
  #closed(socket: SocketLike): void { if (socket !== this.#socket) return; this.#socket = null; this.#clearHeartbeat(); if (this.#manualClose) return; this.#attempt += 1; this.#store.getState().setConnectionState({ status: 'reconnecting', attempt: this.#attempt }); const delay = Math.min(this.#options.reconnectMaxMs, this.#options.reconnectBaseMs * 2 ** (this.#attempt - 1)); this.#reconnect = this.#timers.set(() => { this.#reconnect = undefined; this.connect(); }, delay); }
  #send(message: object): boolean { if (!this.#socket || this.#socket.readyState !== 1) return false; this.#socket.send(JSON.stringify(message)); return true; }
  #clearHeartbeat(): void { if (this.#heartbeat !== undefined) this.#timers.clear(this.#heartbeat); if (this.#heartbeatTimeout !== undefined) this.#timers.clear(this.#heartbeatTimeout); this.#heartbeat = this.#heartbeatTimeout = undefined; }
  #clearTimers(): void { this.#clearHeartbeat(); if (this.#reconnect !== undefined) this.#timers.clear(this.#reconnect); this.#reconnect = undefined; }
}
