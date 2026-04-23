# Troubleshooting

Common problems and what they usually mean.

## "Failed to fetch" / connection hangs

The most common cause is **CORS**. Open DevTools → Network tab. If the
preflight `OPTIONS` request has no `Access-Control-Allow-Origin`
header, or the browser console shows a "blocked by CORS policy" line,
the server is not configured to accept your origin.

Point the server operator at [`cors-explainer.md`](cors-explainer.md).
This client cannot work around CORS. No browser tool can.

## "Connection closed before opening" on a `wss://` URL

- Check the server actually speaks the WebSocket MCP transport. Many
  MCP servers only speak Streamable HTTP.
- Check the URL scheme: `wss://` from the hosted client; `ws://` only
  works locally.
- If the server requires auth, remember: bearer headers **cannot** be
  set on a WebSocket upgrade from a browser. Use cookies, put the
  token in the query string, or authenticate in the first JSON-RPC
  message.

## Tool list is empty after connecting

- The server advertises a `tools` capability but `tools/list` is
  failing. Check the log panel — the error response has the detail.
- Some servers expose only prompts or only resources. Switch tabs in
  the inspector.
- Some servers require authentication; the list call fails with `401`
  until you configure a token in the server settings.

## "MCP-Protocol-Version" header is rejected

The client negotiates the highest spec version it supports. If the
server returns `400 Bad Request` with a protocol-version complaint, the
server is on a very old spec. Try the **SSE (legacy)** transport in
server settings — that routes through the pre-2025 `HTTP+SSE` shape.

## Schema form rejects valid input

- If the server's JSON Schema uses a construct the renderer doesn't yet
  support, the panel falls back to a raw JSON editor. Paste the literal
  arguments there.
- File an issue with the schema; each reported schema becomes a
  regression test in
  [`tests/conformance/real-schemas/`](../tests/conformance/).

## Browser warns about mixed content

You loaded the app over `https://` but pointed it at an `http://` or
`ws://` server that isn't on localhost. Browsers block this. Either:

- Deploy the server over TLS (`https://` or `wss://`).
- Run the client locally: clone the repo and `npm run dev`.

## Local development: `npm run dev` won't start

- Node ≥ 20 is required. Check `node -v`.
- If port 5173 is taken Vite will pick another; watch the log for the
  actual URL.

## I deleted a server by accident

There is no undo — `localStorage` is authoritative and we persist
changes immediately. If you exported your setup (Settings menu →
Export) you can re-import it. Otherwise, re-add the URL.

## Data reset

Settings → **Clear all stored data** wipes every `mcptc:*` key. This
includes all servers, tokens, history, tool parameters, canned
requests, and theme preference. There is no way back.

## Anything else

Open an issue: https://github.com/ktsaou/mcp-test-client/issues. Please
include:

- Browser + OS
- Server URL (if public)
- The contents of the log panel around the failure
- A screenshot if the UI misbehaved visually
