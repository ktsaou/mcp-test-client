/**
 * Assemble a {@link DiagnosticBundle} from the current app state.
 *
 * The bundle is plain JSON — structurally stable so agents and humans can
 * read a pasted blob and reconstruct what happened. See
 * `docs/reporting-bugs.md` for the user-facing flow.
 */

import { redactServer } from './redact.ts';
import {
  BUNDLE_VERSION,
  type BundleInput,
  type ConnectionSnapshot,
  type DiagnosticBundle,
  type RedactedLogEntry,
} from './types.ts';
import type { LogEntry } from '../state/log.tsx';

/** Injected at build time from package.json version. */
declare const __APP_VERSION__: string;

function readEnvironment(): DiagnosticBundle['environment'] {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      userAgent: '',
      platform: null,
      language: null,
      timezone: null,
      viewport: null,
    };
  }

  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    timezone = null;
  }

  const platform =
    'userAgentData' in navigator && navigator.userAgentData
      ? ((navigator.userAgentData as { platform?: string }).platform ?? null)
      : ((navigator as unknown as { platform?: string }).platform ?? null);

  return {
    userAgent: navigator.userAgent,
    platform,
    language: navigator.language ?? null,
    timezone,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
  };
}

function redactLog(entries: LogEntry[]): RedactedLogEntry[] {
  return entries.map((entry) => {
    if (entry.kind === 'system') {
      return {
        kind: 'system',
        id: entry.id,
        level: entry.level,
        timestamp: entry.timestamp,
        text: entry.text,
      };
    }
    return {
      kind: 'wire',
      id: entry.id,
      direction: entry.direction,
      timestamp: entry.timestamp,
      message: entry.message,
    };
  });
}

function buildConnection(input: BundleInput['connection']): ConnectionSnapshot | null {
  if (!input) return null;
  return {
    status: input.status,
    lastError: input.lastError,
    server: input.server ? redactServer(input.server) : null,
    inventory: input.inventory,
  };
}

export function buildDiagnosticBundle(input: BundleInput): DiagnosticBundle {
  const appVersion =
    typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0 ? __APP_VERSION__ : 'unknown';

  return {
    bundleVersion: BUNDLE_VERSION,
    tool: 'mcp-test-client',
    appVersion,
    capturedAt: new Date().toISOString(),
    environment: readEnvironment(),
    connection: buildConnection(input.connection),
    log: redactLog(input.log),
    note: input.note,
  };
}

/** Render a bundle as a pretty-printed JSON string for paste. */
export function bundleToJson(bundle: DiagnosticBundle): string {
  return JSON.stringify(bundle, null, 2);
}
