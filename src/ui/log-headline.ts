/**
 * Pure functions that derive the bold method-summary headline shown for every
 * log entry (DEC-012, item 5). Kept side-effect-free and React-free so they
 * can be unit-tested without a DOM.
 *
 * The discriminator picked depends on the JSON-RPC `method`:
 *   - `tools/call`        → params.name
 *   - `prompts/get`       → params.name
 *   - `resources/read`    → params.uri
 *   - everything else     → no discriminator (just the method)
 *
 * For response messages (no `method`) the caller pairs the response with
 * its originating request by `id` and re-uses the request's headline.
 */

import type { JSONRPCMessage } from '../mcp/types.ts';

export interface Headline {
  /** Method name (`tools/call`, `prompts/get`, …). `null` for orphan responses. */
  method: string | null;
  /** Discriminator (tool name, resource URI…). Empty string when none. */
  discriminator: string;
  /** Whether this entry represents an error response. */
  isError: boolean;
}

/** Methods that take a `params.name` discriminator. */
const NAME_METHODS = new Set(['tools/call', 'prompts/get']);
/** Methods that take a `params.uri` discriminator. */
const URI_METHODS = new Set(['resources/read', 'resources/subscribe', 'resources/unsubscribe']);

/**
 * Derive the headline for a request/notification message (one with a `method`).
 */
export function headlineForRequest(message: JSONRPCMessage): Headline {
  if (!('method' in message) || typeof message.method !== 'string') {
    return { method: null, discriminator: '', isError: false };
  }
  const method = message.method;
  const params = 'params' in message ? message.params : undefined;
  let discriminator = '';
  const lookup = (key: string): string | undefined => {
    if (params && typeof params === 'object') {
      const v = (params as Record<string, unknown>)[key];
      return typeof v === 'string' ? v : undefined;
    }
    return undefined;
  };
  if (NAME_METHODS.has(method)) {
    const name = lookup('name');
    if (name !== undefined) discriminator = name;
  } else if (URI_METHODS.has(method)) {
    const uri = lookup('uri');
    if (uri !== undefined) discriminator = uri;
  }
  return { method, discriminator, isError: false };
}

/**
 * Derive the headline for a response message. Falls back to a generic
 * `response` label if no paired request was found.
 */
export function headlineForResponse(
  message: JSONRPCMessage,
  paired: JSONRPCMessage | undefined,
): Headline {
  const isError = 'error' in message && message.error !== undefined;
  if (paired) {
    const base = headlineForRequest(paired);
    return { ...base, isError };
  }
  return { method: null, discriminator: '', isError };
}

/** Render the headline as a plain string `method · discriminator (error)?`. */
export function formatHeadline(h: Headline): string {
  if (h.method === null) {
    return h.isError ? 'response (error)' : 'response';
  }
  const base = h.discriminator ? `${h.method} · ${h.discriminator}` : h.method;
  return h.isError ? `${base} (error)` : base;
}

/**
 * Returns the JSON-RPC `id` of any request/response message, or `undefined`
 * for notifications (which carry no id).
 */
export function rpcId(message: JSONRPCMessage): string | number | undefined {
  if ('id' in message && (typeof message.id === 'string' || typeof message.id === 'number')) {
    return message.id;
  }
  return undefined;
}

/**
 * `true` when the message is a request (has both `method` and `id`).
 * Notifications (have `method`, no `id`) are excluded — they don't expect
 * a response to pair with.
 */
export function isRequest(message: JSONRPCMessage): boolean {
  return (
    'method' in message &&
    typeof message.method === 'string' &&
    'id' in message &&
    rpcId(message) !== undefined
  );
}

/**
 * `true` when the message is a response (no `method`, has `id`).
 */
export function isResponse(message: JSONRPCMessage): boolean {
  return !('method' in message) && rpcId(message) !== undefined;
}

/**
 * `true` when the message is a notification (has `method`, no `id`).
 */
export function isNotification(message: JSONRPCMessage): boolean {
  return 'method' in message && typeof message.method === 'string' && rpcId(message) === undefined;
}
