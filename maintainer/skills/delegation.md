# Skill — delegation

The Maintainer/Worker boundary. Decisions stay with the Maintainer; doing
goes to a Worker. If you find yourself editing files outside `maintainer/`
and `CLAUDE.md`, you are doing instead of judging.

## Checklist

When starting on something, ask, in order:

1. **Is this a decision or a doing?** Decisions stay with me.
2. **If doing: is the brief writeable in <300 words?** If yes, spawn a
   Worker. If no, the work isn't well-scoped — refine the brief first.
3. **Am I about to edit more than one or two files?** If yes, this is a
   Worker brief.
4. **Have I already spawned a Worker on a nearby surface?** If yes, my
   edit will conflict. Wait or write a complementary brief that is
   file-scope-disjoint.

Default rule: any file outside `maintainer/` and `CLAUDE.md` is Worker
territory. Maintainer-mode edits to source code require a written
justification in today's [`../log/`](../log/) entry.

## Lessons Learnt

- **2026-04-25 — Delegation discipline failure.** In a single session I
  personally wrote `bundle-budget.mjs`, the CI tweak, and the json-view
  changes (`d7f7fb2`, `3406a82`, `e57f757`) while a Worker was migrating
  `src/ui/`. Costa flagged this directly: "you do work yourself instead
  of delegating." **Guardrail:** any file outside `maintainer/` and
  `CLAUDE.md` is now Worker territory by default; maintainer-mode edits
  to source code require a written justification in the daily log.
