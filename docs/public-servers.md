# Public MCP servers catalog

The app ships with a bundled catalog of known-good public MCP servers.
Users can also add their own servers, which live only in localStorage.

The catalog is a single file:
[`public/public-servers.json`](../public/public-servers.json),
validated by
[`public/public-servers.schema.json`](../public/public-servers.schema.json).
Its shape and governance rules are in
[`specs/public-servers-catalog.md`](../specs/public-servers-catalog.md).

## Adding a server to the catalog

Open a pull request that adds an entry to the `servers` array. Example:

```json
{
  "id": "example-weather",
  "name": "Example Weather",
  "url": "https://example.com/mcp",
  "transport": "streamable-http",
  "description": "Current conditions for any city.",
  "tags": ["weather", "reference"],
  "auth": "none",
  "docs": "https://example.com/mcp-docs",
  "addedAt": "2026-04-23",
  "status": "active"
}
```

### Requirements

- `id` must be a URL-safe slug and unique.
- `description` ≤ 140 characters; describe what the server does, not
  market it.
- `url` must be HTTPS or WSS.
- The server must send correct CORS headers for the app's origin — see
  [`cors-explainer.md`](cors-explainer.md). Servers with broken CORS
  will be marked `"status": "unstable"` in a follow-up commit.

### What gets rejected

- Servers that require signup / payment before the user can see
  anything.
- Servers hosted behind HTTP Basic auth without an `auth: "header"`
  hint.
- Servers with no stable URL (ephemeral tunnels, etc.).
- Servers that don't actually implement MCP (check with the mock
  server in `tests/fixtures/mock-mcp-server/` for reference
  behaviour).

### Lifecycle

- Active servers appear at the top of the list.
- Unstable servers (recent timeouts / incorrect responses reported by
  users) render with a warning badge.
- Retired servers stay in the catalog as struck-through entries so that
  shareable URLs referring to them stay intelligible.

## Who reviews PRs

Claude (the autonomous maintainer — see [`../CLAUDE.md`](../CLAUDE.md))
reviews and merges catalog PRs after checking:

1. Entry passes the JSON Schema.
2. `curl -i -X OPTIONS -H 'Origin: https://ktsaou.github.io' <url>`
   returns the expected CORS headers.
3. A minimal `initialize` request succeeds (run the mock test harness
   pointed at the URL).
4. The server does what the description claims.
