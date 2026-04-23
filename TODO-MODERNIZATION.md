# TODO — Modernization of mcp-test-client

**Started**: 2026-04-23
**Owner**: Claude (autonomous maintainer)
**Target**: v1.0.0 public release on GitHub Pages

Delete this file when v1.0 ships. Track v1.x work via GitHub issues and `CHANGELOG.md`.

---

## 1. Purpose (pinned — do not drift)

Build a zero-install, browser-only test client for **public MCP servers** that
beats MCP Inspector on: schema rendering quality, static-hosting friendliness,
WebSocket support, and shareable-link UX. See `CLAUDE.md` for the mission and
boundaries.

## 2. Analysis of the current state

The existing repo is a working prototype extracted from Netdata. Strengths and
gaps below — cited with file:line.

### 2.1 What works and is worth preserving

- **Schema renderer** (`mcp-schema-ui-generator.js`, 2466 lines): solid coverage
  of strings / numbers / booleans / enums (as dropdown and checkbox sets) /
  arrays / tuple arrays / objects / `anyOf` with tab switcher /
  `additionalProperties` as editable key/value maps. Tooltips, descriptions, and
  required-field validation. _Port this to TypeScript + React; do not rewrite
  from scratch._
- **JSON pretty-printer** (`json-pretty-printer.js`, 312 lines): detects nested
  JSON strings and pretty-prints them recursively; visualizes `\n`. _Port._
- **UX concepts to keep**: three send modes (form / raw / schema), "import from
  LLM paste", bearer auth per server, request history tab.

### 2.2 Gaps vs. current MCP spec (`2025-11-25`)

All references are to `index.html` unless noted:

| #   | Issue                                                                                       | Location               |
| --- | ------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Hardcoded `protocolVersion: '2024-11-05'` (two spec versions behind)                        | `index.html:2518`      |
| 2   | `Accept` header for HTTP is `application/json` only; spec requires also `text/event-stream` | `index.html:2948`      |
| 3   | No `MCP-Session-Id` handling (not sent, not read from init response)                        | entire transport layer |
| 4   | No `MCP-Protocol-Version` header on subsequent requests                                     | entire transport layer |
| 5   | No GET for server→client SSE stream                                                         | n/a (not implemented)  |
| 6   | No `Last-Event-ID` resume on reconnect                                                      | n/a                    |
| 7   | SSE path uses non-standard `?transport=sse` query param (Netdata convention)                | `index.html:3118`      |
| 8   | `connectStateless()` is a no-op for HTTP (no real session)                                  | `index.html:2757`      |
| 9   | Hardcoded `clientInfo.name: 'Netdata MCP Test Client'` (branding bleed)                     | `index.html:2524`      |
| 10  | `<title>Netdata MCP Web Client</title>`                                                     | `index.html:6`         |

### 2.3 Architectural issues

- **No build step**: vanilla ES5-ish globals, script tags, embedded CSS. Can't
  add a dependency without manual vendoring.
- **3661-line monolith HTML**: 2675 lines of JS inside one `<script>` tag, all
  top-level globals. Unreviewable.
- **No types**: entire codebase is untyped JS; no guarantees on message shapes.
- **No tests**: zero unit tests, zero E2E.
- **Light theme only**: no theming system; colours hardcoded in CSS.
- **localStorage keys collide-prone**: flat keyspace like `server-url`,
  `tool-params`, etc. No namespacing, no versioning, no migrations.
- **Single-file layout**: `src/`, `specs/`, `docs/` do not exist.
- **No CI, no release automation, no deploy pipeline.**

## 3. Architecture decisions (locked)

| Decision          | Choice                                                  | Rationale                                                         |
| ----------------- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| Build tool        | **Vite 5+**                                             | Default modern ESM bundler, matches SDK ESM, fast HMR             |
| Language          | **TypeScript 5.6 strict**                               | Type safety for JSON-RPC messages; onramp for contributors        |
| UI framework      | **React 18**                                            | Mainstream (matches Inspector), easy for community PRs            |
| CSS               | **Plain CSS + custom properties**                       | Zero dep, simple theming, no Tailwind/Radix churn                 |
| State             | **React Context + useReducer**                          | Zero dep, sufficient at this scale                                |
| MCP client        | **`@modelcontextprotocol/sdk@^1.29`**                   | Official, maintained, ships all 3 browser transports              |
| Schema validation | **`ajv@^8` + `ajv-formats`**                            | JSON Schema 2020-12 support (Inspector stuck on ajv 6 / draft-07) |
| Unit tests        | **Vitest**                                              | Pairs with Vite                                                   |
| E2E tests         | **Playwright**                                          | Industry standard for browser apps                                |
| Lint/format       | **ESLint + Prettier**                                   | Standard                                                          |
| CI/CD             | **GitHub Actions**                                      | Native to GitHub Pages deploy                                     |
| Deploy target     | **GitHub Pages** (primary); Cloudflare Pages compatible | Static-hostable anywhere                                          |
| License           | **GPL-3.0-or-later**                                    | Match existing, community-friendly copyleft                       |

