# MCP Protocol Compliance

**Target spec version**: `2025-11-25` (the `LATEST_PROTOCOL_VERSION` exposed
by `@modelcontextprotocol/sdk@^1.29`).

**Accepted during negotiation** (we will transparently work with servers
speaking any of these):

- `2025-11-25` (target)
- `2025-06-18`
- `2025-03-26`
- `2024-11-05` (first public MCP spec)

Matches `SUPPORTED_PROTOCOL_VERSIONS` in
[`@modelcontextprotocol/sdk/types.js`](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/types.ts).
When the SDK bumps this list, we re-run the compliance suite and update this
document in the same PR.

---

## 1. What we implement

### 1.1 Client roles

We act as an **MCP client** only. We do not impersonate a server.

### 1.2 Capabilities we advertise

During `initialize`, our client declares:

```json
{
  "capabilities": {},
  "clientInfo": { "name": "mcp-test-client", "version": "<package.json version>" }
}
```

We deliberately declare **no** client capabilities (`sampling`, `roots`,
`elicitation`) in v1.x. Rationale:

- Declaring `sampling` implies we can run LLM calls on behalf of a server.
  A test client should not route real LLM traffic.
- Declaring `roots` implies filesystem scope. We have none (browser).
- Declaring `elicitation` would let the server prompt the user through us; we
  will support this when a concrete user need lands (tracked as a future
  feature issue).

### 1.3 Server features we surface

| Feature                    | Status | Notes                                                          |
| -------------------------- | ------ | -------------------------------------------------------------- |
| `tools/list`               | ✅     | Fully rendered as forms via schema renderer                    |
| `tools/call`               | ✅     | Result shown; `isError`, `structuredContent` both honoured     |
| `prompts/list`             | ✅     |                                                                |
| `prompts/get`              | ✅     | Argument schemas rendered as forms                             |
| `resources/list`           | ✅     |                                                                |
| `resources/templates/list` | ✅     |                                                                |
| `resources/read`           | ✅     | Text + blob contents; MIME-type aware display                  |
| `resources/subscribe`      | ✅ \*  | (\*) Works, but we make it obvious that the session stays open |
| `resources/unsubscribe`    | ✅     |                                                                |
| `completion/complete`      | ⚠️     | Advertised to server, but UI integration is v1.1               |
| `logging/setLevel`         | ✅     | Level picker in UI                                             |
| `ping`                     | ✅     | Available as a manual button                                   |

### 1.4 Notifications we handle

| Notification                           | Behaviour                                |
| -------------------------------------- | ---------------------------------------- |
| `notifications/tools/list_changed`     | Re-run `tools/list` automatically        |
| `notifications/prompts/list_changed`   | Re-run `prompts/list`                    |
| `notifications/resources/list_changed` | Re-run `resources/list`                  |
| `notifications/resources/updated`      | Flash the subscribed resource + refetch  |
| `notifications/message` (logging)      | Append to the message log with level tag |
| `notifications/progress`               | Show progress bar for the request id     |
| `notifications/cancelled`              | Mark the in-flight request as cancelled  |

## 2. Streamable HTTP (primary transport)

The SDK handles the wire format; we just pass URLs and headers. Spec points we
verify in the compliance suite:

- [ ] `POST` with body = single JSON-RPC message
- [ ] `Accept: application/json, text/event-stream`
- [ ] `MCP-Protocol-Version: <negotiated>` on every non-initialize request
- [ ] `MCP-Session-Id` echoed on every request once the server assigns it
- [ ] `GET` with `Accept: text/event-stream` supported to receive
      server-initiated messages
- [ ] `DELETE` with the session id on disconnect
- [ ] `Last-Event-ID` sent on reconnect when we have one
- [ ] `HTTP 400` on session errors reinitializes cleanly
- [ ] `HTTP 404` on unknown session triggers a fresh initialize
- [ ] `Origin` header is allowed by the server (we log CORS errors clearly)

## 3. SSE legacy transport

We keep this for servers still on 2024-11-05. The SDK's
`SSEClientTransport` handles it; we don't do anything custom beyond providing
headers.

## 4. WebSocket transport

See [`websocket-transport.md`](websocket-transport.md). Non-spec; SDK-compatible.

## 5. What we do not implement (and why)

- **stdio transport** — browsers cannot spawn subprocesses.
- **Sampling / roots** — see 1.2.

## 6. How to re-verify compliance

1. `npm run test:compliance` runs the compliance suite in `tests/compliance/`
   against the mock server in `tests/fixtures/mock-mcp-server/`.
2. For real-world exercise, connect to at least one public server from
   `public/public-servers.json` and run through the manual smoke-test list
   in `docs/manual-smoke-test.md`.
3. On spec bump: open an issue, update this doc, bump SDK, re-run both steps.
