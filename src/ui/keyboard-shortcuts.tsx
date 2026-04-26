/**
 * DEC-027 — global hotkey registration.
 *
 * Reads the resolved catalog and registers every non-`displayOnly`,
 * `scope: 'global'` entry with `@mantine/hooks`' `useHotkeys`. Mantine
 * skips events whose target is `<INPUT>`, `<TEXTAREA>`, `<SELECT>`,
 * or `contenteditable` by default — that's the WCAG 2.1.4
 * input-skipping guarantee. We do NOT pass a custom `tagsToIgnore`
 * argument; the default list is exactly the set DEC-027 mandates.
 *
 * Renders nothing.
 */

import { useMemo } from 'react';
import { useHotkeys } from '@mantine/hooks';

import { useShortcutCatalog } from './shortcut-catalog.ts';

export function KeyboardShortcutsHost() {
  const catalog = useShortcutCatalog();

  const hotkeys = useMemo<Array<[string, () => void]>>(() => {
    const out: Array<[string, () => void]> = [];
    for (const def of catalog) {
      if (def.scope !== 'global') continue;
      if (def.displayOnly === true) continue;
      if (def.available === false) continue;
      for (const key of def.keys) {
        out.push([key, def.run]);
      }
    }
    return out;
  }, [catalog]);

  useHotkeys(hotkeys);

  return null;
}
