# DEC-011 — v1.1 ship blockers, round 2 (2026-04-25)

**Problem.** The second UX-critic pass on commit `690ed7c` returned
**no-ship** with: one of [DEC-010](DEC-010-v1-1-blockers.md)'s blockers only
partially fixed (mobile header overflow, distinct from the panel collapse
that was patched), one **new** desktop regression at 1440 px (the
request-panel toolbar squeezes `Send`/`Share` after Save-as), one new
empty-state lie (inventory pane says "Connect to a server" while the
header chip already shows ERROR), and one missing save-toast (a quality-bar
item 8 violation introduced by Save-as).

**The four findings, with directional fixes:**

1. **Mobile header overflow at < ~470 px (re-opens DEC-010 Blocker 1).**
   - Current behaviour: header inner `<Group>` uses `wrap="wrap"` and a
     fixed 56 px height. Below ~470 px, `[burger][title][active][status][primary][theme-toggle]`
     overflows; Connect / theme-toggle wrap to a second row at `y: 50–86`,
     physically overlaying the tab strip at `y: 56–91`. Critic verified
     with `document.elementFromPoint(50, 75) → <Connect>` — clicks land on
     the wrong control.
   - Direction: keep the header at one row (`wrap="nowrap"`); below
     ~480 px hide the brand title and the "Active: …" subtitle (they
     duplicate information visible in the drawer / status chip). Show:
     `[burger][status-pill][primary-action][theme-toggle]` only. The
     `Active: …` label may move into the drawer header.
   - File scope: `src/ui/connection-bar.tsx`. Possibly `src/ui/layout.tsx`
     if the brand title needs to migrate into the drawer.

2. **`Send` / `Share` truncate to "Se" / "Sh" at 1440 px after Save-as.**
   - Current behaviour: when the request panel grows the "Load saved (n)"
     dropdown after the first Save-as, the flex container squeezes the
     primary buttons. `sendOffsetWidth: 50 px, sendScrollWidth: 48 px` —
     text actually fits but the surrounding flex shrinks the container.
   - Direction: in the request-panel toolbar, give the primary buttons
     (`Send`, `Share`) `flex-shrink: 0` and a sensible `min-width`. The
     "Load saved" `Select` should be the flexible element; if the toolbar
     overflows the row, prefer wrapping the _secondary_ group, not the
     primary actions. Or: move the Save / Load / Delete trio into a
     single Mantine `Menu` ("Saved requests ▾") so the toolbar stays
     compact.
   - File scope: `src/ui/canned-requests.tsx`, `src/ui/request-panel.tsx`.

3. **Inventory empty-state lies on connect-error.**
   - Current behaviour: the inventory pane renders "Connect to a server
     to see its inventory." regardless of the connection status — even
     when status is `error`. Misleading; user thinks they need to click
     Connect again when in fact the server already rejected them.
   - Direction: branch the inventory empty-state on `useConnection().status`:
     - `idle` (no server): the existing prose.
     - `connecting`: "Negotiating with the server…" (with a small spinner
       OK to show).
     - `error`: render the error message inline ("Server returned: <msg>"),
       and a clear hint ("Check the URL or token in the sidebar entry").
     - `connected` but no inventory: "Server exposed no tools / prompts /
       resources" (already exists for the per-tab empty list).
   - File scope: `src/ui/inspector.tsx`, possibly `src/ui/empty-state.tsx`
     if a shared component is created.

4. **Save-as has no confirmation toast.**
   - Current behaviour: a localStorage write occurs with only the "Load
     saved (1)" dropdown appearing as feedback.
   - Direction: in `canned-requests.tsx::commitSave`, fire
     `notifications.show({ message: 'Saved request "<name>"' })` after
     persistence succeeds. Same on delete: a toast on confirmed delete.
   - File scope: `src/ui/canned-requests.tsx`.

**Out of scope for this round (still deferred to v1.1.1).**

- Empty-state copy paragraphs (`maintainer/decisions/DEC-007-non-costa-issues-into-v1-1.md`).
- Light-theme log timestamp contrast (2.85:1).
- ARIA `valuemin > valuemax` on the third panel separator.
- Log virtualization at 200+ messages.
- Per-response metrics ([DEC-009](DEC-009-response-metrics.md)).

**Falsifier.** A re-spawned UX critic against the patched dev build
returns no-ship for any of the four findings. Then the patch was wrong
or another scope-narrowing happened in the brief.

**Advisor sign-off.** UX critic surfaced the four findings; the patch is
gated on a fresh UX-critic pass post-fix. Critic's prompt-improvement
suggestion ("verify header at 360/390/414 px") was folded into
`maintainer/skills/ux-review.md` and `maintainer/agents.md`
before this DEC was opened, so the next pass will catch a similar
header-overflow regression automatically.

**Status.** **Closed (2026-04-25).** All four findings closed in
commit `eb1d3b6`; third UX-critic pass signed off SHIP. Three minor
items the critic flagged as non-blockers fold into v1.1.1: the F1
breakpoint off-by-one at exactly 480 px (`< 479` → should be `< 480`);
delete-saved opening a Menu first instead of a direct confirm when
there's a single saved entry; friendly-name discarded on share-link
reload.
