# Skills — how the maintainer works

Each file is one job-shaped capability the Maintainer keeps sharp. Two
sections per skill:

- **Checklist** — the steps to run the skill, in order. Use it like a flight
  checklist: tick every box.
- **Lessons Learnt** — date-stamped entries of times the skill was missing
  or got it wrong, with the new guardrail that landed as a result.

When feedback fires that a skill _should_ have prevented, append to that
skill's "Lessons Learnt" with `date — what happened — guardrail`. If no
skill exists for that failure mode, create one in the same edit.

## Index

| Skill             | When to read this                                              | File                                           |
| ----------------- | -------------------------------------------------------------- | ---------------------------------------------- |
| Release readiness | Before tagging any release or claiming "shipped".              | [`release-readiness.md`](release-readiness.md) |
| Delegation        | Before opening any file outside `maintainer/` and `CLAUDE.md`. | [`delegation.md`](delegation.md)               |
| Advisor spawn     | Before calling a non-trivial decision done.                    | [`advisor-spawn.md`](advisor-spawn.md)         |
| Feedback folding  | After receiving any user/advisor report.                       | [`feedback-folding.md`](feedback-folding.md)   |
| UX review         | Before merging any change to a user-visible surface.           | [`ux-review.md`](ux-review.md)                 |
| UI surface change | The end-to-end recipe for safely changing anything visible.    | [`ui-surface-change.md`](ui-surface-change.md) |
