import { ConnectionProvider } from './state/connection.tsx';
import { LogProvider } from './state/log.tsx';
import { ServersProvider } from './state/servers.tsx';
import { ThemeProvider } from './state/theme.tsx';
import { Layout } from './ui/layout.tsx';

export function App() {
  return (
    <ThemeProvider>
      <ServersProvider>
        <LogProvider>
          <ConnectionProvider>
            <Layout />
          </ConnectionProvider>
        </LogProvider>
      </ServersProvider>
    </ThemeProvider>
  );
}
