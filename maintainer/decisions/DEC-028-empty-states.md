# DEC-028 — Empty states with guidance + action (2026-04-26)

**Problem.** Several mcp-test-client surfaces show a blank-or-near-blank
panel when there's no data to display, and the user has to guess
whether they're looking at: (a) loading, (b) a server that genuinely
exposes nothing under that tab, (c) a filter that excluded
everything, or (d) a permission/connection failure.

CRM-design synthesis (§6.9 Contextual Empty States, §11 Silent
Failure 1) is unequivocal: "an empty table with headers and no rows
is confusing"; the empty state must explain the situation AND
suggest the next action. We do this for the sidebar
("No servers yet — Click Add to connect to an MCP server.") but
inconsistently elsewhere.

## Surfaces missing or weak today

| Surface                                             | Today                                                         | Should say + offer                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inventory tabs when count is 0 (Tools/Prompts/Res.) | "No tools" or just no rows, depending on tab                  | "This server doesn't expose any tools." (or "prompts" / "resources" / "templates"). Offer: link to the MCP tool spec, link to the server's docs. |
| Inventory tabs while inventory is loading           | Last-server's stale list briefly visible during reconnect     | Skeleton — see DEC-029 separately.                                                                                                                |
| Log when filter excludes everything                 | Empty log panel                                               | "No log entries match `<filter>`." Offer: chip showing the active filter with `×` to clear, "Clear filter" button.                                |
| Resources tab when reads have failed                | Looks identical to "no resources"                             | If the most recent `resources/list` errored, show the error inline with retry; do NOT show an empty state masquerading as success.                |
| Request panel before a tool is selected             | Already OK ("Select a tool…")                                 | Keep, but link to "Pick a tool from the inventory" with `↑↓` hint.                                                                                |
| Server inventory before connect                     | Already OK ("Connect to a server to see its inventory.")      | Keep.                                                                                                                                             |
| Sidebar with zero servers                           | Already OK ("No servers yet — Click Add to connect…")         | Keep.                                                                                                                                             |

The pattern across all of them: a Mantine `Center` + `Stack`
containing a small icon, one-line explanation, and one CTA. Match the
existing sidebar empty state's tone: matter-of-fact, no marketing
fluff, no illustrations.

## What ships

A new `<EmptyState icon, title, description, action />` component
backed by Mantine primitives. Replaces every ad-hoc empty render in
the four-or-five surfaces above with calls to it.

The component:

- Renders nothing decorative — single-line icon (Lucide), 1–2 line
  description, optional action button or link.
- Sits inside its container's normal scroll viewport (no fixed
  positioning).
- Inherits `--color-text-muted` and the existing dark/light tokens.

Empty-state copy is a single string per surface, hard-coded. No
internationalisation pretence — the rest of the app is English-only.

## Options considered

- **A. One shared `<EmptyState>` component, hard-coded copy per
  surface.** Chosen. Simple, no abstraction tax.
- B. A copy table indexed by surface key. Rejected — the surface
  count is small (5–6) and the copy isn't reused. Premature
  abstraction.
- C. Illustrations from a stock pack (e.g. `undraw`). Rejected — CRM
  synthesis §6.3 explicitly warns against decorative empty-state
  illustrations in admin tools; they consume vertical space and don't
  match the project's tone.

## Anti-cases

- Empty state must NOT replace error state. If the most recent
  inventory fetch errored, render an error-state component, NOT
  EmptyState. Worker brief must include both surfaces.
- Filtered-empty must show the active filter chip with `×` so the
  user can clear in place. (CRM synthesis §11 silent-failure 1.)
- Loading is a skeleton, NOT an empty state. (See DEC-029.)
- The "what is a tool / prompt / resource / template?" link in the
  empty-tab states must point to the upstream MCP spec, not to a
  local doc we'd then have to maintain.

## Falsifier

The DEC has shipped successfully if, on the live deploy:

1. Connect to a server with empty `prompts/list`. The Prompts tab
   shows: "This server doesn't expose any prompts." with a link to
   the MCP prompts spec section.
2. Connect to a server, generate ≥ 5 log entries, set the log filter
   to a string that matches none of them. The log panel shows: "No
   log entries match `<term>`." plus a chip with `×` and a "Clear
   filter" button.
3. The empty-state component is the same React component in every
   surface — `git grep` finds zero ad-hoc "no … yet" JSX outside the
   component itself.
4. Failed inventory fetches still show the existing red error
   surface, NOT the empty-state component (verify by disconnecting
   network mid-load).
5. Critic-gated under DEC-002.

## Advisor sign-off

UX critic (visible surface, copy review). The empty-state copy is
the actual user-facing wording — must be reviewed in the critic
verdict not just for presence but for tone.

## Status

Open — assigned to v1.2.0. Lower priority than DEC-025/DEC-026; can
ship in a separate PR.
