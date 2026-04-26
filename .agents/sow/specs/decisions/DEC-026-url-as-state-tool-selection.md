# DEC-026 — URL-as-state for tool / args / log filter (2026-04-26)

**Problem.** mcp-test-client already encodes _adding a server_ in the
URL (`?add=<url>&name=&transport=&auth=…`, see DEC-016 #3 and
`docs/integrate-your-mcp-server.md`). What it does not encode is the
state once a developer has _picked a tool and filled in arguments_ —
the very state most worth sharing.

A maintainer of an MCP server who wants to write a "click here to try
my new tool" link in their README has no way to do it today. A
colleague who sends "this tool is broken on Hugging Face Hub" has to
say it in prose: "go to hf.co/mcp, pick `paper-search`, set
`query=foo`, click Send — it returns nothing." That should be a link.

The CRM-design synthesis (§2 invariant 4: "the URL is the source of
truth for view state") and §11 pitfall 2 ("the filter state wipe")
call this out as foundational, not optional. The cost of not doing it
is paid by every operator on every page-refresh and every share.

## What ships

Persist these slices of state in the URL `?` query string (not the
hash — we already use the hash for share-link reproduction
fingerprints; keeping the two surfaces separate avoids collision):

| Param        | Source                           | Decoded into                         |
| ------------ | -------------------------------- | ------------------------------------ |
| `server`     | `mcptc:servers.active`           | The active server id                 |
| `tool`       | request panel selected tool name | The selected tool tab + tool name    |
| `args`       | base64url-encoded JSON of form   | `formValue` for the selected tool    |
| `mode`       | `form` / `raw`                   | Request panel mode toggle            |
| `log_filter` | `mcptc:ui.log.filter`            | `all` / `wire` / `system` / `errors` |
| `log_search` | log filter input text            | The current free-text log filter     |

The URL is the **source of truth** at boot: if `?tool=…&args=…` is
present and the active server exposes that tool, hydrate the form
from the URL **before** consulting `mcptc:tool-state.<server>.<tool>`
local-storage. Local-storage continues to win when the URL is silent
about that slice (the existing DEC-018 behaviour).

Updates push to history with `replaceState` — no back-button noise as
the user types into a field, but page-load and explicit "share this
view" actions can use `pushState`.

A new toolbar button **Copy link** beside Send copies the current
`?server=&tool=&args=&mode=` URL to clipboard. This is the
discoverability anchor: developers see the button, click it, paste
it into Slack — the deep-link behaviour follows naturally.

Credentials are NEVER in the URL. The existing `?add=` policy holds:
no `auth_value`, no bearer token, no header value. Servers that
require auth round-trip with the user typing the secret post-paste,
matching DEC-016 #3.

**Not in scope for v1:** encoding the inspector tabs (we'll likely
handle that in a future DEC alongside per-pane state), encoding
the resource URI being read (Resources tab), encoding the prompt
arguments (Prompts tab — different from tool args).

## Options considered

- **A. Query-string `?key=value` with base64url-encoded JSON for
  `args`.** Chosen. URLs stay readable for the simple case
  (`?server=context7&tool=resolve-library-id`) and the args payload
  rides along when the form is non-trivial.
- B. URL hash `#…` instead of query string. Rejected — already used
  by share-link reproduction; keeping them disjoint avoids
  collision and lets the browser address bar surface the
  shareable bit.
- C. A separate `?share=` parameter that points at a
  short-link-resolver service. Rejected — this is a static-deploy
  zero-backend project; we do not run a URL-shortener.
- D. `nuqs`-style typed search-param library. Considered. Rejected
  for now because we're React Router-free (the app is a single
  shell). A small custom serializer keeps the dependency surface
  minimal; we can adopt nuqs later if the param surface grows.

## Anti-cases

- Updating the URL on every keystroke would spam history. The
  serializer must `replaceState`-debounce updates at 200 ms (mirroring
  the existing tool-state persistence cadence).
- A malformed `args` payload (corrupt base64, invalid JSON, schema
  mismatch) must NOT crash the boot path. Fall back to local-storage,
  log a system-level warning, and continue — the user shouldn't lose
  their workspace because they pasted a bad link.
- The `mcptc:` storage migration shipped in v1.1.20 must precede URL
  hydration so the comparison "is the saved state the same as the URL
  state?" is consistent.

## Falsifier

The DEC has shipped successfully if, on the live deploy:

1. Connect to Context7, select `resolve-library-id`, type
   `libraryName: react`, click **Copy link**. Paste into a fresh
   incognito browser — the same server is selected, the same tool is
   selected, and the input field shows `react`.
2. Refresh mid-form-edit — the server, tool, and args persist.
3. The URL never contains a bearer token, never contains a
   `header_value`, never contains an `auth.value`. Manual eyeball plus
   automated grep on the `?` string before `pushState`.
4. A malformed `?args=zzzz` URL boots cleanly (system log shows
   warning, the form is empty, no crash).
5. Per-tool form-state persistence (DEC-018) still works when the
   URL is silent about `tool`/`args`.
6. Critic-gated under DEC-002.

## Advisor sign-off

UX critic (visible-surface change: Copy link button + URL-driven
hydration). Security advisor strongly recommended for the
"credentials never in URL" guarantee — even though the policy is
already in DEC-016, a fresh review for the args path is cheap.

## Status

Closed — shipped as v1.2.1 (Worker commit `71b5f1e`, release
`6b54526`). Critic verdict `pass` (no followups required). The
"deep link works inside one browser" promise holds end-to-end:
copy → paste → refresh → malformed → migration ordering all PASS.

**Known follow-up — cross-browser server-id portability is broken
and warrants DEC-029.** Catalog servers (Context7, DeepWiki, etc.)
get fresh random nanoids per browser via `useServers()`'s autoMerge.
A URL like `?server=Prw2gQtj` only resolves on the same browser that
generated the id. The README pitch ("click here to try my new tool")
across browsers needs catalog entries to use stable slugs derived
from the catalog manifest; user-added entries keep random ids.
Captured in task #41 (historical: see git log around 2026-04-26).
