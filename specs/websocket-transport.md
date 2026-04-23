# MCP WebSocket Transport (custom, non-spec)

**Status**: custom transport, not part of the MCP specification.
**MCP spec as of 2026-04-23**: `2025-11-25`. Defines only `stdio` and
Streamable HTTP. SEP-1288 (WebSocket Transport) is OPEN but stalled; sponsor
has publicly signalled they will not continue without help, the companion PR
has no diff, and the related SEP-1364 is closed. We do not bet on SEP-1288
landing as-is.

**What we actually ship**: the WebSocket transport from
`@modelcontextprotocol/sdk/client/websocket.js`. It is an SDK-blessed
transport that many community servers implement, even though it is not in the
written spec. We wrap it with our logging decorator and use it unchanged.

---

## 1. Why WebSocket at all

Some public MCP servers expose a WebSocket endpoint. Users want to test
them. Shipping WebSocket support:

- Keeps us in parity with the SDK (no divergent wire protocol).
- Lets users exercise `wss://` endpoints that MCP Inspector does not support.
- Requires no custom code beyond transport wiring.

## 2. Wire protocol (as shipped by the SDK)

- **URL**: `ws://` or `wss://`, user-provided; we pass through.
- **Subprotocol**: `"mcp"` (singular, no version suffix) — this is what
  `new WebSocket(url, 'mcp')` sends in `Sec-WebSocket-Protocol`.
- **Framing**: one text frame per JSON-RPC message. Binary frames are
  unexpected and dropped with a log entry.
- **Session**: implicit — one session per connection. No `MCP-Session-Id`,
  no `mcpSessionId` at the JSON-RPC level.
- **Initialize**: same `initialize` → `initialized` handshake as Streamable
  HTTP, just carried over WS frames.
- **Protocol version**: negotiated via `initialize` exactly like other
  transports.
- **Auth**: bearer tokens cannot be sent via headers on a browser WebSocket
  upgrade (browser API limitation). If the server requires auth:
  - **Cookie-based** works transparently (browser attaches cookies on same
    origin upgrades).
  - **Token-in-URL** (query string) works but is visible in server logs;
    discouraged and documented.
  - **Auth on first message after connect** — server-specific; we do not
    try to automate it. Users can type the auth handshake into the raw
    JSON-RPC editor.

## 3. Differences from draft SEP-1288 (for the record)

SEP-1288 proposes:

- Subprotocol `mcp.v1` with an auth-token appended in the subprotocol list.
- Session id as a top-level `mcpSessionId` field on every JSON-RPC object.

**We do not implement either.** SEP-1288 is stalled and its author has
rejected an `Authorization` header approach only to invent a protocol that
no server actually implements. The SDK's simpler `mcp` subprotocol + implicit
session is the de facto standard among servers that do ship WS.

If SEP-1288 (or any future WebSocket SEP) is adopted and the SDK updates its
transport, we follow the SDK. If it's adopted but the SDK lags, we
implement the delta as a second transport (`websocket-sep1288`) next to the
existing one.

## 4. Reconnection

The SDK's WebSocket transport does **not** auto-reconnect. On close we show
a disconnection banner; the user initiates reconnect with the connect
button. Rationale: in a test client, surprise reconnects hide real
connectivity bugs the user is trying to see.

## 5. Close codes we surface

The SDK emits `onclose(code, reason)`. We render:

| Code range     | UI label                                       |
|----------------|------------------------------------------------|
| 1000           | "Disconnected cleanly"                         |
| 1001–1015      | The standard WebSocket reason, verbatim        |
| 4000–4999      | "Application close: `<code>` `<reason>`"       |
| anything else  | "Unknown close: `<code>`"                      |

## 6. Testing

- **Unit**: mock `WebSocket`; assert the SDK transport is constructed with
  subprotocol `mcp`, our logging decorator fires on send/receive, close
  surfaces the code/reason to the UI.
- **Integration**: Node test server using the SDK's server-side WS transport
  (via `ws` npm) runs a minimal tools/prompts/resources flow.
- **Conformance**: the same compliance suite runs against the WS transport
  as against Streamable HTTP (initialize, protocol version negotiation,
  list, call, notifications). Different transport, same server contract.

## 7. Out of scope

- Reconnection-with-backoff (test tool; we want transparency over convenience).
- WebSocket-specific OAuth negotiation (deferred until a server actually needs it).
- Binary frames (MCP is JSON; dropping binary is correct behaviour).
