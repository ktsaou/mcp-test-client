# DEC-002 — UX advisor sign-off mandatory for visible changes (2026-04-25)

**Problem.** I shipped v1.0's UI without a second pair of eyes. Costa was
the second pair of eyes, retroactively, in production. That is a contract
breach.

**Options considered.**

- _Trust the maintainer's judgement alone._ Failed in v1.0.
- _Wait for community PR review._ Too slow; at v1.x we don't have the
  community yet.
- _Spawn a UX-critic sub-agent before declaring any visible change done,
  block on its sign-off._ Costs one sub-agent run per change. Cheap.

**Decision.** Every change that touches a user-visible surface
(`src/ui/**`, `src/schema-form/**`, anything CSS) requires a UX-critic
advisor pass. Their report goes in the PR description and into the relevant
DEC entry under [`../decisions/`](../decisions/). Their sign-off is captured. If they
flag a regression vs the §4 quality bar, the change does not merge.

**Falsifier.** If the advisor turns out to either rubber-stamp everything
or block on noise, the prompt template (in `../agents.md`) is broken; refine
or replace.

**Advisor sign-off.** Self-applied (this is a process decision).

**Status.** Active.
