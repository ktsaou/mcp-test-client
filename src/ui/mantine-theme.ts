/**
 * Mantine theme overrides.
 *
 * Default Mantine v9 looks already; we set:
 *   - default colour scheme = dark (per product.md §4)
 *   - primary colour = a single neutral-ish accent that reads well on both
 *     dark and light backgrounds
 *   - fonts to match what we use elsewhere
 *   - `colors.dark`: a custom 10-shade palette matching VS Code Dark
 *     Modern (the default theme since VS Code Sept 2022). Mantine reads
 *     `dark[7]` as the body background, `dark[6]` as raised surfaces
 *     (modal / popover), `dark[8]` for chrome surfaces, and `dark[5]`
 *     for borders. Without this override, Mantine's stock dark palette
 *     gives a slightly grey body bg that disagrees with our theme.css
 *     custom properties. Costa: "match modern vscode, sections still
 *     oriented".
 */

import { createTheme, type MantineColorsTuple } from '@mantine/core';

const darkModernShades: MantineColorsTuple = [
  '#cccccc', // 0  — text foreground (lightest)
  '#a8a8a8', // 1
  '#9d9d9d', // 2  — muted text
  '#858585', // 3
  '#6e6e6e', // 4
  '#3c3c3c', // 5  — border
  '#2b2b2b', // 6  — raised surface (modal, popover)
  '#1f1f1f', // 7  — body bg (editor.background — main content panels)
  '#181818', // 8  — chrome bg (sideBar.background, panel.background)
  '#0d0d0d', // 9  — deepest
];

export const appTheme = createTheme({
  primaryColor: 'cyan',
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyMonospace:
    'ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Roboto Mono", Consolas, "DejaVu Sans Mono", monospace',
  defaultRadius: 'sm',
  colors: {
    dark: darkModernShades,
  },
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
