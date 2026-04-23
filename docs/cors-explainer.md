# CORS for MCP server operators

If people want to exercise your MCP server from this test client (or any
other browser-only tool), your server has to **opt in via CORS
headers**. Browsers will block any cross-origin request otherwise — and
there is nothing the client can do about it.

This page tells you exactly what to configure.

---

## What breaks without CORS

- The user clicks **Connect** in the app.
- The browser sends an `OPTIONS` preflight or actual `POST` to your URL.
- Your server responds without an `Access-Control-Allow-Origin` header
  that matches the client's origin.
- The browser silently drops the response. The user sees a generic
  "Failed to fetch" error.

Nobody can test your public MCP server this way.

## What to send

These are the minimum headers for a public MCP server that wants to be
reachable from `https://ktsaou.github.io` *and* from any user running
the client locally on `http://localhost:5173`:

```
Access-Control-Allow-Origin: <the request's Origin, if you want to be permissive>
Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID
Access-Control-Expose-Headers: MCP-Session-Id, MCP-Protocol-Version
Access-Control-Max-Age: 600
```

Handle `OPTIONS` explicitly by returning **HTTP 204** with the headers
above. No body is required.

### The Origin header

You have three reasonable strategies:

| Strategy | Header value | When to use |
|---|---|---|
| Allow any origin | `Access-Control-Allow-Origin: *` | Truly public server. Cannot combine with credentialed requests. |
| Reflect request origin | Echo the incoming `Origin` value | Same effect as `*` but lets you scope by-origin later. |
| Allowlist | A specific origin | Only want certain hosted clients to reach you. |

If you need cookies or per-origin credentials, you *must* reflect the
origin exactly (wildcard is not allowed) and set
`Access-Control-Allow-Credentials: true`.

## WebSocket auth note

The browser **cannot** set custom headers on a WebSocket upgrade. If
your server is WebSocket-based and requires auth, your options are:

1. **Cookie auth**: the browser sends cookies automatically on same-
   origin upgrades. No headers needed.
2. **Token in URL query string**: `wss://server/mcp?token=…`. Works
   everywhere; visible in server logs.
3. **First-message auth**: the client connects unauthenticated, then
   sends credentials as its first JSON-RPC message. Server-specific;
   users configure this manually in the raw editor.

There is no way to send `Authorization: Bearer …` on a WebSocket
upgrade from a browser. This is a browser limitation, not a client bug.

## Nginx example

```nginx
location /mcp {
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin $http_origin always;
        add_header Access-Control-Allow-Methods "GET, POST, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID" always;
        add_header Access-Control-Max-Age 600 always;
        add_header Access-Control-Expose-Headers "MCP-Session-Id, MCP-Protocol-Version" always;
        return 204;
    }
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Expose-Headers "MCP-Session-Id, MCP-Protocol-Version" always;
    proxy_pass http://your-backend;
}
```

## Express / Node example

```js
app.use((req, res, next) => {
  const origin = req.headers.origin ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, MCP-Session-Id, MCP-Protocol-Version, Last-Event-ID',
  );
  res.setHeader('Access-Control-Expose-Headers', 'MCP-Session-Id, MCP-Protocol-Version');
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }
  next();
});
```

(This is essentially what the test harness at
`tests/fixtures/mock-mcp-server/` does.)

## Verifying it works

```bash
curl -i -X OPTIONS \
  -H 'Origin: https://ktsaou.github.io' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: Content-Type, MCP-Session-Id' \
  https://your-server.example.com/mcp
```

You should see `HTTP/1.1 204 No Content` (or `200 OK`) and the
`Access-Control-Allow-*` headers above. If `Access-Control-Allow-Origin`
is missing, the browser will block the real request.
