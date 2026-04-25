import { useEffect, useMemo, useState } from 'react';

import { useConnection } from '../state/connection.tsx';
import { useLog } from '../state/log.tsx';
import { JsonView } from './json-view.tsx';
import { SchemaForm, type JSONSchema } from '../schema-form/index.ts';
import { CannedRequests } from './canned-requests.tsx';
import { ShareButton } from './share-button.tsx';
import type { Selection } from './inspector.tsx';

interface Props {
  selection: Selection | null;
}

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

export function RequestPanel({ selection }: Props) {
  const { client, status } = useConnection();
  const log = useLog();
  const [text, setText] = useState('');
  const [formValue, setFormValue] = useState<unknown>({});
  const [mode, setMode] = useState<Mode>('form');
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(() => templateFor(selection), [selection]);
  const formSchema = useMemo(() => formSchemaFor(selection), [selection]);

  useEffect(() => {
    if (template) setText(template);
    setFormValue({});
    setMode(formSchema ? 'form' : 'raw');
    setLastResult(null);
    setError(null);
  }, [template, formSchema]);

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
    <div className="shell__panel">
      <div className="panel-header">
        <span>
          Request
          {selection ? (
            <span className="muted">
              {' '}
              — {selection.kind}/{selection.name}
            </span>
          ) : null}
        </span>

        {formSchema ? (
          <div className="row row--tight">
            <button
              className={'btn btn--ghost' + (mode === 'form' ? ' btn--primary' : '')}
              type="button"
              onClick={() => setMode('form')}
            >
              Form
            </button>
            <button
              className={'btn btn--ghost' + (mode === 'raw' ? ' btn--primary' : '')}
              type="button"
              onClick={() => setMode('raw')}
            >
              Raw
            </button>
          </div>
        ) : null}

        <CannedRequests selection={selection} formValue={formValue} onLoad={setFormValue} />

        <ShareButton selection={selection} formValue={formValue} rawText={text} mode={mode} />

        <button
          className="btn btn--primary"
          type="button"
          onClick={() => {
            void send();
          }}
          disabled={disabled}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {canSendForm && formSchema ? (
          <SchemaForm schema={formSchema} value={formValue} onChange={setFormValue} />
        ) : (
          <textarea
            className="textarea"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "…",\n  "params": { }\n}'}
            spellCheck={false}
          />
        )}

        {error !== null ? <div className="pill pill--error">{error}</div> : null}

        {lastResult !== null ? (
          <div>
            <div className="muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 6 }}>
              Last result
            </div>
            <JsonView
              value={lastResult}
              copyButton
              downloadButton
              downloadFilename={
                selection ? `mcp-${selection.kind}-${selection.name}` : 'mcp-result'
              }
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
