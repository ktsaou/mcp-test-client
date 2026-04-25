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

**Confirmed (Costa Q8, 2026-04-25): place the indicator in the
connection bar at the top of the app, not in the footer.** The
connection bar is already there; it grows an "MCP activity" icon
that animates while `n > 0`, idle otherwise. **Future-proof:** the
icon is the entry point for an "activity feed" generally, not just
inflight requests — additional activity types (background syncs,
reconnect attempts, catalog auto-merge, polling) can hang off the
same icon over time. Click → popover with the per-activity list,
each carrying its own cancel / dismiss action.

The earlier draft of this DEC put the indicator in a footer slot.
Dropped.

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

UI: a small Mantine `ActionIcon` in the connection bar (top of the
app), with an animated spinner when `n > 0` and an idle-state icon
otherwise. The animation is the affordance — a static icon would
get lost in the connection-bar chrome. Hovering gives a tooltip
("3 in flight"); clicking opens a `Popover` listing each entry
(method, target, elapsed ms, [Cancel]).

The icon's name and component should be **activity-generic** (not
"inflight-only") — `<ActivityIndicator>` or similar — because Costa
flagged future activity types (auto-merges, background polls, etc.)
will share this surface. The popover content is a switch on activity
kind; the icon's animation reflects "any activity in progress".

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
