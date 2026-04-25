import { useEffect, useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  Modal,
  NavLink,
  Select,
  Stack,
  Text,
  TextInput,
  PasswordInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

import { loadCatalog } from '../catalog/loader.ts';
import type { CatalogServer } from '../catalog/types.ts';
import { useConnection } from '../state/connection.tsx';
import { useServers } from '../state/servers.tsx';
import type { ServerEntry } from '../persistence/schema.ts';
import type { TransportKind } from '../mcp/types.ts';

/**
 * Pre-fill payload for `<ServerModal mode="add">` — used by the
 * URL-driven add-server flow (DEC-016 #3) so a deep-link from a server
 * operator's docs lands in the modal with URL / name / transport / auth
 * already populated.
 *
 * Credentials are deliberately NOT in the prefill: tokens never travel
 * in URLs maintainers publish.
 */
interface AddPrefill {
  url: string;
  name?: string;
  transport?: TransportKind | 'auto';
  authKind?: 'none' | 'bearer' | 'header';
  authHeaderName?: string;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M11.5 2.5 13.5 4.5 5 13H3v-2L11.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
      <path
        d="M3 4h10M6 4V2.5h4V4M4.5 4l.5 9h6l.5-9M7 7v4M9 7v4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ServerPicker() {
  const { servers, activeId, setActive, markUsed, remove } = useServers();
  const { connect } = useConnection();
  const [modal, setModal] = useState<
    { mode: 'add'; prefill?: AddPrefill } | { mode: 'edit'; id: string } | null
  >(null);

  // DEC-016 #3 — URL-driven add-server. On first paint, parse
  // `?add=<url>&name=&transport=&auth=&auth_header_name=` from the
  // query string. If the URL matches a saved server, select + connect
  // (the user already consented when they saved it). If new, open the
  // modal pre-filled. Credentials are never read from the URL.
  const urlParamsConsumedRef = useRef(false);
  // Capture servers in a ref so the effect doesn't re-fire when the
  // list mutates (e.g. ServerModal's add() updates servers).
  const serversRef = useRef(servers);
  serversRef.current = servers;
  useEffect(() => {
    if (urlParamsConsumedRef.current) return;
    urlParamsConsumedRef.current = true;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const addUrl = params.get('add');
    if (!addUrl) return;
    try {
      new URL(addUrl);
    } catch {
      return;
    }
    const transportRaw = params.get('transport');
    const transport: TransportKind | 'auto' | undefined =
      transportRaw === 'auto' ||
      transportRaw === 'streamable-http' ||
      transportRaw === 'sse-legacy' ||
      transportRaw === 'websocket'
        ? transportRaw
        : undefined;
    const authRaw = params.get('auth');
    const authKind: 'none' | 'bearer' | 'header' | undefined =
      authRaw === 'none' || authRaw === 'bearer' || authRaw === 'header' ? authRaw : undefined;
    const name = params.get('name');
    const authHeaderName = params.get('auth_header_name');

    const existing = serversRef.current.find((s) => s.url === addUrl);
    if (existing) {
      void handleSelectServer(existing);
    } else {
      setModal({
        mode: 'add',
        prefill: {
          url: addUrl,
          ...(name !== null ? { name } : {}),
          ...(transport !== undefined ? { transport } : {}),
          ...(authKind !== undefined ? { authKind } : {}),
          ...(authHeaderName !== null ? { authHeaderName } : {}),
        },
      });
    }

    // Strip the query but preserve the hash (ShareUrlLoader may still
    // want it).
    window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Click-to-connect (DEC-016 #5). Selecting a server in the sidebar
   * sets it active AND kicks off connect immediately. If a previous
   * connect is still in flight, `connect()` cancels it and starts the
   * new one — so a user staring at a slow-connecting server can click
   * a different one without waiting for the timeout. (Until v1.1.11
   * the only escapes were "wait for the timeout" or "refresh the
   * page", per Costa.)
   *
   * Toast shape mirrors the header Connect button so both entry
   * points produce the same UX: success → "Connected to …", failure
   * → red "Connect failed" toast, supersede → silent.
   */
  async function handleSelectServer(s: ServerEntry) {
    setActive(s.id);
    try {
      const outcome = await connect(s);
      if (outcome === 'connected') {
        markUsed(s.id);
        notifications.show({ message: `Connected to ${s.name || s.url}` });
      }
    } catch (e) {
      notifications.show({
        color: 'red',
        title: 'Connect failed',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  function confirmDelete(s: ServerEntry) {
    modals.openConfirmModal({
      title: 'Delete server?',
      children: (
        <Text size="sm">
          Delete <strong>{s.name || s.url}</strong>? This removes its saved entry from your browser.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        remove(s.id);
        notifications.show({ message: `Removed ${s.name || s.url}` });
      },
    });
  }

  return (
    <Box
      component="aside"
      h="100%"
      style={{
        // Sidebar gets the "chrome" shade — visibly darker than the main
        // editor-like content (Inspector / RequestPanel / Log) which uses
        // `--mantine-color-body`. Matches VS Code Dark Modern's
        // sideBar.background being darker than editor.background.
        background: 'var(--color-bg-raised)',
        borderRight: '1px solid var(--mantine-color-default-border)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Group
        justify="space-between"
        px="md"
        py="xs"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
        }}
      >
        <Text size="xs" tt="uppercase" c="dimmed" fw={600} style={{ letterSpacing: '0.05em' }}>
          Servers
        </Text>
        <Tooltip label="Add a new MCP server" withinPortal>
          <Button
            size="compact-sm"
            variant="light"
            leftSection={<PlusIcon />}
            onClick={() => setModal({ mode: 'add' })}
          >
            Add
          </Button>
        </Tooltip>
      </Group>

      <Box style={{ flex: 1, overflowY: 'auto' }}>
        {servers.length === 0 ? (
          <Stack p="md" gap="xs">
            <Text size="sm" c="dimmed">
              No servers yet. Click &ldquo;Add&rdquo; to connect to an MCP server.
            </Text>
          </Stack>
        ) : (
          <Box>
            {servers.map((s) => (
              <NavLink
                key={s.id}
                active={s.id === activeId}
                onClick={() => {
                  void handleSelectServer(s);
                }}
                label={
                  <Text size="sm" truncate="end">
                    {s.name || s.url}
                  </Text>
                }
                description={
                  <Text size="xs" c="dimmed" truncate="end">
                    {s.url}
                  </Text>
                }
                rightSection={
                  <Group gap={4} wrap="nowrap" onClick={(e) => e.stopPropagation()}>
                    <Tooltip label="Edit server" withinPortal>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        aria-label="Edit server"
                        onClick={() => setModal({ mode: 'edit', id: s.id })}
                      >
                        <PencilIcon />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Delete server" withinPortal>
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        aria-label="Delete server"
                        onClick={() => confirmDelete(s)}
                      >
                        <TrashIcon />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                }
              />
            ))}
          </Box>
        )}
      </Box>

      {modal !== null ? <ServerModal spec={modal} onClose={() => setModal(null)} /> : null}
    </Box>
  );
}

interface ServerModalProps {
  spec: { mode: 'add'; prefill?: AddPrefill } | { mode: 'edit'; id: string };
  onClose: () => void;
}

function ServerModal({ spec, onClose }: ServerModalProps) {
  const { servers, add, update, setActive } = useServers();
  const { connect } = useConnection();
  const existing = spec.mode === 'edit' ? servers.find((s) => s.id === spec.id) : null;
  const prefill = spec.mode === 'add' ? spec.prefill : undefined;

  const [name, setName] = useState(existing?.name ?? prefill?.name ?? '');
  const [url, setUrl] = useState(existing?.url ?? prefill?.url ?? 'https://');
  const [transport, setTransport] = useState<TransportKind | 'auto'>(
    existing?.transport ?? prefill?.transport ?? 'auto',
  );
  const [authKind, setAuthKind] = useState<'none' | 'bearer' | 'header'>(
    existing?.auth?.kind ?? prefill?.authKind ?? 'none',
  );
  const [token, setToken] = useState(existing?.auth?.kind === 'bearer' ? existing.auth.token : '');
  const [headerName, setHeaderName] = useState(
    existing?.auth?.kind === 'header' ? existing.auth.name : (prefill?.authHeaderName ?? ''),
  );
  const [headerValue, setHeaderValue] = useState(
    existing?.auth?.kind === 'header' ? existing.auth.value : '',
  );
  const [error, setError] = useState<string | null>(null);
  // DEC-017 #9 — auth-required known-servers dropdown. Only shown in
  // add mode (edit mode is editing a saved entry, no need to seed
  // from a known server). Loaded async on mount so the modal opens
  // instantly even on a slow first paint.
  const [authCatalog, setAuthCatalog] = useState<CatalogServer[]>([]);
  useEffect(() => {
    if (spec.mode !== 'add') return;
    void loadCatalog().then((c) => {
      setAuthCatalog(c.servers.filter((s) => s.auth !== 'none' && s.status !== 'retired'));
    });
  }, [spec.mode]);
  function applyKnownServer(id: string | null) {
    if (id === null) return;
    const known = authCatalog.find((s) => s.id === id);
    if (!known) return;
    setName(known.name);
    setUrl(known.url);
    setTransport(known.transport);
    // Map the catalog's auth shape into the modal's. 'oauth' isn't
    // (yet) an interactive auth method in this client; treat it as
    // bearer and let the user paste the token they get from signup.
    if (known.auth === 'header') setAuthKind('header');
    else if (known.auth === 'bearer' || known.auth === 'oauth') setAuthKind('bearer');
    else setAuthKind('none');
  }

  // DEC-016 #4: connecting spinner while the Save handler probes the
  // server. Persistence is gated on a successful connect — if the
  // handshake fails, the entry is NOT saved and the user sees the
  // error inline so they can fix and retry.
  const [busy, setBusy] = useState(false);

  // DEC-016 #4: required-auth validation. With auth ≠ none the
  // credential field must be non-empty before submit.
  const tokenMissing = authKind === 'bearer' && token.trim().length === 0;
  const headerNameMissing = authKind === 'header' && headerName.trim().length === 0;
  const headerValueMissing = authKind === 'header' && headerValue.trim().length === 0;
  const authIncomplete = tokenMissing || headerNameMissing || headerValueMissing;

  async function handleSave() {
    setError(null);
    const cleanUrl = url.trim();
    try {
      new URL(cleanUrl);
    } catch {
      setError(`Not a valid URL: ${cleanUrl}`);
      return;
    }
    if (authIncomplete) {
      setError('Auth value required when an auth method is selected.');
      return;
    }

    const auth: ServerEntry['auth'] =
      authKind === 'none'
        ? { kind: 'none' }
        : authKind === 'bearer'
          ? { kind: 'bearer', token }
          : { kind: 'header', name: headerName, value: headerValue };

    // Build a probe-only ServerEntry for connect(). The id /
    // addedAt / lastUsed values are placeholders — they're only used
    // by ServerEntry consumers, and we never stash this candidate in
    // storage. On success we either re-create (add) or update the
    // real entry below.
    const candidate: ServerEntry = {
      id: existing?.id ?? '__candidate__',
      name: name.trim() || cleanUrl,
      url: cleanUrl,
      transport,
      auth,
      addedAt: existing?.addedAt ?? Date.now(),
      lastUsed: existing?.lastUsed ?? null,
    };

    setBusy(true);
    // DEC-016 #4 — connect-on-save. We probe the server with a
    // throwaway client first; if it works, we persist the entry and
    // promote to the live connection. If it fails, we surface the
    // error inline and DON'T persist. The reuse of the live
    // ConnectionContext.connect() handles supersede if the user
    // clicks Save while another connect is in flight.
    try {
      const outcome = await connect(candidate);
      if (outcome === 'superseded') {
        // Another connect (e.g. user clicked a sidebar entry while the
        // modal probe was running) took over. Don't save; close the
        // modal silently.
        onClose();
        return;
      }
      // Connect succeeded — now persist.
      if (spec.mode === 'add') {
        const created = add({
          name: candidate.name,
          url: candidate.url,
          transport: candidate.transport,
          auth: candidate.auth,
        });
        setActive(created.id);
        notifications.show({ message: `Added and connected to ${created.name}` });
      } else {
        update(spec.id, {
          name: candidate.name,
          url: candidate.url,
          transport: candidate.transport,
          auth: candidate.auth,
        });
        notifications.show({ message: `Updated ${candidate.name}` });
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(`Connect failed: ${msg}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={spec.mode === 'add' ? 'Add MCP server' : 'Edit server'}
      size="lg"
    >
      {/*
        Wrapping the body in a <form> wires Enter-to-submit from any focused
        input through the Save button (type="submit") without trapping Enter
        in custom onKeyDown handlers — and keeps Esc on the Modal listener.
      */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleSave();
        }}
      >
        <Stack gap="sm">
          {spec.mode === 'add' && authCatalog.length > 0 ? (
            <Select
              label="Pick a known server"
              description="Pre-fill from a catalog of known auth-required MCP servers. You'll still need to provide credentials."
              placeholder="Choose…"
              value={null}
              onChange={(v) => applyKnownServer(v)}
              data={authCatalog.map((s) => ({ value: s.id, label: s.name }))}
              clearable
              searchable
            />
          ) : null}

          <TextInput
            label="Name"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            placeholder="Friendly name (optional)"
          />

          <TextInput
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.currentTarget.value)}
            placeholder="https://example.com/mcp or wss://…"
            required
          />

          <Select
            label="Transport"
            value={transport}
            onChange={(v) => {
              if (
                v === 'auto' ||
                v === 'streamable-http' ||
                v === 'sse-legacy' ||
                v === 'websocket'
              ) {
                setTransport(v);
              }
            }}
            data={[
              { value: 'auto', label: 'Auto (by URL scheme)' },
              { value: 'streamable-http', label: 'Streamable HTTP (current MCP spec)' },
              { value: 'sse-legacy', label: 'SSE (legacy)' },
              { value: 'websocket', label: 'WebSocket (custom)' },
            ]}
            allowDeselect={false}
          />

          <Select
            label="Authentication"
            value={authKind}
            onChange={(v) => {
              if (v === 'none' || v === 'bearer' || v === 'header') {
                setAuthKind(v);
              }
            }}
            data={[
              { value: 'none', label: 'None' },
              { value: 'bearer', label: 'Bearer token' },
              { value: 'header', label: 'Custom header' },
            ]}
            allowDeselect={false}
          />

          {authKind === 'bearer' ? (
            <PasswordInput
              label="Bearer token"
              value={token}
              onChange={(e) => setToken(e.currentTarget.value)}
              placeholder="paste token"
              required
              error={tokenMissing ? 'Token required' : undefined}
            />
          ) : null}

          {authKind === 'header' ? (
            <>
              <TextInput
                label="Header name"
                value={headerName}
                onChange={(e) => setHeaderName(e.currentTarget.value)}
                placeholder="X-Api-Key"
                required
                error={headerNameMissing ? 'Header name required' : undefined}
              />
              <PasswordInput
                label="Header value"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.currentTarget.value)}
                required
                error={headerValueMissing ? 'Header value required' : undefined}
              />
            </>
          ) : null}

          {error !== null ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}

          <Text size="xs" c="dimmed">
            Stored in your browser only. See{' '}
            <Anchor href="specs/security.md" target="_blank" rel="noreferrer" size="xs">
              security notes
            </Anchor>
            .
          </Text>

          <Group justify="flex-end" gap="xs">
            <Tooltip label="Discard changes" withinPortal>
              <Button type="button" variant="default" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
            </Tooltip>
            <Tooltip
              label={
                spec.mode === 'add'
                  ? 'Save and connect — only persists if the connection succeeds'
                  : 'Save and reconnect with the new settings'
              }
              withinPortal
            >
              <Button type="submit" loading={busy} disabled={busy || authIncomplete}>
                Save and connect
              </Button>
            </Tooltip>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
