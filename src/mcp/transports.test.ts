import { describe, it, expect } from 'vitest';

import { UnsupportedTransportError, createTransport, resolveTransportKind } from './transports.ts';

describe('resolveTransportKind', () => {
  it.each([
    ['https://example.com/mcp', 'streamable-http'],
    ['http://localhost:5173/mcp', 'streamable-http'],
    ['wss://example.com/mcp', 'websocket'],
    ['ws://localhost:8080/mcp', 'websocket'],
  ])('auto-resolves %s → %s', (url, expected) => {
    expect(resolveTransportKind(url, 'auto')).toBe(expected);
  });

  it('honours an explicit choice even when the URL suggests otherwise', () => {
    expect(resolveTransportKind('https://example.com/mcp', 'sse-legacy')).toBe('sse-legacy');
    expect(resolveTransportKind('https://example.com/mcp', 'websocket')).toBe('websocket');
  });

  it('rejects non-URL strings', () => {
    expect(() => resolveTransportKind('not a url', 'auto')).toThrow(UnsupportedTransportError);
  });

  it('rejects stdio:// and other unsupported schemes', () => {
    expect(() => resolveTransportKind('stdio://foo', 'auto')).toThrow(UnsupportedTransportError);
    expect(() => resolveTransportKind('file:///foo', 'auto')).toThrow(UnsupportedTransportError);
  });
});

describe('createTransport', () => {
  it('builds a StreamableHTTP transport for https URLs', () => {
    const t = createTransport({ url: 'https://example.com/mcp', transport: 'auto' });
    expect(t.constructor.name).toBe('StreamableHTTPClientTransport');
  });

  it('builds a WebSocket transport for wss URLs', () => {
    const t = createTransport({ url: 'wss://example.com/mcp', transport: 'auto' });
    expect(t.constructor.name).toBe('WebSocketClientTransport');
  });

  it('builds an SSE transport when explicitly requested', () => {
    const t = createTransport({
      url: 'https://example.com/mcp',
      transport: 'sse-legacy',
    });
    expect(t.constructor.name).toBe('SSEClientTransport');
  });

  it('throws on an unsupported scheme', () => {
    expect(() => createTransport({ url: 'stdio://local', transport: 'auto' })).toThrow(
      UnsupportedTransportError,
    );
  });
});
