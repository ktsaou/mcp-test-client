# Design system

Synthesised from the relevant decisions and the live theme bridge in
`src/ui/mantine-theme.ts`. This file does not duplicate decisions — it
links to them.

## Library

**Mantine v9.** Picked for batteries-included coverage (~250 components),
opinionated visual style (so we don't re-taste-make every component), and
matching React 19 peer requirement. Pinned to v9 — v8.3.18 is the last 8.x
release. Rationale and migration risks:
[`../decisions/DEC-001-mantine-v9.md`](../decisions/DEC-001-mantine-v9.md).

## Theme

From `src/ui/mantine-theme.ts`:

- **Primary colour:** `cyan` — a single neutral-ish accent that reads on
  both dark and light.
- **Default radius:** `sm`.
- **Fonts:** system stack (`system-ui, -apple-system, "Segoe UI", Roboto,
"Helvetica Neue", Arial, sans-serif`); monospace stack
  (`ui-monospace, "SF Mono", Menlo, Monaco, "Cascadia Mono", "Roboto
Mono", Consolas, "DejaVu Sans Mono", monospace`). No third-party fonts
  (anti-goal).
- **Default colour scheme:** dark (per [`quality-bar.md`](quality-bar.md)).
  Light theme is a real second-class citizen, not an afterthought.
- **Component defaults:** `Tooltip` opens with arrow + 350 ms open delay;
  `ActionIcon` is `subtle` by default; `Modal` is centered with a blurred
  overlay.

## Layout

Mantine `<AppShell>` for the chrome (header, navbar, aside, optional
footer); `react-resizable-panels` for **both** inner splits — at minimum
inspector-vs-request and main-vs-log. Sizes persist to localStorage under
`mcptc:ui.*` (see `specs/persistence.md`). The tools list MUST live behind
`react-resizable-panels`, **not** inside `AppShell.Navbar` (the Navbar is
not draggable). Rationale:
[`../decisions/DEC-004-mantine-appshell-resizable.md`](../decisions/DEC-004-mantine-appshell-resizable.md).

## Components used

| Quality-bar item                               | Mantine component        | Notes                                                                                                                                                                                                                       |
| ---------------------------------------------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons with hover/active/disabled/busy states | `Button`, `ActionIcon`   | Snapshot hover state in Playwright before merge (Mantine #8482 risk under React 19).                                                                                                                                        |
| Tooltips on every actionable element           | `Tooltip`                | Theme defaults: `withArrow`, 350 ms open delay.                                                                                                                                                                             |
| Real modals (not `window.prompt()`)            | `Modal`                  | Free focus trap, Escape-to-close, Enter-to-submit.                                                                                                                                                                          |
| Real tabs                                      | `Tabs`                   | Free `role="tab"`, `aria-selected`, arrow-key nav.                                                                                                                                                                          |
| Toasts confirm side effects                    | `@mantine/notifications` | Saved / copied / deleted.                                                                                                                                                                                                   |
| Command palette                                | `@mantine/spotlight`     | Optional; not in v1.1 critical scope.                                                                                                                                                                                       |
| Code highlight                                 | not used for JSON        | The bespoke newline-respecting renderer ships per [`../decisions/DEC-003-json-view-newlines.md`](../decisions/DEC-003-json-view-newlines.md); `@mantine/code-highlight` is the bundle trap to avoid (see DEC-001 sign-off). |
| Resizable splitters                            | `react-resizable-panels` | Both axes.                                                                                                                                                                                                                  |

The bespoke `src/schema-form/` per-field renderer stays — Mantine doesn't
ship that exact shape and the UX critic flagged it as already-good
(2026-04-25).

## Bundle budget

CI fails when `dist/assets/*.js` total exceeds **350 KB gzipped**. Threshold
chosen above the 230 KB analyst estimate to allow normal feature growth,
well under the 400 KB CodeHighlight-trap line. Rationale:
[`../decisions/DEC-005-bundle-budget.md`](../decisions/DEC-005-bundle-budget.md).
