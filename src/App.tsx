import { MantineProvider } from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';

import { ConnectionProvider } from './state/connection.tsx';
import { LogProvider } from './state/log.tsx';
import { ServersProvider } from './state/servers.tsx';
import { ThemeProvider, useTheme } from './state/theme.tsx';
import { appTheme } from './ui/mantine-theme.ts';
import { Layout } from './ui/layout.tsx';

/**
 * Bridges our `ThemeProvider` (which knows the user's preference: dark /
 * light / system) to Mantine's `MantineProvider` colour scheme. Mantine
 * supports its own `defaultColorScheme="auto"` mode, but we already have a
 * persistence-aware ThemeProvider so we keep that and reflect into Mantine.
 */
function MantineBridge({ children }: { children: React.ReactNode }) {
  const { preference } = useTheme();
  // Mantine accepts 'light' | 'dark' | 'auto'; our 'system' maps to 'auto'.
  const forceColorScheme = preference === 'system' ? undefined : preference;
  return (
    <MantineProvider theme={appTheme} defaultColorScheme="dark" forceColorScheme={forceColorScheme}>
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
              <Layout />
            </ConnectionProvider>
          </LogProvider>
        </ServersProvider>
      </MantineBridge>
    </ThemeProvider>
  );
}
