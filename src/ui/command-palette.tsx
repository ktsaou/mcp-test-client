/**
 * DEC-025 — command palette (Cmd+K / Ctrl+K).
 *
 * cmdk-backed flat search over the surfaces a power user would
 * otherwise reach by clicking around: every saved + catalog server,
 * the active server's tools/prompts/resources/templates, and the
 * verb actions (Connect, Send, Toggle theme, Filter log, …). Verbs
 * gate on state preconditions so a "Send" entry only appears when
 * a click on Send would actually do something.
 *
 * Recents float to the top — last 5 picks, persisted under
 * `mcptc:command-palette.recents` so they survive a reload.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Modal } from '@mantine/core';
import { modals } from '@mantine/modals';
import { notifications } from '@mantine/notifications';
import {
  CommandRoot,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from 'cmdk';

import { Keys } from '../persistence/schema.ts';
import { appStore } from '../state/store-instance.ts';
import { useConnection } from '../state/connection.tsx';
import { useLog } from '../state/log.tsx';
import { useSelection } from '../state/selection.tsx';
import { useServers } from '../state/servers.tsx';
import { useTheme } from '../state/theme.tsx';
import type { LogFilter } from './log-pairing.ts';
import type { Selection } from './inspector.tsx';
import { useRequestActions, type RequestActionState } from '../state/request-actions.tsx';

interface CommandPaletteContextValue {
  /** Whether the palette modal is currently open. */
  open: boolean;
  /**
   * Open the palette. `prefill` seeds the search input — the header
   * search field calls this with whatever the user typed inside it
   * so focus moves seamlessly into the palette without losing keys.
   */
  openPalette: (prefill?: string) => void;
  /** Close the palette and reset the search field. */
  closePalette: () => void;
}

const CommandPaletteContext = createContext<CommandPaletteContextValue | null>(null);

/** Recently-selected items, newest first. */
type Recent =
  | { kind: 'server'; id: string; label: string }
  | { kind: 'inventory'; tab: InventoryTab; name: string; label: string }
  | { kind: 'verb'; id: string; label: string };

type InventoryTab = 'tools' | 'prompts' | 'resources' | 'templates';

const RECENTS_CAP = 5;

function readRecents(): Recent[] {
  const raw = appStore.read<Recent[]>(Keys.commandPaletteRecents);
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === 'object' && typeof r.label === 'string')
    .slice(0, RECENTS_CAP);
}

function pushRecent(prev: Recent[], next: Recent): Recent[] {
  // De-dupe by stable identity per kind.
  const key = recentKey(next);
  const filtered = prev.filter((r) => recentKey(r) !== key);
  return [next, ...filtered].slice(0, RECENTS_CAP);
}

function recentKey(r: Recent): string {
  if (r.kind === 'server') return `server:${r.id}`;
  if (r.kind === 'inventory') return `inventory:${r.tab}:${r.name}`;
  return `verb:${r.id}`;
}

interface InventoryItem {
  tab: InventoryTab;
  name: string;
  description?: string;
  payload: unknown;
}

