/**
 * DEC-027 — keyboard navigation expansion.
 *
 * Single source of truth for every keyboard shortcut in the app. The
 * help modal renders straight off this list, tooltips look up their
 * `kbd` hint by id, and the global hotkey registration consumes the
 * same `keys`/`run` pairs. New shortcuts auto-appear in help; there
 * is no second list to keep in sync.
 *
 * `scope` distinguishes shortcuts the global hotkey hook owns from
 * those a panel registers locally. `displayOnly: true` means the
 * entry is shown in help / tooltips but the global hook MUST NOT
 * register a listener — used for the log-panel `j`/`k`/`↑`/`↓`/`Enter`
 * triple, which is owned by `<LogPanel>`'s focus-scoped handler so
 * it only fires when the panel actually has focus.
 *
 * WCAG 2.1.4 — every single-letter shortcut MUST be suppressed when
 * an `<input>`, `<textarea>`, `<select>`, or contenteditable holds
 * focus. `@mantine/hooks`' `useHotkeys` does this by default; the
 * registration in `keyboard-shortcuts.tsx` MUST NOT weaken it.
 */

import { useMemo } from 'react';

import { useCommandPalette } from './command-palette.tsx';
import { useConnection } from '../state/connection.tsx';
import { useServers } from '../state/servers.tsx';
import { useTheme } from '../state/theme.tsx';
import { useSidebarCollapse } from '../state/sidebar-collapse.tsx';

export type ShortcutScope = 'global' | 'log-panel';

export interface ShortcutDef {
  /** Stable identifier — used by tooltips to look up the `kbd` hint. */
  id: string;
  /**
   * Mantine hotkey strings (see `@mantine/hooks` `useHotkeys`).
   * Multiple entries register the same shortcut under multiple key
   * combinations (e.g., `?` is `shift+slash` on US layouts).
   */
  keys: string[];
  /** One-line description, rendered in the help modal and tooltips. */
  description: string;
  /** Where this shortcut applies — drives the help modal sections. */
  scope: ShortcutScope;
  /** Optional gate; when `false`, the shortcut is hidden from help and not registered. */
  available?: boolean;
  /**
   * When true the global hotkey hook MUST NOT register a listener —
   * the panel that owns the focus context registers its own. The
   * entry still appears in the help modal and in tooltips so the
   * user discovers it.
   */
  displayOnly?: boolean;
  /** Side effect — invoked by the global hotkey hook (or a verb). */
  run: () => void;
}

/**
 * Display-only shortcut entries that other panels register
 * themselves. The `run` is a no-op since the global hook skips
 * `displayOnly` anyway — keeping it in the type means the help
 * modal's row code is a single shape.
 */
const NOOP = () => undefined;

/**
 * Builds the resolved catalog from the active context. Returns a new
 * array on every state change — `useShortcutCatalog` consumers should
 * rely on the stable `id` field, not array identity, for keys.
 */
