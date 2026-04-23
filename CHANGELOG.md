# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

### Changed

- README re-positioned from Netdata-specific to community tool.

## [0.1.0-legacy] - 2026-04-23

The initial import — a working prototype extracted from the
[Netdata](https://github.com/netdata/netdata) repository, with its Netdata
branding still visible in places. This version continues to live in the
`legacy/` directory and will be removed once the v1.0 rewrite ships.
