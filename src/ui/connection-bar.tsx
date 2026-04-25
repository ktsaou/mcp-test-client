import { useRef, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

import { useServers } from '../state/servers.tsx';
import { useConnection, type ConnectionStatus } from '../state/connection.tsx';
import { downloadExport, exportSettings, importSettings } from '../persistence/portability.ts';
import { ThemeToggle } from './theme-toggle.tsx';

/** Gear / settings icon — inline SVG so we don't pull in an icon library. */
function GearIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M9.405 1.05a.78.78 0 0 0-.88-.65l-1.05.16a.78.78 0 0 0-.65.88l.13.84a5.4 5.4 0 0 0-1.18.68L5 2.42a.78.78 0 0 0-1.07.27l-.55.92a.78.78 0 0 0 .27 1.07l.74.45a5.4 5.4 0 0 0 0 1.36l-.74.45a.78.78 0 0 0-.27 1.07l.55.92a.78.78 0 0 0 1.07.27l.78-.45a5.4 5.4 0 0 0 1.18.68l-.13.84a.78.78 0 0 0 .65.88l1.05.16a.78.78 0 0 0 .88-.65l.16-.83a5.4 5.4 0 0 0 1.36 0l.16.83a.78.78 0 0 0 .88.65l1.05-.16a.78.78 0 0 0 .65-.88l-.13-.84a5.4 5.4 0 0 0 1.18-.68l.78.45a.78.78 0 0 0 1.07-.27l.55-.92a.78.78 0 0 0-.27-1.07l-.74-.45a5.4 5.4 0 0 0 0-1.36l.74-.45a.78.78 0 0 0 .27-1.07l-.55-.92a.78.78 0 0 0-1.07-.27l-.78.45a5.4 5.4 0 0 0-1.18-.68l.13-.84a.78.78 0 0 0-.65-.88l-1.05-.16a.78.78 0 0 0-.88.65l-.16.83a5.4 5.4 0 0 0-1.36 0l-.16-.83ZM8 5.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5Z" />
    </svg>
  );
}

/**
 * DEC-021 — settings export / import. Gear icon in the header opens
 * a Menu with Export and Import items. Export writes a download with
 * every `mcptc:*` key, optionally stripping credentials. Import
 * reads a JSON file, validates `version: 1`, and replaces the
 * existing keys.
 */
function SettingsMenu() {
  const [exportOpen, setExportOpen] = useState(false);
  const [includeCreds, setIncludeCreds] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function doExport() {
    const blob = exportSettings({ includeCredentials: includeCreds });
    downloadExport(blob);
    setExportOpen(false);
    notifications.show({
      message: includeCreds
        ? 'Settings exported (with credentials)'
        : 'Settings exported (credentials stripped)',
    });
  }

  async function doImport(file: File) {
    let text: string;
    try {
      text = await file.text();
    } catch {
      notifications.show({ color: 'red', title: 'Import failed', message: 'Could not read file' });
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Import failed',
        message: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
      });
      return;
    }
    const result = importSettings(parsed);
    if (!result.ok) {
      notifications.show({
        color: 'red',
        title: 'Import failed',
        message: result.error ?? 'Unknown error',
      });
      return;
    }
    notifications.show({
      title: 'Settings imported',
      message: result.credentialsStripped
        ? `Wrote ${String(result.keysWritten)} keys. Credentials were stripped on export — re-enter tokens.`
        : `Wrote ${String(result.keysWritten)} keys.`,
    });
    // Reload so every state slice picks up the imported values.
    setTimeout(() => window.location.reload(), 800);
  }

  return (
    <>
      <Menu position="bottom-end" withinPortal>
        <Menu.Target>
          <Tooltip label="Export / Import settings" withinPortal>
            <ActionIcon variant="subtle" size="lg" aria-label="Settings menu">
              <GearIcon />
            </ActionIcon>
          </Tooltip>
        </Menu.Target>
        <Menu.Dropdown>
          <Menu.Label>Settings</Menu.Label>
          <Menu.Item onClick={() => setExportOpen(true)}>Export settings…</Menu.Item>
          <Menu.Item onClick={() => fileInputRef.current?.click()}>Import settings…</Menu.Item>
        </Menu.Dropdown>
      </Menu>

      {/* Hidden file input for the import flow. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.currentTarget.files?.[0];
          e.currentTarget.value = '';
          if (file) void doImport(file);
        }}
      />

      <Modal
        opened={exportOpen}
        onClose={() => setExportOpen(false)}
        title="Export settings"
        size="md"
      >
        <Stack gap="sm">
          <Text size="sm">
            Downloads a JSON file with every <code>mcptc:*</code> key — your servers, layout, theme,
            canned requests, per-tool form state. Import on another browser to round-trip.
          </Text>
          <Checkbox
            checked={includeCreds}
            onChange={(e) => setIncludeCreds(e.currentTarget.checked)}
            label="Include credentials (bearer tokens, custom-header values)"
            description="Default on so the round-trip works without re-typing. Turn off to share the file safely with a colleague."
          />
          {includeCreds ? (
            <Alert color="yellow" variant="light" title="Treat the file like a password">
              The download will contain your saved auth tokens in plaintext. Anyone with the file
              can connect to your servers as you.
            </Alert>
          ) : null}
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={() => setExportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={doExport}>Download</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}

/** GitHub mark, inline so we don't pull in another icon dep. */
function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}

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

      <SettingsMenu />

      <Tooltip label="View source on GitHub" withinPortal>
        <ActionIcon
          component="a"
          href="https://github.com/ktsaou/mcp-test-client"
          target="_blank"
          rel="noopener noreferrer"
          variant="subtle"
          size="lg"
          aria-label="View source on GitHub"
        >
          <GitHubIcon />
        </ActionIcon>
      </Tooltip>

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
