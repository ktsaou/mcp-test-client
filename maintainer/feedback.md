# Feedback log

Append-only. Every report from Costa or the community lands here, with my
reading of the underlying expectation it violated and what I did about it.

When a feedback item is resolved, the entry stays — I want the receipts.

Format per entry:

```
## YYYY-MM-DD — short title  (source: who)

**Verbatim** (or close paraphrase).

**The expectation it violated.** What the user was assuming would be true.

**Where it landed in the product.** Which §4 quality-bar item, which file,
which decision in decisions.md.

**Status.** Open / in-flight (link to PR/issue) / closed (link to commit).
```

---

## 2026-04-25 — v1.0 fails the basics (source: Costa, relaying user reports)

**Verbatim summary** (seven points):

1. UX/styling primitive — no button styling, no selected-tab indicator,
   confusing.
2. "Saving forms is the worst UX ever" — `window.prompt()` for naming a
   canned request.
3. UI is tiny and hard to work with.
4. Screen real-estate badly split. Tools list takes 1/3 of screen width and
   isn't resizable.
5. Log is unmanageable: no nav between requests/responses, no copy-as-JSON
   per message, no save-to-file. JSON should respect newlines (the original
   pretty-printer did this; the port doesn't). On narrow screens timestamp +
   direction icon waste width.
6. No tooltips anywhere.
7. Tool descriptions are unreadable (truncated or hidden).

Costa's framing: "the application seems a throw away, not practical for any
reasonable use" and "you have failed".

**The expectations these violated.**

- That a "release" means the visible surface has been honestly evaluated by
  the maintainer as a user, not just `npm test && git tag`.
- That basic interaction patterns (tooltips, active states, modals over
  prompts, resizable panes, copy buttons) are table stakes, not "polish".
- That the maintainer makes decisions and judges quality — does not ship
  the first thing that compiles.

**Where it landed.**

- Updated [`product.md`](product.md) §4 quality bar to enumerate the
  table-stakes items so they cannot be deferred again.
- Updated CLAUDE.md to make user-walkthrough mandatory before "done".
- New decision DEC-001 in [`decisions.md`](decisions.md): pick a real UI
  component library; stop hand-rolling primitives.
- New decision DEC-002: spawn a UX advisor before declaring any visible
  change done.
- New decision DEC-003: restore the legacy `json-pretty-printer.js`
  newline-respecting behaviour as a hard requirement, not an enhancement.

**Status.** **Open.** v1.1 work is the response. Each of the seven items
becomes a tracked issue + PR. This entry remains open until all seven are
visibly fixed in production _and_ the relevant advisor has signed off.

**Falsifier.** This is closed when Costa (or any test user) opens the live
app, runs the §3 60-second flow in `product.md`, and does not report any of
the seven items recurring.

---

## 2026-04-23 — initial v1.0 ship (source: Costa)

**Verbatim** (paraphrased): "I told you stop only when the work is done /
result is given to users / you need a button I can't press. You stopped
prematurely."

**The expectation it violated.** That "shipped" is a real bar, not a phase
boundary. That I escalated decisions to him instead of taking them.

**Where it landed.** CLAUDE.md §1 ("Decisions belong to you"), §6 (the
"all of these hold" gate before declaring done).

**Status.** Closed by the 2026-04-25 framework rewrite. Now invariably
re-checked against §6.
