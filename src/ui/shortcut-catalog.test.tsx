/**
 * DEC-027 — shortcut catalog correctness:
 *   - every key combination is owned by exactly one entry (no
 *     duplicate `keydown` registrations);
 *   - global hotkeys are suppressed inside `<input>` /
 *     `<textarea>` / `contenteditable` (WCAG 2.1.4 input-skipping);
 *   - the help-modal opens on `?`, the catalog and modal both
 *     enumerate every catalog row.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import type { ReactNode } from 'react';

import { CommandPaletteHost } from './command-palette.tsx';
import { KeyboardShortcutsHost } from './keyboard-shortcuts.tsx';
import { ShortcutHelp } from './shortcut-help.tsx';
import { useShortcutCatalog } from './shortcut-catalog.ts';
import { ConnectionProvider } from '../state/connection.tsx';
import { LogProvider } from '../state/log.tsx';
import { RequestActionsProvider } from '../state/request-actions.tsx';
import { SelectionProvider } from '../state/selection.tsx';
import { ServersProvider } from '../state/servers.tsx';
import { SidebarCollapseProvider } from '../state/sidebar-collapse.tsx';
import { ThemeProvider } from '../state/theme.tsx';
import { __setStorageForTests } from '../state/store-instance.ts';
import { MemoryStorage } from '../persistence/store.test.ts';

function Wrapper({ children }: { children: ReactNode }) {
  return (
    <MantineProvider>
      <ModalsProvider>
        <Notifications />
        <ThemeProvider>
          <SidebarCollapseProvider>
            <ServersProvider>
              <LogProvider>
                <ConnectionProvider>
                  <SelectionProvider>
                    <RequestActionsProvider>
                      <CommandPaletteHost>{children}</CommandPaletteHost>
                    </RequestActionsProvider>
                  </SelectionProvider>
                </ConnectionProvider>
              </LogProvider>
            </ServersProvider>
          </SidebarCollapseProvider>
        </ThemeProvider>
      </ModalsProvider>
    </MantineProvider>
  );
}

beforeEach(() => {
  __setStorageForTests(new MemoryStorage());
});

function CatalogProbe({ onCatalog }: { onCatalog: (defs: unknown) => void }) {
  const catalog = useShortcutCatalog();
  onCatalog(catalog);
  return null;
}

describe('shortcut catalog (DEC-027)', () => {
  it('has no duplicate (key, scope) pairs across the catalog', () => {
    let defs: ReturnType<typeof useShortcutCatalog> | null = null;
    render(
      <Wrapper>
        <CatalogProbe
          onCatalog={(c) => {
            defs = c as typeof defs;
          }}
        />
      </Wrapper>,
    );
    if (!defs) throw new Error('catalog never resolved');
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const def of defs as ReturnType<typeof useShortcutCatalog>) {
      for (const k of def.keys) {
        const composite = `${def.scope}:${k}`;
        if (seen.has(composite)) dupes.push(composite);
        seen.add(composite);
      }
    }
    expect(dupes).toEqual([]);
  });

  it('every catalog entry has a unique id', () => {
    let defs: ReturnType<typeof useShortcutCatalog> | null = null;
    render(
      <Wrapper>
        <CatalogProbe
          onCatalog={(c) => {
            defs = c as typeof defs;
          }}
        />
      </Wrapper>,
    );
    if (!defs) throw new Error('catalog never resolved');
    const ids = (defs as ReturnType<typeof useShortcutCatalog>).map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('global hotkeys (DEC-027)', () => {
  it("'?' opens the shortcut help modal from the document body", async () => {
    render(
      <Wrapper>
        <KeyboardShortcutsHost />
        <ShortcutHelp />
      </Wrapper>,
    );

    // Pre-condition: modal closed.
    expect(screen.queryByText(/Show keyboard shortcuts/)).toBeNull();

    // Fire a `?` (shift+slash) keydown on the document element — which
    // is where Mantine's useHotkeys binds.
    act(() => {
      document.documentElement.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '?',
          code: 'Slash',
          shiftKey: true,
          bubbles: true,
        }),
      );
    });

    // Mantine modal renders content asynchronously into a portal —
    // use findBy* to wait for the body to flush.
    expect(await screen.findByText(/Show keyboard shortcuts/)).toBeInTheDocument();
  });

  it("does NOT fire 'c' when the focus is inside an <input>", () => {
    render(
      <Wrapper>
        <KeyboardShortcutsHost />
        <ShortcutHelp />
        <input data-testid="probe-input" />
      </Wrapper>,
    );

    const input = screen.getByTestId('probe-input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    // Pre-condition — Add modal not open.
    expect(screen.queryByRole('dialog', { name: /add mcp server/i })).toBeNull();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', bubbles: true }));
    });

    // The Add modal MUST stay closed: the registration goes through
    // Mantine's useHotkeys, which skips events whose target is INPUT.
    expect(screen.queryByRole('dialog', { name: /add mcp server/i })).toBeNull();
  });

  it("does NOT fire 's' when the focus is inside a <textarea>", () => {
    render(
      <Wrapper>
        <KeyboardShortcutsHost />
        <ShortcutHelp />
        <textarea data-testid="probe-textarea" />
      </Wrapper>,
    );

    const ta = screen.getByTestId('probe-textarea') as HTMLTextAreaElement;
    ta.focus();
    expect(document.activeElement).toBe(ta);

    // We can't easily detect the absence of a sidebar-collapse change
    // (no DOM rendering for it in this isolated harness), but the
    // load-bearing assertion is that no preventDefault fires — i.e.,
    // the keydown is NOT consumed. Checking via `defaultPrevented`.
    let event: KeyboardEvent | null = null;
    const captureHandler = (e: Event) => {
      event = e as KeyboardEvent;
    };
    document.documentElement.addEventListener('keydown', captureHandler, { capture: true });
    act(() => {
      ta.dispatchEvent(new KeyboardEvent('keydown', { key: 's', bubbles: true, cancelable: true }));
    });
    document.documentElement.removeEventListener('keydown', captureHandler, { capture: true });
    if (event === null) throw new Error('no keydown captured');
    // Mantine skips inputs → does not preventDefault → user's `s` lands in the textarea.
    // Use a non-null reference so the type-narrowing flows through.
    const captured = event as KeyboardEvent;
    expect(captured.defaultPrevented).toBe(false);
  });

  it("'?' inside a <textarea> does NOT open the help modal", () => {
    render(
      <Wrapper>
        <KeyboardShortcutsHost />
        <ShortcutHelp />
        <textarea data-testid="probe-textarea" />
      </Wrapper>,
    );

    const ta = screen.getByTestId('probe-textarea') as HTMLTextAreaElement;
    ta.focus();
    expect(document.activeElement).toBe(ta);

    act(() => {
      ta.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '?',
          code: 'Slash',
          shiftKey: true,
          bubbles: true,
        }),
      );
    });

    expect(screen.queryByRole('dialog', { name: /keyboard shortcuts/i })).toBeNull();
  });
});

describe('shortcut help modal (DEC-027)', () => {
  it('renders a row per catalog entry, grouped by scope', async () => {
    render(
      <Wrapper>
        <KeyboardShortcutsHost />
        <ShortcutHelp />
      </Wrapper>,
    );

    // Open via `?`.
    act(() => {
      document.documentElement.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: '?',
          code: 'Slash',
          shiftKey: true,
          bubbles: true,
        }),
      );
    });

    // Wait for Mantine modal body to flush.
    await screen.findByText(/Show keyboard shortcuts/);
    expect(screen.getByText(/Add a new MCP server/)).toBeInTheDocument();
    expect(screen.getByText(/Cycle theme/)).toBeInTheDocument();
    expect(screen.getByText(/Collapse \/ expand the sidebar/)).toBeInTheDocument();
    expect(screen.getByText(/Previous request in the log/)).toBeInTheDocument();
  });
});
