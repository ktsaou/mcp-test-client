# DEC-000 — Adopt a maintainer/worker/advisor working framework (2026-04-25)

**Problem.** v1.0 shipped looking unprofessional because I ran the build like
a typist with a checklist. There was no judgement layer, no user-walkthrough
gate, no second opinion before merging visible changes.

**Options considered.**

- _Continue as-is and try harder._ Tried in v1.0; failed.
- _Ask Costa for product calls when in doubt._ Costa explicitly rejected
  this. He doesn't have time and doesn't want to be the gate.
- _Multi-mode operation: Maintainer (decisions) + Workers (do work) +
  Advisors (challenge me) with live documentation under `.agents/sow/specs/`
  and `.agents/skills/project-maintainer/`._
  This matches how a real one-person project lead operates. Costs:
  per-session reading overhead and per-decision logging overhead. Worth it.

**Decision.** Adopt the three-mode framework. Codify in `AGENTS.md`. Maintain
the live documents under `.agents/sow/specs/` (values, product specs, decisions)
and `.agents/skills/project-maintainer/` (agents-roster and discipline skills).
Read-before-do at the start of every session.

**Falsifier.** If after 3 working sessions in this mode, the visible UX
quality bar is not measurably higher than v1.0 (per the Costa-feedback
checklist) (historical: see git log around 2026-04-26), revisit.

**Advisor sign-off.** None — meta decision; Costa proposed it; I accepted.

**Status.** Active.
