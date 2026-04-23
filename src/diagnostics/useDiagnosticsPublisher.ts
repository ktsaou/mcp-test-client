/**
 * React hook that wires live app state into the diagnostic-bundle publisher.
 *
 * Mount this once — from {@link Layout} — inside all the state providers
 * it depends on. Each render refreshes the closure so {@link snapshotBundle}
 * always returns a bundle built from the current log and connection.
 */

import { useEffect } from 'react';

import { useConnection } from '../state/connection.tsx';
import { useLog } from '../state/log.tsx';
import { useServers } from '../state/servers.tsx';
import { buildDiagnosticBundle } from './build.ts';
import { registerBundleProvider } from './current.ts';
import type { UnredactedServer } from './types.ts';

export function useDiagnosticsPublisher(): void {
  const { entries } = useLog();
  const { status, inventory } = useConnection();
  const { active } = useServers();

  useEffect(() => {
    const server: UnredactedServer | null = active
      ? {
          id: active.id,
          name: active.name,
          url: active.url,
          transport: active.transport,
          auth: active.auth,
        }
      : null;

    return registerBundleProvider(() =>
      buildDiagnosticBundle({
        log: entries,
        connection: {
          status: status.state,
          lastError: status.state === 'error' ? status.error.message : undefined,
          server,
          inventory: {
            tools: inventory.tools.length,
            prompts: inventory.prompts.length,
            resources: inventory.resources.length,
            resourceTemplates: inventory.resourceTemplates.length,
          },
        },
      }),
    );
  }, [entries, status, inventory, active]);
}
