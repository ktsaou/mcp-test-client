# DEC-001 — Adopt Mantine **v9** as the UI component library (2026-04-25, revised)

**Problem.** v1.0 used hand-rolled CSS + bare HTML elements. Result: no
visible button states, no tooltips, no proper modals, no toasts, hand-rolled
resizable layout that almost works. Costa's feedback singled this out as
the root visible failure.

**Options considered.**

- _Mantine v8 / v9._ Batteries-included. ~250 components, dark/light theme,
  modals, tooltips, notifications, command palette (`@mantine/spotlight`),
  code highlight, splitter via `react-resizable-panels`. Opinionated visual
  style.
- _shadcn/ui + Tailwind v4._ Components copied into the repo, fully owned.
  Tree-shaken. Requires Tailwind. We hand-style each component (more code,
  more taste needed, slower to "done" — exactly what bit me last time).
- _Chakra UI v3._ Similar to Mantine. Smaller component set; no Spotlight or
  CodeHighlight equivalents — would not shorten the migration path.
- _Radix Themes._ What MCP Inspector uses. Pre-themed Radix primitives but
  smaller component set; still hand-build splitter, command palette.
- _Park UI / Ark UI._ Real, but pulls in Panda CSS as a build-time concern.
  Second tooling decision on top of a UI decision; contradicts
  "lowest time-to-good".

**Decision.** **Mantine v9.** Originally chose v8; revised to v9 after the
framework analyst flagged that v8.3.18 is explicitly the last 8.x release and
v9.1 shipped 2026-04-21. Our React 19.2 stack already meets v9's `react@^19.2`
peer requirement. Visual style is "default Mantine v9"; no bespoke styling.

**Falsifier.** If after the migration the §4 quality-bar items are still
failing — buttons without active states, missing tooltips, `prompt()` instead
of modals — Mantine wasn't the bottleneck and [DEC-001](DEC-001-mantine-v9.md) was wrong. Try again.

**Advisor sign-off (2026-04-25).** Framework-choice analyst confirmed
Mantine over shadcn/Radix/Chakra/Park, _with the version corrected to v9_,
and surfaced four concrete risks that I must mitigate during migration:

1. **[Mantine #8482](https://github.com/mantinedev/mantine/issues/8482)** —
   Button hover styles missing under React 19 in some configurations.
   Mitigation: snapshot hover state in a Playwright test before merge of the
   button replacement PR.
2. **[Mantine #8461](https://github.com/mantinedev/mantine/issues/8461)** —
   `Radio` deselect bug under React 19. Mitigation: if the form renderer
   uses `Radio`, test deselection explicitly; workaround is keying by hash.
3. **`AppShell.Navbar` is not draggable** ([discussion #6878](https://github.com/orgs/mantinedev/discussions/6878)).
   The tools list MUST live behind `react-resizable-panels`, not inside
   `AppShell.Navbar`, or the v1.0 "tools list takes 1/3 fixed width" bug
   recurs verbatim.
4. **`@mantine/code-highlight` bundle trap.** Default-importing pulls in
   ~300 KB of `highlight.js`. Mitigation: register only the languages we
   actually use (`json`, possibly `bash` / `markdown`). Better still: do
   not use CodeHighlight for JSON — [DEC-003](DEC-003-json-view-newlines.md) already calls for the bespoke
   newline-respecting renderer, and the analyst confirmed CodeHighlight
   does not solve that requirement.

Real bundle estimate (analyst): **180–230 KB gzipped** of UI framework code
plus ~5 KB for `react-resizable-panels`. Higher than my initial guess of
100–150 KB. **Acceptable**, but treated as a budget — see [DEC-005](DEC-005-bundle-budget.md).

**Status.** Active, advisor-signed-off, version corrected to v9.