### Import rules for the SDK (Vite + tree-shaking)

- Deep imports only: `@modelcontextprotocol/sdk/client/index.js`,
  `.../client/streamableHttp.js`, `.../client/sse.js`, `.../client/websocket.js`,
  `.../types.js`.
- **Never** import `.../client/stdio.js` (pulls Node built-ins).
- Add `optimizeDeps.exclude: ['cross-spawn']` in `vite.config.ts` as
  belt-and-braces against transitive Node-only deps.

### Transport matrix

| Transport       | Source                              | Use when                         |
| --------------- | ----------------------------------- | -------------------------------- |
| Streamable HTTP | SDK `StreamableHTTPClientTransport` | default for HTTP(S) URLs         |
| SSE (legacy)    | SDK `SSEClientTransport`            | fallback for 2024-11-05 servers  |
| WebSocket       | SDK `WebSocketClientTransport`      | user explicitly selects `wss://` |
| stdio           | _not supported_                     | browsers cannot spawn processes  |

We **wrap** each transport with a small decorator that emits the raw JSON-RPC
to our message log before calling through — see `src/mcp/logging-transport.ts`
in the implementation.

## 4. Phased plan

Each phase ends in a merge-ready state. CI must be green. Docs updated. Tick
each box as the phase lands.

### Phase 0 — Repo foundations ✅ (this session)

- [x] `CLAUDE.md` — maintainer runbook
- [x] `TODO-MODERNIZATION.md` — this file
- [x] `specs/` scaffolded with all spec documents
- [x] `specs/websocket-transport.md` aligned with SDK behaviour
- [x] `README.md` rewritten (community-focused, not Netdata-focused)
- [x] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `CHANGELOG.md`
- [x] `.gitignore` expanded
- [x] The old `index.html`, `mcp-schema-ui-generator.js`, `json-pretty-printer.js`
      move to `legacy/` so they remain a working reference until the rewrite
      reaches parity.

### Phase 1 — Project scaffold

- [ ] `package.json` with pinned versions
- [ ] `tsconfig.json` (strict, ES2022, bundler resolution)
- [ ] `vite.config.ts` with `base: './'` for GH Pages, correct exclusions
- [ ] `vitest.config.ts`
- [ ] `playwright.config.ts`
- [ ] `.eslintrc.cjs`, `.prettierrc.json`, `.editorconfig`
- [ ] `.github/workflows/ci.yml` (install, lint, typecheck, test, build)
- [ ] `.github/workflows/deploy.yml` (GH Pages)
- [ ] `.github/ISSUE_TEMPLATE/`, `.github/PULL_REQUEST_TEMPLATE.md`
- [ ] Empty `src/main.tsx` + `src/App.tsx` booting to "hello world"
- [ ] First green CI run

### Phase 2 — MCP client core

- [ ] `src/mcp/client.ts` — thin wrapper around SDK `Client` with our defaults
- [ ] `src/mcp/logging-transport.ts` — decorator that captures wire messages
- [ ] `src/mcp/transports.ts` — factory: URL → transport instance
- [ ] `src/mcp/types.ts` — re-exports and project-specific types
- [ ] Unit tests for each against a mock transport

### Phase 3 — Persistence + state

- [ ] `src/persistence/store.ts` — typed, namespaced localStorage wrapper
- [ ] `src/persistence/schema.ts` — versioned storage schema (v1)
- [ ] `src/persistence/migrations.ts` — empty for v1, ready for future versions
- [ ] `src/state/` — React contexts for servers, connection, theme, log
- [ ] Unit tests for migrations and store

### Phase 4 — UI shell + theming

- [ ] `src/ui/theme.css` — CSS custom properties for dark + light
- [ ] `src/ui/theme-toggle.tsx` — system / dark / light
- [ ] `src/ui/layout/` — sidebar, main, log panel
- [ ] `src/ui/server-list/` — add / edit / delete / select
- [ ] `src/ui/connection-bar/` — transport picker, connect button, status
- [ ] Visual regression tests via Playwright screenshots

