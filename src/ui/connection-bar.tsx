import type { ReactNode } from 'react';
import { Badge, Box, Button, Group, Text, Tooltip } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

import { useServers } from '../state/servers.tsx';
import { useConnection, type ConnectionStatus } from '../state/connection.tsx';
import { ThemeToggle } from './theme-toggle.tsx';

// Build-time stamps so users can verify which version they're running.
// Costa flagged the need after a deployment-vs-code mismatch in v1.1.3.
// `declare` lines mirror the project's existing pattern in
// src/diagnostics/build.ts — global.d.ts isn't part of every tsconfig
// project ref, so each consumer redeclares.
declare const __APP_VERSION__: string;
declare const __GIT_SHA__: string;
declare const __BUILD_TIME__: string;
const APP_VERSION =
  typeof __APP_VERSION__ === 'string' && __APP_VERSION__.length > 0 ? __APP_VERSION__ : 'dev';
const GIT_SHA = typeof __GIT_SHA__ === 'string' && __GIT_SHA__.length > 0 ? __GIT_SHA__ : 'unknown';
const BUILD_TIME =
  typeof __BUILD_TIME__ === 'string' && __BUILD_TIME__.length > 0 ? __BUILD_TIME__ : 'unknown';

interface ConnectionBarProps {
  /**
   * Optional element rendered at the leading edge of the bar, before the
   * brand. Used by the mobile layout to host the sidebar drawer hamburger.
   */
  leftSlot?: ReactNode;
}

/**
 * Below this width we drop the brand title and the "Active: …" subtitle so the
 * remaining controls (burger, status pill, primary action, theme toggle) stay
 * on a single row. The active server name is still discoverable from the
 * status pill tooltip and the drawer header.
 */
const COMPACT_HEADER_BREAKPOINT_PX = 480;

export function ConnectionBar({ leftSlot }: ConnectionBarProps = {}) {
  const { active, markUsed } = useServers();
  const { status, connect, disconnect } = useConnection();
  // useMediaQuery returns undefined on first render before the listener is
  // wired up; treat that as "not compact" so the desktop layout is the SSR /
  // first-paint default.
  const compact = useMediaQuery(`(max-width: ${COMPACT_HEADER_BREAKPOINT_PX - 1}px)`) ?? false;

  const busy = status.state === 'connecting';
  const connected = status.state === 'connected';

  async function handleConnect() {
    if (!active) return;
    try {
      const outcome = await connect(active);
      // Only fire the success toast on a real handshake completion.
      // Until v1.1.11 this branch fired even when the connect timed
      // out, because connect() resolved (didn't re-throw) and the
      // success path always ran — Costa: "On timeout, the toast still
      // says 'connected to …' although the logs show failure".
      if (outcome === 'connected') {
        markUsed(active.id);
        notifications.show({
          message: `Connected to ${active.name || active.url}`,
        });
      }
      // 'superseded' = a newer connect() to a different server cancelled
      // ours mid-flight. Stay silent; the newer attempt owns the toast.
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
      gap={compact ? 'xs' : 'md'}
      align="center"
      // wrap="nowrap" is critical: at < 480 px the previous wrap="wrap"
      // pushed Connect / theme-toggle onto a second row that physically
      // overlaid the mobile tab strip below the header (DEC-011 F1).
      wrap="nowrap"
      style={{
        borderBottom: '1px solid var(--mantine-color-default-border)',
        // Connection bar gets the "chrome" shade alongside the sidebar so
        // the top frame reads as one continuous chrome layer, with the
        // main content (Inspector / RequestPanel / Log) lighter beneath.
        // Matches VS Code Dark Modern titleBar.activeBackground.
        background: 'var(--color-bg-raised)',
        flexShrink: 0,
      }}
    >
      {leftSlot}
      {compact ? (
        // Spacer keeps the status pill / primary action right-aligned the
        // same way the brand+active block does on desktop.
        <Box style={{ flex: 1, minWidth: 0 }} />
      ) : (
        <>
          <Group gap={6} wrap="nowrap" align="baseline">
            <Text fw={600} size="md" style={{ letterSpacing: '0.02em' }}>
              MCP Test Client
            </Text>
            <Tooltip label={`Built ${BUILD_TIME} from ${GIT_SHA}`} withinPortal>
              <Text size="xs" c="dimmed" style={{ fontVariantNumeric: 'tabular-nums' }}>
                v{APP_VERSION} · {GIT_SHA}
              </Text>
            </Tooltip>
          </Group>

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
        </>
      )}

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
