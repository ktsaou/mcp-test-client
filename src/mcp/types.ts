/**
 * Project-local types for our MCP integration.
 *
 * Wire-level JSON-RPC types are re-exported from the SDK where useful;
 * anything else (transport kinds, config shape, log events) lives here.
 */

import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/** Transport kinds we can actually speak in a browser. */
export type TransportKind = 'streamable-http' | 'sse-legacy' | 'websocket';

/** Auth configuration for a server. */
export type ServerAuth =
  | { kind: 'none' }
  | { kind: 'bearer'; token: string }
  | { kind: 'header'; name: string; value: string };

/** A server the user wants to talk to. */
export interface ServerConfig {
  url: string;
  transport: TransportKind | 'auto';
  auth?: ServerAuth;
}

/** Direction of a message on the wire. */
export type WireDirection = 'outgoing' | 'incoming';

/** An event we emit to the UI log when JSON-RPC traffic flows. */
export interface WireEvent {
  direction: WireDirection;
  message: JSONRPCMessage;
  /** Milliseconds since the Unix epoch. */
  timestamp: number;
}

/** Subscriber signature used by the logging transport. */
export type WireEventSink = (event: WireEvent) => void;

/** Re-export the SDK's message shape for downstream use. */
export type { JSONRPCMessage };
