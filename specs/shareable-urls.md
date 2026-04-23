# Shareable URLs

A user can copy a URL that encodes a pre-filled MCP request and paste it to a
teammate. Opening the URL loads the app with that server selected, that tool
selected, and those arguments filled in — ready to click "Send".

This is a core differentiator versus MCP Inspector (their issue #1183).

---

## 1. Design choices

- **Hash fragment, not query string.** The fragment never reaches the server,
  never appears in access logs, and keeps any bearer token out of
  Referer/analytics. We still warn against sharing links that carry tokens.
- **Compressed JSON, base64url-encoded.** Human-readability isn't a goal;
  fidelity and small size are.
- **No network lookup on load.** Everything needed to render the app state is
  in the URL plus the (optional) user's localStorage.

## 2. Format

```
https://<host>/#s=<base64url(deflate(state-json))>
```

`state-json` shape:

```ts
interface ShareState {
  v: 1; // format version
  url: string; // server URL
  t?: 'streamable-http' | 'sse-legacy' | 'websocket'; // transport override
  tool?: string; // selected tool name
  args?: unknown; // tool arguments (pre-filled form)
  raw?: string; // raw JSON-RPC payload override
  connect?: boolean; // auto-connect on load
}
```

Only `url` is required; everything else is optional.

## 3. Semantics on load

1. Parse the fragment. On parse failure: log the error, show a toast, continue
   with default state.
2. Look up the URL in `localStorage`. If a matching entry exists, select it —
   **preserving the user's stored auth**. If not, create an in-memory server
   entry (not persisted until the user confirms "Save this server").
3. If `t` is present and different from the saved entry's transport, we do
   **not** overwrite the saved entry. We temporarily override for this
   session.
4. If `tool` is present, select it.
5. If `args` is present, pre-fill the form.
6. If `raw` is present, it wins over `args` and pre-fills the raw editor.
7. If `connect` is `true`, attempt to connect. Still requires a user click
   for initial tool call (no auto-send).

## 4. "Copy shareable link" button

Lives next to the Send button. Builds the current state, compresses, base64url
encodes, writes `location.href` with the new fragment, copies it to clipboard.

Tokens are **never** included, even when the user has a bearer configured.
The pasted URL on the other end will require the recipient to configure their
own auth.

## 5. Size budget

URLs longer than ~2000 characters break in some chat apps. If the compressed
payload exceeds that, we:

- Drop `raw` (usually the largest field), fall back to structured `args`.
- If still too long, strip `args` and include only `url` + `tool`.
- Warn the user with a toast: "Arguments too large to include; recipient will
  need to fill them in manually."

## 6. Security considerations

- A shared URL with `connect: true` can cause the recipient's browser to hit
  the configured server. Same-as-clicking-any-link: the user still sees the
  address and the server URL before connecting. We display both prominently.
- No XSS vector: the fragment is never interpolated as HTML; it's parsed as
  JSON and feeds typed fields only.

## 7. Future (out of scope for v1.0)

- Named "presets" that reference a local bookmark instead of embedding args
  (avoids URL size limits, but loses self-containment).
- Signed shareable URLs that certify "this came from a trusted source" —
  probably never; it would undo the zero-backend principle.
