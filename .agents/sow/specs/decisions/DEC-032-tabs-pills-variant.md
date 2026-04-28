# DEC-032 — Tabs switch to pills variant for at-rest active state (2026-04-28)

**Problem.** Costa flagged a major UX failure on the live deploy:

> The selected lists tab (tools, prompt, resources, templates) is not
> highlighted at rest, making the ui confusing when eg prompt is
> selected and the new mcp server is selected which does not support
> prompt and returns error or empty, you need to be careful to read the
> error message to understand "ah! this is not tools, prompts failed,
> let me switch to tools".

Both `Tabs` surfaces — the inspector inner tabs
(`src/ui/inspector.tsx:189-220`, tools / prompts / resources /
templates) and the layout-level tabs
(`src/ui/layout.tsx:271-284`, inventory / request / log) — used
Mantine v9's `variant="default"`. That variant signals the active tab
with only a thin bottom border. When the panel below renders a red
error Alert (server returns 32601 / empty for the currently-selected
category after a server switch), the Alert dominates the column and
the thin border underneath the active tab effectively disappears.

## Options considered

- **`variant="pills"`** (chosen) — Mantine paints the active tab with
  the primary filled colour; loud at rest, matches developer-tool
  aesthetic.
- **`variant="outline"`** — relies on a panel border below the strip
  for the bottom-merge to land cleanly. The inspector and layout
  surfaces don't have that border; result would look unfinished.
- **Keep `default`, add custom CSS for stronger active state** —
  fragile across Mantine v9 upgrades; same surface area of work as
  the variant swap, less robust.
- **Custom dot/icon active indicator** — visual noise on a 4-tab
  surface; doesn't fix the root cause (the tab needs to _be_ loud,
  not annotated as loud).

## Decision

Switch both surfaces to `variant="pills"`. Apply consistently — same
root cause at both. Add a small `src/ui/shell.css` block to:

- pin the active fill (`--mantine-primary-color-filled`) deterministically,
- give inactive pills a subtle hover background
  (`--mantine-color-default-hover`) so the strip still feels alive,
- give pills a `:focus-visible` outline (2 px, accent colour, ≥3:1
  against the tab background on both themes — WCAG 2.2 AA), since
  pills sit on top of the chrome and the global 1 px outline is too
  thin to register.

Inspector Badge `rightSection` (per-list count) keeps Mantine's
default pill horizontal padding; alignment verified at component-test
time.

## Falsifier

The decision is bad if any of these hold on the live deploy:

1. The active tab is not identifiable in under 1 second from a glance
   at the tab strip — at 1280×800 and 390×844, both light and dark
   themes.
2. The Badge count rightSection on inspector tabs is misaligned,
   clipped, or overlaps the active pill at any width.
3. Hover state on inactive tabs is missing or visually identical to
   the active state.
4. Keyboard focus is no longer visible after the change (regress on
   `project-reviewing/SKILL.md` accessibility-auditor checklist).
5. The bundle exceeds 350 KB gz (DEC-005).
6. The Costa-flagged scenario regresses: switch from a server with
   prompts (e.g. `mcp.deepwiki.com/mcp`) to one without
   (e.g. `registry.my-netdata.io/mcp`); the active tab indicator must
   stay unmistakable above the error Alert.

## Advisor sign-off

UX critic (DEC-002 mandatory; visible-surface change). Advisor brief
explicitly targets the prompts-empty server-switch scenario.

## Status

In flight — implemented under SOW-0007. UX-critic gate runs after
the maintainer cuts the live deploy.
