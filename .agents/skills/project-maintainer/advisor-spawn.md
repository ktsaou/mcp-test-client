# Skill — advisor spawn

How to use advisors. Advisors do not write code; they render a verdict.
Their job is to challenge the Maintainer's thinking.

## Checklist

1. **Is this a non-trivial decision touching a user-visible surface, MCP
   wire format, security, accessibility, or perf?** If yes, an advisor
   pass is mandatory before the corresponding DEC entry is marked active.
2. **Pick the advisor template** from [`./agents-roster.md`](./agents-roster.md).
3. **Always include a falsifier.** "This work is bad if X." Without it,
   you cannot judge their output.
4. **Capture the advisor's verdict in the relevant DEC file**, not in the
   log only. The SOW / commit log records the event; the DEC records the
   conclusion.

Brief like a colleague who walked into the room. They have none of your
context. Tell them the goal, the relevant facts, the deliverable shape, and
the falsifier. Single-purpose: one question, one job.

## Lessons Learnt

- **2026-04-25 — Incomplete UX-critic prompt.** The first UX-critic
  prompt missed mobile, share-link reload, bearer auth, and 200+
  message log perf. The critic's prompt-improvement suggestion surfaced
  these. **Guardrail:** those four scopes are now in the UX-critic
  template by default; see `.agents/skills/project-reviewing/ux-review.md`
  for the expanded checklist.