### Phase 5 — Schema form renderer (the crown jewel)

- [ ] `src/schema-form/` — one file per field type (string, number, boolean,
      enum, array, tuple, object, anyOf, oneOf, additionalProperties)
- [ ] JSON Schema 2020-12 support: `$ref`, `$defs`, `allOf` merge, `prefixItems`,
      discriminated `oneOf` with tabs
- [ ] Ajv 8 validator integration
- [ ] Complete unit test matrix — one test per field type, plus a conformance
      suite of ~30 real tool schemas harvested from public MCP servers

### Phase 6 — Request / response UX

- [ ] Form editor ↔ raw JSON editor bidirectional sync
- [ ] "Import from LLM paste" — parse messy tool-call JSON
- [ ] Per-tool canned-request save/load in localStorage
- [ ] Full message log with syntax highlighting and copy-to-clipboard
- [ ] Shareable URL — hash fragment encodes server URL + tool + params
      (see `specs/shareable-urls.md`)
- [ ] History tab

### Phase 7 — Public servers catalog

- [ ] `public/public-servers.json` — curated, reviewed list
- [ ] "Discover" pane — load the catalog, one-click try
- [ ] Community contribution path: PR to `public/public-servers.json`, CI
      validates schema, manual review
- [ ] User-added servers merged in-memory with catalog

### Phase 8 — E2E + compliance tests

- [ ] `tests/fixtures/mock-mcp-server/` — Node-based reference server using
      `@modelcontextprotocol/sdk` server side; implements tools, prompts,
      resources, streaming, session, protocol version, error responses
- [ ] Playwright specs: connect with each transport, run a tool, handle errors,
      reconnect, theme toggle, URL share, import from paste
- [ ] MCP compliance suite: programmatic `vitest` tests that assert our client
      sends spec-compliant headers/bodies and handles every mandatory response

### Phase 9 — Docs + release

- [ ] `docs/quick-start.md`
- [ ] `docs/cors-explainer.md` (critical — tell server operators how to allow us)
- [ ] `docs/troubleshooting.md`
- [ ] `docs/public-servers.md`
- [ ] Screenshots
- [ ] Demo GIF
- [ ] `v1.0.0` tag + GH release notes

## 5. Risks explicitly tracked

| Risk                                                                  | Mitigation                                                                                                          |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **CORS**: server doesn't allow our origin → connection silently fails | Detect fetch failure; show actionable error with a link to `docs/cors-explainer.md`                                 |
| **OAuth** is out of v1.0 scope; some servers require it               | Ship bearer+custom-header for v1.0; open tracking issue for v1.1 OAuth PKCE                                         |
| **SDK 2.0 alpha** lands and changes imports                           | Pin to v1.x `^1.29`; watch releases; migrate in a dedicated issue                                                   |
| **WebSocket SEP-1288** may get rewritten or rejected                  | Spec already positions WS as "custom transport, not MCP standard"; SDK handles actual wire protocol; we're shielded |
| **Schema renderer** receives a wild real-world schema we don't handle | Conformance suite + public issue template for bug reports; fall back to raw JSON editor gracefully                  |
| **localStorage quota**: users with hundreds of servers + history      | Cap history at 100 entries; warn at 90% quota usage                                                                 |

## 6. Out of scope for v1.0 (tracked for later)

- stdio transport — impossible in browser, will never ship
- OAuth 2.1 PKCE — v1.1
- Sampling / roots / elicitation client features — v1.2+, only if community asks
- Built-in CORS proxy — v2 or never; document the workaround instead
- Native desktop wrapper — not the mission
- Account sync — explicitly not the mission

## 7. Done-definition for v1.0

All of the following must be true:

1. `npm run build && npx serve dist` serves a fully functional app
2. Connects to a public MCP server (at least one in the catalog) over each of
   the three transports
3. Every tool, prompt, resource from the server renders as an interactive form
4. Dark and light themes both pass visual regression
5. Compliance suite passes against the mock server
6. `npm run test` and `npm run test:e2e` green in CI
7. Deployed to GitHub Pages via `.github/workflows/deploy.yml`
8. README has a working demo link
9. `CHANGELOG.md` has a `1.0.0` entry

When those are all green, delete this file and move outstanding work to
GitHub issues.
