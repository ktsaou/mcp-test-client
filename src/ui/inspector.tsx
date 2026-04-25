import { useState } from 'react';
import { Badge, Box, NavLink, ScrollArea, Tabs, Text } from '@mantine/core';

import { useConnection, type ConnectionStatus } from '../state/connection.tsx';
import { useSelection } from '../state/selection.tsx';
import { EmptyState } from './empty-state.tsx';

type Tab = 'tools' | 'prompts' | 'resources' | 'templates';

export interface Selection {
  kind: Tab;
  name: string;
  payload: unknown;
}

const TAB_LABELS: Record<Tab, string> = {
  tools: 'Tools',
  prompts: 'Prompts',
  resources: 'Resources',
  templates: 'Templates',
};

export function Inspector() {
  const { inventory, status } = useConnection();
  const { selection, setSelection } = useSelection();
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
    <Box
      h="100%"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--mantine-color-body)',
        overflow: 'hidden',
      }}
    >
      <Tabs
        value={tab}
        onChange={(v) => {
          if (v === 'tools' || v === 'prompts' || v === 'resources' || v === 'templates') {
            setTab(v);
          }
        }}
        variant="default"
        keepMounted={false}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
      >
        <Tabs.List
          style={{
            flexShrink: 0,
            paddingInline: 'var(--mantine-spacing-sm)',
            paddingTop: 6,
          }}
        >
          {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
            <Tabs.Tab
              key={t}
              value={t}
              rightSection={
                <Badge size="xs" variant="light" radius="sm">
                  {lists[t].length}
                </Badge>
              }
            >
              {TAB_LABELS[t]}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Box style={{ flex: 1, minHeight: 0 }}>
          {status.state !== 'connected' ? (
            <InventoryEmptyState status={status} />
          ) : current.length === 0 ? (
            <EmptyState title={`Server exposed no ${tab}.`} />
          ) : (
            <ScrollArea style={{ height: '100%' }}>
              {current.map((entry) => {
                const isActive =
                  selection !== null && selection.kind === tab && selection.name === entry.name;
                return (
                  <NavLink
                    key={entry.name}
                    active={isActive}
                    onClick={() =>
                      setSelection({ kind: tab, name: entry.name, payload: entry.item })
                    }
                    label={
                      <Text size="sm" fw={500}>
                        {entry.name}
                      </Text>
                    }
                    description={
                      entry.description ? (
                        <Text
                          size="xs"
                          c="dimmed"
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.4,
                          }}
                        >
                          {entry.description}
                        </Text>
                      ) : null
                    }
                  />
                );
              })}
            </ScrollArea>
          )}
        </Box>
      </Tabs>
    </Box>
  );
}

/**
 * Branches the inventory empty-state on the connection status so a connect
 * failure does not silently render "Connect to a server" — which makes the
 * user think they haven't tried yet, when in fact the server already
 * rejected them (DEC-011 F3).
 */
export function InventoryEmptyState({ status }: { status: ConnectionStatus }) {
  switch (status.state) {
    case 'idle':
      return <EmptyState title="Connect to a server to see its inventory." />;
    case 'connecting':
      return <EmptyState busy title="Negotiating with the server…" />;
    case 'error':
      return (
        <EmptyState
          tone="error"
          title={`Server returned: ${status.error.message}`}
          hint="Check the URL or token in the sidebar entry."
        />
      );
    case 'connected':
      // Inventory is non-empty by construction at this branch; the parent
      // handles the "connected but exposes no X" case per-tab.
      return null;
  }
}
