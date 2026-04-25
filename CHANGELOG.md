# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

(v1.2 work tracked in DEC-016 through DEC-023 and GitHub issues.)

## [1.1.19] - 2026-04-26

DEC-020 — inflight activity indicator (visibility-only).

### Added

- **Activity icon in the connection bar.** A small icon next to the
  Settings / GitHub / Theme cluster shows a spinner + count badge
  whenever JSON-RPC requests are in flight — i.e. an outgoing
  request whose paired response hasn't landed yet. When idle (count
  = 0), the icon dims to a thin circle outline. Click the icon to
  open a popover listing each pending request: method, target tool
  name (when applicable), and elapsed time.
- **Future-proof for additional activity types.** The icon's
  framing isn't request-specific — Costa's call: "the icon with
  some animation would be ok — we may have more types of activity
  in the future". Background reconnects, polling, etc. can hang
  off the same surface later.

### Notes

- Cancel buttons in the popover are deliberately NOT in v1.1.19.
  Routing an `AbortController` per request through the SDK so the
  cancel actually terminates the wire request (and emits
  `notifications/cancelled`) is a separate change. Visibility-only
  for now matches Costa's "show that something is in progress"
  ask; cancellation is the v1.2 follow-up.
- Inflight set is derived from the existing log entries in render
  (LOG_CAP=500 makes this trivially cheap, ~500 ops per render),
  not a separate context. One source of truth.
- 227 unit tests pass; lint, typecheck, build clean.

## [1.1.18] - 2026-04-26

DEC-021 — settings export and import.

### Added

- **Export settings** to a JSON file (gear icon in the header → Export
  settings…). Walks every `mcptc:*` key in localStorage and produces
  a `version: 1` blob with all servers, layout, theme, canned
  requests, per-tool form snapshots. The export modal carries a
  `Include credentials` checkbox (default on, with a yellow Alert
  warning); turning it off strips bearer tokens / custom-header
  values from the saved server entries before download — safe to
  share with a colleague.
- **Import settings** from a JSON file (gear icon → Import
  settings…). Validates `version: 1`, refuses files newer than the
  app supports, refuses anything malformed. On success, replaces
  every `mcptc:*` key with the imported value and reloads the app
  so all state slices pick up the change. Round-trip works between
  browsers / machines.

### Notes

- Bundle delta: ~3 KB gz (~0 visible deps; the new helper is small).
- 227 unit tests pass; lint, typecheck, build clean.

## [1.1.17] - 2026-04-26

DEC-017 + DEC-022 #1 — curated server catalog auto-merge and a
GitHub icon in the header.

### Added

- **Curated public-server catalog** seeded with 9 verified no-auth
  MCP servers (Context7, DeepWiki, GitMCP, Cloudflare Docs, Hugging
  Face Hub, Netdata Registry, Manifold Markets, NYC Transit,
  Ferryhopper) plus 1 auth-required entry (Cloudflare API).
  Verified live in the April 2026 research pass.
