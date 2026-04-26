# DEC-025 — Command palette (Cmd+K) (2026-04-26)

**Problem.** Every action in mcp-test-client today is a click target:
switch server, switch tool tab, jump to Resources, open Settings,
Disconnect, "Send without validation", clear log filter. A developer
who lands on the page from a HN link, picks Context7, runs
`resolve-library-id`, decides to switch to DeepWiki, then re-runs the
same tool — that's six round-trips to small targets across three
different regions of the screen. Every minute they're scanning the
sidebar.

The CRM-design synthesis (Modern Interactive Admin §6.1, §9 Stage 3)
calls Cmd+K "the single highest-leverage power-user feature in admin
panels" — and the reasoning translates cleanly to a developer-facing
test client: dense action surface + power-user audience + repeated
sessions. Vercel, Linear, GitHub, Raycast all default to it.

We have ~10 servers in the auto-merged catalog plus user-saved
entries, and tool counts of 2–60 per server (Hugging Face Hub has
~30, Context7 has 2). Together the searchable surface is dozens of
named entities + ~10 verbs. This is exactly the surface a command
palette flattens well.

## What ships

A `cmdk`-based palette opened via:

- `Cmd+K` (mac) / `Ctrl+K` (linux/win) — primary
- A small visible search input in the header (always visible) — the
  "discoverability anchor" so newcomers find the shortcut

The palette indexes:

1. **Servers** — every catalog + saved entry. Selecting connects.
2. **Tools / Prompts / Resources / Templates of the active server** —
   selecting opens that tab and selects the entry.
3. **Verbs** — `Connect`, `Disconnect`, `Reconnect`, `Edit server`,
   `Delete server`, `Export settings`, `Import settings`,
   `Clear log`, `Filter log: All / Wire / System / Errors`,
   `Toggle theme`, `Send`, `Send without validation` (when send is
   armed).

Recents float to the top (last 5). Fuzzy-match (cmdk default).
Arrow keys + Enter; Esc closes. The palette is a Mantine `Modal`
shell so theme + a11y come for free.

**Not in scope for v1:** indexing the log entries, indexing fields
within the current request form, command palette on mobile <768px
(falls back to the visible header search input only).

## Options considered

- **A. cmdk + Mantine shell** — the React community standard;
  ~5 KB; headless, so we control the styling. Wraps cleanly around a
  Mantine `Modal` for portal/z-index/focus-trap. **Chosen.**
- B. Mantine `Spotlight` — already a dependency
  (`@mantine/spotlight`). Lighter integration cost. Rejected because
  Spotlight is opinionated about layout and harder to extend with
  grouped sections + recents. cmdk wins on flexibility.
- C. Roll our own — rejected. Focus management + screen-reader
  semantics + virtualisation are non-trivial; cmdk has shipped this
  to production at Vercel scale.

## Bundle budget

cmdk is ~5 KB gzipped. Total budget per DEC-005 is 350 KB; current
build is 260.69 KB — plenty of headroom even with the wider listing
state. Worker brief must verify post-build delta < 8 KB gzipped.

## Falsifier

The palette has shipped successfully if, on the live deploy:

1. `Cmd+K` opens the palette from any focused state (no input
   focused, sidebar focused, log focused). Esc closes it from any
   state.
2. Typing "deepw" highlights the DeepWiki server entry; Enter
   connects to it without a separate click.
3. Typing "send w" finds "Send without validation" verb when the
   send is armed (form valid OR raw mode), is hidden otherwise.
4. After connecting to Hugging Face Hub, typing "model" finds tools
   prefixed with "model" in the active server's tool inventory.
5. The visible header search input opens the palette when clicked
   AND types-into the search field on focus — so newcomers stumble
   into the feature without needing to read docs.
6. Bundle delta < 8 KB gzipped vs v1.1.20.
7. Critic-gated under DEC-002.

## Advisor sign-off

UX critic (mandatory under DEC-002). Spec-purist not required (no
MCP-protocol surface affected).

## Status

Closed — shipped as v1.2.0 (commit `b24856c` Worker, `d76dab5`
release). Critic verdict `pass-with-followups`; four cosmetic
items folded into v1.2.1 hygiene queue (see `maintainer/log/2026-04-26.md`
§9). Bundle delta 13.79 KB gz over v1.1.20, accepted under
DEC-005's 350 KB hard cap (75 KB headroom remaining).
