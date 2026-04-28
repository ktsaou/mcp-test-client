# SOW-0007 | 2026-04-28 | tab-active-highlight

## Status

in-progress
Maintainer-locked decisions captured 2026-04-28 (Costa: "you are the maintainer; do whatever is best for the project"). Worker to be briefed. Priority: ship before SOW-0006.

## Requirements

### Purpose

The active tab in the Inspector (tools / prompts / resources / templates) and in the top-level layout (inventory / request / log) is not visually obvious at rest. When the panel content changes (e.g. user switches MCP server, the new server doesn't expose prompts → the prompts panel renders an error or empty state), the user can't quickly tell which tab is selected; they have to read the error message to figure out "ah, prompts is selected, let me switch to tools." Direct UX friction Costa flagged.

### User request (verbatim)

> The selected lists tab (tools, prompt, resources, templates) is not highlighted at rest, making the ui confusing when eg prompt is selected and the new mcp server is selected which does not support prompt and returns error or empty, you need to be careful to read the error message to understand "ah! this is not tools, prompts failed, let me switch to tools". This is major UX issue confusing users.

### Assistant understanding

- The Inspector inner tabs (`src/ui/inspector.tsx:189-220`) and the top-level layout tabs (`src/ui/layout.tsx:271-284`) both use Mantine `Tabs variant="default"` with no custom CSS. The "default" variant indicates the active tab with only a thin bottom border — too subtle to register at a glance, especially when a red error Alert dominates the panel below.
- The trigger for confusion is the **server-switch + previously-selected-tab-now-empty** scenario: tab state persists across server switches; the new server lacks the capability; the panel renders an error or empty state; the user can't tell which tab is selected.
- The fix is a stronger active-tab visual at rest (not just hover/focus).

### Acceptance criteria

1. **Active tab obvious at rest.** A user glancing at the tab strip can identify the active tab within 1 second, without hover or focus, on both light and dark themes. Verify: UX-critic on live deploy reports this; advisor measures contrast (target: ≥3:1 between active and inactive states OR equivalent border-weight/color contrast).
2. **Both surfaces fixed.** Inspector tabs (tools / prompts / resources / templates) AND layout tabs (inventory / request / log) get the same active-state treatment.
3. **Hover and focus states still distinguishable.** Hovering an inactive tab still shows hover affordance; keyboard focus still shows a focus ring (WCAG 2.2 AA per `project-reviewing/SKILL.md`).
4. **Server-switch + error scenario resolved.** When the user picks a server that errors/empties the active tab's category, the active-tab indicator stays visible above the error message. (Logical consequence of #1, but called out explicitly.)
5. **No regression on tab Badge counts.** The `<Badge>` rightSection on inspector tabs (per-list count) remains visible and aligned with the new active treatment.
6. **Bundle.** Stays under DEC-005's 350 KB gz cap.

## Analysis

Sources consulted:

- `src/ui/inspector.tsx:189-220` — Inspector Tabs (variant="default")
- `src/ui/layout.tsx:271-284` — top-level Tabs (variant="default")
- `src/ui/shell.css`, `src/ui/theme.css` — confirmed: no custom Tabs CSS overrides exist today (only a doc comment listing `Tabs` among migrated primitives).
- `package.json` — Mantine v9.1; `Tabs.variant` options per Mantine v9: `default | outline | pills`.

Failure mode (logical reasoning; will reproduce on live deploy at execution time):

1. User connects to Server A which exposes prompts. User clicks "Prompts" tab.
2. Inspector renders Server A's prompts list.
3. User picks Server B from the sidebar; Server B doesn't support prompts (32601 on `prompts/list`).
4. Inspector still has `tab === 'prompts'` (state preserved across server switch) → renders the per-list error Alert (`inspector.tsx:261`).
5. Visual: a red Alert dominates the panel; the tab strip's active indicator is a thin line under "Prompts". User assumes "tools is broken" because Tools is the default mental model. Costa's reported confusion.

Marked:

- Fact: variant="default" used at both surfaces (file:line cites).
- Fact: no custom override exists.
- Inference: the thin border alone is the root cause of the confusion (advisor verification at execution).
- Working theory: a stronger visual fully resolves; out-of-scope for this SOW would be persisting tab-state per-server (a bigger UX change Costa didn't ask for).

## Implications and decisions

Maintainer-locked 2026-04-28 (Costa instruction: "You are the maintainer. You should do whatever is best for the project and its users."):

### D1 — Tabs variant: `variant="pills"`

Strongest at-rest active-state signal; matches the developer-tool aesthetic the product targets (`60-second-flow.md` positions us next to Linear / Raycast / Postman). Mantine handles the swap cleanly; the only verifiable risk is Badge alignment inside the pill, easy to confirm at implementation.

Rejected:

- `outline` — relies on a panel border below the strip for the bottom-merge to land; we don't have one. Will look unfinished.
- `default` + CSS override — fragile across Mantine v9 upgrades; same surface area of work as the variant swap, less robust.
- Custom dot/icon indicator — noise on a 4-tab surface; doesn't fix the root cause (the tab needs to _be_ loud, not annotated as loud).

### D2 — Apply to both surfaces

Inspector tabs (tools/prompts/resources/templates) AND layout tabs (inventory/request/log). Same root cause; visual consistency across the chrome and inner tabs is its own win; treating only the inspector tabs would leave the layout-level tabs confusing in the same way after server switches.

### D3 — Hover + focus polish (the small extras)

Add subtle hover background on inactive pills + a visible focus-visible ring meeting WCAG 2.2 AA. The accessibility-auditor advisor would flag focus-ring quality on a new interactive surface anyway (`project-reviewing/SKILL.md`); adding it inside this SOW avoids a round-trip and keeps the visible-surface contract whole.

### Risk register

- Pills variant + Badge rightSection alignment — verify at component test time and in the UX-critic pass.
- Theme variants (light + dark) — both must read clearly; the Mantine default `--mantine-primary-color-filled` should hold but verify.
- DEC-002 mandates UX-critic on visible-surface change → non-skippable gate before ship.

## Plan

Single-unit, low risk. One Worker brief.

Files to touch:

1. `src/ui/inspector.tsx:196` — `variant="default"` → `variant="pills"`.
2. `src/ui/layout.tsx:275` — same swap.
3. `src/ui/shell.css` — append a small block:
   - subtle hover background on inactive `Tabs.Tab`
   - explicit `:focus-visible` outline meeting WCAG 2.2 AA contrast
   - if pills + Badge alignment needs tuning, a minimal override
4. `src/ui/inspector.test.tsx` — assert `aria-selected="true"` on the active tab AND a measurable style distinction (computed background OR border) between active and inactive states.
5. New small e2e or component test asserting the active tab is identifiable when the panel renders the per-list error Alert (the exact failure mode Costa flagged).
6. `.agents/sow/specs/decisions/DEC-032-tabs-pills-variant.md` — record the variant choice + reasoning so it's not re-litigated.

Validation gates:

- Pipeline green: `npm run typecheck && npm run lint && npm test && npm run build && npm run check:bundle`.
- UX-critic on the live deploy (DEC-002 mandatory). Brief explicitly targets the prompts-empty scenario: switch from a server with prompts (e.g. mcp.deepwiki.com/mcp) to a server without (e.g. registry.my-netdata.io/mcp), confirm the active-tab indicator is unmistakable above the error Alert. Evidence via `_evaluate` JSON + `_snapshot` YAML (per `project-reviewing/ux-review.md`).
- Accessibility-auditor advisor pass for new hover + focus-ring styling.
- Bundle: under 350 KB gz.

## Execution log

(To be filled when work begins.)

## Validation

(To be filled at completion.)

## Outcome

(To be filled at completion.)

## Lessons extracted

(To be filled at completion.)
