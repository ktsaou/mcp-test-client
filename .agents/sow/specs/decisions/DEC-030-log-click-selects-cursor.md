# DEC-030 — Log click anchors the prev/next cursor (2026-04-26)

**Problem.** Costa flagged a "half job" on v1.2.4:

> clicking on the log to expand an item, or clicking inside the body
> of a log item, should make it the selected, so that next/previous
> should continue from there

The v1.1.20 work added a visible cursor (`data-current="true"` highlight
on the resolved row from `jumpRequest`). DEC-027/v1.2.2 added the
`j`/`k` keyboard aliases. But neither wired **mouse click → cursor**.
Today: a user clicks row 5 to expand it, then presses `↓`. The cursor
advances from wherever it last was (e.g., row 12 from a prior `↑/↓`),
not from row 5. Spatial-memory violation: the user expects the row
they're looking at to be the anchor.

The fix is small: any click inside a log row's body or headline should
set `currentEntryId` to that row's id. Selection becomes a side effect
of all interactions, not just keyboard nav.

## What ships

In `src/ui/log-panel.tsx`:

1. Add `onSelect: (id: number) => void` to `LogRowProps`. The handler
   sets `currentEntryId` and resets `lastJumpedIndexRef.current` to
   the row's index in the current `filtered` view, so the next
   `jumpRequest('next' | 'prev')` continues from that anchor.

2. In `<LogRow>`:
   - The headline `<div role="button" onClick>` calls `onSelect(entry.id)`
     **alongside** the existing `onToggle()` (preserve expand-on-click).
   - The body `<div className="log-row__body" onClick>` calls
     `onSelect(entry.id)` — body clicks anchor the cursor without
     toggling the expand state.

3. Wire `<LogPanel>`'s `onSelect` prop:
   ```ts
   const handleSelect = useCallback(
     (id: number) => {
       setCurrentEntryId(id);
       const idx = filtered.findIndex((e) => e.id === id);
       if (idx >= 0) lastJumpedIndexRef.current = idx;
     },
     [filtered],
   );
   ```

The system rows (`<div className="log-row log-row--system-${level}">`)
also gain the same `onSelect` wiring on their headline div for
consistency — clicking a system message should also be anchorable.

## Anti-cases

- **Action buttons (`↔`, `⎘`, `⤓`) MUST NOT trigger select.** They
  already call `ev.stopPropagation()` to keep their click from also
  toggling the row. The existing stopPropagation continues to be
  authoritative for button clicks; we don't need to add anything.

- **Selection-drag MUST NOT trigger select.** The existing onToggle
  guard checks `window.getSelection().toString()` to detect a
  drag-then-mouseup vs a click; it skips toggling if the user just
  finished selecting text. The same guard must skip `onSelect` —
  text-selection drags are NOT row selections.

- **Body-click MUST NOT toggle expand.** The body is already
  rendered inside an expanded row; collapsing on body-click would
  trap the user. `onSelect` only; never `onToggle`.

- **Notifications and system rows MUST be selectable**, even though
  they don't pair-jump or expand. `jumpRequest` already filters to
  outgoing-requests for `next/prev` traversal, so anchoring on a
  notification doesn't break the jump algorithm — `findRequest`
  starts from the cursor position and walks forward.

## Falsifier

The DEC has shipped successfully if, on the live deploy:

1. **Click anchors the cursor.** Connect to a server with ≥ 5 log
   entries. Click row 3's headline (or row 3's expanded body if it's
   open). Confirm exactly one row has `data-current="true"`, and
   it's row 3.

2. **Subsequent prev/next continues from the click.** After clicking
   row 5, press `↓` (or `j`) → cursor moves to the next _request_
   row after row 5 (per `findRequest` semantics — DEC-027 honoured).
   Press `↑` → cursor moves to the prior _request_ row before row 5.

3. **Body-click doesn't collapse.** Open row 7. Click inside its
   `.log-row__body` JSON view. Row 7 stays expanded. Cursor
   highlight moves to row 7.

4. **Action buttons don't anchor.** Click row 9's `⎘` copy button.
   Cursor stays where it was (row 9 is NOT highlighted). The copy
   action fires.

5. **Drag-select doesn't anchor.** Drag-select text inside row 11's
   headline. Mouseup. Cursor stays where it was (row 11 is NOT
   highlighted). The headline does NOT toggle.

6. **Critic-gated under DEC-002.**

## Advisor sign-off

UX critic (visible-surface change to log row interaction). Particular
attention to the drag-select guard — that's the only path that could
regress and re-introduce annoyance.

## Status

Closed — shipped as v1.2.5 (Worker commit `4082a77`, release
`02acc49`). Critic verdict `pass` (clean). All six falsifiers PASS,
including F5 (load-bearing — drag-select guard correctly extended to
gate the new `onSelect` alongside the existing `onToggle`). All seven
wave-regression checks (DEC-025 palette through DEC-029 single tooltip)
hold.

F2 — Costa's specific "next/previous should continue from there"
request — verified empirically by both maintainer pre-test and the
sign-off critic on the live deploy: clicking entry id=2 anchors the
cursor; pressing ↓ advances to id=6 then id=8. The cursor honours the
click position, not the last keyboard-jump.

Second Costa-feedback ship of the day after DEC-029 (v1.2.4); both
ran through the framework two-step (historical: see git log around 2026-04-26).
