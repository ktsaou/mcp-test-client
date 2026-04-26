# DEC-013 — Notification rows render as full collapsible entries (2026-04-25)

**Problem.** The v1.1.1 UX critic found one literal spec violation in
[DEC-012](DEC-012-v1-1-1-log-redesign.md): the
`notifications/initialized` row (the only outgoing JSON-RPC notification
in a typical session) carries the collapsible role, `aria-expanded`, and
`tabindex` — but renders no body and no copy/save/pair-jump buttons.
Strictly fails DEC-012 rows 7 (copy always visible per entry), 8 (save
always visible), and 12 (per-entry collapse/expand with a real body).
Other notification kinds (`notifications/cancelled`, `notifications/progress`,
server-pushed `notifications/list_changed`, `notifications/message`)
will hit the same code path and the same gap.

The critic offered two paths: drop the collapsible chrome (and treat as
a system row), or render a real body and the same icon buttons.

**Options considered.**

- _Treat all notifications as system rows._ Drops `role="button"`,
  `aria-expanded`, `tabindex`, replaces the direction glyph with `•`,
  hides copy/save. Smaller diff. **Cost:** notifications are JSON-RPC
  wire traffic; a developer evaluating a server has the same right to
  inspect / copy / save a notification body that they have for a
  request or response. Hiding it conflicts with the project's "show me
  what's on the wire" promise.
- _Treat all notifications as full wire entries._ Body = the notification
  message itself (`{"jsonrpc":"2.0","method":"…","params":…}`) rendered
  via `<JsonView>`. Same copy/save/pair-jump chrome as request/response
  rows. Slightly larger diff. **Cost:** a few extra DOM nodes per
  notification entry. No additional perf risk — notifications are tiny.

**Decision.** **Render notifications as full wire entries.** The notification
row's body is the notification message itself; copy and save use the same
helpers as request/response rows; pair-jump is omitted because notifications
have no paired counterpart (notifications are id-less by JSON-RPC spec).
Direction glyph stays `→` for outgoing and `←` for incoming.

**Sub-item checklist** (apply the new feedback-folding rule — one row per
piece, every row checked before close):

- [ ] `notifications/initialized` outgoing row renders the JSON body on
      expand.
- [ ] `notifications/cancelled`, `notifications/progress` outgoing rows
      same.
- [ ] Server-pushed incoming notifications (`notifications/list_changed`,
      `notifications/message`) same, with `←` glyph.
- [ ] Copy-as-JSON button visible on every notification row.
- [ ] Save-as-file button visible on every notification row.
- [ ] Pair-jump button is **not** rendered on notification rows (no `id`
      to pair with). Document this in the headline tooltip ("notification —
      no paired response").

**Quality-bar update** (in [`../product/quality-bar.md`](../product/quality-bar.md)):
"Per-message actions in the log" already says "always visible". The
"the log is scannable" entry now spells out _all_ entry kinds in scope:
request, response, outgoing notification, outgoing JSON-RPC error,
incoming server notification, system info/warn/error. Ambiguity that
left `notifications/initialized` orphaned is closed.

**Falsifier.** A re-spawned UX critic against the patched dev build
fails any of the six rows above on any notification kind. Then either
the implementation missed a case or the row classifier doesn't catch
all `notifications/*` methods.

**Advisor sign-off.** Pending — UX critic re-pass after the patch.
The critic's two cosmetic notes (360 px chip-vs-title, expand-all blocking
on 200+ entries) and the labelling drift between log-row and Last-result
chips fold into the v1.1.2 backlog (or v1.1.1's CHANGELOG as known
non-blockers); they do not gate this DEC.

**Status.** **Closed (2026-04-25).** Patched in commit `8305809`
(logic-only: dropped the `!isNote` gate that was suppressing copy/save
on notification rows; `pairById` already excluded id-less messages so
pair-jump was correctly absent; added `data-notification` marker and a
`title="notification — no paired response"` tooltip on the headline).
Re-critic returned 6/6 with two rows interpreted from the row
classifier + unit tests (server didn't elicit cancelled/progress
notifications or push list_changed/message during the live walk; unit
tests cover those paths). Bundle delta zero.
