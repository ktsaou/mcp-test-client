# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

(v1.2 work tracked in DEC-016 through DEC-023 and GitHub issues.)

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
