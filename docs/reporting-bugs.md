# Reporting a bug or asking for help

When something doesn't work — a connection fails, a tool returns nothing,
a schema renders wrong — the fastest path to a fix is a **diagnostic
bundle**: a small JSON document that captures what the app saw during
your session.

## What's in the bundle

A bundle is plain JSON. It contains:

| Section       | What it holds                                                                                                                 | Why we need it                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `appVersion`  | Which build you ran                                                                                                           | Rules out fixes that already shipped               |
| `environment` | Browser, platform, language, viewport, timezone                                                                               | Many MCP bugs are browser-specific                 |
| `connection`  | Server URL, transport, connection status, last error, inventory sizes                                                         | Locates the problem by transport and server config |
| `log`         | Every JSON-RPC message the app sent or received, plus system events (connection closed, transport errors) — up to 500 entries | Lets us see what actually crossed the wire         |

## What's redacted, what isn't

**Redacted automatically:**

- Bearer tokens — replaced with `{ kind: "bearer", tokenLength: N, tokenPreview: "xx…yy" }`
- Custom-header auth values — replaced with length + short preview
- The preview shows the first two and last two characters of strings ≥ 8
  characters, so you can confirm which token you shared without exposing it.

**Not redacted:**

- **Response payloads.** If you called a tool that returned sensitive data,
  that data is in the `log` array. Review the JSON before pasting.
- The server URL. If your server URL is a secret (e.g., an internal
  staging endpoint), edit it out before sharing.

## Three ways to get a bundle

### Fastest: the "Report issue" button

Click **Report issue** in the log panel. The app:

1. Builds the bundle
2. Copies the JSON to your clipboard
3. Opens the GitHub bug-report form in a new tab

Paste the bundle into the **Diagnostics** field of the form, fill in the
rest, and submit.

### DevTools console (if you can't click the button, or you want to inspect)

```js
// In the browser DevTools Console while the app is open:
mcpClientDiagnostics(); // returns the bundle object
copy(JSON.stringify(mcpClientDiagnostics(), null, 2)); // to clipboard
```

Use this if the Report-issue button doesn't work for you, or if you want
to inspect the bundle before sharing.

### File a bug without the app (edge cases)

If the app crashed so hard the button is gone, open a bug report with
just what you have: browser console errors, the URL you connected to,
and the transport you picked. Anything is better than nothing.

## Where to share

- **Public bug**: [open a GitHub issue](https://github.com/ktsaou/mcp-test-client/issues/new?template=bug_report.yml)
  using the template. Paste the bundle into the Diagnostics field.
- **Private / sensitive**: open a
  [security advisory](https://github.com/ktsaou/mcp-test-client/security/advisories/new)
  instead. The bundle may contain response data you don't want public.
- **Asking an AI assistant for help**: paste the bundle into the chat.
  Any assistant that understands JSON can trace the session from the
  `log` array.

## For assistants / support agents reading a bundle

The bundle is intentionally self-describing. A working rubric:

1. **Identify the failure point.** Walk `log` chronologically. Look for
   a request with no matching response, or a response containing `error`.
2. **Check the transport.** System events (`kind: "system"`) include
   WebSocket close codes, HTTP status mismatches, SSE stream resets —
   usually far more diagnostic than the last JSON-RPC message.
3. **Check the handshake.** The first two `wire` entries are `initialize`
   request + response. If the server advertised capabilities don't match
   what was later called, the problem is server-side.
4. **Check schema compliance.** Tool schemas in the
   `tools/list` response must validate against
   [the MCP tool schema](https://spec.modelcontextprotocol.io/); many
   client bugs are actually server bugs manifesting as render failures.
5. **Consider the environment.** `environment.userAgent` tells you
   whether this is Safari (WebSocket quirks), Firefox (different CORS
   preflight behaviour), or Chrome.

Bundle shape is stable within a `bundleVersion`. When the shape changes
incompatibly, `bundleVersion` is bumped.
