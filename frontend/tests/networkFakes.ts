import type { SocketLike, TimerApi } from '../src/network/WebSocketClient.js';
export class MockSocket implements SocketLike {
  readyState = 0; onopen: (() => void) | null = null; onmessage: ((event: { data: unknown }) => void) | null = null; onerror: (() => void) | null = null; onclose: (() => void) | null = null; sent: string[] = []; closes: number[] = [];
  open() { this.readyState = 1; this.onopen?.(); } receive(value: unknown) { this.onmessage?.({ data: typeof value === 'string' ? value : JSON.stringify(value) }); }
  send(data: string) { this.sent.push(data); } close(code = 1000) { this.readyState = 3; this.closes.push(code); this.onclose?.(); }
}
export class FakeTimers implements TimerApi {
  time = 1000; next = 1; tasks = new Map<number, { callback: () => void; delay: number }>();
  set(callback: () => void, delay: number) { const id = this.next++; this.tasks.set(id, { callback, delay }); return id; }
  clear(handle: unknown) { this.tasks.delete(handle as number); }
  now() { return this.time; }
  runDelay(delay: number) { const entry = [...this.tasks].find(([, task]) => task.delay === delay); if (!entry) throw new Error(`No ${delay}ms timer`); this.tasks.delete(entry[0]); entry[1].callback(); }
}
