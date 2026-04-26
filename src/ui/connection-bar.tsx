import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Group,
  Loader,
  Menu,
  Modal,
  Popover,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';

import { useLog } from '../state/log.tsx';
import { useServers } from '../state/servers.tsx';
import { useConnection, type ConnectionStatus } from '../state/connection.tsx';
import { useSidebarCollapse } from '../state/sidebar-collapse.tsx';
import { downloadExport, exportSettings, importSettings } from '../persistence/portability.ts';
import { ThemeToggle } from './theme-toggle.tsx';
import { useCommandPalette } from './command-palette.tsx';
import type { JSONRPCMessage } from '../mcp/types.ts';

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

  // DEC-025 — palette verbs delegate to this menu so import/export logic
  // lives in one place.
  useEffect(() => {
    function onPaletteEvent(e: Event) {
      const detail = (e as CustomEvent<{ type?: string }>).detail;
      if (!detail) return;
      if (detail.type === 'export-settings') setExportOpen(true);
      else if (detail.type === 'import-settings') fileInputRef.current?.click();
    }
    window.addEventListener('mcptc:command-palette', onPaletteEvent);
    return () => window.removeEventListener('mcptc:command-palette', onPaletteEvent);
  }, []);

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

/**
 * DEC-020 — inflight activity indicator. Counts outgoing requests
 * that haven't been answered yet (matched by JSON-RPC id) by walking
 * the LogProvider's entries. When the count is > 0 the icon spins
 * and shows a count badge; clicking opens a popover that lists each
 * pending request with its method, target tool name, and elapsed
 * time. Cancel UI is intentionally NOT in v1.1.19 — the harder bit
 * of routing AbortController per request through the SDK is a
 * follow-up. Visibility-only for now matches Costa's "show that
 * something is in progress" call.
 */
function rpcIdOf(msg: JSONRPCMessage): string | number | undefined {
  if ('id' in msg && (typeof msg.id === 'string' || typeof msg.id === 'number')) {
    return msg.id;
  }
  return undefined;
}

function methodOf(msg: JSONRPCMessage): string | undefined {
  if ('method' in msg && typeof msg.method === 'string') return msg.method;
  return undefined;
}

function toolNameFromParams(msg: JSONRPCMessage): string | undefined {
  if (!('params' in msg) || !msg.params || typeof msg.params !== 'object') return undefined;
  const params = msg.params as Record<string, unknown>;
  if (typeof params['name'] === 'string') return params['name'];
  return undefined;
}

interface InflightEntry {
  id: string | number;
  method: string;
  toolName?: string;
  sentAtMs: number;
}

function ActivityIndicator() {
  const { entries } = useLog();
  const [open, setOpen] = useState(false);
  // Recompute the inflight set from the log on every render. With the
  // 500-entry LOG_CAP this is trivially cheap (~500 ops). The
  // alternative — a separate context — would force every wire event
  // through a second listener for the same data we already have.
  const inflight = useMemo<InflightEntry[]>(() => {
    const pending = new Map<string | number, InflightEntry>();
    for (const e of entries) {
      if (e.kind !== 'wire') continue;
      const id = rpcIdOf(e.message);
      if (id === undefined) continue;
      if (e.direction === 'outgoing') {
        const method = methodOf(e.message);
        if (method === undefined) continue; // notifications have no id, skip
        pending.set(id, {
          id,
          method,
          toolName: toolNameFromParams(e.message),
          sentAtMs: e.timestamp,
        });
      } else if (e.direction === 'incoming') {
        // Any incoming with an id is a response — clear the pending entry.
        pending.delete(id);
      }
    }
    return Array.from(pending.values());
  }, [entries]);

  const count = inflight.length;
  const now = Date.now();

  return (
    <Popover opened={open} onChange={setOpen} position="bottom-end" withinPortal width={320}>
      <Popover.Target>
        <Tooltip
          label={
            count === 0
              ? 'No requests in flight'
              : `${count} request${count === 1 ? '' : 's'} in flight`
          }
          withinPortal
        >
          <ActionIcon
            variant="subtle"
            size="lg"
            aria-label={`Activity — ${count} in flight`}
            onClick={() => setOpen((o) => !o)}
            style={{ position: 'relative' }}
          >
            {count > 0 ? (
              <Loader size={16} color="cyan" />
            ) : (
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.4" opacity="0.4" />
              </svg>
            )}
            {count > 0 ? (
              <Badge
                size="xs"
                variant="filled"
                color="cyan"
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  padding: '0 4px',
                  minWidth: 14,
                  height: 14,
                  fontSize: 9,
                }}
              >
                {count}
              </Badge>
            ) : null}
          </ActionIcon>
        </Tooltip>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          <Text size="sm" fw={600}>
            {count === 0 ? 'No activity' : `${count} request${count === 1 ? '' : 's'} in flight`}
          </Text>
          {count === 0 ? (
            <Text size="xs" c="dimmed">
              Outgoing JSON-RPC requests show up here while waiting for a response.
            </Text>
          ) : (
            <Stack gap={4}>
              {inflight.map((it) => {
                const elapsed = Math.max(0, now - it.sentAtMs);
                const elapsedLabel =
                  elapsed < 1000 ? `${elapsed} ms` : `${(elapsed / 1000).toFixed(1)} s`;
                return (
                  <Group key={String(it.id)} justify="space-between" gap="xs" wrap="nowrap">
                    <Box style={{ minWidth: 0, flex: 1 }}>
                      <Text size="xs" fw={500} truncate="end">
                        {it.method}
                        {it.toolName ? (
                          <Text component="span" c="dimmed">
                            {' · '}
                            {it.toolName}
                          </Text>
                        ) : null}
                      </Text>
                    </Box>
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {elapsedLabel}
                    </Text>
                  </Group>
                );
              })}
            </Stack>
          )}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

