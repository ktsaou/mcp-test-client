import { useState } from 'react';
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

import { useServers } from '../state/servers.tsx';
import type { ServerEntry } from '../persistence/schema.ts';
import type { TransportKind } from '../mcp/types.ts';

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
  const { servers, activeId, setActive, remove } = useServers();
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; id: string } | null>(null);

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
        background: 'var(--mantine-color-body)',
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
                onClick={() => setActive(s.id)}
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
  spec: { mode: 'add' } | { mode: 'edit'; id: string };
  onClose: () => void;
}

function ServerModal({ spec, onClose }: ServerModalProps) {
  const { servers, add, update, setActive } = useServers();
  const existing = spec.mode === 'edit' ? servers.find((s) => s.id === spec.id) : null;

  const [name, setName] = useState(existing?.name ?? '');
  const [url, setUrl] = useState(existing?.url ?? 'https://');
  const [transport, setTransport] = useState<TransportKind | 'auto'>(existing?.transport ?? 'auto');
  const [authKind, setAuthKind] = useState<'none' | 'bearer' | 'header'>(
    existing?.auth?.kind ?? 'none',
  );
  const [token, setToken] = useState(existing?.auth?.kind === 'bearer' ? existing.auth.token : '');
  const [headerName, setHeaderName] = useState(
    existing?.auth?.kind === 'header' ? existing.auth.name : '',
  );
  const [headerValue, setHeaderValue] = useState(
    existing?.auth?.kind === 'header' ? existing.auth.value : '',
  );
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    setError(null);
    const cleanUrl = url.trim();
    try {
      new URL(cleanUrl);
    } catch {
      setError(`Not a valid URL: ${cleanUrl}`);
      return;
    }

    const auth: ServerEntry['auth'] =
      authKind === 'none'
        ? { kind: 'none' }
        : authKind === 'bearer'
          ? { kind: 'bearer', token }
          : { kind: 'header', name: headerName, value: headerValue };

    if (spec.mode === 'add') {
      const created = add({
        name: name.trim() || cleanUrl,
        url: cleanUrl,
        transport,
        auth,
      });
      setActive(created.id);
      notifications.show({ message: `Added ${created.name}` });
    } else {
      update(spec.id, { name: name.trim() || cleanUrl, url: cleanUrl, transport, auth });
      notifications.show({ message: `Updated ${name.trim() || cleanUrl}` });
    }
    onClose();
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={spec.mode === 'add' ? 'Add MCP server' : 'Edit server'}
      size="lg"
    >
      <Stack gap="sm">
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
          />
        ) : null}

        {authKind === 'header' ? (
          <>
            <TextInput
              label="Header name"
              value={headerName}
              onChange={(e) => setHeaderName(e.currentTarget.value)}
              placeholder="X-Api-Key"
            />
            <PasswordInput
              label="Header value"
              value={headerValue}
              onChange={(e) => setHeaderValue(e.currentTarget.value)}
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
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
          </Tooltip>
          <Tooltip label={spec.mode === 'add' ? 'Add this server' : 'Save changes'} withinPortal>
            <Button onClick={handleSave}>Save</Button>
          </Tooltip>
        </Group>
      </Stack>
    </Modal>
  );
}
