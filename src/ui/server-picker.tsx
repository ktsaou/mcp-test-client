import { useState } from 'react';

import { useServers } from '../state/servers.tsx';
import type { ServerEntry } from '../persistence/schema.ts';
import type { TransportKind } from '../mcp/types.ts';

export function ServerPicker() {
  const { servers, activeId, setActive, remove } = useServers();
  const [modal, setModal] = useState<{ mode: 'add' } | { mode: 'edit'; id: string } | null>(null);

  return (
    <aside className="shell__sidebar">
      <div className="panel-header">
        <span>Servers</span>
        <button className="btn btn--ghost" type="button" onClick={() => setModal({ mode: 'add' })}>
          + Add
        </button>
      </div>
      {servers.length === 0 ? (
        <div className="panel-body muted">
          <p>No servers yet. Click &ldquo;Add&rdquo; to connect to an MCP server.</p>
        </div>
      ) : (
        <ul className="item-list">
          {servers.map((s) => (
            <li
              key={s.id}
              className={'item' + (s.id === activeId ? ' item--active' : '')}
              onClick={() => setActive(s.id)}
            >
              <div className="item__name">
                <div>{s.name || s.url}</div>
                <div className="item__meta">{s.url}</div>
              </div>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setModal({ mode: 'edit', id: s.id });
                }}
                title="Edit"
              >
                ✎
              </button>
              <button
                className="btn btn--ghost"
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete ${s.name || s.url}?`)) remove(s.id);
                }}
                title="Delete"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {modal !== null ? <ServerModal spec={modal} onClose={() => setModal(null)} /> : null}
    </aside>
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
    } else {
      update(spec.id, { name: name.trim() || cleanUrl, url: cleanUrl, transport, auth });
    }
    onClose();
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" role="dialog" aria-label="Server details">
        <h2>{spec.mode === 'add' ? 'Add MCP server' : 'Edit server'}</h2>

        <label className="field">
          <span>Name</span>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Friendly name (optional)"
          />
        </label>

        <label className="field">
          <span>URL</span>
          <input
            className="input"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/mcp or wss://…"
          />
        </label>

        <label className="field">
          <span>Transport</span>
          <select
            className="select"
            value={transport}
            onChange={(e) => setTransport(e.target.value as TransportKind | 'auto')}
          >
            <option value="auto">Auto (by URL scheme)</option>
            <option value="streamable-http">Streamable HTTP (current MCP spec)</option>
            <option value="sse-legacy">SSE (legacy)</option>
            <option value="websocket">WebSocket (custom)</option>
          </select>
        </label>

        <label className="field">
          <span>Authentication</span>
          <select
            className="select"
            value={authKind}
            onChange={(e) => setAuthKind(e.target.value as 'none' | 'bearer' | 'header')}
          >
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
            <option value="header">Custom header</option>
          </select>
        </label>

        {authKind === 'bearer' ? (
          <label className="field">
            <span>Bearer token</span>
            <input
              className="input"
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="paste token"
            />
          </label>
        ) : null}

        {authKind === 'header' ? (
          <>
            <label className="field">
              <span>Header name</span>
              <input
                className="input"
                value={headerName}
                onChange={(e) => setHeaderName(e.target.value)}
                placeholder="X-Api-Key"
              />
            </label>
            <label className="field">
              <span>Header value</span>
              <input
                className="input"
                type="password"
                value={headerValue}
                onChange={(e) => setHeaderValue(e.target.value)}
              />
            </label>
          </>
        ) : null}

        {error !== null ? <div className="pill pill--error">{error}</div> : null}

        <div className="row">
          <span className="muted" style={{ fontSize: 'var(--font-size-sm)' }}>
            Stored in your browser only. See{' '}
            <a
              href="specs/security.md"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--color-accent)' }}
            >
              security notes
            </a>
            .
          </span>
          <div className="spacer" />
          <button className="btn" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn--primary" type="button" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
