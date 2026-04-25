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

## 2026-04-25 — UX-critic advisor pass on live v1.0 (source: internal advisor)

After the framework rewrite landed, I spawned the UX-critic advisor template
(see `agents.md`) against https://ktsaou.github.io/mcp-test-client/. Verdict:
**do not ship as v1.x.y; wait for the v1.1 Mantine migration.** Full report
at `/tmp/ux-review-2026-04-25/` plus 22 screenshots.

**§3 60-second flow** — 1 pass / 2 partials / 3 rough-or-fail.

**Four of Costa's seven items still visibly present** in the deploy:

- JSON newlines (DEC-003 falsifier) — fixed in commit `d7f7fb2`, awaiting deploy.
- `window.prompt()` for canned-request naming — captured in v1.1 worker brief.
- Sidebar / tools-pane fixed widths — captured in v1.1 worker brief.
- Tool descriptions truncated and missing from request panel — captured.

**Additional issues the critic surfaced beyond Costa's seven** (treat as
must-fix in v1.1, not v1.2):

1. **Modal a11y is broken** — Add Server modal: Escape doesn't close, Enter
   doesn't submit, no focus trap, Tab leaks behind the backdrop. Mantine
   `Modal` fixes all four for free; require it.
2. **Tabs are not real tabs** — no `role="tab"`, no `aria-selected`, no
   arrow-key nav. Mantine `Tabs` fixes for free; require it.
3. **Light theme has near-zero header contrast** — title and `Connected`
   chip on pure-white. Mantine's auto-generated palette should resolve, but
   verify post-migration.
4. **Empty states are one-liners ("void")** — "Connect to a server to see
   its inventory" is too thin. Each empty state needs a paragraph that helps
   the user know what to do next.
5. **No log virtualization** — possible perf cliff at 200+ messages. Not in
   the worker brief; tracked as a v1.1 risk to verify after migration.

**Things the critic flagged as already-good** — don't regress them in the
migration:

- Theme cycle (Dark → Light → System) with persisted state.
- Per-field schema form rendering with description + required marker. Mantine
  doesn't ship this shape; the bespoke `src/schema-form/` must stay.
- Share link compress/round-trip works — only a toast is missing.

**Falsifier add-on**: in addition to "Costa reports the same problems",
the critic recommended testing four scopes I had not specified:

- iPhone-size viewport (390×844)
- Share-link reload in a fresh incognito tab
- Bearer-token auth flow
- 200+ messages in the log (scroll perf)

These are now part of the UX-critic prompt template in `agents.md`.

**Status.** **Open.** The v1.1 worker is migrating to Mantine in parallel;
critic will be re-run against the deployed v1.1 before merging.

---

## 2026-04-25 — Framework-choice analyst sign-off on DEC-001 (source: internal advisor)

Confirmed Mantine over shadcn / Radix Themes / Chakra / Park, with a
correction: **use v9, not v8** (v8.3.18 is the last 8.x release). Surfaced
four concrete migration risks now captured in DEC-001 advisor sign-off:
button hover regression on React 19 (#8482), Radio deselect bug (#8461),
`AppShell.Navbar` not draggable (use `react-resizable-panels` for both
splits), `@mantine/code-highlight` bundle trap (~300 KB if mis-imported).
Real bundle estimate revised upward to 180–230 KB gzipped. CI tripwire at
350 KB added as DEC-005.

**Status.** Closed by DEC-001 revision and DEC-005.

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
