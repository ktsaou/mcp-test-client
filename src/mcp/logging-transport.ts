/**
 * LoggingTransport — a decorator around any MCP Transport that emits every
 * JSON-RPC message to a subscriber before delegating. This is the hook that
 * feeds the wire-traffic log in the UI.
 *
 * The decorator preserves every contract of the underlying Transport:
 * - start / send / close pass through unchanged
 * - onclose / onerror / onmessage are re-exposed so the SDK Client sees them
 * - sessionId and setProtocolVersion are proxied (getters for sessionId,
 *   method pass-through for setProtocolVersion)
 *
 * Rationale: The SDK's `Client` class wires up the Transport callbacks when
 * `connect()` is called, so our decorator must be indistinguishable from a
 * raw Transport at the contract level.
 */

import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';

import type { JSONRPCMessage, WireEventSink } from './types.ts';

export class LoggingTransport implements Transport {
  #inner: Transport;
  #sink: WireEventSink;

  constructor(inner: Transport, sink: WireEventSink) {
    this.#inner = inner;
    this.#sink = sink;

    // Intercept inbound messages: the SDK Client will set `onmessage` on us
    // after construction, so we need to forward through our log hook then
    // delegate to whatever they installed.
    this.#inner.onmessage = (message, extra) => {
      this.#emit('incoming', message);
      this.onmessage?.(message, extra);
    };

    this.#inner.onclose = () => {
      this.onclose?.();
    };

    this.#inner.onerror = (err) => {
      this.onerror?.(err);
    };
  }

  // The SDK Client installs these after construction. We forward them above.
  onmessage?: Transport['onmessage'];
  onclose?: Transport['onclose'];
  onerror?: Transport['onerror'];

  start(): Promise<void> {
    return this.#inner.start();
  }

  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    this.#emit('outgoing', message);
    await this.#inner.send(message, options);
  }

  close(): Promise<void> {
    return this.#inner.close();
  }

  get sessionId(): string | undefined {
    return this.#inner.sessionId;
  }

  setProtocolVersion(version: string): void {
    this.#inner.setProtocolVersion?.(version);
  }

  #emit(direction: 'outgoing' | 'incoming', message: JSONRPCMessage): void {
    try {
      this.#sink({ direction, message, timestamp: Date.now() });
    } catch {
      // A faulty sink must never break transport semantics. Silently swallow;
      // the decorator is observational only.
    }
  }
}
