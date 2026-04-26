# Skill — UI surface change

The recipe for safely changing anything visible. End-to-end, from worker
brief to post-deploy verification.

## Checklist

1. **Brief a Worker** (per [`./delegation.md`](./delegation.md)). Maintainers
   judge; Workers do.
2. **Worker delivers; pipeline must be green** including the bundle budget
   step (see
   [`../../sow/specs/decisions/DEC-005-bundle-budget.md`](../../sow/specs/decisions/DEC-005-bundle-budget.md)).
3. **UX-critic advisor pass** against a local dev build OR the deploy
   preview, **not the prod URL.** Use the recipe in
   `.agents/skills/project-reviewing/ux-review.md`.
4. **Maintainer walkthrough** — open the app, drive the §3 flow from
   [`../../sow/specs/60-second-flow.md`](../../sow/specs/60-second-flow.md), take
   screenshots, attach to PR. This is non-negotiable.
5. **Capture the critic verdict in the relevant DEC file.**
6. **Merge → deploy → re-run UX-critic against prod URL within 24
   hours.** If it regresses, revert.

## Lessons Learnt

- **2026-04-23 — v1.0 shipped without any of steps 3, 4, or 6.** The
  visible surface had never been evaluated by either the maintainer-as-user
  or by an advisor; the deploy was the first encounter. **Guardrail:**
  these steps are now blocking; [`./release-readiness.md`](./release-readiness.md)
  inherits them.
