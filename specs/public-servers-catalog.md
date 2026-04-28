# Public Servers Catalog

`public/public-servers.json` is a curated list of publicly reachable MCP
servers that users can try with one click.

---

## 1. Schema

```json
{
  "$schema": "./public-servers.schema.json",
  "version": 1,
  "servers": [
    {
      "id": "example-weather",
      "name": "Example Weather",
      "url": "https://example.com/mcp",
      "transport": "streamable-http",
      "description": "Short (< 140 char) sentence about what the server does.",
      "tags": ["weather", "reference"],
      "auth": "none",
      "docs": "https://example.com/docs/mcp",
      "addedAt": "2026-04-23",
      "status": "active"
    }
  ]
}
```

### Field reference

| Field              | Required | Notes                                                                                                  |
| ------------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| `id`               | yes      | slug; stable; used as a URL anchor and localStorage key suffix                                         |
| `name`             | yes      | display name                                                                                           |
| `url`              | yes      | full URL including scheme                                                                              |
| `transport`        | yes      | `streamable-http` / `sse-legacy` / `websocket` / `auto`                                                |
| `description`      | yes      | ≤ 140 chars; no marketing language                                                                     |
| `tags`             | optional | free-form, lowercase                                                                                   |
| `auth`             | yes      | `"none"` / `"bearer"` / `"oauth"` / `"header"` — tells user what to configure                          |
| `docs`             | optional | URL to server docs (for users who want to learn more)                                                  |
| `instructions`     | optional | ≤ 280 chars; plain-text guidance shown in the add-server modal explaining how to obtain the credential |
| `instructions_url` | optional | URL to the server's auth-setup docs; renders as a "Where to find this →" link beside `instructions`    |
| `addedAt`          | yes      | ISO date                                                                                               |
| `status`           | yes      | `"active"` / `"unstable"` / `"retired"`                                                                |

A JSON Schema file `public/public-servers.schema.json` enforces this shape;
CI rejects PRs that add malformed entries.

## 2. Governance

- Entries are added via PR to this repo.
- Each PR must include the `public-servers.json` diff plus a short note in
  the PR description saying who runs the server and why it's useful to the
  community.
- Any maintainer (currently Claude under Costa's authority, per `CLAUDE.md`)
  can approve and merge. Community contributors can open PRs; we merge them.
- We do **not** accept:
  - Commercial tease servers that redirect to paid signups
  - Servers that return wildly non-standard JSON-RPC
  - Servers without HTTPS / WSS
  - Servers with no CORS configured (they will not work in the browser;
    see `docs/cors-explainer.md`)
- We will mark a server `"status": "unstable"` after repeated user reports of
  timeouts, and `"retired"` when it goes offline — we do not delete entries
  so that shareable URLs remain meaningful.

## 3. Runtime behaviour

On startup:

1. The bundled `public-servers.json` is loaded at build time into the app.
2. User-added servers are loaded from localStorage.
3. The server list is the union, with user entries keeping priority on
   duplicate URLs (they may have custom auth etc.).
4. `"retired"` entries are shown struck-through and at the bottom; they
   cannot be connected to, only viewed.

## 4. Privacy

We do **not** report which catalog entries a user connects to. There is no
backend to receive such a report.

## 5. Validation tests

`tests/unit/public-servers.test.ts` asserts every entry:

- has required fields
- `url` parses as a URL
- `transport` matches an allowed value
- `description` ≤ 140 chars
- `id` is a valid slug and unique

## 6. Initial seed

Seeded empty at Phase 7; entries added by community + Claude's research into
known-good public servers as part of that phase.
