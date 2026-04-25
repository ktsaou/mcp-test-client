# DEC-005 — CI bundle-size tripwire (2026-04-25)

**Problem.** The framework analyst ([DEC-001](DEC-001-mantine-v9.md) sign-off) flagged that
`@mantine/code-highlight` defaulted-imported pulls ~300 KB gzipped of
`highlight.js`. That is a regression vector users will feel as page-load
slowness ("UI is tiny and hard to work with" turns into "UI is slow"), and
it is not catchable by typecheck or unit tests.

**Options considered.**

- _Manual bundle inspection._ Easy to forget; failed in v1.0.
- _Hard CI cap on dist/ size that fails the build over the threshold._
  Cheap to wire, automatic, surfaces regressions in the PR.

**Decision.** Add a CI step that fails when `dist/assets/*.js` total exceeds
**350 KB gzipped**. Threshold chosen above the 230 KB analyst estimate to
allow normal feature growth, well under the 400 KB CodeHighlight-trap line.
Can be raised later with a comment justifying why; not without one.

**Falsifier.** The threshold either lets a bundle blow-up through, or fires
on routine feature growth. In either case raise/lower with a justification
appended here.

**Advisor sign-off.** Self-applied (process decision).

**Status.** Active. Wiring lands in the same PR as the Mantine migration.
