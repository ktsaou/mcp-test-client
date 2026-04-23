import { describe, it, expect, vi } from 'vitest';
import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

import { LoggingTransport } from './logging-transport.ts';
import type { WireEvent } from './types.ts';

/** Minimal in-memory Transport used to drive the decorator in tests. */
class MockTransport implements Transport {
  sent: JSONRPCMessage[] = [];
  started = false;
  closed = false;

  onmessage?: Transport['onmessage'];
  onclose?: Transport['onclose'];
  onerror?: Transport['onerror'];

  sessionId: string | undefined;

  async start(): Promise<void> {
    this.started = true;
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    this.sent.push(message);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.onclose?.();
  }

  setProtocolVersion(version: string): void {
    this.sessionId = `pv:${version}`; // just to show it was called
  }

  // Test helpers
  simulateIncoming(message: JSONRPCMessage): void {
    this.onmessage?.(message);
  }

  simulateError(err: Error): void {
    this.onerror?.(err);
  }
}

describe('LoggingTransport', () => {
  it('emits outgoing events before delegating send()', async () => {
    const events: WireEvent[] = [];
    const inner = new MockTransport();
    const decorated = new LoggingTransport(inner, (e) => events.push(e));

    const msg: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'ping' };
    await decorated.send(msg);

    expect(events).toHaveLength(1);
    expect(events[0]?.direction).toBe('outgoing');
    expect(events[0]?.message).toEqual(msg);
    expect(inner.sent).toEqual([msg]);
  });

  it('emits incoming events when the inner transport delivers a message', () => {
    const events: WireEvent[] = [];
    const inner = new MockTransport();
    const decorated = new LoggingTransport(inner, (e) => events.push(e));

    const userHandler = vi.fn();
    decorated.onmessage = userHandler;

    const msg: JSONRPCMessage = { jsonrpc: '2.0', id: 1, result: {} };
    inner.simulateIncoming(msg);

    expect(events).toHaveLength(1);
    expect(events[0]?.direction).toBe('incoming');
    expect(userHandler).toHaveBeenCalledWith(msg, undefined);
  });

  it('forwards onclose and onerror to the user handlers', () => {
    const inner = new MockTransport();
    const decorated = new LoggingTransport(inner, () => undefined);

    const onClose = vi.fn();
    const onErr = vi.fn();
    decorated.onclose = onClose;
    decorated.onerror = onErr;

    inner.onclose?.();
    inner.onerror?.(new Error('boom'));

    expect(onClose).toHaveBeenCalledOnce();
    expect(onErr).toHaveBeenCalledWith(new Error('boom'));
  });

  it('proxies sessionId from the inner transport', () => {
    const inner = new MockTransport();
    inner.sessionId = 'abc-123';
    const decorated = new LoggingTransport(inner, () => undefined);
    expect(decorated.sessionId).toBe('abc-123');
  });

  it('proxies setProtocolVersion to the inner transport', () => {
    const inner = new MockTransport();
    const spy = vi.spyOn(inner, 'setProtocolVersion');
    const decorated = new LoggingTransport(inner, () => undefined);
    decorated.setProtocolVersion('2025-11-25');
    expect(spy).toHaveBeenCalledWith('2025-11-25');
  });

  it('survives a sink that throws', async () => {
    const inner = new MockTransport();
    const decorated = new LoggingTransport(inner, () => {
      throw new Error('sink exploded');
    });

    const msg: JSONRPCMessage = { jsonrpc: '2.0', method: 'notifications/foo' };
    await expect(decorated.send(msg)).resolves.toBeUndefined();
    expect(inner.sent).toEqual([msg]);
  });

  it('delegates start() and close()', async () => {
    const inner = new MockTransport();
    const decorated = new LoggingTransport(inner, () => undefined);

    await decorated.start();
    await decorated.close();

    expect(inner.started).toBe(true);
    expect(inner.closed).toBe(true);
  });
});
