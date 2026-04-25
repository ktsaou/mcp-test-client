import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Group,
  ScrollArea,
  SegmentedControl,
  Stack,
  Text,
  Textarea,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';

import { useConnection } from '../state/connection.tsx';
import { useLog } from '../state/log.tsx';
import { useSelection } from '../state/selection.tsx';
import { JsonView } from './json-view.tsx';
import { SchemaForm, type JSONSchema } from '../schema-form/index.ts';
import { CannedRequests } from './canned-requests.tsx';
import { ShareButton } from './share-button.tsx';
import type { Selection } from './inspector.tsx';

type Mode = 'form' | 'raw';

/**
 * Build a JSON-RPC request template for the currently selected inspector
 * item.
 */
function templateFor(selection: Selection | null): string {
  if (!selection) return '';
  const item = selection.payload as Record<string, unknown>;
  switch (selection.kind) {
    case 'tools':
      return JSON.stringify(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: selection.name, arguments: {} },
        },
        null,
        2,
      );
    case 'prompts':
      return JSON.stringify(
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'prompts/get',
          params: { name: selection.name, arguments: {} },
        },
        null,
        2,
      );
    case 'resources': {
      const uri = (item['uri'] as string | undefined) ?? '';
      return JSON.stringify(
        { jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri } },
        null,
        2,
      );
    }
    case 'templates': {
      const uriTemplate = (item['uriTemplate'] as string | undefined) ?? '';
      return JSON.stringify(
        { jsonrpc: '2.0', id: 1, method: 'resources/read', params: { uri: uriTemplate } },
        null,
        2,
      );
    }
  }
}

/**
 * Returns the JSON Schema we should drive a form from for the current
 * selection, or null if there isn't one that makes sense.
 */
function formSchemaFor(selection: Selection | null): JSONSchema | null {
  if (!selection) return null;
  const item = selection.payload as Record<string, unknown>;
  if (selection.kind === 'tools') {
    const s = item['inputSchema'];
    return s && typeof s === 'object' ? (s as JSONSchema) : null;
  }
  return null;
}

function selectionDescription(selection: Selection | null): string | undefined {
  if (!selection) return undefined;
  const item = selection.payload as Record<string, unknown>;
  const desc = item['description'];
  return typeof desc === 'string' ? desc : undefined;
}

