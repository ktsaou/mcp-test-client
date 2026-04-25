/**
 * Mantine theme overrides.
 *
 * Default Mantine v9 looks already; we set:
 *   - default colour scheme = dark (per product.md §4)
 *   - primary colour = a single neutral-ish accent that reads well on both
 *     dark and light backgrounds
 *   - fonts to match what we use elsewhere
 */

import { createTheme } from '@mantine/core';

export const appTheme = createTheme({
  primaryColor: 'cyan',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Roboto Mono", Consolas, "DejaVu Sans Mono", monospace',
  defaultRadius: 'sm',
  components: {
    Tooltip: {
      defaultProps: {
        withArrow: true,
        openDelay: 350,
        closeDelay: 50,
      },
    },
    ActionIcon: {
      defaultProps: {
        variant: 'subtle',
      },
    },
    Modal: {
      defaultProps: {
        centered: true,
        overlayProps: { backgroundOpacity: 0.55, blur: 2 },
      },
    },
  },
});
