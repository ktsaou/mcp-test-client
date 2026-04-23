/**
 * URL → MCP Transport factory.
 *
 * Selection rule:
 *   - `wss://` / `ws://`     → WebSocket (custom transport; see specs/websocket-transport.md)
 *   - explicit `sse-legacy`  → SSE (for 2024-11-05 servers still shipping the old transport)
 *   - anything HTTP(S) else  → Streamable HTTP (the current spec)
 *   - `stdio://...` or any other scheme → rejected with a clear error
 *
 * We intentionally do NOT import from `@modelcontextprotocol/sdk/client/stdio.js`;
 * that module pulls Node-only deps (cross-spawn, node:process) and would inflate
 * the browser bundle. The eslint rule `no-restricted-imports` guards against it.
 */

import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

import type { ServerAuth, ServerConfig, TransportKind } from './types.ts';

export class UnsupportedTransportError extends Error {
  constructor(
    message: string,
    readonly url: string,
  ) {
    super(message);
    this.name = 'UnsupportedTransportError';
  }
}

/**
 * Decide which transport kind to use for a given URL when the config says 'auto'.
 */
export function resolveTransportKind(
  url: string,
  requested: TransportKind | 'auto',
): TransportKind {
  if (requested !== 'auto') return requested;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new UnsupportedTransportError(`Not a valid URL: ${url}`, url);
  }

  const scheme = parsed.protocol;

  if (scheme === 'ws:' || scheme === 'wss:') return 'websocket';
  if (scheme === 'http:' || scheme === 'https:') return 'streamable-http';

  throw new UnsupportedTransportError(
    `Unsupported URL scheme '${scheme}'. Use https://, wss://, or (for local dev) http:// / ws://.`,
    url,
  );
}

/**
 * Turn an auth config into headers we can pass via `requestInit`.
 * Returns `undefined` when no headers apply.
 */
function authHeaders(auth: ServerAuth | undefined): Record<string, string> | undefined {
  if (!auth || auth.kind === 'none') return undefined;
  if (auth.kind === 'bearer') return { Authorization: `Bearer ${auth.token}` };
  return { [auth.name]: auth.value };
}

/**
 * Build a {@link Transport} from a {@link ServerConfig}. Callers should wrap
 * the result with the logging decorator (see `logging-transport.ts`) so wire
 * traffic reaches the UI log.
 */
export function createTransport(config: ServerConfig): Transport {
  const kind = resolveTransportKind(config.url, config.transport);
  const url = new URL(config.url);
  const headers = authHeaders(config.auth);

  switch (kind) {
    case 'streamable-http':
      return new StreamableHTTPClientTransport(
        url,
        headers ? { requestInit: { headers } } : undefined,
      );

    case 'sse-legacy':
      return new SSEClientTransport(url, headers ? { requestInit: { headers } } : undefined);

    case 'websocket':
      // Browser WebSocket API cannot set Authorization on the Upgrade request.
      // Servers needing auth over WS must accept cookie-based or in-band auth.
      // See specs/websocket-transport.md §2 — "Auth".
      return new WebSocketClientTransport(url);
  }
}
