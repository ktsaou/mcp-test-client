import { useEffect, useMemo, useState } from 'react';

import { useConnection } from '../state/connection.tsx';
import { useLog } from '../state/log.tsx';
import { JsonView } from './json-view.tsx';
import type { Selection } from './inspector.tsx';

interface Props {
  selection: Selection | null;
}

/**
 * Build a JSON-RPC request template for the currently selected inspector
 * item. This is intentionally bare — the rich schema-driven form landing
 * in Phase 5 will replace the raw editor as the primary interaction path.
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

export function RequestPanel({ selection }: Props) {
  const { client, status } = useConnection();
  const log = useLog();
  const [text, setText] = useState('');
  const [lastResult, setLastResult] = useState<unknown>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const template = useMemo(() => templateFor(selection), [selection]);
  useEffect(() => {
    if (template) setText(template);
  }, [template]);

  async function send() {
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
        <button
          className="btn btn--primary"
          type="button"
          onClick={() => {
            void send();
          }}
          disabled={disabled || text.trim().length === 0}
        >
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <textarea
          className="textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'{\n  "jsonrpc": "2.0",\n  "id": 1,\n  "method": "…",\n  "params": { }\n}'}
          spellCheck={false}
        />

        {error !== null ? <div className="pill pill--error">{error}</div> : null}

        {lastResult !== null ? (
          <div>
            <div className="muted" style={{ fontSize: 'var(--font-size-sm)', marginBottom: 6 }}>
              Last result
            </div>
            <JsonView value={lastResult} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
