# DEC-020 — Inflight status bar (2026-04-25)

**Problem.** Costa's item #10. The user sends a request and stares at
the screen. There's no feedback that the request is in-flight beyond
the Send button's `loading` state — and that state belongs to one
specific Send click. If the user sends two requests in quick
succession (or the SDK's auto-inits and pings are firing in the
background), there's no global view of pending work.

## Sub-item checklist

- [ ] **#10 — inflight indicator.** A persistent footer / status bar
      below the log panel (or in the connection bar) showing:
      `n in flight` when `n > 0`, idle otherwise. Updates live as
      requests fire and resolve.
- [ ] **#10 — click to expand.** Clicking the indicator opens a
      small popover listing each in-flight request: method, target
      tool name, elapsed ms, [Cancel] button. The Cancel button
      sends the JSON-RPC `notifications/cancelled` for that id.
- [ ] **#10 — cancelled requests log as system entries.** Every
      cancellation (whether user-initiated, server-switch-induced
      per DEC-016 #11, or page-unload) gets a `system` log entry
      with `level: warn` and a `cancelled · <method> · <reason>`
      headline.

## Direction

The connection context already holds the SDK `Client`. Add a small
`InflightContext`:

```ts
interface InflightEntry {
  id: number | string;
  method: string;
  toolName?: string;
  sentAt: number;
  abort: () => void;
}
```

Track entries in a Map keyed by JSON-RPC id. On every outgoing
request via the LoggingTransport, insert; on response or error or
cancel, remove.

UI: a small Mantine `Group` in the page footer (or as a "footer
slot" in the AppShell) showing a `Loader size="xs"` + count badge.
Click opens a `Popover` listing the entries.

The footer position keeps it out of the way until something is
in-flight; hovering on it gives a tooltip; clicking gives the popover.

## Falsifier

- A request fires and the status bar doesn't update.
- A response lands and the status bar doesn't decrement.
- Cancel from the popover doesn't actually cancel the request on the
  wire (no `notifications/cancelled` sent).
- Cancel doesn't surface as a log entry.

**Advisor sign-off.** Pending — UX critic on the popover layout +
spec purist on the cancellation wire format (MCP supports
`notifications/cancelled`; need to verify our SDK exposes it).

**Status.** Open. Target release: v1.2.2.
