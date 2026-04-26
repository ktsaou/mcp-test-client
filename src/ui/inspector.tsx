import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Badge, Box, NavLink, ScrollArea, Tabs, Text, TextInput } from '@mantine/core';

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
  // One search query shared across tabs. The user is usually focused on
  // one kind at a time; persisting across tab switches lets them refine
  // a single search instead of losing it on every tab change.
  const [query, setQuery] = useState('');

  // DEC-025 — when the command palette selects an inventory item it
  // dispatches a `switch-tab` event so the inspector lands on the
  // matching tab. Without this the user could pick a prompt from the
  // palette while the inspector still showed Tools, leaving the
  // selection invisible.
  useEffect(() => {
    function onPaletteEvent(e: Event) {
      const detail = (e as CustomEvent<{ type?: string; tab?: Tab }>).detail;
      if (!detail || detail.type !== 'switch-tab') return;
      const next = detail.tab;
      if (next === 'tools' || next === 'prompts' || next === 'resources' || next === 'templates') {
        setTab(next);
      }
    }
    window.addEventListener('mcptc:command-palette', onPaletteEvent);
    return () => window.removeEventListener('mcptc:command-palette', onPaletteEvent);
  }, []);

  const asStr = (v: unknown, fallback: string): string => (typeof v === 'string' ? v : fallback);

  const asOptStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined);

  // Sort each list alphabetically by name (case-insensitive locale compare)
  // before any filtering so the rendered order is deterministic regardless
  // of the order the server returned. useMemo keys on inventory identity.
  const lists = useMemo<
    Record<Tab, Array<{ name: string; description?: string; item: unknown }>>
  >(() => {
    const sortByName = <T extends { name: string }>(arr: T[]): T[] =>
      [...arr].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }),
      );
    return {
      tools: sortByName(
        (inventory.tools as Array<Record<string, unknown>>).map((t) => ({
          name: asStr(t['name'], '(unnamed)'),
          description: asOptStr(t['description']),
          item: t,
        })),
      ),
      prompts: sortByName(
        (inventory.prompts as Array<Record<string, unknown>>).map((p) => ({
          name: asStr(p['name'], '(unnamed)'),
          description: asOptStr(p['description']),
          item: p,
        })),
      ),
      resources: sortByName(
        (inventory.resources as Array<Record<string, unknown>>).map((r) => ({
          name: asStr(r['name'], asStr(r['uri'], '(unnamed)')),
          description: asOptStr(r['description']),
          item: r,
        })),
      ),
      templates: sortByName(
        (inventory.resourceTemplates as Array<Record<string, unknown>>).map((t) => ({
          name: asStr(t['name'], asStr(t['uriTemplate'], '(unnamed)')),
          description: asOptStr(t['description']),
          item: t,
        })),
      ),
    };
  }, [inventory]);

  // Filter the active tab by the search query (matches name OR description,
  // case-insensitive substring). Empty query ⇒ no filter. We filter at the
  // active-tab level so the per-tab counts in the header reflect the full
  // inventory, not the filtered subset — that way the user can see at a
  // glance whether other tabs have matches without having to switch.
  const current = useMemo(() => {
    const list = lists[tab];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        (e.description !== undefined && e.description.toLowerCase().includes(q)),
    );
  }, [lists, tab, query]);

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

        <Box style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {status.state !== 'connected' ? (
            <InventoryEmptyState status={status} />
          ) : (
            <>
              {/* Search box appears only when the unfiltered list has at least
                  one entry. Hiding it on a truly-empty tab keeps the empty
                  state quiet. */}
              {lists[tab].length > 0 ? (
                <Box
                  style={{
                    flexShrink: 0,
                    paddingInline: 'var(--mantine-spacing-sm)',
                    paddingBlock: 6,
                  }}
                >
                  <TextInput
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                    placeholder={`Search ${TAB_LABELS[tab].toLowerCase()} by name or description`}
                    size="xs"
                    aria-label={`Search ${TAB_LABELS[tab].toLowerCase()}`}
                    rightSection={
                      query ? (
                        <ActionIcon
                          variant="subtle"
                          size="xs"
                          aria-label="Clear search"
                          onClick={() => setQuery('')}
                        >
                          ×
                        </ActionIcon>
                      ) : null
                    }
                  />
                </Box>
              ) : null}

              <Box style={{ flex: 1, minHeight: 0 }}>
                {lists[tab].length === 0 ? (
                  <EmptyState title={`Server exposed no ${tab}.`} />
                ) : current.length === 0 ? (
                  <EmptyState
                    title={`No ${tab} match "${query.trim()}".`}
                    hint="Try a shorter query or clear the search."
                  />
                ) : (
                  <ScrollArea style={{ height: '100%' }}>
                    {current.map((entry) => {
                      const isActive =
                        selection !== null &&
                        selection.kind === tab &&
                        selection.name === entry.name;
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
            </>
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
