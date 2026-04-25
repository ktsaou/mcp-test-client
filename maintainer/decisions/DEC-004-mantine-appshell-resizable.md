# DEC-004 — Mantine spec for layout, panels, log (2026-04-25)

**Problem.** v1.0 hand-rolled the shell layout. Result: panels not resizable
in all directions, tools list a fixed sliver, log a fixed bottom strip.

**Options considered.**

- _Keep the partial hand-rolled resizer (already in `src/ui/layout.tsx`)._
  Workable but limited to two axes; fragile.
- _Use Mantine's `<AppShell>` + an external `react-resizable-panels` for
  the inner splitter._ `react-resizable-panels` is the gold standard for
  this and has 1k+ stars; pairs cleanly with Mantine.
- _Use only `react-resizable-panels` without Mantine `<AppShell>`._ Doable
  but we lose the navbar / header niceties from `<AppShell>`.

**Decision.** Mantine `<AppShell>` for the chrome (header, navbar, aside,
optional footer). `react-resizable-panels` for the inner splits — at minimum
inspector-vs-request and main-vs-log. Sizes persist to localStorage under
`mcptc:ui.*` (already reserved in `specs/persistence.md`).

**Falsifier.** Resizable handles feel janky on common viewports (1280×800,
1920×1080, 2560×1440), or sizes don't persist across reloads.

**Advisor sign-off.** Pending — UX critic to walk three viewport sizes.

**Status.** Active.
