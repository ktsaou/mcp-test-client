# DEC-019 — Send without validation (2026-04-25)

**Problem.** Costa's item #7: server developers want to test how
_their_ server handles arbitrary / malformed input — including input
that violates the server's own `inputSchema`. The current Send button
gates on Ajv 8 validation; if the form output doesn't match the
schema, Send is blocked.

This is a power-user affordance — the typical user wants schema
gating; an MCP-server developer specifically wants to bypass it.

## Sub-item checklist

- [ ] **#7 — Send-without-validation option.** A second action next
      to Send. Wording: **"Send without validation"** (split button
      with chevron, OR a checkbox under the Send button labelled
      _"Bypass schema validation"_).
- [ ] **#7 — explicit signal.** When the bypass is used, the
      resulting log entry's headline carries a small badge `(no-val)`
      so the wire trace shows the bypass happened. Bypass state is
      _not_ persisted between sessions — it's a deliberate per-send
      choice.
- [ ] **#7 — works for both Form and Raw modes.** In Raw mode the
      form is irrelevant; the bypass is implicit (raw JSON has no
      gate). The badge surfaces on the log entry regardless of mode.

## Direction

**Confirmed (Costa Q6 + Q7, 2026-04-25):**

- **Q6 — split-button.** `Send` button stays as-is for the default
  action; a chevron next to it opens a dropdown carrying "Send without
  validation". Send-without-validation is never the visible default —
  the user has to deliberately choose it from the menu.
- **Q7 — per-send only.** Bypass state is _not_ persisted across sends,
  not session-sticky, not tool-sticky. Every bypass is an explicit
  per-click choice. Server developers want intentional escapes, not a
  foot-gun left armed.

Mantine `Button.Group` (or `SplitButton` if v9 has one — verify) with
"Send" as the default action and "Send without validation" as the
secondary. The dropdown reveals only the second option.

Implementation in `RequestPanel`:

```ts
async function handleSend(opts: { skipValidation?: boolean } = {}) {
  if (!opts.skipValidation && validation.failed) {
    // current path
  } else {
    // bypass: send args as-is (form output) or text as-is (raw)
    await client.callTool(name, args, { meta: { mcpClient: 'no-val' } });
  }
}
```

Log-entry badge: extend `LogEntry`'s wire kind with a `noVal: boolean`
flag (default false) set when the user took the bypass path. The
headline renders `<Badge size="xs" color="orange">no-val</Badge>` when
true.

## Falsifier

- User can send a form output that fails Ajv validation through the
  default Send button (i.e. the gate failed open).
- User cannot send malformed input even when explicitly opting in.
- Bypass state persists across sends (it shouldn't — every send is
  an explicit choice).
- Log entry doesn't surface the bypass, so a future reader can't
  tell the request was knowingly malformed.

**Advisor sign-off.** Pending.

**Status.** Open. Target release: v1.2.2 (small surface, polish-bundle).
