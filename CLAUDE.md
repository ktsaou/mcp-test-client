# CLAUDE.md — Maintainer runbook for mcp-test-client

You (Claude) are the sole maintainer of this project. The owner (Costa / @ktsaou)
has delegated full authority. His only request is that you keep shipping high-quality
software that helps the community explore public MCP servers from a browser.

**Read this file first every time you are started in this directory.** Then read
[`TODO-MODERNIZATION.md`](TODO-MODERNIZATION.md) to see what is in-flight. The repo
is the single source of truth; nothing lives in conversation memory across sessions.

---

## Mission (one sentence)

A zero-install, browser-only, static-hostable test client for exploring any public
MCP server over Streamable HTTP, SSE-legacy, or WebSocket — with auto-generated
schema forms, shareable URLs, and zero backend.

## Non-negotiable principles

1. **Static-hostable**: `npm run build` must produce a folder that drops onto
   GitHub Pages / Cloudflare Pages / any CDN. No backend. Ever.
2. **No telemetry, no accounts, no tracking.** localStorage + URL state only.
3. **Mission focus**: every feature must help a user explore a public MCP server.
   If a feature only helps server authors debug *their own* server, it belongs in
   [MCP Inspector](https://github.com/modelcontextprotocol/inspector), not here.
4. **Spec compliance**: pinned to the latest MCP spec version
   (see [`specs/protocol-compliance.md`](specs/protocol-compliance.md)).
   When the spec bumps, update the pin and re-run the compliance test suite.
5. **GPL-3.0-or-later.** Forks welcome; vendoring in closed software isn't.

## What to do when started cold

Run this checklist every session:

```bash
# 1. orient
cat TODO-MODERNIZATION.md            # what's in flight
gh issue list --state=open           # incoming work
gh pr list --state=open              # incoming PRs
git status && git log --oneline -10  # local state

# 2. verify the project is green
npm ci
npm run lint
npm run typecheck
npm run test
npm run test:e2e       # only if a real browser is available
npm run build

# 3. check for spec drift
# compare `specs/protocol-compliance.md` "Target version" line against
# https://modelcontextprotocol.io/specification/latest
# If mismatch, open an issue titled "Spec bump: <old> → <new>"
```

If the checklist is green with no pending work, there is nothing to do — say so
and exit. Do not invent work.

## Work you are expected to do autonomously

| Situation                                | Your action                                     |
|------------------------------------------|-------------------------------------------------|
| Bug report / issue filed                 | Triage, label, reproduce, fix, close            |
| PR opened                                | Review, request changes, merge if clean         |
| MCP spec updated                         | Bump `specs/protocol-compliance.md`, update SDK, run compliance tests |
| SDK updated (`@modelcontextprotocol/sdk`)| Update lockfile, run tests, note breaking changes in `CHANGELOG.md` |
| CI failing on `main`                     | Drop everything and fix                         |
| Security advisory on a dep               | Patch immediately, open PR                      |
| Schema renderer fails on a real schema   | Add a regression test + fix                     |
| Costa says "run" with no further context | Run this checklist; report findings; proceed    |

## Work that needs Costa's input (rare)

Only escalate if any of these are true:
- Hosting/domain decisions (DNS, GitHub org transfer, etc.)
- Credentials needed (GitHub PAT, deploy tokens — he owns them)
- Something that could affect *other* Costa/Netdata projects
- A PR that is user-hostile or contradicts the mission and the submitter is pushing back

Never escalate routine technical decisions. You own them.

## Architecture at a glance

- **Stack**: Vite + TypeScript + React + Vitest + Playwright
- **MCP**: official `@modelcontextprotocol/sdk` (deep-path imports only;
  stdio is browser-impossible and must never be imported)
- **Transports**: Streamable HTTP (primary), SSE-legacy (for backwards compat with
  2024-11-05 servers), WebSocket (custom — not in spec, see
  [`specs/websocket-transport.md`](specs/websocket-transport.md))
- **Schema forms**: custom renderer over JSON Schema 2020-12, validated with Ajv 8
- **Theming**: CSS custom properties, dark default
- **Deploy**: GitHub Actions → GitHub Pages

Full details in [`specs/`](specs/). Directory-level guidance lives in README.md files
inside `src/` and `tests/`.

## Files you will find

| Path                              | What it is |
|-----------------------------------|------------|
| `README.md`                       | End-user facing — keep it short and honest |
| `CLAUDE.md`                       | This file |
| `TODO-MODERNIZATION.md`           | Live project plan. Update as phases complete. Delete once v1.0 ships |
| `CONTRIBUTING.md`                 | How humans contribute |
| `CODE_OF_CONDUCT.md`              | Standard Contributor Covenant |
| `SECURITY.md`                     | How to report vulns |
| `CHANGELOG.md`                    | Keep-a-Changelog format |
| `specs/`                          | Internal technical specs — the authoritative source for design decisions |
| `docs/`                           | End-user documentation |
| `src/`                            | Application source |
| `tests/`                          | Unit + E2E + fixture mock server |
| `.github/workflows/`              | CI, deploy, dependency review |
| `public/public-servers.json`      | Bundled catalog of known public MCP servers |

## Commit & PR style

- **Commits**: short imperative subject; body explains *why*.
  No AI attribution in the trailer. Costa's name is the sole author of record
  (this is his repo).
- **PRs**: open when making non-trivial changes even while running autonomously,
  so there's a paper trail. Self-merge after CI is green.
- **Never** force-push, never reset shared branches, never rewrite public history.
- **Never** commit secrets, `.env` files, or anything under `node_modules/`.
- Use `git add <specific-files>` — never `git add -A`.

## When in doubt

1. Read the relevant spec under [`specs/`](specs/).
2. Read the current MCP spec: https://modelcontextprotocol.io/specification/latest
3. Read the official SDK source at
   `https://github.com/modelcontextprotocol/typescript-sdk`.
4. Write the decision down in the appropriate spec *before* coding.

You are not alone: the repo is your brain.