/**
 * DEC-027 — sidebar collapse toggle. A visible affordance for the
 * `s` shortcut, so single-letter shortcut WCAG compliance has a
 * traditional UI mechanism alongside the keybinding. Only rendered
 * on desktop layouts; on mobile the sidebar is a Drawer reached via
 * the hamburger and `s` is a no-op.
 */
function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true">
      <rect
        x="1.5"
        y="2.5"
        width="13"
        height="11"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <line
        x1="6"
        y1="2.5"
        x2="6"
        y2="13.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeOpacity={collapsed ? 0.35 : 1}
      />
    </svg>
  );
}

function SidebarToggle() {
  const { collapsed, toggleCollapsed } = useSidebarCollapse();
  return (
    <Tooltip label={`${collapsed ? 'Show' : 'Hide'} the server sidebar (s)`} withinPortal>
      <ActionIcon
        variant="subtle"
        size="lg"
        aria-label={collapsed ? 'Show sidebar' : 'Hide sidebar'}
        aria-pressed={collapsed}
        onClick={() => toggleCollapsed()}
      >
        <SidebarToggleIcon collapsed={collapsed} />
      </ActionIcon>
    </Tooltip>
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
  const { appendSystem } = useLog();
  // useMediaQuery returns undefined on first render before the listener is
  // wired up; treat that as "not compact" so the desktop layout is the SSR /
  // first-paint default.
  const compact = useMediaQuery(`(max-width: ${COMPACT_HEADER_BREAKPOINT_PX - 1}px)`) ?? false;

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

  // DEC-029 — Abort during a `connecting` state reuses the same
  // disconnect() path (the v1.1.20 epoch bump cancels the in-flight
  // handshake and resets status to `idle`). No toast — the user did
  // not "disconnect", they cancelled. A neutral system-log entry
  // documents the cancellation in the wire pane.
  async function handleAbort() {
    try {
      await disconnect();
      appendSystem('info', 'Connect cancelled');
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Abort failed',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // DEC-029 — tristate primary action. The button is always present;
  // its label, color, and click handler flip on `status.state`. The
  // Activity icon (DEC-020) remains the only spinner during the
  // handshake — it tracks per-request inflight, not lifecycle.
  const targetName = active ? active.name || active.url : '';
  let primaryAction: {
    label: string;
    tooltip: string;
    variant: 'default' | 'filled';
    color?: string;
    disabled: boolean;
    onClick: () => void;
  };
  switch (status.state) {
    case 'connecting':
      primaryAction = {
        label: 'Abort',
        tooltip: 'Cancel the in-flight connection (handshake will be aborted)',
        variant: 'filled',
        color: 'red',
        disabled: false,
        onClick: () => {
          void handleAbort();
        },
      };
      break;
    case 'connected':
      primaryAction = {
        label: 'Disconnect',
        tooltip: `Disconnect from ${targetName}`,
        variant: 'default',
        disabled: false,
        onClick: () => {
          void handleDisconnect();
        },
      };
      break;
    case 'error':
      primaryAction = {
        label: 'Reconnect',
        tooltip: active ? `Try connecting to ${targetName} again` : 'Pick a server first',
        variant: 'filled',
        disabled: !active,
        onClick: () => {
          void handleConnect();
        },
      };
      break;
    case 'idle':
    default:
      primaryAction = {
        label: 'Connect',
        tooltip: active ? `Connect to ${targetName}` : 'Pick a server first',
        variant: 'filled',
        disabled: !active,
        onClick: () => {
          void handleConnect();
        },
      };
      break;
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

      <PaletteAnchor />

      <StatusBadge status={status} />

      <Tooltip label={primaryAction.tooltip} withinPortal>
        {/* Wrap the Button in a span so the tooltip target stays a real
            DOM node when the button is disabled — Mantine drops pointer
            events on disabled <button> and the tooltip would never fire
            for the "Pick a server first" idle-no-active state. */}
        <span style={{ display: 'inline-flex' }}>
          <Button
            variant={primaryAction.variant}
            size="sm"
            color={primaryAction.color}
            disabled={primaryAction.disabled}
            onClick={primaryAction.onClick}
          >
            {primaryAction.label}
          </Button>
        </span>
      </Tooltip>

      <ActivityIndicator />

      {compact ? null : <SidebarToggle />}

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

/**
 * DEC-025 — visible "search" affordance that opens the command
 * palette. Click or focus opens the palette so newcomers stumble
 * into Cmd+K without needing docs. Typing inside the anchor seeds
 * the palette query so keys are not lost during the focus hop.
 */
function PaletteAnchor() {
  const { openPalette } = useCommandPalette();
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  const shortcut = isMac ? '⌘K' : 'Ctrl+K';
  return (
    <button
      type="button"
      className="cmd-anchor"
      aria-label="Open command palette"
      onClick={() => openPalette()}
      onFocus={(e) => {
        // Browser focus rings call this on programmatic focus too — guard
        // against an open-loop where openPalette() steals focus, which
        // would re-fire onFocus on the anchor when the modal closes.
        if (e.currentTarget === document.activeElement) openPalette();
      }}
      onKeyDown={(e) => {
        // If the user starts typing inside the anchor (rather than
        // clicking it first) we want the keys to land in the palette.
        // The single-letter check excludes navigation keys; the palette's
        // openPalette accepts a prefill so the typed character is not
        // lost on the focus hop.
        if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          openPalette(e.key);
        }
      }}
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        className="cmd-anchor__icon"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
        <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      </svg>
      <span className="cmd-anchor__label">Search servers, tools, actions…</span>
      <span className="cmd-anchor__kbd">{shortcut}</span>
    </button>
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
