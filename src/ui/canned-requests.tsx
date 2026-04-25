/**
 * Per-tool canned requests: save the current form value under a name,
 * load a previously saved entry to refill the form.
 *
 * Storage key: `mcptc:canned.<server-id>.<tool-name>` → array of
 * `{ name, args, savedAt }`.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Menu,
  Modal,
  Select,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';

import { useServers } from '../state/servers.tsx';
import { appStore } from '../state/store-instance.ts';
import { cannedKey } from '../persistence/schema.ts';
import type { Selection } from './inspector.tsx';

interface CannedEntry {
  name: string;
  args: unknown;
  savedAt: number;
}

interface Props {
  selection: Selection | null;
  formValue: unknown;
  onLoad: (args: unknown) => void;
}

export function CannedRequests({ selection, formValue, onLoad }: Props) {
  const { active } = useServers();
  const storeKey = useMemo(() => {
    if (!active || !selection || selection.kind !== 'tools') return null;
    return cannedKey(active.id, selection.name);
  }, [active, selection]);

  const [entries, setEntries] = useState<CannedEntry[]>([]);
  const [savingOpen, setSavingOpen] = useState(false);

  useEffect(() => {
    if (!storeKey) {
      setEntries([]);
      return;
    }
    const saved = appStore.read<CannedEntry[]>(storeKey.replace(/^mcptc:/, ''));
    setEntries(Array.isArray(saved) ? saved : []);
  }, [storeKey]);

  function persist(next: CannedEntry[]) {
    if (!storeKey) return;
    appStore.write(storeKey.replace(/^mcptc:/, ''), next);
    setEntries(next);
  }

  function commitSave(name: string) {
    if (!storeKey) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    const entry: CannedEntry = { name: trimmed, args: formValue, savedAt: Date.now() };
    const existing = entries.filter((e) => e.name !== trimmed);
    persist([entry, ...existing].slice(0, 50));
    notifications.show({ message: `Saved request “${trimmed}”` });
  }

  function handleLoad(value: string | null) {
    if (value === null) return;
    const idx = Number(value);
    const entry = entries[idx];
    if (entry) {
      onLoad(entry.args);
      notifications.show({ message: `Loaded “${entry.name}”` });
    }
  }

  function handleDelete(name: string) {
    modals.openConfirmModal({
      title: 'Delete saved request?',
      children: (
        <Text size="sm">
          Delete <strong>{name}</strong>? This removes the saved arguments for this tool.
        </Text>
      ),
      labels: { confirm: 'Delete', cancel: 'Cancel' },
      confirmProps: { color: 'red' },
      onConfirm: () => {
        persist(entries.filter((e) => e.name !== name));
        notifications.show({ message: `Deleted “${name}”` });
      },
    });
  }

  if (!storeKey) return null;

  const selectData = entries.map((e, i) => ({ value: String(i), label: e.name }));

  return (
    <>
      <Group gap={4} wrap="nowrap">
        <Tooltip label="Save the current arguments as a named canned request" withinPortal>
          <Button
            variant="default"
            size="compact-sm"
            onClick={() => setSavingOpen(true)}
            disabled={!formValue}
          >
            Save as…
          </Button>
        </Tooltip>
        {entries.length > 0 ? (
          <Select
            placeholder={`Load saved (${entries.length})`}
            data={selectData}
            value={null}
            onChange={handleLoad}
            size="xs"
            w={170}
            aria-label="Load a saved request"
            comboboxProps={{ withinPortal: true }}
          />
        ) : null}
        {entries.length > 0 ? (
          <Menu shadow="md" position="bottom-end" withinPortal>
            <Menu.Target>
              <Tooltip label="Delete a saved request" withinPortal>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  aria-label="Delete saved request"
                >
                  <CrossIcon />
                </ActionIcon>
              </Tooltip>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Label>Delete which?</Menu.Label>
              {entries.map((e) => (
                <Menu.Item key={e.name} onClick={() => handleDelete(e.name)}>
                  {e.name}
                </Menu.Item>
              ))}
            </Menu.Dropdown>
          </Menu>
        ) : null}
      </Group>

      {savingOpen ? (
        <SaveAsModal
          existing={entries.map((e) => e.name)}
          onClose={() => setSavingOpen(false)}
          onSave={(name) => {
            commitSave(name);
            setSavingOpen(false);
          }}
        />
      ) : null}
    </>
  );
}

interface SaveAsModalProps {
  existing: string[];
  onClose: () => void;
  onSave: (name: string) => void;
}

function SaveAsModal({ existing, onClose, onSave }: SaveAsModalProps) {
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);

  const trimmed = name.trim();
  const isEmpty = trimmed.length === 0;
  const overwrites = !isEmpty && existing.includes(trimmed);
  const errorMsg = touched && isEmpty ? 'Name cannot be empty.' : null;

  function submit() {
    setTouched(true);
    if (isEmpty) return;
    onSave(trimmed);
  }

  return (
    <Modal opened onClose={onClose} title="Save request as" size="md">
      {/*
        Form-level submit so Enter from any field saves; matches Add Server.
        The previous TextInput-local onKeyDown is gone for consistency.
      */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Stack gap="sm">
          <TextInput
            label="Name"
            placeholder="e.g. add 2 and 3"
            value={name}
            onChange={(e) => setName(e.currentTarget.value)}
            onBlur={() => setTouched(true)}
            error={errorMsg}
            data-autofocus
          />
          {overwrites ? (
            <Alert color="yellow" variant="light">
              A saved request named “{trimmed}” already exists — saving will overwrite it.
            </Alert>
          ) : null}
          <Group justify="flex-end" gap="xs">
            <Tooltip label="Discard" withinPortal>
              <Button type="button" variant="default" onClick={onClose}>
                Cancel
              </Button>
            </Tooltip>
            <Tooltip label="Save under this name" withinPortal>
              <Button type="submit" disabled={isEmpty}>
                Save
              </Button>
            </Tooltip>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function CrossIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
      <path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
