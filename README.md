# MCP Test Client

A zero-install, browser-based client for **exploring any online MCP server** — paste a URL, connect, and interact with the server's tools, prompts, and resources through auto-generated forms. Everything runs client-side; nothing is sent anywhere except your browser and the MCP server you point at.

No install. No backend. Open the URL in a browser and connect.

## What it is for

This is for **exploring other people's online MCP servers**:

- Evaluating a public MCP service before deciding to integrate it
- Inspecting what tools, prompts, and resources a given server exposes
- Invoking tools interactively to see the real response shapes
- Sharing a reproducible "here is the tool call" link with a teammate

It is **not** for testing an MCP server you're writing locally — for that, use [MCP Inspector](https://github.com/modelcontextprotocol/inspector), which is installable locally and supports stdio transport.

## Transports supported

- **Streamable HTTP** (`https://…`)
- **Server-Sent Events / SSE** (`https://…`)
- **WebSocket** (`wss://…`)

**Not supported**: `stdio` (browsers cannot spawn processes) and unencrypted `http://` / `ws://` to non-localhost addresses (browsers block mixed content).

## Features

- **Multi-transport**: WebSocket, Streamable HTTP, SSE — choose per server
- **Schema-driven forms**: auto-generates input widgets for any tool's JSON Schema, including:
  - `anyOf` / `oneOf` unions — tab switcher between type options
  - `additionalProperties` — editable key/value maps
  - Arrays, tuple arrays, array-of-objects
  - Enums as dropdowns or multi-select checkboxes
- **Three ways to send**: generated form, raw JSON editor, or schema inspector
- **Send with / without validation**: deliberately bypass client-side checks to exercise server-side validation
- **Import from LLM output**: paste a tool call your LLM produced (even with backtick-quoted JSON) and the client converts it to a valid request
- **Full message log**: every JSON-RPC request and response, colored and pretty-printed
- **Local-first persistence**: server list, transport preferences, auth tokens, and per-tool last-used parameters are saved in browser `localStorage`. No account, no sync, no telemetry.
- **Bearer token auth**: configurable per server

## Quick start

### Option A — use the hosted version
Open https://ktsaou.github.io/mcp-test-client/ and enter your MCP server URL.

### Option B — run locally
```bash
git clone https://github.com/ktsaou/mcp-test-client
cd mcp-test-client
# Open index.html in a browser
```
Or serve it from any static HTTP server:
```bash
python3 -m http.server 8080
# open http://localhost:8080
```

## How connections work

The client talks directly from your browser to the MCP server. The tool never proxies your traffic through a backend — there is no backend.

For this to work, the target MCP server must:

- Be reachable over `https://` or `wss://`
- Send the appropriate **CORS headers** (`Access-Control-Allow-Origin`) for the origin you're loading the client from
- Accept an `Authorization: Bearer <token>` header if authentication is required

If CORS is not configured on the server, the browser will refuse the connection. That is the server's responsibility — the client cannot work around it.

## File layout

| File | Purpose |
|------|---------|
| `index.html` | Main UI shell — transport selection, server list, request/response panels |
| `mcp-schema-ui-generator.js` | JSON Schema → HTML form generator (handles unions, dynamic objects, tuples, etc.) |
| `json-pretty-printer.js` | JSON response formatter with syntax highlighting and nested-JSON detection |

No dependencies. No build step.

## Contributing

Pull requests welcome. If you find a tool schema that doesn't render cleanly, open an issue with a minimal reproduction (the offending schema + a short description).

## License

GPL-3.0-or-later. See `LICENSE`.

## History

Originally developed as part of [Netdata](https://github.com/netdata/netdata) to test Netdata's MCP server implementation. Extracted and positioned as a general-purpose MCP exploration tool.
