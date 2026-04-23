import { useState } from 'react';

import { useConnection } from '../state/connection.tsx';

type Tab = 'tools' | 'prompts' | 'resources' | 'templates';

export interface Selection {
  kind: Tab;
  name: string;
  payload: unknown;
}

interface Props {
  selection: Selection | null;
  onSelect: (selection: Selection) => void;
}

export function Inspector({ selection, onSelect }: Props) {
  const { inventory, status } = useConnection();
  const [tab, setTab] = useState<Tab>('tools');

  const asStr = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

  const asOptStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

  const lists: Record<Tab, Array<{ name: string; description?: string; item: unknown }>> = {
    tools: (inventory.tools as Array<Record<string, unknown>>).map((t) => ({
      name: asStr(t['name'], '(unnamed)'),
      description: asOptStr(t['description']),
      item: t,
    })),
    prompts: (inventory.prompts as Array<Record<string, unknown>>).map((p) => ({
      name: asStr(p['name'], '(unnamed)'),
      description: asOptStr(p['description']),
      item: p,
    })),
    resources: (inventory.resources as Array<Record<string, unknown>>).map((r) => ({
      name: asStr(r['name'], asStr(r['uri'], '(unnamed)')),
      description: asOptStr(r['description']),
      item: r,
    })),
    templates: (inventory.resourceTemplates as Array<Record<string, unknown>>).map((t) => ({
      name: asStr(t['name'], asStr(t['uriTemplate'], '(unnamed)')),
      description: asOptStr(t['description']),
      item: t,
    })),
  };

  const current = lists[tab];

  return (
    <div className="shell__panel">
      <div className="panel-header">
        <div className="row">
          {(['tools', 'prompts', 'resources', 'templates'] as const).map((t) => (
            <button
              key={t}
              className={'btn btn--ghost' + (tab === t ? ' btn--primary' : '')}
              type="button"
              onClick={() => setTab(t)}
            >
              {t} ({lists[t].length})
            </button>
          ))}
        </div>
      </div>
      <div>
        {status.state !== 'connected' ? (
          <div className="panel-body muted">Connect to a server to see its inventory.</div>
        ) : current.length === 0 ? (
          <div className="panel-body muted">Server exposes no {tab}.</div>
        ) : (
          <ul className="item-list">
            {current.map((entry) => {
              const isActive =
                selection !== null && selection.kind === tab && selection.name === entry.name;
              return (
                <li
                  key={entry.name}
                  className={'item' + (isActive ? ' item--active' : '')}
                  onClick={() => onSelect({ kind: tab, name: entry.name, payload: entry.item })}
                >
                  <div className="item__name">
                    <div>{entry.name}</div>
                    {entry.description ? (
                      <div className="item__meta">{entry.description}</div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
