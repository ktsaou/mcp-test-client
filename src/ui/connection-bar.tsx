import { Badge, Box, Button, Group, Text, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { useServers } from '../state/servers.tsx';
import { useConnection, type ConnectionStatus } from '../state/connection.tsx';
import { ThemeToggle } from './theme-toggle.tsx';

export function ConnectionBar() {
  const { active, markUsed } = useServers();
  const { status, connect, disconnect } = useConnection();

  const busy = status.state === 'connecting';
  const connected = status.state === 'connected';

  async function handleConnect() {
    if (!active) return;
    try {
      await connect(active);
      markUsed(active.id);
      notifications.show({
        message: `Connected to ${active.name || active.url}`,
      });
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Connect failed',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  async function handleDisconnect() {
    try {
      await disconnect();
      notifications.show({ message: 'Disconnected' });
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Disconnect failed',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return (
    <Group
      h={56}
      px="md"
      gap="md"
      align="center"
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
        background: 'var(--mantine-color-body)',
        flexShrink: 0,
      }}
    >
      <Text fw={600} size="md" style={{ letterSpacing: '0.02em' }}>
        MCP Test Client
      </Text>

      <Box style={{ flex: 1, minWidth: 0 }}>
        {active ? (
          <Group gap={6} wrap="nowrap" c="dimmed">
            <Text size="sm" style={{ whiteSpace: 'nowrap' }}>
              Active:
            </Text>
            <Tooltip label={active.url} withinPortal>
              <Text size="sm" truncate="end" style={{ minWidth: 0 }}>
                {active.name || active.url}
              </Text>
            </Tooltip>
          </Group>
        ) : (
          <Text size="sm" c="dimmed">
            Select or add a server in the sidebar.
          </Text>
        )}
      </Box>

      <StatusBadge status={status} />

      {connected ? (
        <Tooltip label="Disconnect from this server" withinPortal>
          <Button
            variant="default"
            size="sm"
            onClick={() => {
              void handleDisconnect();
            }}
          >
            Disconnect
          </Button>
        </Tooltip>
      ) : (
        <Tooltip
          label={active ? `Connect to ${active.name || active.url}` : 'Pick a server first'}
          withinPortal
        >
          <Button
            variant="filled"
            size="sm"
            disabled={!active}
            loading={busy}
            onClick={() => {
              void handleConnect();
            }}
          >
            Connect
          </Button>
        </Tooltip>
      )}

      <ThemeToggle />
    </Group>
  );
}

function StatusBadge({ status }: { status: ConnectionStatus }) {
  switch (status.state) {
    case 'idle':
      return (
        <Tooltip label="Not connected to any server" withinPortal>
          <Badge variant="light" color="gray" size="lg">
            Idle
          </Badge>
        </Tooltip>
      );
    case 'connecting':
      return (
        <Tooltip label="Negotiating with the server" withinPortal>
          <Badge variant="light" color="yellow" size="lg">
            Connecting
          </Badge>
        </Tooltip>
      );
    case 'connected':
      return (
        <Tooltip label="MCP session is active" withinPortal>
          <Badge
            variant="light"
            color="green"
            size="lg"
            // Keep `.pill--ok` so the existing e2e selector still matches.
            classNames={{ root: 'pill--ok' }}
          >
            Connected
          </Badge>
        </Tooltip>
      );
    case 'error':
      return (
        <Tooltip label={status.error.message} withinPortal multiline w={320}>
          <Badge variant="light" color="red" size="lg">
            Error
          </Badge>
        </Tooltip>
      );
  }
}
