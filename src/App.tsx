import { useEffect, useRef } from 'react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import { ConnectionProvider, useConnection } from './state/connection.tsx';
import { LogProvider } from './state/log.tsx';
import { SelectionProvider, useSelection } from './state/selection.tsx';
import { ServersProvider, useServers } from './state/servers.tsx';
import { ThemeProvider, useTheme } from './state/theme.tsx';
import { readLastSelection } from './state/tool-state-persistence.ts';
import { appTheme } from './ui/mantine-theme.ts';
import { Layout } from './ui/layout.tsx';

/**
 * DEC-018 — selection lifecycle on server switch.
 *
 * On `activeId` change we **clear** `selection` so the request panel
 * empties immediately (Costa: "When switching mcp servers, the last
 * form must be cleared too" — v1.1.13). Once the new server's
 * inventory finishes loading, we look up the per-server last-selection
 * pointer (`mcptc:last-selection.<server-id>`) and, if it matches a
 * tool that exists, auto-re-select it. The `RequestPanel` then
 * hydrates its form from the per-tool snapshot — so the user's
 * in-progress work survives a round-trip through another server.
 *
 * Renders nothing — pure side-effect. Mounted inside all four
 * providers so it can read `activeId`, `inventory` / `status`, and
 * call `setSelection`.
 */
function RestoreSelectionOnServerReady() {
  const { activeId } = useServers();
  const { status, inventory } = useConnection();
  const { setSelection } = useSelection();
  // Track the activeId we last cleared on, so we don't clear-and-restore
  // in a loop when the user clicks within the same server.
  const lastClearedRef = useRef<string | null>(null);
  // Restoration is one-shot per (activeId, connect cycle). Once we
  // restore (or decide not to), we set this to activeId and skip until
  // activeId changes.
  const lastRestoredForRef = useRef<string | null>(null);

  // Clear selection on server change.
  useEffect(() => {
    if (lastClearedRef.current === activeId) return;
    lastClearedRef.current = activeId;
    setSelection(null);
    lastRestoredForRef.current = null;
  }, [activeId, setSelection]);

  // Restore once status flips to connected and inventory is non-empty.
  useEffect(() => {
    if (activeId === null) return;
    if (lastRestoredForRef.current === activeId) return;
    if (status.state !== 'connected') return;
    const lastTool = readLastSelection(activeId);
    if (!lastTool) {
      lastRestoredForRef.current = activeId;
      return;
    }
    const tool = (inventory.tools as Array<Record<string, unknown>>).find(
      (t) => t['name'] === lastTool,
    );
    if (!tool) {
      lastRestoredForRef.current = activeId;
      return;
    }
    setSelection({ kind: 'tools', name: lastTool, payload: tool });
    lastRestoredForRef.current = activeId;
  }, [activeId, status, inventory, setSelection]);

  return null;
}

/**
 * Bridges our `ThemeProvider` (which knows the user's preference: dark /
 * light / system) to Mantine's `MantineProvider` colour scheme. Mantine
 * supports its own `defaultColorScheme="auto"` mode, but we already have a
 * persistence-aware ThemeProvider so we keep that and reflect into Mantine.
 */
function MantineBridge({ children }: { children: React.ReactNode }) {
  const { preference } = useTheme();
  // Mantine accepts 'light' | 'dark' | 'auto'. Our 'system' maps to 'auto'
  // so Mantine follows the OS preference; the explicit picks pass through
  // unchanged via `forceColorScheme`.
  //
  // v1.1.10 fix: previously `defaultColorScheme="dark"` was hardcoded, so
  // "system" + an OS that prefers light produced a split-brain — Mantine
  // stayed dark while our CSS `@media (prefers-color-scheme: light)`
  // applied light tokens. Setting the default to "auto" + only forcing
  // when the user picked an explicit scheme keeps both sides aligned on
  // the OS preference.
  const forceColorScheme = preference === 'system' ? undefined : preference;
  return (
    <MantineProvider theme={appTheme} defaultColorScheme="auto" forceColorScheme={forceColorScheme}>
      <ModalsProvider>
        <Notifications position="bottom-right" zIndex={2000} />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <MantineBridge>
        <ServersProvider>
          <LogProvider>
            <ConnectionProvider>
              <SelectionProvider>
                <RestoreSelectionOnServerReady />
                <Layout />
              </SelectionProvider>
            </ConnectionProvider>
          </LogProvider>
        </ServersProvider>
      </MantineBridge>
    </ThemeProvider>
  );
}
