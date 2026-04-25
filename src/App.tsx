import { useEffect } from 'react';
import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import { ConnectionProvider } from './state/connection.tsx';
import { LogProvider } from './state/log.tsx';
import { SelectionProvider, useSelection } from './state/selection.tsx';
import { ServersProvider, useServers } from './state/servers.tsx';
import { ThemeProvider, useTheme } from './state/theme.tsx';
import { appTheme } from './ui/mantine-theme.ts';
import { Layout } from './ui/layout.tsx';

/**
 * Clears the selection (and therefore the request panel's form) whenever
 * the active server changes. Without this, switching from server A to
 * server B left A's tool selected → the form rendered against A's tool
 * schema while B's inventory loaded, which Costa flagged as confusing
 * ("why don't I see any tools? why is the old form still here?").
 *
 * Renders nothing — pure side-effect. Mounted inside both providers so
 * it can read `useServers().activeId` and call `useSelection().setSelection`.
 */
function ClearSelectionOnServerSwitch() {
  const { activeId } = useServers();
  const { setSelection } = useSelection();
  useEffect(() => {
    setSelection(null);
  }, [activeId, setSelection]);
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
                <ClearSelectionOnServerSwitch />
                <Layout />
              </SelectionProvider>
            </ConnectionProvider>
          </LogProvider>
        </ServersProvider>
      </MantineBridge>
    </ThemeProvider>
  );
}