- **Catalog auto-merge on first paint** (DEC-017 #8). No-auth
  entries are silently inserted into the user's server list at
  app boot — the empty-state experience for a brand-new user is
  populated, not blank. URLs the user has explicitly removed are
  tombstoned (`mcptc:catalog-tombstones`) so a deleted catalog
  entry stays deleted across reloads.
- **"Pick a known server" dropdown** in the add-server modal
  (DEC-017 #9). Pre-fills URL / name / transport / auth shape from
  the auth-required catalog. Credentials remain the user's
  responsibility — the dropdown only populates the structural
  fields.
- **GitHub icon in the header** (DEC-022 #1). Inline SVG (no new
  icon dep) linking to the source repo with `target="_blank"
rel="noopener noreferrer"`. Sits next to the theme toggle.

### Notes

- The catalog is shipped as a static `public-servers.json` so PRs
  to add / retire / re-flag entries don't require a code change.
  The schema accepts `status: 'active' | 'unstable' | 'retired'`
  — `retired` entries are skipped on auto-merge.
- 227 unit tests pass; lint, typecheck, build clean.

## [1.1.16] - 2026-04-26

DEC-019 — Send button validation gate + bypass split-button.

### Added

- **Form validation gate.** In form mode, the Send button is now
  gated on the tool's `inputSchema` (cfworker, draft 2020-12). If
  the form value doesn't validate, the button is disabled and the
  tooltip surfaces the failure count. Until v1.1.15 the form
  always sent; nothing was checked on the way out.
- **"Send without validation" bypass.** A chevron next to Send
  reveals a single menu item for the deliberate per-click bypass.
  MCP server developers who want to pressure-test how their server
  handles malformed input can use this without disabling the gate
  for normal users. Every bypass writes a `warn`-level system-log
  entry — `tools/call · <name> — sent without validation` — so the
  trace shows the request was knowingly malformed.

### Notes

- Bypass state is per-send only — never persisted, never sticky.
  Costa's call: every bypass is an explicit choice.
- The chevron only appears in form mode (raw mode has no schema to
  bypass).
- 227 unit tests pass; lint, typecheck, build clean.

## [1.1.15] - 2026-04-26

DEC-018 — per-tool form-state persistence with auto-restore on
server return.

### Added

- **Form state survives tool / server switching.** Switching from
  tool A1 to A2 then back to A1 used to drop A1's form to empty.
  v1.1.15 persists `{ formValue, rawText, mode, lastResult }` per
  `(server, tool)` in `mcptc:tool-state.<server>.<tool>` and hydrates
  the request panel on selection-change. Saves are debounced 200 ms.
- **Auto-reselect last tool on server return.** When the user
  switches servers and returns, the tool they were on (per
  `mcptc:last-selection.<server>`) is auto-re-selected once the new
  server's inventory loads. Combined with the per-tool persistence,
  the user picks up exactly where they left off — including the
  values they had typed.

### Changed

- `<ClearSelectionOnServerSwitch>` from v1.1.13 is replaced by
  `<RestoreSelectionOnServerReady>`. Server switch still clears the
  selection immediately (so the form empties on click and the user
  isn't confused by a stale form rendering against the new server's
  loading inventory). The auto-restore fires once
  `status === 'connected'` AND the saved tool exists in the new
  inventory — strictly after the clear, so there's no flash of the
  wrong form.

### Notes

- 64 KB cap per per-tool snapshot — oversized snapshots trim
  `lastResult` and the raw editor text and re-attempt; on still-too-
  big the persistence is silently skipped (no UI breakage).
- 200-entry LRU across all `mcptc:tool-state.*` keys to keep
  localStorage healthy on heavy users.
- Bundle delta: ~1.7 KB gz (from 252 to 254 KB initial-load gz).
  Well under DEC-005's 350 KB cap.
- 227 unit tests pass; lint, typecheck, build clean.

## [1.1.14] - 2026-04-26

Closes the remaining DEC-016 sub-items.

### Added

- **URL-driven add-server modal** (DEC-016 #3). On first paint the
  app reads `?add=<url>&name=…&transport=…&auth=…&auth_header_name=…`
  from the query string. If the URL matches a saved server, it is
  selected and connected (the user already consented when they saved
  it; no third-party initiation). If the URL is new, the add-server
  modal opens pre-filled with everything except credentials —
  tokens never travel in URLs maintainers publish. The query string
  is stripped after consumption so reloads don't re-apply.
- **Connect-on-save modal** (DEC-016 #4). The Save button is now
  "Save and connect": it probes the server with the current config
  before persisting. On success the entry is saved (or updated, in
  edit mode) and the modal closes. On failure the entry is **not**
  persisted and the modal stays open with the connection error
  inline so the user can fix the URL / token / header name and
  retry. Required-auth fields are now strictly required: the bearer
  token / header name / header value inputs show inline "required"
  errors and the Save button is disabled until they're filled.

### Notes

- DEC-016 is now done; the remaining v1.1.x backlog is DEC-017
  (catalogs), DEC-018 (per-tool persistence), DEC-019 (Send w/o
  validation), DEC-020 (inflight indicator), DEC-021 (export/import),
  DEC-022 (chrome polish + docs viewer), DEC-023 (LLM chat),
  DEC-015 (share-link reproduction).
- 227 unit tests pass; lint, typecheck, build clean.

## [1.1.13] - 2026-04-25

Two follow-ups Costa flagged after using v1.1.12 against a slow
server. Both come down to "the user has no clear signal that work is
in progress, so an empty Inspector reads as 'broken' instead of
'still loading'".

### Fixed

- **Status badge stays `Connecting` until the inventory is loaded.**
  Until v1.1.12 the badge flipped to `Connected` after just the
  initialize handshake, while `tools/list` / `prompts/list` /
  `resources/list` were still mid-flight. On a slow server (e.g.
  llm.netdata.cloud takes ~95 s for the four inventory calls) the
  user saw `Connected` + empty Inspector and reasonably assumed the
  app was broken. The status flip now happens alongside the
  `Ready.` log entry and the success toast — three signals in
  lockstep. The Connect-button spinner stays spinning across the
  whole window. Costa: _"show CONNECTING and SPINNER while the
  connection is in place, and switch them to CONNECTED and
  DISCONNECT together with the success toast"_.
- **Form clears when the active server changes.** Switching from
  server A (with tool A1 selected and the form filled) to server B
  used to leave A1's form on screen while B's inventory loaded — a
  second, sneakier source of "is anything happening?" confusion. A
  small `<ClearSelectionOnServerSwitch>` bridge in `App.tsx` calls
  `setSelection(null)` whenever `useServers().activeId` changes, so
  the request panel empties immediately on the click. The
  share-link loader's later `setSelection` (which fires only after
  the inventory contains the saved tool) is unaffected because it
  runs in a different effect that depends on `inventory` and
  `status`.

### Notes

- Bundle delta: 0 (state-machine + one tiny effect component).
- 227 unit tests pass; lint, typecheck, build clean.
- The full DEC-020 inflight-request indicator (an animated icon
  with a popover that lists pending requests + a Cancel button) is
  still slated for v1.2.2. v1.1.13 only covers the connect-time
  case.

## [1.1.12] - 2026-04-25

Three coupled bugs Costa flagged after watching a slow MCP server
hang the UI:

> the connect button cannot be pressed on another mcp server while
> the connect button is spinning while connecting to another mcp
> server. The only way out is either to wait for it to timeout, or
> to refresh the page.
>
> On timeout, the toast still says "connected to …" although the
> logs show failure.

### Added

- **Click-to-connect on the sidebar (DEC-016 #5).** Clicking a
  `<NavLink>` in the server list now sets it active AND immediately
  kicks off connect. The header Connect button is no longer the only
  entry point.

### Fixed

- **In-flight connects are cancellable.** Clicking a different server
  (or the same one again, or the Disconnect button) while a slow
  handshake is still spinning now aborts the prior attempt and
  starts the new one. Implementation: a monotonic
  `connectEpochRef` in the connection context. Each new `connect()`
  bumps the counter and snapshots its own value; post-await
  continuations bail out silently when they see the counter has
  moved on. The previous client is disconnected fire-and-forget
  (was awaited — would block the new connect on the dead transport's
  close, which is exactly what the user is trying to escape).
- **Toast no longer lies on failure.** `connect()` now returns
  `'connected' | 'superseded'` and **throws** on real connect failures.
  The header Connect button only fires the success toast when the
  outcome is `'connected'`; any thrown error becomes a red "Connect
  failed" toast. Until v1.1.11 the success path always ran (because
  the old `connect()` swallowed errors internally), so a 30-second
  timeout produced the green "Connected to …" toast even though
  the system log showed the failure.
- **`disconnect()` now interrupts an in-flight connect** by bumping
  the same epoch — clicking Disconnect while a handshake is still
  spinning leaves you idle instead of letting the eventual success
  flip you back to connected.

### Notes

- 227 unit tests pass; lint, typecheck, build clean.
- Will verify all four flows in playwright after deploy:
  click-while-connecting → supersede, click-while-connected → switch,
  connect-timeout → red toast, disconnect-while-connecting → idle.

## [1.1.11] - 2026-04-25

### Fixed

- **Log panel in light mode no longer stuck on dark.** The new
  `--color-bg-log` token from v1.1.9 was only defined in the dark
  theme block. Light + system-light schemes inherited the dark
  fallback, so a user on the light theme saw a black log panel
  underneath an otherwise-light layout. Added the token to both
  light variants (set to the light chrome shade `#f3f3f3` so the log
  matches the sidebar). Surfaced during v1.1.10's playwright verify.

## [1.1.10] - 2026-04-25

### Fixed

- **System theme respects the OS now.** `MantineProvider` was
  hardcoded `defaultColorScheme="dark"`, so when the user picked
  "System" and the OS preferred light, Mantine kept rendering dark
  while our CSS `@media (prefers-color-scheme: light)` applied light
  tokens — a split-brain where the inspector pane showed the dark
  body shade `#161616` while the sidebar and connection bar showed
  the light shade `#f3f3f3`. Switched to `defaultColorScheme="auto"`
  and only force when the user picked an explicit `light` / `dark`.
  Now both sides follow the OS for "System".

### Notes

- This bug predated v1.1.9 — likely never noticed because the
  primary maintainer's machine prefers dark at the OS level.
  Surfaced during v1.1.9's playwright verification.

## [1.1.9] - 2026-04-25

Dark theme nudge after Costa flagged v1.1.8's palette still felt too
light, especially the log.

### Changed

- **Dark palette shifted down ~one step.** Body content panels go
  `#1f1f1f` → `#161616`; chrome (sidebar, connection bar, log panel)
  goes `#181818` → `#0d0d0d`. Mantine's `dark` color tuple updated
  to match (`dark[7]=#161616`, `dark[8]=#0d0d0d`, `dark[6]=#1f1f1f`
  for raised popovers/modals, `dark[5]=#2a2a2a` for borders). Hierarchy
  stays Dark Modern — chrome darker than content — just lower
  overall.
- **Log panel pulled into the chrome layer.** Until v1.1.8 the log
  inherited the body shade and read as part of the editor area;
  v1.1.9 sets it to `var(--color-bg-log)` = chrome shade (`#0d0d0d`),
  matching VS Code Dark Modern's `panel.background` design where the
  bottom panel reads as part of the chrome frame, darker than the
  editor. Expanded log rows still drop their JSON body to the body
  shade (`#161616`) — slightly lighter than the surrounding log —
  so the in-focus row visually rises out of the panel.

### Notes

- Bundle delta: 0 (theme + CSS variable values only). Initial-load
  gz stays at ~253 KB.
- 227 unit tests pass; lint, typecheck, build clean.

## [1.1.8] - 2026-04-25

Three usability calls from Costa, all in one release.

### Added

- **Hover tooltip on every log row** carries the full method headline
  plus byte size and end-to-end duration when the row is a response.
  When the row is narrow and the metric chips fold (DEC-014), the
  numbers stay reachable via the native `title` tooltip. Tokens are
  deliberately omitted (lazy-computed; expand the row to see them).

### Changed

- **Dark theme switched to VS Code Dark Modern.** Editor-area panels
  (Inspector, RequestPanel, Log) are `#1f1f1f`; chrome (sidebar,
  connection bar) is `#181818` — darker than the content, the
  inverse of VS Code Dark+. Mantine's dark color tuple is overridden
  to match (`dark[7] = #1f1f1f`, `dark[8] = #181818`, `dark[6] =
#2b2b2b` for raised popovers / modals). Borders muted to `#2b2b2b`,
  inputs to `#313131`. Costa: "match modern vscode, sections still
  oriented".
- **Log row text is selectable again.** Until v1.1.7 the headline
  carried `user-select: none`, which blocked the user from selecting
  the method name, timestamp, or chip values to copy. Now selection
  is allowed across the title / timestamp / chip text; chevron,
  direction glyph, and action icons keep `user-select: none` so a
  triple-click doesn't sweep them into the clipboard. The
  click-to-expand handler now skips toggling when the user just
  finished a selection drag inside the row.

### Notes

- Bundle delta: ~0 KB gz (CSS + theme overrides; no library
  changes). Initial-load gz stays at ~252 KB, well under DEC-005's
  350 KB cap.
- 227 unit tests pass; lint, typecheck, build clean. The selection
  guard's interaction with click-to-expand isn't covered by JSDOM
  tests (selection APIs are stubs there); will verify in playwright
  after deploy.

## [1.1.7] - 2026-04-25

Inspector usability: Costa connected to a server with 61 tools and
flagged that there's no way to scan, sort, or filter them. Two small
UX wins.

### Added

- **Alphabetical sort by name** for every inventory list — tools,
  prompts, resources, templates. Case-insensitive locale compare with
  natural-number sort (so `tool-2` precedes `tool-10`). The sort is
  applied client-side in the Inspector, regardless of the order the
  server returned. Deterministic ordering means the user can build
  muscle memory: "I know `prompt-foo` is between `pre-bar` and
  `printf-baz` and I can find it by feel without reading every label."
- **Search box** on every inventory tab (placeholder
  `Search <kind> by name or description`). Case-insensitive substring
  match across both name and description. Clear-button (`×`) appears
  in the input's right-section when the query is non-empty.

### Notes

- The search query is shared across tabs. The user can refine a search
  on Tools and switch to Prompts to see if the same query matches there
  without re-typing.
- Tab counts continue to reflect the **full** inventory, not the
  filtered subset — so the user can see at a glance whether other tabs
  would have matches without switching.
- New "no matches" empty state shows when the query filters everything
  out, distinct from "Server exposed no <kind>" so the user knows the
  difference between "search too narrow" and "actually empty".
- Bundle delta: ~0.3 KB gz (was 252.5 → 252.8 KB initial-load gz).
  Well under DEC-005's 350 KB cap.
- Inspector test coverage doubled (5 → 10 tests). New tests cover:
  alphabetical order, name-match, description-match, no-matches empty
  state, search-box hidden on empty tab, badge counts unaffected by
  filter.

## [1.1.6] - 2026-04-25

The real DEC-024 fix.

### Background

v1.1.3 / 1.1.4 / 1.1.5 wrapped the SDK validator's throws so the
tools list rendered through them. But every Ajv compile in the
deployed app was still failing — the actual error message was
`"Evaluating a string as JavaScript violates the following Content
Security Policy directive"`. Our `src/index.html` ships
`script-src 'self'` (no `'unsafe-eval'`), and Ajv compiles validators
by generating JavaScript at runtime. Result: every `outputSchema`
silently fell through to a permissive validator, and the form's
`inputSchema` gate would have surfaced "Schema compile error" if any
user actually opened a tool form.

### Fixed

- **Replaced Ajv with `@cfworker/json-schema` everywhere.** The MCP
  SDK ships `CfWorkerJsonSchemaValidator` precisely for environments
  without `'unsafe-eval'` (Cloudflare Workers and our CSP fall in the
  same bucket); `@cfworker/json-schema` interprets schemas at
  validation time instead of generating JavaScript. No CSP conflict.
  Behaviour is functionally equivalent for the schemas MCP servers
  ship in practice. Output schemas now actually validate; form input
  validation now actually runs.
- **`src/schema-form/validate.ts`** rewritten on the same library.
  The `validate()` API and `ValidationFailure` shape are unchanged;
  only the engine swapped.

### Removed

- `ajv` (8.18.0) and `ajv-formats` (3.0.1) dependencies. Replaced
  by `@cfworker/json-schema` (4.1.1).

### Notes

- Bundle delta: ~5 KB gz (was 247 → 252 KB initial-load gz). Well
  under DEC-005's 350 KB cap.
- The `TolerantValidator` wrapper from v1.1.3 stays as defence-in-
  depth: even though CfWorker rarely throws on `getValidator()` (it
  defers most checks to `validate()`), a malformed schema can still
  raise during construction and we keep one bad tool from blocking
  the whole list.
- Console diagnostics: with CfWorker, the long Ajv `console.error`
  function-code dumps are gone — they were Ajv-specific. CfWorker
  reports failures via the standard `validate()` result, surfaced in
  the system log via the existing warning sink. The lesson from
  v1.1.4/v1.1.5 still stands: do not silence diagnostic output;
  surfaces should improve framing instead. CfWorker just produces
  less noise to begin with.

## [1.1.5] - 2026-04-25

Reverts a misjudgement from v1.1.4.

### Reverted

- **Ajv's pre-throw `console.error` output is back.** v1.1.4 muted it
  on the theory that it was scary noise. Costa flagged that this was
  the wrong call: the dump is the **full generated validator source**
  pointing at exactly the keyword Ajv choked on. For a developer
  debugging an MCP server's schema, that is gold — silencing it
  removed the most actionable diagnostic on the floor. The
  v1.1.4 silencing is gone; Ajv's default logger writes to the
  console as it always did.

### Changed

- **System-log warning now says "tool still usable".** The per-schema
  warning is now phrased
  `output schema compile failed (…): … — tool still usable; output
validation disabled. Full Ajv detail in browser console.` That
  addresses the v1.1.3 perception bug — "looks broken when it isn't"
  — by changing the framing in the log, not by suppressing the
  underlying console output.

### Notes

- The catch-and-warn behaviour from v1.1.3 / v1.1.4 is unchanged. One
  un-compilable `outputSchema` still does not block the tools list;
  the offending tool is still rendered with output validation
  silently downgraded.
- Lesson folded into `maintainer/skills/feedback-folding.md`: do not
  conflate "user is confused by output" with "output is useless".
  Diagnostic data goes to the console; user-facing framing goes in
  the system log; both audiences served.

## [1.1.4] - 2026-04-25

A follow-up to v1.1.3: the resilience wrapper from DEC-024 was already
catching the throws and the tools list _was_ rendering, but Ajv's
internal logger was dumping the failed function-code to `console.error`
**before** the throw — which made it look like the app was broken even
when it wasn't. Plus, Costa flagged that there's no visible way to tell
which version of the app is loaded.

### Fixed

- **Silenced Ajv's pre-throw console spam.** The MCP SDK's default
  `AjvJsonSchemaValidator` uses an Ajv configured with the default
  console logger; on a compile failure it calls
  `logger.error("Error compiling schema, function code:", source)`
  before throwing. Our wrapper already catches the throw and surfaces a
  clean per-schema warning to the system log, so the raw dump is just
  noise. We now construct our own Ajv with `logger: false` and feed it
  to `AjvJsonSchemaValidator`, suppressing the dump while keeping every
  other Ajv behaviour identical.

### Added

- **Visible version stamp in the header** — small dimmed text next to
  the brand: `v1.1.4 · <git-sha>`, with a tooltip showing the build
  ISO timestamp. Removes any ambiguity about whether a deploy is
  current. The version + git short SHA + build time are injected at
  build time via Vite `define`. CI's `GITHUB_SHA` is preferred so the
  built artefact carries the exact commit it was built from.
- **MCP client identity carries the real version.** The SDK's
  `initialize` handshake now reports `version: 1.1.4` (was hardcoded
  `1.0.0-dev`). Server-side observability tools that record client
  versions will see the correct value.

### Notes

- v1.1.3's wrapper was correct; its only flaw was UX. The behavior
  change in this release is "stop scaring the user" — no logic
  changes to the tools-list flow.
- Bundle delta: negligible (~5 KB gz from inline Ajv import + version
  stamps). Initial-load gz stays at ~248 KB, well under DEC-005's
  350 KB cap.

## [1.1.3] - 2026-04-25

A bug-fix release for a connect-failure case Costa hit on a real
authenticated multi-vendor MCP aggregator (~60 tools): a single
tool's `outputSchema` failed to compile in the SDK's eager Ajv
cache and took the entire `tools/list` down with it.

### Fixed

- **Output-schema compile resilience** (DEC-024). One un-compilable
  output schema no longer blocks every other tool from rendering.
  The MCP SDK 1.29's `Client.cacheToolMetadata()` eagerly compiles
  every tool's `outputSchema` after `tools/list`; if any schema
  throws, the throw propagates and fails the whole call. Fix: a
  small `TolerantValidator` wrapper around the SDK's
  `AjvJsonSchemaValidator` that catches per-schema compile errors,
  surfaces them to a caller-supplied warning sink, and returns a
  permissive validator (`valid: true`) so the SDK's cache loop
  continues. Output validation is silently downgraded for the
  offender; the warning makes the downgrade visible. The user sees
  a system-log warning of the form
  `output schema compile failed (type=object props=[…]): <ajv error>`
  per failing tool.

### Notes

- Output validation for the offending tool is disabled (the
  permissive validator always passes input through). The protocol
  layer still validates the response envelope; only the tool-level
  `outputSchema` cross-check is skipped.
- An upstream SDK PR is a follow-up — fixing the eager-compile-
  with-no-catch in `cacheToolMetadata` itself is the right long-
  term fix; it benefits every browser-side SDK consumer. Tracked
  in DEC-024.

## [1.1.2] - 2026-04-25

A small follow-up release fixing a layout bug Costa flagged after
v1.1.1: when the log column is narrow, the per-row metric chips
(bytes / ms / tokens) used to push the copy / save buttons off the
right edge or out of vertical alignment with their neighbours,
breaking the icon column the eye scans.

### Fixed

- **Log-row alignment under squeeze** (DEC-014). The action-icon
  column now keeps a single shared X offset across every wire row at
  every panel width down to 280 px. Chips fold first, in a deliberate
  drop order — `tokens` → `ms` → `bytes` — driven by a
  `data-chip-level` attribute (0 / 1 / 2 / 3) on the log-panel root,
  set by a `ResizeObserver`. Verified via a Playwright e2e
  (`tests/e2e/log-row-alignment.spec.ts`) that asserts the set of
  `getBoundingClientRect().right` values across all rows is a single
  value (±0.5 px) at 280 / 320 / 360 / 400 / 440 / 600 px.

### Notes

- This regression survived three UX-critic passes in v1.1 because
  the critic walked the panel visually without resizing it narrow
  enough. A new mandatory scope ("alignment under squeeze") with a
  measurable falsifier is now part of `maintainer/skills/ux-review.md`
  and the UX-critic prompt template, so future passes catch this
  class of bug in code, not by eye.

## [1.1.1] - 2026-04-25

A focused release: the log panel is rewritten end-to-end so a developer
poking at a public MCP server can read the request flow at a glance.

### Added

- **Bold method-summary headline** on every wire entry — `tools/call ·
echo`, `prompts/get · greet`, `resources/read · file:///etc/hosts`.
  Mechanical discriminator from the JSON-RPC params.
- **Per-entry collapse / expand** with default-collapsed bodies and
  global Expand all / Collapse all toolbar buttons.
- **Prev / next request navigation** — toolbar arrow buttons + `j` /
  `k` keyboard shortcuts. Skips responses, notifications, and system
  messages. Input-focus edge case handled.
- **Per-response metrics chips** — bytes, end-to-end duration in ms,
  estimated tokens (`~tok` label communicates "estimate"). Same chips
  surfaced in the request panel's "Last result" header.
- **Always-visible copy and save** buttons in every wire entry's
  headline (no more hover-only). Both emit raw JSON-RPC envelopes via
  `JSON.stringify(value, null, 2)`.
- **Pair-jump** button (↔) on entries with a paired counterpart.
  Notifications correctly omit it and carry a "notification — no
  paired response" tooltip on the row instead.
- **Direction filter** in the toolbar: All / Outgoing / Incoming /
  Requests-only / System.
- **Inline timestamp + direction** in the headline — no fixed-width
  left column eating horizontal space.

### Changed

- The `gpt-tokenizer` `o200k_base` BPE table is **lazy-loaded** on
  first response expand (~1008 KB gz on-demand). Initial bundle
  stays at 271.5 KB gzipped — under the DEC-005 350 KB cap.
- `scripts/bundle-budget.mjs` distinguishes initial-load assets from
  lazy chunks.

### Fixed

- Three sub-needs hidden inside the original v1.0 "log is unmanageable"
  feedback bullet that v1.1 only partially addressed: prev/next
  request navigation, time/direction wasting horizontal space, and
  always-visible per-message copy/save are now fully resolved.
- `notifications/*` rows (e.g. `notifications/initialized`) now expand
  to a real body and carry copy/save buttons like every other wire
  entry.

### Memory

- Heap at 232 entries dropped from ~309 MB (v1.1) to ~101 MB. Lazy
  tokenizer + default-collapsed bodies pay only on demand. The log
  virtualization deferral becomes less urgent as a result.

### Deferred to v1.1.2

- 360 px discriminator clipping when chips dominate (cosmetic).
- "Expand all" blocking ~3 s on 200+ entries.
- Light-theme log timestamp contrast 2.85:1.
- Last-result vs log-row tokenizer drift labelling.
- Three v1.1 minor critic notes (480 px off-by-one, delete-saved
  Menu when one entry, friendly-name in share payload).

## [1.1.0] - 2026-04-25

The first user-quality release. v1.0 shipped with structural pieces in
place but seven unusable surfaces; this release closes them and adds
the working framework that produced the fix.

### Added

- **Mantine v9 across every visible surface.** Real `<Button>` /
  `<ActionIcon>` with hover / active / disabled / busy states; real
  `<Tabs>` with `role="tab"` and arrow-key navigation; real `<Modal>`
  with focus-trap, Esc-to-close, and Enter-to-submit; `<Tooltip>` on
  every actionable element; `<SegmentedControl>` for the Form / Raw
  toggle; `<NavLink>` for the server picker.
- **Three-axis resizable layout** via `react-resizable-panels` —
  sidebar / main / inspector / request / log all draggable; sizes
  persist to localStorage per layout.
- **Mobile responsive collapse** below 768 px: sidebar becomes a
  Mantine `Drawer`; inspector / request / log become a stacked
  `Tabs` with `keepMounted` so per-tab state survives switches. Below
  ~480 px the header collapses to a compact chip set so primary
  actions stay reachable on iPhone-size viewports.
- **Newline-respecting JSON view** restored from the legacy
  pretty-printer — multi-line strings render across actual line
  breaks with a `↵` glyph marker; nested-JSON-in-strings is detected
  and rendered inline with a `[JSON]` badge; per-message and
  last-result copy / save buttons emit well-formed JSON.
- **Shareable URLs** now encode AND restore the full state — server,
  selected tool, method, and arguments all reconstruct on load. Tokens
  are never included.
- **Toast notifications** confirm every side effect: connect,
  disconnect, save, load, delete, copy, share.
- **Inventory empty-state branches on connection status** — `idle`,
  `connecting`, `error` (showing the actual error message + a hint),
  and `connected & empty` each render distinct copy.
- **CI bundle-size tripwire** at 350 KB gzipped (current: 267.7 KB).
- **Maintainer brain framework** under `maintainer/` — daily activity
  logs, ADR-lite decisions per file, skills with checklists + Lessons
  Learnt, product spec subdirectories, and a `values.md` daily anchor.
  Three UX-critic passes and one framework-analyst pass landed
  guardrails into `skills/ux-review.md` so every regression class
  caught is now blocked-by-default on the next release.

### Changed

- Project entrypoint chrome migrated from hand-rolled CSS + bare HTML
  to Mantine's `AppShell`. Bundle grew from the v1.0 baseline to
  267.7 KB gzipped — under the DEC-005 350 KB CI cap.
- The 4 borderlines (empty-state copy paragraphs, light-theme
  timestamp contrast, ARIA `valuemin > valuemax` on a separator, log
  virtualization at 200+ messages) are tracked as v1.1.1 follow-ups
  alongside DEC-009 response metrics.

### Fixed

- Seven Costa-flagged v1.0 issues, plus four UX-critic-found a11y
  issues (modal Enter-submit, real tabs, focus-trap, header-overflow
  occluding mobile tabs after a partial round-1 fix), plus three
  desktop regressions surfaced during the migration cycle (Send /
  Share label truncation after Save-as, inventory empty-state lying
  on connect-error, missing save-confirmation toast).

## [1.0.0] - 2026-04-23

First public release. Hosted at https://ktsaou.github.io/mcp-test-client/.

### Added

- Repo foundations for the v1.0 rewrite: `CLAUDE.md`, `TODO-MODERNIZATION.md`,
  `specs/` directory with compliance, schema-rendering, persistence,
  shareable-urls, security, public-servers-catalog, and websocket-transport
  specs.
- Standard community files: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`,
  `SECURITY.md`, `CHANGELOG.md`.
- The pre-rewrite prototype has been moved to `legacy/` as a reference
  until the new implementation reaches feature parity.
- Project scaffold: Vite 8, TypeScript 6, React 19, Vitest 4, Playwright,
  ESLint 9 flat config, Prettier, EditorConfig.
- `@modelcontextprotocol/sdk` 1.29 pinned as the only MCP runtime dep.
- GitHub Actions: CI (lint + typecheck + unit + e2e + build + audit) and
  automated GitHub Pages deploy.
- Dependabot (weekly npm, monthly actions).
- Issue + PR templates.
- Minimal booting React shell with dark-theme CSS-variable system.
- `src/mcp/` — MCP client integration layer:
  - `types.ts` — project-local wire types (transport kind, server config, auth, wire events)
  - `transports.ts` — URL→transport factory over the SDK's three browser-safe transports
  - `logging-transport.ts` — decorator surfacing every JSON-RPC message to a subscriber
  - `client.ts` — thin `McpClient` wrapper around the SDK `Client` with our defaults
  - 25 unit tests covering transport selection, decorator semantics, and connect/init flow
- `src/persistence/` — typed localStorage layer:
  - `schema.ts` — key namespace `mcptc:*`, v1 value types (ServerEntry, HistoryRecord)
  - `store.ts` — Store class with JSON round-tripping, quota-error reporting, and bulk reset
  - `migrations.ts` — version framework with discriminated outcome (fresh / upToDate / migrated / downgrade)
  - 21 additional unit tests (46 total green)
- End-to-end UI shell — first visibly-functional build:
  - `src/state/` React Context providers (theme, servers, log, connection) over the Store and McpClient
  - `src/ui/` — grid layout with header/sidebar/main/log, server CRUD modal, connection bar with status pill,
    inspector tabs (tools/prompts/resources/templates), raw JSON-RPC request panel with template seeding,
    auto-scrolling wire-message log, React-element JSON pretty-printer, dark/light/system theme cycling
  - Happy-dom + in-memory localStorage polyfill for the test environment
- Public servers catalog scaffolding:
  - `public/public-servers.json` shipped as a static asset + `public-servers.schema.json` validator
  - `src/catalog/` loader resilient to missing / malformed catalogs (4 tests, 51 total green)
- E2E harness:
  - `tests/fixtures/mock-mcp-server/` — SDK-based Streamable HTTP fixture with echo/add tools, a sample prompt, a sample resource, and permissive CORS
  - Playwright smoke test that drives the full add → connect → list-tools → call-echo flow against the fixture
- Schema-driven form renderer at `src/schema-form/`:
  - Every field type (string/number/boolean/enum/array/tuple/object/additionalProperties) with a bespoke widget
  - `$ref` / `$defs` resolution with cycle detection, `allOf` merge with conflict detection, `anyOf`/`oneOf` as tab switcher, `const`-discriminator labelling
  - Ajv 8 JSON Schema 2020-12 validation; graceful fallback to raw JSON for unsupported constructs
  - 51 unit tests (98 total)
  - Wired into the request panel with a Form / Raw mode toggle per tool
- Per-tool canned requests: "Save as…" stores the current form value under
  a user-chosen name in localStorage; "Load saved" dropdown restocks the form.
- Shareable URLs: deflate-raw + base64url-encoded hash fragment carrying
  server URL + transport + tool + arguments; the `ShareUrlLoader` component
  materialises the link on recipient page load (but does not auto-connect).
  Tokens are never included.
- 5 additional unit tests for the shareable URL encoder (108 total).

### Changed

- README re-positioned from Netdata-specific to community tool.

## [0.1.0-legacy] - 2026-04-23

The initial import — a working prototype extracted from the
[Netdata](https://github.com/netdata/netdata) repository, with its Netdata
branding still visible in places. This version continues to live in the
`legacy/` directory and will be removed once the v1.0 rewrite ships.
