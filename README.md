# mcp-test-client

A zero-install, browser-only test client for exploring public [Model Context
Protocol](https://modelcontextprotocol.io) servers.

Paste a URL, connect, and interact with a server's tools, prompts, and
resources through auto-generated forms. Nothing is sent anywhere except your
browser and the MCP server you point at. No backend, no account, no
telemetry.

**Status**: rewrite in progress. See [`TODO-MODERNIZATION.md`](TODO-MODERNIZATION.md).

## What it's for

- **Evaluating a public MCP server** before you integrate it
- **Seeing what a server exposes** — tools, prompts, resources, their schemas
- **Exercising a tool interactively** without writing any code
- **Sharing a reproducible "here's the call I made"** via a copy-able URL

It is **not** for testing an MCP server you are writing locally. For that,
use [MCP Inspector](https://github.com/modelcontextprotocol/inspector) —
it's installable, spawns your stdio server, and proxies to a browser UI.

## Transports

| Transport                                                                                                | Status                             | URL scheme  |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------- | ----------- |
| Streamable HTTP (current MCP spec)                                                                       | ✅                                 | `https://…` |
| Server-Sent Events (legacy, pre-2025-03)                                                                 | ✅                                 | `https://…` |
| WebSocket (custom, not in MCP spec — see [`specs/websocket-transport.md`](specs/websocket-transport.md)) | ✅                                 | `wss://…`   |
| stdio                                                                                                    | ❌ browsers cannot spawn processes |

Mixed content (plain `http://` or `ws://` to non-localhost) is blocked by
browsers and will not work.

## Quick start

**Hosted version** (once v1.0 ships): https://ktsaou.github.io/mcp-test-client/

**Run locally**:

```bash
git clone https://github.com/ktsaou/mcp-test-client
cd mcp-test-client
npm install
npm run dev
```

Then open http://localhost:5173 and add a server.

## Known limitation: CORS

Because this app talks directly from your browser to the MCP server, the
server **must** include CORS headers allowing your origin — either our
hosted origin or `http://localhost:5173` if you run it locally. If the
server does not permit your origin, the browser will block the connection
and there is nothing the client can do about it. See
[`docs/cors-explainer.md`](docs/cors-explainer.md) for what a server
operator has to configure.

## Features

- Multi-transport: Streamable HTTP, SSE, WebSocket
- JSON Schema 2020-12 form generator: unions, tuples, dynamic objects,
  arrays-of-objects, enums, `$ref` / `$defs`, `allOf`
- Three send modes: form, raw JSON, schema inspector
- Send with or without client-side validation
- "Import from LLM paste" — tolerant parser for sloppy tool-call JSON
- Full message log with syntax highlighting
- Dark and light themes (dark default)
- Shareable URLs — copy a link that opens a pre-filled request on the
  recipient's browser
- Public servers catalog — curated list of known-good public MCP servers
- localStorage persistence: servers, themes, last-used params, canned
  requests. No backend, no sync, no telemetry.

## For contributors

See [`CONTRIBUTING.md`](CONTRIBUTING.md). Internal design decisions live in
[`specs/`](specs/); the maintainer runbook is in [`CLAUDE.md`](CLAUDE.md).

## License

GPL-3.0-or-later. Fork freely; vendoring into closed software is not
permitted under GPL.

## History

Extracted from [Netdata's MCP test client](https://github.com/netdata/netdata),
originally built to exercise Netdata's MCP server. Re-positioned as a
general-purpose tool for the community.
