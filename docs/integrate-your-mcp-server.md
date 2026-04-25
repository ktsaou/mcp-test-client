# Integrate your MCP server with mcp-test-client

If you operate a public MCP server and want to make it easy for users
to try it, you can deep-link from your docs / website / README into
the hosted client at
**[ktsaou.github.io/mcp-test-client](https://ktsaou.github.io/mcp-test-client/)**
with the URL pre-filled.

## Deep-link format

```
https://ktsaou.github.io/mcp-test-client/?add=<your-server-url>
```

If the visitor already has your server saved (matched by URL), the
client picks the entry and connects immediately. If they don't, an
add-server modal opens with the URL pre-filled — the visitor presses
Save and that's it.

## Optional query parameters

Add any of these to make the modal land in the right state:

| Param              | Purpose                                                                                                                               | Example                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `name`             | Friendly name shown in the sidebar. Defaults to the URL host if omitted.                                                              | `&name=Acme%20MCP`            |
| `transport`        | One of `auto`, `streamable-http`, `sse-legacy`, `websocket`. Defaults to `auto` (the client picks based on the URL scheme + a probe). | `&transport=streamable-http`  |
| `auth`             | One of `none`, `bearer`, `header`. Picks the auth UI in the modal. The visitor still types the credential.                            | `&auth=bearer`                |
| `auth_header_name` | When `auth=header`, pre-fill the header name (e.g. `X-Api-Key`).                                                                      | `&auth_header_name=X-Api-Key` |

Credentials are **never** read from the URL. There is no `auth_value`
parameter and there will not be: tokens must not travel in URLs you
publish on a public web page.

## Examples

A no-auth public server:

```
https://ktsaou.github.io/mcp-test-client/?add=https%3A//hf.co/mcp&name=Hugging%20Face%20Hub
```

An auth-required server using a bearer token:

```
https://ktsaou.github.io/mcp-test-client/?add=https%3A//mcp.example.com/v1&name=Acme%20MCP&auth=bearer
```

An auth-required server using a custom header (the visitor types the
value):

```
https://ktsaou.github.io/mcp-test-client/?add=https%3A//mcp.example.com/v1&auth=header&auth_header_name=X-Api-Key
```

## What about a "Try it" button?

You can wrap any of the above in a regular `<a>` tag:

```html
<a
  href="https://ktsaou.github.io/mcp-test-client/?add=https%3A//mcp.example.com/v1&auth=bearer"
  target="_blank"
  rel="noopener noreferrer"
  >Try this server in mcp-test-client →</a
>
```

## Getting listed in the public catalog

For genuinely public, no-auth, CORS-permissive servers, open a PR
against
[`public/public-servers.json`](https://github.com/ktsaou/mcp-test-client/blob/master/public/public-servers.json).
A periodic verification job runs against every catalog URL
(`initialize` handshake + CORS preflight); entries that fail get
flagged or removed in a maintenance PR.

## CORS

Whatever URL you ship, the visitor's browser must be able to talk to
it. That means CORS — your `/mcp` endpoint must respond to a browser
preflight from arbitrary origins. The most common shapes:

- `Access-Control-Allow-Origin: *` (wildcard — easiest, fine for
  public read-only servers)
- `Access-Control-Allow-Origin: <echoes the request origin>` (works
  with credentials enabled)

If your server doesn't speak CORS, the client will surface a CORS
error in the system log and the connect will fail. Fix it on the
server side; we can't proxy from a static-deployed browser app.

See [`docs/cors-explainer.md`](./cors-explainer.md) for the full
treatment.

## Telemetry / privacy

The client never reports to any backend. Everything happens in the
visitor's browser — your server never knows mcp-test-client is the
caller unless your code looks at the `User-Agent` (which is the
browser's UA, not the client's). The MCP `initialize` request does
include `clientInfo: { name: "mcp-test-client", version: "<x.y.z>" }`
per the protocol — that is the only signal.
