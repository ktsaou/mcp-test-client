# SOW-0003 | 2026-04-26 | dec-030-log-click-anchors-cursor

## Status

completed
Retroactively documented at SOW init time. The work itself shipped as v1.2.5 on 2026-04-26 before the SOW system was adopted.

## Requirements

Costa-direct "half job" feedback on v1.2.4:

> clicking on the log to expand an item, or clicking inside the body of a log
> item, should make it the selected, so that next/previous should continue
> from there

Acceptance criteria:

- Given the user has clicked a log row's headline (or body), when they next
  press `↓` / `↑` / `j` / `k`, then the next/previous cursor advances from the
  clicked row, NOT from wherever the cursor was before the click.
- Given a row is expanded, when the user clicks inside its `.log-row__body`
  JSON view, then the cursor anchors to that row but the row does NOT collapse
  (the user is reading; collapsing under them traps them).
- Given the user is drag-selecting text inside a row, when the mouseup
  completes the drag, then NEITHER the click handler nor the cursor anchor
  fires (DEC-030 anti-case).

## Analysis

See `.agents/sow/specs/decisions/DEC-030-log-click-selects-cursor.md` for the
full pre-code analysis.

## Implications and decisions

Captured in DEC-030. Highlights:

- Add `onSelect` prop to `LogRowProps`; called from headline click AND body
  click; sets `currentEntryId` + `lastJumpedIndexRef.current` to the row's
  index.
- Drag-select guard extracted into shared `isSelectionDragInside()` helper;
  applied to both `onToggle` (existing) and `onSelect` (new).
- Body-click anchors but does NOT toggle expand.

## Plan

Single-unit Worker brief; not chunked.

## Execution log

### 2026-04-26 — Worker brief → land → critic gate → ship

- Worker commit: `4082a77` — `onSelect` prop wired through, drag-select guard
  extracted, system rows also gain `onSelect` for consistency.
- Critic gate: clean PASS on first try. F2 (the Costa-direct ask) verified
  empirically — anchor at id=2, ↓→6→8.
- Release: v1.2.5 tagged + deployed.

## Validation

- [x] Acceptance criteria evidence — F1-F6 falsifiers in DEC-030 all PASS;
      F5 (drag-select doesn't anchor) is load-bearing because it's the
      regression-risk surface, and the extracted helper correctly gates both
      onToggle AND onSelect.
- [x] Real-use validation evidence — UX-critic agent on the LIVE deploy.
- [x] Cross-model reviewer findings — N/A — reason: low-risk visible-surface
      refinement of an existing flow.
- [x] Lessons extracted — see `## Lessons extracted` below.
- [x] Same-failure-at-other-scales check — verified: drag-select guard now
      in shared helper, applied at both call sites; no other click-handlers in
      log rows that need similar protection.

## Outcome

Shipped as **v1.2.5** (release commit `02acc49`, Worker commit `4082a77`).
Click on any log row's headline or expanded body anchors the prev/next cursor
to that row. Subsequent `↑` / `↓` / `j` / `k` keystrokes continue from the
click position, not from the last keyboard-driven jump. Drag-select inside a
row is unaffected — the click handlers correctly skip when the selection
ends inside the row.

## Lessons extracted

1. **Shared helpers prevent guard divergence.** Before this DEC, the
   drag-select guard was inline in the headline click handler; adding a
   second call site (`onSelect`) without extracting risked the two guards
   drifting. Extracting `isSelectionDragInside()` to a shared helper made
   both paths share the exact same logic. Mapped artifact:
   `.agents/skills/project-coding/SKILL.md` "Common patterns" — extract
   shared logic when adding a second call site.
2. **The "half job" framing is itself a class of feedback.** Costa's "half
   job" comment described a complete-but-incomplete v1.2.4 release: the
   visible cursor was added in v1.1.20, the keyboard nav in DEC-027, but
   nobody wired mouse click → cursor. The ship-readiness gate
   (`project-maintainer/release-readiness.md` § "you used it for real")
   should specifically check for "any new affordance the user encounters
   for the first time has its expected interactions wired". Mapped
   artifact: `.agents/skills/project-maintainer/release-readiness.md`.
