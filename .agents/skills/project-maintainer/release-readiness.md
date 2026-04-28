# Skill — release readiness

What "shipped" means. Derived from `CLAUDE.md` §6. A release is not done
until **all** of the checklist items hold.

## Checklist

- [ ] **Pipeline green** — lint, typecheck, unit tests, e2e smoke, build,
      deploy. Includes the bundle budget step from
      [`../../sow/specs/decisions/DEC-005-bundle-budget.md`](../../sow/specs/decisions/DEC-005-bundle-budget.md).
- [ ] **You used it for real.** Connected to a server. Drove every flow you
      changed. Took screenshots. If a real server isn't available, you
      used the mock fixture and documented the limit. Walkthrough
      screenshots are attached to the PR.
- [ ] **The relevant advisor signed off.** UX critic for visible-surface
      changes (mandatory per
      [`../../sow/specs/decisions/DEC-002-ux-advisor-mandatory.md`](../../sow/specs/decisions/DEC-002-ux-advisor-mandatory.md)).
      Spec purist for protocol changes. Accessibility auditor for any new
      interactive component. Their report is captured in the PR
      description or in the relevant DEC entry under
      [`../../sow/specs/decisions/`](../../sow/specs/decisions/).
- [ ] **Docs are current.** README quick-start still works. `specs/`
      reflects new behaviour.
      [`../../sow/specs/quality-bar.md`](../../sow/specs/quality-bar.md) reflects
      the current visible-surface bar. The active SOW shows the feedback
      that prompted the change is resolved.
- [ ] **The CHANGELOG entry, written by you, would not embarrass you if it
      appeared on Hacker News tomorrow.**

If any item is "no", say so out loud — in your message to Costa, in the PR
description, to yourself. You do not call it shipped.

## Lessons Learnt

- **2026-04-23 — Shipped v1.0 with `pipeline-green && URL-200` taken as
  proof-of-done.** Costa flagged the visible surface had never been
  evaluated as a user. **Guardrail:** §6 item 2 ("you used the app for
  real") is now non-negotiable; release blocked unless walkthrough
  screenshots are in the PR.
- **2026-04-25 — Costa's seven-point report.** v1.0 had no advisor pass on
  the visible surface; the maintainer's own judgement stood in for one.
  **Guardrail:** §6 item 3 (UX-critic advisor sign-off mandatory before
  merge of visible changes); see
  [`../../sow/specs/decisions/DEC-002-ux-advisor-mandatory.md`](../../sow/specs/decisions/DEC-002-ux-advisor-mandatory.md).
- **2026-04-29 — SOW-0005 closed retrospectively, 3 days after ship.**
  The work shipped in v1.3.0 on Apr 26, but the SOW file sat in
  `current/` while v1.3.1 and v1.3.2 shipped on top. Mandate 4
  (retrospection on close) was skipped at ship-time; lessons were
  reconstructed days later from the Execution log. The reconstruction
  works but loses the "lessons captured while the work is fresh"
  signal, and `current/` accumulates zombie SOWs that newer
  maintainer-mode reads have to scan past. **Guardrail:** the
  `release: bump to vX.Y.Z` commit MUST also `git mv` the SOW(s)
  shipped in that release from `current/` → `done/` and fill their
  Validation / Outcome / Lessons sections in the same commit. Ship
  and close are one atomic step — never two. If a SOW spans multiple
  releases, only close it on the release that ships its final chunk.
