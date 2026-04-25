import { describe, it, expect } from 'vitest';
import type {
  Transport,
  TransportSendOptions,
} from '@modelcontextprotocol/sdk/shared/transport.js';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

import { McpClient } from './client.ts';
import type { ServerConfig, WireEvent } from './types.ts';

/**
 * Scripted mock transport.
 *
 * We pre-install a map of method → canned response. Every time the SDK Client
 * sends a request, we match it against the map, echo back a response with the
 * same request id, and invoke `onmessage`. This is enough to drive the
 * initialize handshake and any subsequent *_list / *_call method.
 */
class ScriptedTransport implements Transport {
  responses: Record<string, unknown>;
  sent: JSONRPCMessage[] = [];
  onmessage?: Transport['onmessage'];
  onclose?: Transport['onclose'];
  onerror?: Transport['onerror'];
  /**
   * The SDK's Client.connect() treats a pre-set sessionId as "this is a
   * reconnect, skip initialize". We leave it undefined so the full handshake
   * runs in tests.
   */
  sessionId: string | undefined = undefined;

  constructor(responses: Record<string, unknown>) {
    this.responses = responses;
  }

  async start(): Promise<void> {
    // no-op
  }

  async send(message: JSONRPCMessage, _options?: TransportSendOptions): Promise<void> {
    this.sent.push(message);
    if (!('method' in message) || !('id' in message)) return; // notification
    const method = message.method;
    const id = message.id;
    const result = this.responses[method];
    if (result === undefined) {
      // Default: empty result.
      setTimeout(() => {
        this.onmessage?.({ jsonrpc: '2.0', id, result: {} });
      }, 0);
      return;
    }
    setTimeout(() => {
      this.onmessage?.({ jsonrpc: '2.0', id, result: result as Record<string, unknown> });
    }, 0);
  }

  async close(): Promise<void> {
    this.onclose?.();
  }
}

const BASE_CONFIG: ServerConfig = {
  url: 'https://fixture.invalid/mcp',
  transport: 'streamable-http',
};

describe('McpClient', () => {
  it('connects with clientInfo = mcp-test-client and {} capabilities', async () => {
    const transport = new ScriptedTransport({
      initialize: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        serverInfo: { name: 'fixture', version: '0.0.0' },
      },
    });

    const client = new McpClient({ transportFactory: () => transport });
    await client.connect(BASE_CONFIG);

    const initMsg = transport.sent.find(
      (m): m is JSONRPCMessage & { method: string; params: { clientInfo: { name: string } } } =>
        'method' in m && m.method === 'initialize',
    );
    expect(initMsg).toBeDefined();
    expect(initMsg?.params.clientInfo.name).toBe('mcp-test-client');
    expect(client.connected).toBe(true);
  });

  it('refuses a second connect while already connected', async () => {
    const transport = new ScriptedTransport({
      initialize: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        serverInfo: { name: 'fixture', version: '0.0.0' },
      },
    });
    const client = new McpClient({ transportFactory: () => transport });
    await client.connect(BASE_CONFIG);
    await expect(client.connect(BASE_CONFIG)).rejects.toThrow(/already connected/);
  });

  it('routes listTools through the SDK', async () => {
    const transport = new ScriptedTransport({
      initialize: {
        protocolVersion: '2025-11-25',
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '0.0.0' },
      },
      'tools/list': {
        tools: [
          {
            name: 'echo',
            description: 'echo input',
            inputSchema: { type: 'object', properties: {} },
          },
        ],
      },
    });
    const client = new McpClient({ transportFactory: () => transport });
    await client.connect(BASE_CONFIG);
    const result = await client.listTools();
    expect(result.tools.map((t) => t.name)).toEqual(['echo']);
  });

  it('emits wire events via the onWire sink', async () => {
    const events: WireEvent[] = [];
    const transport = new ScriptedTransport({
      initialize: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        serverInfo: { name: 'fixture', version: '0.0.0' },
      },
    });
    const client = new McpClient({
      transportFactory: () => transport,
      onWire: (e) => events.push(e),
    });
    await client.connect(BASE_CONFIG);

    // At minimum: outgoing initialize, outgoing initialized notification,
    // incoming initialize response.
    const methods = events
      .filter((e) => 'method' in e.message)
      .map((e) => ({ dir: e.direction, method: (e.message as { method: string }).method }));
    expect(methods).toEqual(
      expect.arrayContaining([
        { dir: 'outgoing', method: 'initialize' },
        { dir: 'outgoing', method: 'notifications/initialized' },
      ]),
    );
    expect(events.some((e) => e.direction === 'incoming')).toBe(true);
  });

  it('survives a tool with an un-compilable outputSchema and warns', async () => {
    // Regression for DEC-024: the SDK eagerly compiles every tool's
    // outputSchema after listTools. A schema Ajv chokes on must NOT take
    // the whole tools list down; it must surface a schema warning and
    // leave the tool in the list (output validation downgraded).
    const warnings: { message: string; schema: unknown }[] = [];
    const transport = new ScriptedTransport({
      initialize: {
        protocolVersion: '2025-11-25',
        capabilities: { tools: {} },
        serverInfo: { name: 'fixture', version: '0.0.0' },
      },
      'tools/list': {
        tools: [
          {
            name: 'good',
            description: 'compiles fine',
            inputSchema: { type: 'object', properties: {} },
            outputSchema: {
              type: 'object',
              properties: { ok: { type: 'boolean' } },
              required: ['ok'],
              additionalProperties: false,
            },
          },
          {
            name: 'broken',
            description: 'output schema is malformed',
            inputSchema: { type: 'object', properties: {} },
            outputSchema: {
              // Top-level type must be "object" (MCP protocol-level
              // Zod check). Inside, a string property carries an
              // invalid regex — `[` is an unterminated char class —
              // which makes Ajv throw at compile time.
              type: 'object',
              properties: { x: { type: 'string', pattern: '[' } },
            },
          },
        ],
      },
    });
    const client = new McpClient({
      transportFactory: () => transport,
      onSchemaWarning: (w) => warnings.push(w),
    });
    await client.connect(BASE_CONFIG);
    const result = await client.listTools();
    expect(result.tools.map((t) => t.name).sort()).toEqual(['broken', 'good']);
    expect(warnings.length).toBeGreaterThanOrEqual(1);
    expect(warnings[0].message).toBeTruthy();
  });

  it('disconnect is idempotent and resets connected flag', async () => {
    const transport = new ScriptedTransport({
      initialize: {
        protocolVersion: '2025-11-25',
        capabilities: {},
        serverInfo: { name: 'fixture', version: '0.0.0' },
      },
    });
    const client = new McpClient({ transportFactory: () => transport });
    await client.connect(BASE_CONFIG);
    await client.disconnect();
    expect(client.connected).toBe(false);
    await expect(client.disconnect()).resolves.toBeUndefined();
  });
});
