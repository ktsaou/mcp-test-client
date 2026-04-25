# DEC-016 — Onboarding and connection ergonomics (2026-04-25)

**Problem.** Three friction points conspire to make the "first
connection" experience feel like work:

- The Connect button is in the header, far from the server list — the
  user clicks the server, walks the cursor up-and-right, then clicks
  Connect.
- Adding a server is two trips: fill modal → save → walk to header →
  Connect. The modal saves bad URLs / bad credentials happily.
- Server maintainers can't deep-link from their docs to a pre-filled
  add-server flow.

Costa's items #3 (URL-driven add-server), #4 (connect-on-save with
required auth), #5 (click-to-connect on server-list selection), and
#11 (cancel inflight on server switch — subsumed by #5).

## Sub-item checklist

- [ ] **#5 — click-to-connect on server-list selection.** Selecting a
      `<NavLink>` in the sidebar triggers connect immediately. The
      header Connect button stays for keyboard / no-server-yet edge
      cases (or removed if we can't justify it).
- [ ] **#11 — cancel inflight on server switch.** When the user
      switches to a different server (or disconnects), every
      in-flight request must be cancelled via JSON-RPC
      `notifications/cancelled` (the SDK supports this through
      `AbortController`) and each cancelled request must appear in
      the log marked `cancelled` (system-message style).
- [ ] **#4 — connect-on-save modal.** Save in the add/edit-server
      modal becomes "Save and connect": kicks off the connect; the
      modal stays open with a spinner while connecting; on success
      the entry persists and the modal closes; on failure the entry
      is **not** persisted and the modal shows the connection error
      (Mantine `Alert` color="red") in-place. User can edit and
      retry.
- [ ] **#4 — required auth field.** When the user selects a non-`none`
      auth method, the auth-value input becomes required: red border + helper text on empty / whitespace; submit blocked until
      filled.
- [ ] **#3 — URL-driven add-server modal.** On app load, parse query
      string. If `?add=<url>` is present: - If a server entry with that exact URL already exists, **do
      not show the modal** — select that entry and trigger connect. - If not, open the add-server modal pre-filled with the
      passed-in fields. Supported params: - `add` — server URL (required to trigger the flow) - `name` — friendly name - `transport` — `auto` / `streamable-http` / `sse-legacy` /
      `websocket` - `auth` — `none` / `bearer` / `header` - `auth_header_name` — when `auth=header` - (No `auth_value` ever — credentials must be entered by the
      user, not encoded in a URL maintainers publish.) - Strip the query string after consumption (same hygiene as
      the share-link hash).

## Direction

The server-list `NavLink` already supports an `active` state and an
`onClick`. Wire `onClick` to a new `connectActive(id)` function that:

1. If the chosen server is already active and connected, no-op.
2. If a different server is connected, abort all inflight requests
   first (via the connection context's `client.disconnect()` which
   already aborts the SDK's `AbortController`); log each cancelled
   id as a system-error log entry with `cancelled` reason.
3. Set the new active id; trigger connect.

The add/edit-server modal's `onSubmit` becomes async:

1. Validate all fields (auth value required if auth ≠ none).
2. **Don't persist yet.** Construct an in-memory `ServerEntry`,
   try to connect via a one-shot `McpClient`. If success: persist via
   `add()`/`update()`, set active, close modal, show toast. If
   failure: surface the error in the modal, do not persist.

URL-param parsing lives in `src/state/url-params.tsx` (new) — a small
context that runs once on mount, reads `window.location.search`,
applies, and clears the params via `history.replaceState`. It must
**not** auto-connect for safety (just like share-link loader §6 of
specs/shareable-urls.md). It pre-fills and selects; the click is the
user's.

Actually wait — Costa explicitly says #3: "If users already have
configured this mcp URL, no modal should be shown and their configured
mcp server should be selected and **probably connected**." So the
URL-param flow MAY auto-connect when the URL matches an existing entry
(the user has already given consent by saving that server). For new
servers it must NOT auto-connect — the user fills the modal, sees the
auth fields, decides.

## Falsifier

- A user clicks a server in the sidebar and the connection doesn't
  start within 200 ms of the click.
- The add-server modal lets the user save a server with a wrong URL
  or wrong token.
- An empty auth value passes validation when an auth method is
  selected.
- A `?add=...` URL with a known server opens the modal anyway.
- A `?add=...` URL with a new server triggers a network call before
  the user sees and confirms the modal.
- Switching servers leaves an in-flight request hanging without a
  log entry.

**Advisor sign-off.** Pending — UX critic (with the alignment-under-
squeeze + connect-flow scopes both checked) post-implementation.

**Status.** Open. Worker brief drafts after v1.1.2 ships. Target
release: v1.2.0.
