/**
 * Thin wrapper around the SDK Client that enforces our defaults (clientInfo,
 * declared-capabilities = {}), wires the logging transport, and exposes the
 * handful of RPC methods our UI needs.
 *
 * High-level methods here are deliberately a small surface. Anything exotic
 * can be sent via the raw JSON-RPC editor through the underlying Protocol
 * `request()` method on the SDK Client — we expose that too, as `request()`.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { z } from 'zod';

import { LoggingTransport } from './logging-transport.ts';
import { TolerantValidator, type SchemaWarningSink } from './tolerant-validator.ts';
import type { ServerConfig, WireEventSink } from './types.ts';
import { createTransport } from './transports.ts';

/** Build-time version stamp from package.json (Vite `define`). */
declare const __APP_VERSION__: string;
const RUNTIME_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0 ? __APP_VERSION__ : 'dev';

/** Our single client identity. */
const CLIENT_INFO = {
  name: 'mcp-test-client',
  version: RUNTIME_VERSION,
} as const;

export interface McpClientOptions {
  /** Sink that receives every JSON-RPC message flowing over the wire. */
  onWire?: WireEventSink;
  /**
   * Sink that receives a notice when a tool's `outputSchema` fails to
   * compile. The SDK eagerly compiles every output schema after
   * `tools/list`; without this guard, one bad schema would block the
   * whole tools list. See DEC-024.
   */
  onSchemaWarning?: SchemaWarningSink;
  /**
   * Override the SDK Client construction. Intended for tests that need to
   * inject a pre-built Client (e.g. with a mock Protocol); production code
   * should not use this.
   */
  clientFactory?: () => Client;
  /**
   * Override transport construction. Intended for tests that want to
   * substitute a mock Transport. Production code should leave this unset;
   * {@link createTransport} is the default.
   */
  transportFactory?: (config: ServerConfig) => Transport;
}

export class McpClient {
  #sdk: Client;
  #transport: Transport | null = null;
  #onWire: WireEventSink | undefined;
  #transportFactory: (config: ServerConfig) => Transport;

  constructor(options: McpClientOptions = {}) {
    this.#sdk =
      options.clientFactory?.() ??
      new Client(CLIENT_INFO, {
        capabilities: {},
        jsonSchemaValidator: new TolerantValidator(options.onSchemaWarning ?? (() => undefined)),
      });
    this.#onWire = options.onWire;
    this.#transportFactory = options.transportFactory ?? createTransport;
  }

  /** `true` once connected and initialize has succeeded. */
  get connected(): boolean {
    return this.#transport !== null;
  }

  /** The session id assigned by the server (Streamable HTTP only). */
  get sessionId(): string | undefined {
    return this.#transport?.sessionId;
  }

  async connect(config: ServerConfig): Promise<void> {
    if (this.#transport) {
      throw new Error('already connected; call disconnect() first');
    }
    const raw = this.#transportFactory(config);
    const transport = this.#onWire ? new LoggingTransport(raw, this.#onWire) : raw;
    await this.#sdk.connect(transport);
    this.#transport = transport;
  }

  async disconnect(): Promise<void> {
    if (!this.#transport) return;
    try {
      await this.#sdk.close();
    } finally {
      this.#transport = null;
    }
  }

  /** List tools exposed by the server. */
  listTools() {
    return this.#sdk.listTools();
  }

  /** Call a tool by name. */
  callTool(name: string, args?: Record<string, unknown>) {
    return this.#sdk.callTool({ name, arguments: args });
  }

  listPrompts() {
    return this.#sdk.listPrompts();
  }

  getPrompt(name: string, args?: Record<string, string>) {
    return this.#sdk.getPrompt({ name, arguments: args });
  }

  listResources() {
    return this.#sdk.listResources();
  }

  listResourceTemplates() {
    return this.#sdk.listResourceTemplates();
  }

  readResource(uri: string) {
    return this.#sdk.readResource({ uri });
  }

  ping() {
    return this.#sdk.ping();
  }

  /**
   * Escape hatch for the raw-JSON-RPC editor: send any request and wait for
   * any shape of result. We accept whatever the server returns — validation
   * is the user's responsibility when they use the raw editor.
   */
  request(method: string, params?: Record<string, unknown>): Promise<unknown> {
    return this.#sdk.request({ method, params }, z.unknown());
  }
}

export { CLIENT_INFO };
