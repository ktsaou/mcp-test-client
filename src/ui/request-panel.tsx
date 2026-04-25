import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Box,
  Button,
  Group,
  Menu,
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
import { useServers } from '../state/servers.tsx';
import {
  readToolState,
  writeToolState,
  writeLastSelection,
} from '../state/tool-state-persistence.ts';
import { JsonView } from './json-view.tsx';
import { SchemaForm, type JSONSchema, validate } from '../schema-form/index.ts';
import { CannedRequests } from './canned-requests.tsx';
import { ShareButton } from './share-button.tsx';
import { MetricsChips, type ResponseMetrics, type TokenState } from './metrics-chips.tsx';
import { jsonByteLength } from './log-pairing.ts';
import { estimateTokens } from './log-tokens.ts';
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
  const { activeId } = useServers();
  const [text, setText] = useState('');
  const [formValue, setFormValue] = useState<unknown>({});
  const [mode, setMode] = useState<Mode>('form');
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null);
  const [lastTokens, setLastTokens] = useState<TokenState>('pending');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(() => templateFor(selection), [selection]);
  const formSchema = useMemo(() => formSchemaFor(selection), [selection]);
  const description = useMemo(() => selectionDescription(selection), [selection]);

  // DEC-018 — per-tool form-state persistence. On selection change:
  //
  //  1. If a stored snapshot exists for `(activeId, selection.name)`,
  //     hydrate the form / raw / mode / lastResult fields from it.
  //     The user's in-progress work survives switching tools or
  //     servers and coming back.
  //  2. Otherwise, seed from a share-url inbox if the recipient
  //     arrived via a share link and the inbox matches this tool.
  //  3. Otherwise, default-empty (with the request template seeded).
  //
  // The share-url inbox is consumed BEFORE the snapshot check would
  // be — but we only use the inbox path when no snapshot exists, so
  // a returning user's saved work isn't clobbered by a stale share-
  // url match.
  useEffect(() => {
    // Default-empty as the baseline; specialised paths below override.
    if (template) setText(template);
    setFormValue({});
    setMode(formSchema ? 'form' : 'raw');
    setLastResult(null);
    setLastDurationMs(null);
    setLastTokens('pending');
    setError(null);

    if (!selection || selection.kind !== 'tools') return;

    // 1. Stored snapshot (DEC-018)
    if (activeId !== null) {
      const snapshot = readToolState(activeId, selection.name);
      if (snapshot) {
        setFormValue(snapshot.formValue ?? {});
        setText(typeof snapshot.rawText === 'string' ? snapshot.rawText : (template ?? ''));
        setMode(snapshot.mode === 'raw' ? 'raw' : formSchema ? 'form' : 'raw');
        if (snapshot.lastResult !== null) setLastResult(snapshot.lastResult);
        return;
      }
    }

    // 2. Share-url inbox (one-shot)
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
  }, [activeId, template, formSchema, selection, consumeInbox]);

  // DEC-018 — debounced persistence of the current snapshot. Fires on
  // every change to formValue / text / mode / lastResult. Debounced
  // 200 ms so fast typing doesn't hit storage on every keystroke.
  useEffect(() => {
    if (!selection || selection.kind !== 'tools' || activeId === null) return;
    const tool = selection.name;
    const id = setTimeout(() => {
      writeToolState(activeId, tool, {
        formValue,
        rawText: text,
        mode,
        lastResult,
        touchedAt: Date.now(),
      });
    }, 200);
    return () => clearTimeout(id);
  }, [activeId, selection, formValue, text, mode, lastResult]);

  // DEC-018 — track the user's current selection per server so
  // switching servers and coming back auto-re-selects the same tool.
  // Replaces the v1.1.13 ClearSelectionOnServerSwitch effect.
  useEffect(() => {
    if (activeId === null) return;
    if (selection && selection.kind === 'tools') {
      writeLastSelection(activeId, selection.name);
    }
  }, [activeId, selection]);

  function recordResultMetrics(result: unknown, startedAt: number) {
    setLastDurationMs(performance.now() - startedAt);
    setLastResult(result);
    setLastTokens('pending');
    // Tokenisation is async (gpt-tokenizer is dynamic-imported on first use).
    // The chip shows `… ~tok` until this resolves.
    estimateTokens(result)
      .then((n) => setLastTokens(n))
      .catch(() => setLastTokens('na'));
  }

  async function sendFormCall(opts: { skipValidation?: boolean } = {}) {
    if (!selection || selection.kind !== 'tools' || !client) return;
    setError(null);
    setLastResult(null);
    setLastDurationMs(null);
    if (opts.skipValidation) {
      // DEC-019: log the bypass so a future reader of the wire trace
      // can tell the request was knowingly malformed. The wire entry
      // itself looks normal — the system-log entry sits above it as
      // the audit trail.
      log.appendSystem('warn', `tools/call · ${selection.name} — sent without validation`);
    }
    setSending(true);
    const startedAt = performance.now();
    try {
      const args =
        formValue && typeof formValue === 'object' ? (formValue as Record<string, unknown>) : {};
      const result = await client.callTool(selection.name, args);
      recordResultMetrics(result, startedAt);
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
    setLastDurationMs(null);
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
    const startedAt = performance.now();
    try {
      const result: unknown = await client.request(parsed.method, parsed.params);
      recordResultMetrics(result, startedAt);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      log.appendSystem('error', msg);
    } finally {
      setSending(false);
    }
  }

  const canSendForm = mode === 'form' && formSchema !== null;

  // DEC-019: form-mode validation gate. When the form value doesn't
  // match the tool's inputSchema, block the default Send action and
  // surface the failure count on the button. The bypass is the
  // chevron menu's "Send without validation".
  const formErrors = useMemo(() => {
    if (!canSendForm || !formSchema) return null;
    return validate(formSchema, formValue);
  }, [canSendForm, formSchema, formValue]);
  const formInvalid = formErrors !== null && formErrors.length > 0;

  const disabledByConn = status.state !== 'connected' || sending;
  const disabled = disabledByConn || (canSendForm && formInvalid);

  function send() {
    if (canSendForm) {
      void sendFormCall();
    } else {
      void sendRaw();
    }
  }

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

        {/*
          DEC-019: split-button primary action. Default Send is gated by
          form validation (Ajv via cfworker) when in form mode. The
          chevron reveals "Send without validation" — a deliberate
          per-click bypass for MCP server developers who want to test
          how their server handles malformed input. Bypass is never
          persisted: every send is an explicit choice.
        */}
        <Group gap={0} wrap="nowrap" style={{ flexShrink: 0 }} aria-label="Send request">
          <Tooltip
            label={
              disabledByConn
                ? status.state !== 'connected'
                  ? 'Connect to a server first'
                  : 'Sending…'
                : formInvalid
                  ? `${formErrors?.length ?? 0} validation error(s) — fix or use the chevron to bypass`
                  : 'Send the request to the server'
            }
            withinPortal
          >
            <Button
              size="sm"
              onClick={send}
              disabled={disabled}
              loading={sending}
              style={{
                flexShrink: 0,
                minWidth: 64,
                borderTopRightRadius: canSendForm ? 0 : undefined,
                borderBottomRightRadius: canSendForm ? 0 : undefined,
              }}
            >
              Send
            </Button>
          </Tooltip>
          {canSendForm ? (
            <Menu position="bottom-end" withinPortal trigger="click">
              <Menu.Target>
                <ActionIcon
                  size="lg"
                  variant="filled"
                  color="cyan"
                  disabled={disabledByConn}
                  aria-label="More send options"
                  style={{
                    flexShrink: 0,
                    borderTopLeftRadius: 0,
                    borderBottomLeftRadius: 0,
                    borderLeft: '1px solid rgba(255,255,255,0.18)',
                  }}
                >
                  ▾
                </ActionIcon>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item
                  onClick={() => {
                    void sendFormCall({ skipValidation: true });
                  }}
                  disabled={disabledByConn}
                >
                  Send without validation
                </Menu.Item>
                <Menu.Item disabled style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                  Bypass the input-schema check for this send only
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : null}
        </Group>
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
              <Group justify="space-between" align="center" mb={6} wrap="nowrap">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>
                  Last result
                </Text>
                <Group gap={4} wrap="nowrap">
                  <MetricsChips
                    metrics={
                      {
                        bytes: jsonByteLength(lastResult),
                        durationMs: lastDurationMs ?? 0,
                        tokens: lastTokens,
                      } satisfies ResponseMetrics
                    }
                  />
                </Group>
              </Group>
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
