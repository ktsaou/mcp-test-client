/**
 * Diagnostic bundle — the payload users capture when reporting a bug or
 * asking for help with an MCP server. Stable, documented shape so humans
 * and agents can triage from a paste.
 *
 * Redaction happens at bundle-build time. Bearer tokens and header secrets
 * are replaced with a placeholder that preserves the original length only.
 * Response payloads are *not* redacted — callers should review before
 * sharing; see `docs/reporting-bugs.md`.
 */

import type { LogEntry } from '../state/log.tsx';
import type { JSONRPCMessage, TransportKind } from '../mcp/types.ts';

/** Bundle version — bump when the shape changes in a non-backwards-compatible way. */
export const BUNDLE_VERSION = 1;

export interface DiagnosticBundle {
  bundleVersion: typeof BUNDLE_VERSION;
  tool: 'mcp-test-client';
  /** App version (from package.json), injected at build time. */
  appVersion: string;
  /** ISO 8601, when the bundle was produced. */
  capturedAt: string;
  environment: {
    userAgent: string;
    platform: string | null;
    language: string | null;
    timezone: string | null;
    viewport: { width: number; height: number } | null;
  };
  connection: ConnectionSnapshot | null;
  /** Wire events + system messages as captured by LogProvider. */
  log: RedactedLogEntry[];
  /** Simple summary of what the user told the client to do, if known. */
  note?: string;
}

export interface ConnectionSnapshot {
  status: 'idle' | 'connecting' | 'connected' | 'error';
  /** The most recent error message, if any. Already a plain string. */
  lastError?: string;
  /** Server config with credentials redacted. */
  server: RedactedServer | null;
  /** Inventory sizes only — not the full schemas, which can be enormous. */
  inventory?: {
    tools: number;
    prompts: number;
    resources: number;
    resourceTemplates: number;
  };
}

export interface RedactedServer {
  id: string;
  name: string;
  url: string;
  transport: TransportKind | 'auto';
  auth:
    | { kind: 'none' }
    | { kind: 'bearer'; tokenLength: number; tokenPreview: string }
    | { kind: 'header'; name: string; valueLength: number; valuePreview: string };
}

export type RedactedLogEntry =
  | {
      kind: 'wire';
      id: number;
      direction: 'outgoing' | 'incoming';
      timestamp: number;
      message: JSONRPCMessage;
    }
  | {
      kind: 'system';
      id: number;
      level: 'info' | 'warn' | 'error';
      timestamp: number;
      text: string;
    };

/** Input shape accepted by {@link buildDiagnosticBundle}. */
export interface BundleInput {
  log: LogEntry[];
  connection: {
    status: 'idle' | 'connecting' | 'connected' | 'error';
    lastError?: string;
    server: UnredactedServer | null;
    inventory?: ConnectionSnapshot['inventory'];
  } | null;
  note?: string;
}

export interface UnredactedServer {
  id: string;
  name: string;
  url: string;
  transport: TransportKind | 'auto';
  auth?:
    | { kind: 'none' }
    | { kind: 'bearer'; token: string }
    | { kind: 'header'; name: string; value: string };
}
