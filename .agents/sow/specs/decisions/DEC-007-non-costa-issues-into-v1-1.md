# DEC-007 — Additional non-Costa issues fold into v1.1, not v1.2 (2026-04-25)

**Problem.** The UX critic surfaced five issues beyond Costa's seven-point
report: modal a11y (no focus trap, no Escape-to-close, no Enter-to-submit),
fake tabs (no `role="tab"` / `aria-selected`), light-theme header contrast,
one-line empty states, and possible log perf at 200+ messages. Treating any
of these as "v1.2 polish" repeats the v1.0 mistake.

**Options considered.**

- _Defer modal a11y / fake tabs to v1.2._ Both are free wins from Mantine
  components (`Modal`, `Tabs`). Deferring them means re-explaining v1.1.
- _Defer empty-state copy / contrast / virtualization._ Empty states +
  contrast are 30 minutes of work each. Virtualization is a real cost
  (use `react-virtuoso` or `@tanstack/react-virtual`).
- _Add to v1.1 scope, except virtualization which lands as v1.1.1 if any
  user reports a hang._

**Decision.** Modal a11y, real tabs, light-theme contrast verification, and
empty-state copy are part of the v1.1 worker brief. Log virtualization is
**not** added to v1.1; it ships as v1.1.1 only if a user reports a hang or
the post-migration UX critic pass measures one.

**Falsifier.** A user reports a freeze with hundreds of log entries before
v1.1.1 ships. Then virtualization moves up.

**Advisor sign-off.** UX critic surfaced these; this decision folds them in.

**Status.** Active.