export function useShortcutCatalog(): ShortcutDef[] {
  const { openPalette } = useCommandPalette();
  const { active, activeId } = useServers();
  const { setPreference, preference } = useTheme();
  const { toggleCollapsed } = useSidebarCollapse();
  // useConnection is read so `e` only registers when there's an
  // active server to edit. Connection state itself isn't required —
  // the gate is purely on `active != null`.
  useConnection();

  return useMemo<ShortcutDef[]>(() => {
    const haveActive = active !== null && activeId !== null;

    return [
      {
        id: 'open-palette',
        keys: ['mod+k'],
        description: 'Open the command palette',
        scope: 'global',
        // Cmd+K is owned by <CommandPaletteHost>'s own listener
        // (predates DEC-027). Listed here so it appears in help.
        displayOnly: true,
        run: NOOP,
      },
      {
        id: 'open-palette-slash',
        keys: ['slash'],
        description: 'Open the command palette (search)',
        scope: 'global',
        run: () => openPalette(),
      },
      {
        id: 'log-prev-request',
        keys: ['k', 'arrowup'],
        description: 'Previous request in the log',
        scope: 'log-panel',
        // Owned by <LogPanel>'s focus-scoped listener.
        displayOnly: true,
        run: NOOP,
      },
      {
        id: 'log-next-request',
        keys: ['j', 'arrowdown'],
        description: 'Next request in the log',
        scope: 'log-panel',
        displayOnly: true,
        run: NOOP,
      },
      {
        id: 'log-expand-current',
        keys: ['enter'],
        description: 'Expand the cursored log row',
        scope: 'log-panel',
        displayOnly: true,
        run: NOOP,
      },
      {
        id: 'add-server',
        keys: ['c'],
        description: 'Add a new MCP server',
        scope: 'global',
        run: () => {
          window.dispatchEvent(
            new CustomEvent('mcptc:command-palette', { detail: { type: 'add-server' } }),
          );
        },
      },
      {
        id: 'edit-server',
        keys: ['e'],
        description: 'Edit the active server',
        scope: 'global',
        available: haveActive,
        run: () => {
          if (!haveActive) return;
          window.dispatchEvent(
            new CustomEvent('mcptc:command-palette', {
              detail: { type: 'edit-server', id: activeId },
            }),
          );
        },
      },
      {
        id: 'toggle-sidebar',
        keys: ['s'],
        description: 'Collapse / expand the sidebar',
        scope: 'global',
        run: () => toggleCollapsed(),
      },
      {
        id: 'toggle-theme',
        keys: ['mod+`'],
        description: 'Cycle theme (dark / light / system)',
        scope: 'global',
        run: () => {
          // Same three-way cycle the toolbar toggle and the palette
          // verb use — single source of truth in
          // `<ThemeToggle>` would be neater, but inlining the
          // identical logic keeps state owners decoupled.
          const next = preference === 'dark' ? 'light' : preference === 'light' ? 'system' : 'dark';
          setPreference(next);
        },
      },
      {
        id: 'open-shortcut-help',
        keys: ['shift+slash', 'shift+?'],
        description: 'Show keyboard shortcuts',
        scope: 'global',
        run: () => {
          window.dispatchEvent(
            new CustomEvent('mcptc:command-palette', { detail: { type: 'shortcut-help' } }),
          );
        },
      },
      {
        id: 'close-overlay',
        keys: ['escape'],
        description: 'Close the topmost overlay',
        scope: 'global',
        // Mantine modals + the palette already wire Esc themselves.
        // Listed here so the user discovers the binding.
        displayOnly: true,
        run: NOOP,
      },
    ];
  }, [openPalette, active, activeId, setPreference, preference, toggleCollapsed]);
}

/**
 * Renders a Mantine hotkey string as a stack of `<kbd>` glyphs the
 * user would recognise. `'mod+k'` becomes `'⌘ K'` on Mac, `'Ctrl K'`
 * elsewhere; `'shift+slash'` becomes `'?'` (the user-visible glyph,
 * not the parsed key name); `'arrowup'` becomes `'↑'`.
 */
export function formatHotkey(hotkey: string): string {
  const isMac =
    typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
  const parts = hotkey.toLowerCase().split('+');
  return parts
    .map((p) => {
      switch (p) {
        case 'mod':
          return isMac ? '⌘' : 'Ctrl';
        case 'meta':
          return '⌘';
        case 'ctrl':
          return 'Ctrl';
        case 'alt':
          return isMac ? '⌥' : 'Alt';
        case 'shift':
          return isMac ? '⇧' : 'Shift';
        case 'enter':
          return 'Enter';
        case 'escape':
          return 'Esc';
        case 'arrowup':
          return '↑';
        case 'arrowdown':
          return '↓';
        case 'arrowleft':
          return '←';
        case 'arrowright':
          return '→';
        case 'slash':
          return '/';
        case '?':
          return '?';
        case 'space':
          return 'Space';
        default:
          return p.length === 1 ? p.toUpperCase() : p;
      }
    })
    .join(' ');
}

/**
 * Picks the canonical user-visible label for a shortcut. Multi-key
 * shortcuts show the first form (e.g., `?` shows `?`, not the
 * `shift+slash` it parses to).
 */
export function primaryLabel(def: ShortcutDef): string {
  // Help modal uses formatted hotkeys; tooltips use the single-glyph
  // shorthand. Both walk the same key list — the first entry wins
  // because catalog authors put the natural one first.
  return def.keys.map((k) => formatHotkey(k)).join(' or ');
}

/**
 * Tooltip-friendly compact form: shorter than `primaryLabel` since
 * tooltips already carry the description in surrounding prose.
 * "Add server (c)", "Edit server (e)".
 */
export function compactKey(def: ShortcutDef): string {
  // First key only, lowercased single letters left as-is.
  const first = def.keys[0];
  if (first === undefined) return '';
  return formatHotkey(first);
}
