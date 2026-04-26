/**
 * DEC-027 — shortcut help modal. Generated from the catalog so a
 * new shortcut auto-appears here without a parallel edit. Esc
 * closes (Mantine modal default).
 *
 * Open path: dispatching `mcptc:command-palette` with
 * `{ type: 'shortcut-help' }` (the same channel the palette already
 * uses to open Add / Edit modals). The `?` global shortcut and a
 * "Keyboard shortcuts" verb in the palette both go through this
 * channel — single seam, single owner of the open/close state.
 */

import { useEffect, useState } from 'react';
import { Box, Group, Modal, Stack, Text } from '@mantine/core';

import {
  formatHotkey,
  useShortcutCatalog,
  type ShortcutDef,
  type ShortcutScope,
} from './shortcut-catalog.ts';

const SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: 'Global',
  'log-panel': 'Log panel',
};

export function ShortcutHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onPaletteEvent(e: Event) {
      const detail = (e as CustomEvent<{ type?: string }>).detail;
      if (!detail) return;
      if (detail.type === 'shortcut-help') setOpen(true);
    }
    window.addEventListener('mcptc:command-palette', onPaletteEvent);
    return () => window.removeEventListener('mcptc:command-palette', onPaletteEvent);
  }, []);

  return (
    <Modal
      opened={open}
      onClose={() => setOpen(false)}
      title="Keyboard shortcuts"
      size="lg"
      // Esc and the close button both reach onClose — Mantine default.
    >
      <ShortcutHelpBody />
    </Modal>
  );
}

function ShortcutHelpBody() {
  const catalog = useShortcutCatalog();

  // Group by scope, preserving the catalog's natural ordering inside
  // each group. We render one section per scope so the user can see
  // at a glance which keys work where.
  const groups = new Map<ShortcutScope, ShortcutDef[]>();
  for (const def of catalog) {
    if (def.available === false) continue;
    const list = groups.get(def.scope) ?? [];
    list.push(def);
    groups.set(def.scope, list);
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Single-letter shortcuts are suppressed while you&rsquo;re typing in an input, textarea, or
        the JSON-RPC raw editor (WCAG 2.1.4 — input-skipping).
      </Text>
      {Array.from(groups.entries()).map(([scope, defs]) => (
        <Stack key={scope} gap={6}>
          <Text size="xs" tt="uppercase" c="dimmed" fw={600} style={{ letterSpacing: '0.05em' }}>
            {SCOPE_LABELS[scope]}
          </Text>
          <Stack gap={2}>
            {defs.map((def) => (
              <Group
                key={def.id}
                justify="space-between"
                wrap="nowrap"
                gap="md"
                style={{ padding: '6px 4px' }}
              >
                <Text size="sm" style={{ flex: 1, minWidth: 0 }}>
                  {def.description}
                </Text>
                <KbdRow keys={def.keys} />
              </Group>
            ))}
          </Stack>
        </Stack>
      ))}
    </Stack>
  );
}

function KbdRow({ keys }: { keys: string[] }) {
  return (
    <Group gap={6} wrap="nowrap" style={{ flexShrink: 0 }}>
      {keys.map((k, i) => (
        <Box key={`${k}-${String(i)}`} style={{ display: 'inline-flex', gap: 4 }}>
          {i > 0 ? (
            <Text size="xs" c="dimmed" component="span">
              or
            </Text>
          ) : null}
          <Kbd>{formatHotkey(k)}</Kbd>
        </Box>
      ))}
    </Group>
  );
}

/**
 * Plain styled `<kbd>` — Mantine has a Kbd component but it doesn't
 * render multi-glyph keystrokes the way the help table needs (we
 * want the whole `⌘ K` as one chip, not two).
 */
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <Box
      component="kbd"
      style={{
        fontFamily: 'var(--mantine-font-family-monospace)',
        fontSize: 12,
        padding: '2px 6px',
        background: 'var(--mantine-color-default)',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: 4,
        color: 'var(--mantine-color-text)',
        lineHeight: 1.4,
      }}
    >
      {children}
    </Box>
  );
}