export function RequestPanel() {
  const { client, status } = useConnection();
  const log = useLog();
  const { selection, consumeInbox } = useSelection();
  const [text, setText] = useState('');
  const [formValue, setFormValue] = useState<unknown>({});
  const [mode, setMode] = useState<Mode>('form');
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(() => templateFor(selection), [selection]);
  const formSchema = useMemo(() => formSchemaFor(selection), [selection]);
  const description = useMemo(() => selectionDescription(selection), [selection]);

  // Reset transient panel state whenever the selection changes. If a share
  // URL inbox carries args/raw matching this selection, apply them now and
  // clear the inbox so the user's later edits are not overwritten.
  useEffect(() => {
    if (template) setText(template);
    setFormValue({});
    setMode(formSchema ? 'form' : 'raw');
    setLastResult(null);
    setError(null);

    if (!selection || selection.kind !== 'tools') return;
    const inbox = consumeInbox();
    if (!inbox || inbox.tool !== selection.name) return;
    if (inbox.raw !== undefined) {
      setText(inbox.raw);
      setMode('raw');
      return;
    }
    if (inbox.args !== undefined && formSchema) {
      setFormValue(inbox.args);
      setMode('form');
    }
  }, [template, formSchema, selection, consumeInbox]);

  async function sendFormCall() {
    if (!selection || selection.kind !== 'tools' || !client) return;
    setError(null);
    setLastResult(null);
    setSending(true);
    try {
      const args =
        formValue && typeof formValue === 'object' ? (formValue as Record<string, unknown>) : {};
      const result = await client.callTool(selection.name, args);
      setLastResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      log.appendSystem('error', msg);
    } finally {
      setSending(false);
    }
  }

  async function sendRaw() {
    setError(null);
    setLastResult(null);
    let parsed: { method: string; params?: Record<string, unknown> };
    try {
      parsed = JSON.parse(text) as { method: string; params?: Record<string, unknown> };
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`);
      return;
    }
    if (!parsed.method || typeof parsed.method !== 'string') {
      setError('Request body must include a string `method`.');
      return;
    }
    if (!client) {
      setError('Not connected.');
      return;
    }
    setSending(true);
    try {
      const result: unknown = await client.request(parsed.method, parsed.params);
      setLastResult(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      log.appendSystem('error', msg);
    } finally {
      setSending(false);
    }
  }

  const disabled = status.state !== 'connected' || sending;
  const canSendForm = mode === 'form' && formSchema !== null;
  const send = canSendForm ? sendFormCall : sendRaw;

  return (
    <Box
      h="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-body)',
        overflow: 'hidden',
      }}
    >
      {/*
        Toolbar layout note (DEC-011 F2): the toolbar wraps so the Saved-
        requests group can drop to a second row instead of squeezing the
        primary actions. `Send` and `Share` are flex-shrink:0 with a
        min-width that fits their label, so they always render in full.
      */}
      <Group
        wrap="wrap"
        gap="xs"
        px="md"
        py={8}
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
          flexShrink: 0,
          rowGap: 6,
        }}
      >
        <Box style={{ minWidth: 0, flex: 1 }}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={600} style={{ letterSpacing: '0.05em' }}>
            Request
            {selection ? (
              <Text component="span" c="dimmed" tt="none" fw={400}>
                {' — '}
                {selection.kind}/{selection.name}
              </Text>
            ) : null}
          </Text>
        </Box>

        {formSchema ? (
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(v) => {
              if (v === 'form' || v === 'raw') setMode(v);
            }}
            data={[
              { value: 'form', label: 'Form' },
              { value: 'raw', label: 'Raw' },
            ]}
            style={{ flexShrink: 0 }}
          />
        ) : null}

        <CannedRequests selection={selection} formValue={formValue} onLoad={setFormValue} />

        <ShareButton selection={selection} formValue={formValue} rawText={text} mode={mode} />

        <Tooltip
          label={
            disabled
              ? status.state !== 'connected'
                ? 'Connect to a server first'
                : 'Sending…'
              : 'Send the request to the server'
          }
          withinPortal
        >
          <Button
            size="sm"
            onClick={() => {
              void send();
            }}
            disabled={disabled}
            loading={sending}
            // Pin the primary action so neither label nor button shrinks
            // when the saved-requests dropdown widens the toolbar.
            style={{ flexShrink: 0, minWidth: 64 }}
          >
            Send
          </Button>
        </Tooltip>
      </Group>

      <ScrollArea style={{ flex: 1, minHeight: 0 }}>
        <Stack gap="md" p="md">
          {description ? (
            <Box
              p="sm"
              style={{
                background: 'var(--mantine-color-default-hover)',
                borderRadius: 'var(--mantine-radius-sm)',
                border: '1px solid var(--mantine-color-default-border)',
              }}
            >
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={4}>
                Description
              </Text>
              <Text
                size="sm"
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.55,
                }}
              >
                {description}
              </Text>
            </Box>
          ) : null}

          {canSendForm && formSchema ? (
            <SchemaForm schema={formSchema} value={formValue} onChange={setFormValue} />
          ) : (
            <Textarea
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
              placeholder={
                '{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "…",\n  "params": { }\n}'
              }
              spellCheck={false}
              autosize
              minRows={8}
              maxRows={20}
              styles={{
                input: {
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 'var(--mantine-font-size-sm)',
                },
              }}
            />
          )}

          {error !== null ? (
            <Alert color="red" variant="light">
              {error}
            </Alert>
          ) : null}

          {lastResult !== null ? (
            <Box>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600} mb={6}>
                Last result
              </Text>
              <JsonView
                value={lastResult}
                copyButton
                downloadButton
                downloadFilename={
                  selection ? `mcp-${selection.kind}-${selection.name}` : 'mcp-result'
                }
                onCopied={() => notifications.show({ message: 'Result copied as JSON' })}
                onDownloaded={() => notifications.show({ message: 'Result saved' })}
              />
            </Box>
          ) : null}
        </Stack>
      </ScrollArea>
    </Box>
  );
}