function asStr(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function asOptStr(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function flattenInventory(inventory: {
  tools: unknown[];
  prompts: unknown[];
  resources: unknown[];
  resourceTemplates: unknown[];
}): InventoryItem[] {
  const out: InventoryItem[] = [];
  for (const t of inventory.tools as Array<Record<string, unknown>>) {
    out.push({
      tab: 'tools',
      name: asStr(t['name'], '(unnamed)'),
      description: asOptStr(t['description']),
      payload: t,
    });
  }
  for (const p of inventory.prompts as Array<Record<string, unknown>>) {
    out.push({
      tab: 'prompts',
      name: asStr(p['name'], '(unnamed)'),
      description: asOptStr(p['description']),
      payload: p,
    });
  }
  for (const r of inventory.resources as Array<Record<string, unknown>>) {
    out.push({
      tab: 'resources',
      name: asStr(r['name'], asStr(r['uri'], '(unnamed)')),
      description: asOptStr(r['description']),
      payload: r,
    });
  }
  for (const t of inventory.resourceTemplates as Array<Record<string, unknown>>) {
    out.push({
      tab: 'templates',
      name: asStr(t['name'], asStr(t['uriTemplate'], '(unnamed)')),
      description: asOptStr(t['description']),
      payload: t,
    });
  }
  return out;
}

const TAB_LABELS: Record<InventoryTab, string> = {
  tools: 'Tool',
  prompts: 'Prompt',
  resources: 'Resource',
  templates: 'Template',
};

interface VerbDef {
  id: string;
  label: string;
  /** When true, verb is rendered. Defaults to true. */
  show: boolean;
  run: () => void;
}

/**
 * Build the verb list from the current state. Each verb's `show`
 * gate determines whether it appears in the palette — verbs with
 * `show=false` are filtered out, never disabled-and-shown, so the
 * user only sees actions they can actually take.
 */
function useVerbs(args: { request: RequestActionState; closePalette: () => void }): VerbDef[] {
  const { request, closePalette } = args;
  const { active, activeId, remove } = useServers();
  const { status, connect, disconnect } = useConnection();
  const log = useLog();
  const { setPreference, preference } = useTheme();

  return useMemo<VerbDef[]>(() => {
    const connected = status.state === 'connected';
    const connecting = status.state === 'connecting';
    const errored = status.state === 'error';
    const idle = status.state === 'idle';
    const haveActive = active !== null;
    const haveLog = log.entries.length > 0;
    const filterTargets: Array<{ id: string; label: string; value: LogFilter }> = [
      { id: 'filter-all', label: 'Filter log: All', value: 'all' },
      { id: 'filter-wire', label: 'Filter log: Wire', value: 'wire' },
      { id: 'filter-system', label: 'Filter log: System', value: 'system' },
      { id: 'filter-errors', label: 'Filter log: Errors', value: 'errors' },
    ];

    const out: VerbDef[] = [];

    out.push({
      id: 'connect',
      label: 'Connect',
      show: idle && haveActive,
      run: () => {
        closePalette();
        if (!active) return;
        void (async () => {
          try {
            const outcome = await connect(active);
            if (outcome === 'connected') {
              notifications.show({ message: `Connected to ${active.name || active.url}` });
            }
          } catch (e) {
            notifications.show({
              color: 'red',
              title: 'Connect failed',
              message: e instanceof Error ? e.message : String(e),
            });
          }
        })();
      },
    });

    out.push({
      id: 'disconnect',
      label: 'Disconnect',
      show: connected || connecting,
      run: () => {
        closePalette();
        void (async () => {
          try {
            await disconnect();
            notifications.show({ message: 'Disconnected' });
          } catch (e) {
            notifications.show({
              color: 'red',
              title: 'Disconnect failed',
              message: e instanceof Error ? e.message : String(e),
            });
          }
        })();
      },
    });

    out.push({
      id: 'reconnect',
      label: 'Reconnect',
      show: (connected || errored) && haveActive,
      run: () => {
        closePalette();
        if (!active) return;
        void (async () => {
          try {
            await disconnect().catch(() => undefined);
            const outcome = await connect(active);
            if (outcome === 'connected') {
              notifications.show({ message: `Reconnected to ${active.name || active.url}` });
            }
          } catch (e) {
            notifications.show({
              color: 'red',
              title: 'Reconnect failed',
              message: e instanceof Error ? e.message : String(e),
            });
          }
        })();
      },
    });

    out.push({
      id: 'edit-server',
      label: 'Edit server',
      show: haveActive,
      run: () => {
        closePalette();
        // Drive the existing edit flow by dispatching a window event the
        // server picker listens for. Matches the click-to-edit path so
        // the modal renders identically.
        window.dispatchEvent(
          new CustomEvent('mcptc:command-palette', {
            detail: { type: 'edit-server', id: activeId },
          }),
        );
      },
    });

    out.push({
      id: 'delete-server',
      label: 'Delete server',
      show: haveActive,
      run: () => {
        closePalette();
        if (!active) return;
        // Reuse the existing confirm-modal pattern from server-picker
        // so the verb can't bypass the safety prompt.
        modals.openConfirmModal({
          title: 'Delete server?',
          children: (
            <span>
              Delete <strong>{active.name || active.url}</strong>? This removes its saved entry from
              your browser.
            </span>
          ),
          labels: { confirm: 'Delete', cancel: 'Cancel' },
          confirmProps: { color: 'red' },
          onConfirm: () => {
            remove(active.id);
            notifications.show({ message: `Removed ${active.name || active.url}` });
          },
        });
      },
    });

    out.push({
      id: 'add-server',
      label: 'Add server',
      show: true,
      run: () => {
        closePalette();
        window.dispatchEvent(
          new CustomEvent('mcptc:command-palette', { detail: { type: 'add-server' } }),
        );
      },
    });

    out.push({
      id: 'export-settings',
      label: 'Export settings',
      show: true,
      run: () => {
        closePalette();
        window.dispatchEvent(
          new CustomEvent('mcptc:command-palette', { detail: { type: 'export-settings' } }),
        );
      },
    });

    out.push({
      id: 'import-settings',
      label: 'Import settings',
      show: true,
      run: () => {
        closePalette();
        window.dispatchEvent(
          new CustomEvent('mcptc:command-palette', { detail: { type: 'import-settings' } }),
        );
      },
    });

    out.push({
      id: 'clear-log',
      label: 'Clear log',
      show: haveLog,
      run: () => {
        closePalette();
        log.clear();
      },
    });

    for (const f of filterTargets) {
      out.push({
        id: f.id,
        label: f.label,
        show: true,
        run: () => {
          closePalette();
          log.setFilter(f.value);
        },
      });
    }

    out.push({
      id: 'toggle-theme',
      label: 'Toggle theme',
      show: true,
      run: () => {
        closePalette();
        // Three-way cycle that mirrors the toolbar toggle: dark → light
        // → system → dark. From the palette the user can keep firing
        // the verb to step through the modes.
        const next = preference === 'dark' ? 'light' : preference === 'light' ? 'system' : 'dark';
        setPreference(next);
      },
    });

    // DEC-027 — discoverability verb for the shortcut help modal.
    // Keeps the palette as the one place users learn about every
    // keyboard binding (and the modal lists Cmd+K itself).
    out.push({
      id: 'shortcut-help',
      label: 'Keyboard shortcuts (?)',
      show: true,
      run: () => {
        closePalette();
        window.dispatchEvent(
          new CustomEvent('mcptc:command-palette', { detail: { type: 'shortcut-help' } }),
        );
      },
    });

    out.push({
      id: 'send',
      label: 'Send',
      show: connected && request.canSend,
      run: () => {
        closePalette();
        request.send();
      },
    });

    out.push({
      id: 'send-without-validation',
      label: 'Send without validation',
      show: connected && request.canSendSkipValidation,
      run: () => {
        closePalette();
        request.sendSkipValidation();
      },
    });

    return out;
  }, [
    status.state,
    active,
    activeId,
    log,
    request,
    closePalette,
    connect,
    disconnect,
    remove,
    setPreference,
    preference,
  ]);
}

interface PaletteBodyProps {
  query: string;
  onQueryChange: (q: string) => void;
  closePalette: () => void;
}

function PaletteBody({ query, onQueryChange, closePalette }: PaletteBodyProps) {
  const { servers, active, setActive, markUsed } = useServers();
  const { status, inventory, connect } = useConnection();
  const { setSelection } = useSelection();
  const requestActions = useRequestActions();

  const verbs = useVerbs({ request: requestActions, closePalette });

  const [recents, setRecentsState] = useState<Recent[]>(() => readRecents());
  const persistRecent = useCallback((next: Recent) => {
    setRecentsState((prev) => {
      const updated = pushRecent(prev, next);
      appStore.write(Keys.commandPaletteRecents, updated);
      return updated;
    });
  }, []);

  const inventoryItems = useMemo<InventoryItem[]>(
    () => (status.state === 'connected' ? flattenInventory(inventory) : []),
    [status.state, inventory],
  );

  const verbsById = useMemo(() => new Map(verbs.map((v) => [v.id, v])), [verbs]);

  const handleServer = useCallback(
    (id: string) => {
      const target = servers.find((s) => s.id === id);
      if (!target) return;
      closePalette();
      persistRecent({
        kind: 'server',
        id: target.id,
        label: target.name || target.url,
      });
      setActive(target.id);
      void (async () => {
        try {
          const outcome = await connect(target);
          if (outcome === 'connected') {
            markUsed(target.id);
            notifications.show({ message: `Connected to ${target.name || target.url}` });
          }
        } catch (e) {
          notifications.show({
            color: 'red',
            title: 'Connect failed',
            message: e instanceof Error ? e.message : String(e),
          });
        }
      })();
    },
    [servers, closePalette, persistRecent, setActive, connect, markUsed],
  );

  const handleInventory = useCallback(
    (item: InventoryItem) => {
      closePalette();
      persistRecent({
        kind: 'inventory',
        tab: item.tab,
        name: item.name,
        label: `${TAB_LABELS[item.tab]}: ${item.name}`,
      });
      const next: Selection = { kind: item.tab, name: item.name, payload: item.payload };
      setSelection(next);
      window.dispatchEvent(
        new CustomEvent('mcptc:command-palette', {
          detail: { type: 'switch-tab', tab: item.tab },
        }),
      );
    },
    [closePalette, persistRecent, setSelection],
  );

  const handleVerb = useCallback(
    (id: string) => {
      const verb = verbsById.get(id);
      if (!verb) return;
      persistRecent({ kind: 'verb', id: verb.id, label: verb.label });
      verb.run();
    },
    [verbsById, persistRecent],
  );

  const visibleVerbs = useMemo(() => verbs.filter((v) => v.show), [verbs]);
  const showRecents = query.trim().length === 0 && recents.length > 0;

  return (
    <CommandRoot
      label="Command palette"
      className="cmd-root"
      shouldFilter
      filter={(value, search) => {
        // cmdk fuzzy default but with an explicit non-zero floor for
        // any substring match — keeps short queries like "deepw" from
        // ranking partial-byte hits below the canonical "DeepWiki".
        const v = value.toLowerCase();
        const s = search.toLowerCase().trim();
        if (!s) return 1;
        if (v.includes(s)) return 1;
        // Token-prefix match: every token in the search must be a
        // prefix of some token in the value.
        const tokens = s.split(/\s+/).filter(Boolean);
        const valueTokens = v.split(/\s+/).filter(Boolean);
        const ok = tokens.every((t) => valueTokens.some((vt) => vt.startsWith(t)));
        return ok ? 0.5 : 0;
      }}
    >
      <CommandInput
        autoFocus
        placeholder="Search servers, tools, actions…"
        value={query}
        onValueChange={onQueryChange}
        className="cmd-input"
      />
      <CommandList className="cmd-list">
        <CommandEmpty className="cmd-empty">No matches</CommandEmpty>

        {showRecents ? (
          <CommandGroup heading="Recents" className="cmd-group">
            {recents.map((r) => (
              <CommandItem
                key={`recent-${recentKey(r)}`}
                value={`recent ${r.label}`}
                onSelect={() => {
                  if (r.kind === 'server') handleServer(r.id);
                  else if (r.kind === 'inventory') {
                    const match = inventoryItems.find(
                      (it) => it.tab === r.tab && it.name === r.name,
                    );
                    if (match) handleInventory(match);
                    else closePalette();
                  } else handleVerb(r.id);
                }}
                className="cmd-item"
              >
                <span className="cmd-item__label">{r.label}</span>
                <span className="cmd-item__hint">recent</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {servers.length > 0 ? (
          <CommandGroup heading="Servers" className="cmd-group">
            {servers.map((s) => {
              const isActive = active?.id === s.id;
              return (
                <CommandItem
                  key={`server-${s.id}`}
                  value={`server ${s.name} ${s.url}`}
                  onSelect={() => handleServer(s.id)}
                  className="cmd-item"
                >
                  <span className="cmd-item__label">{s.name || s.url}</span>
                  <span className="cmd-item__hint">
                    {isActive ? 'active · ' : ''}
                    {s.url}
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}

        {inventoryItems.length > 0 ? (
          <CommandGroup heading={`Inventory · ${active?.name ?? ''}`} className="cmd-group">
            {inventoryItems.map((item) => (
              <CommandItem
                key={`inv-${item.tab}-${item.name}`}
                value={`${item.tab} ${item.name} ${item.description ?? ''}`}
                onSelect={() => handleInventory(item)}
                className="cmd-item"
              >
                <span className="cmd-item__label">{item.name}</span>
                <span className="cmd-item__hint">{TAB_LABELS[item.tab]}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}

        {visibleVerbs.length > 0 ? (
          <CommandGroup heading="Actions" className="cmd-group">
            {visibleVerbs.map((v) => (
              <CommandItem
                key={`verb-${v.id}`}
                value={`action ${v.label}`}
                onSelect={() => handleVerb(v.id)}
                className="cmd-item"
              >
                <span className="cmd-item__label">{v.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandRoot>
  );
}

/**
 * Mounted once near the root of the tree. Owns the open/close state +
 * Cmd+K hotkey + the Modal shell. The actual cmdk content lives in
 * <PaletteBody> so we re-mount it on every open — that resets cmdk's
 * internal cursor and search state without us having to reach into
 * its internals.
 */
export function CommandPaletteHost({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const openPalette = useCallback((prefill?: string) => {
    setQuery(prefill ?? '');
    setOpen(true);
  }, []);
  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  // Global Cmd+K / Ctrl+K toggle. Registered at the document level so
  // it fires regardless of which element holds focus — body, sidebar,
  // log row, or a focused input. The hotkey listener lives here (and
  // not inside the modal) so the open path works while the modal is
  // not yet mounted.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((prev) => {
          if (prev) return false;
          setQuery('');
          return true;
        });
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const value = useMemo<CommandPaletteContextValue>(
    () => ({ open, openPalette, closePalette }),
    [open, openPalette, closePalette],
  );

  return (
    <CommandPaletteContext.Provider value={value}>
      {children}
      <Modal
        opened={open}
        onClose={closePalette}
        withCloseButton={false}
        size="lg"
        padding={0}
        centered
        // Pull the modal up so it doesn't bounce vertically as the list
        // grows or shrinks under the search input.
        styles={{ content: { background: 'transparent', boxShadow: 'none' } }}
      >
        {open ? (
          <PaletteBody query={query} onQueryChange={setQuery} closePalette={closePalette} />
        ) : null}
      </Modal>
    </CommandPaletteContext.Provider>
  );
}

export function useCommandPalette(): CommandPaletteContextValue {
  const ctx = useContext(CommandPaletteContext);
  if (!ctx) throw new Error('useCommandPalette must be used inside <CommandPaletteHost>');
  return ctx;
}
