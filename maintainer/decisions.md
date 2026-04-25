# Decision log (ADR-lite)

Every non-trivial product or technical decision lands here, _before_ code is
written. Reversed decisions stay; the falsifier shows what changed.

Format:

```
## DEC-NNN — Short title  (YYYY-MM-DD)

**Problem.** One paragraph.
**Options considered.** Bulleted, with trade-offs.
**Decision.** One paragraph.
**Falsifier.** What evidence would invalidate this?
**Advisor sign-off.** Which advisor (if any) reviewed; their concern; how it
was addressed.
**Status.** Active / superseded by DEC-MMM / reversed (date).
```

---

## DEC-000 — Adopt a maintainer/worker/advisor working framework (2026-04-25)

**Problem.** v1.0 shipped looking unprofessional because I ran the build like
a typist with a checklist. There was no judgement layer, no user-walkthrough
gate, no second opinion before merging visible changes.

**Options considered.**

- _Continue as-is and try harder._ Tried in v1.0; failed.
- _Ask Costa for product calls when in doubt._ Costa explicitly rejected
  this. He doesn't have time and doesn't want to be the gate.
- _Multi-mode operation: Maintainer (decisions) + Workers (do work) +
  Advisors (challenge me) with live `maintainer/_.md` documentation.\*
  This matches how a real one-person project lead operates. Costs:
  per-session reading overhead and per-decision logging overhead. Worth it.

**Decision.** Adopt the three-mode framework. Codify in `CLAUDE.md`. Maintain
four live documents under `maintainer/`: product.md, feedback.md,
decisions.md, agents.md. Read-before-do at the start of every session.

**Falsifier.** If after 3 working sessions in this mode, the visible UX
quality bar is not measurably higher than v1.0 (per the Costa-feedback
checklist in [`feedback.md`](feedback.md) 2026-04-25), revisit.

**Advisor sign-off.** None — meta decision; Costa proposed it; I accepted.

**Status.** Active.

---

## DEC-001 — Adopt Mantine **v9** as the UI component library (2026-04-25, revised)

**Problem.** v1.0 used hand-rolled CSS + bare HTML elements. Result: no
visible button states, no tooltips, no proper modals, no toasts, hand-rolled
resizable layout that almost works. Costa's feedback singled this out as
the root visible failure.

**Options considered.**

- _Mantine v8 / v9._ Batteries-included. ~250 components, dark/light theme,
  modals, tooltips, notifications, command palette (`@mantine/spotlight`),
  code highlight, splitter via `react-resizable-panels`. Opinionated visual
  style.
- _shadcn/ui + Tailwind v4._ Components copied into the repo, fully owned.
  Tree-shaken. Requires Tailwind. We hand-style each component (more code,
  more taste needed, slower to "done" — exactly what bit me last time).
- _Chakra UI v3._ Similar to Mantine. Smaller component set; no Spotlight or
  CodeHighlight equivalents — would not shorten the migration path.
- _Radix Themes._ What MCP Inspector uses. Pre-themed Radix primitives but
  smaller component set; still hand-build splitter, command palette.
- _Park UI / Ark UI._ Real, but pulls in Panda CSS as a build-time concern.
  Second tooling decision on top of a UI decision; contradicts
  "lowest time-to-good".

**Decision.** **Mantine v9.** Originally chose v8; revised to v9 after the
framework analyst flagged that v8.3.18 is explicitly the last 8.x release and
v9.1 shipped 2026-04-21. Our React 19.2 stack already meets v9's `react@^19.2`
peer requirement. Visual style is "default Mantine v9"; no bespoke styling.

**Falsifier.** If after the migration the §4 quality-bar items are still
failing — buttons without active states, missing tooltips, `prompt()` instead
of modals — Mantine wasn't the bottleneck and DEC-001 was wrong. Try again.

**Advisor sign-off (2026-04-25).** Framework-choice analyst confirmed
Mantine over shadcn/Radix/Chakra/Park, _with the version corrected to v9_,
and surfaced four concrete risks that I must mitigate during migration:

1. **[Mantine #8482](https://github.com/mantinedev/mantine/issues/8482)** —
   Button hover styles missing under React 19 in some configurations.
   Mitigation: snapshot hover state in a Playwright test before merge of the
   button replacement PR.
2. **[Mantine #8461](https://github.com/mantinedev/mantine/issues/8461)** —
   `Radio` deselect bug under React 19. Mitigation: if the form renderer
   uses `Radio`, test deselection explicitly; workaround is keying by hash.
3. **`AppShell.Navbar` is not draggable** ([discussion #6878](https://github.com/orgs/mantinedev/discussions/6878)).
   The tools list MUST live behind `react-resizable-panels`, not inside
   `AppShell.Navbar`, or the v1.0 "tools list takes 1/3 fixed width" bug
   recurs verbatim.
4. **`@mantine/code-highlight` bundle trap.** Default-importing pulls in
   ~300 KB of `highlight.js`. Mitigation: register only the languages we
   actually use (`json`, possibly `bash` / `markdown`). Better still: do
   not use CodeHighlight for JSON — DEC-003 already calls for the bespoke
   newline-respecting renderer, and the analyst confirmed CodeHighlight
   does not solve that requirement.

Real bundle estimate (analyst): **180–230 KB gzipped** of UI framework code
plus ~5 KB for `react-resizable-panels`. Higher than my initial guess of
100–150 KB. **Acceptable**, but treated as a budget — see DEC-005.

**Status.** Active, advisor-signed-off, version corrected to v9.

---

## DEC-002 — UX advisor sign-off mandatory for visible changes (2026-04-25)

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
advisor pass. Their report goes in the PR description and into
`decisions.md` under the relevant DEC. Their sign-off is captured. If they
flag a regression vs the §4 quality bar, the change does not merge.

**Falsifier.** If the advisor turns out to either rubber-stamp everything
or block on noise, the prompt template (in `agents.md`) is broken; refine
or replace.

**Advisor sign-off.** Self-applied (this is a process decision).

**Status.** Active.

---

## DEC-003 — JSON view restores the legacy newline-respecting renderer (2026-04-25)

**Problem.** The v1.0 React port of `legacy/json-pretty-printer.js` dropped
the special handling that visualises `\n` inside strings as actual line
breaks. MCP responses regularly include multi-line text in `content[*].text`
fields (markdown, code, log lines). Without newline-respecting rendering,
they are unreadable. This is a §4 quality-bar item Costa called out
specifically.

**Options considered.**

- _Stay with the current minimal rendering._ Rejected — fails the bar.
- _Use Mantine's CodeHighlight for JSON._ Generic syntax highlight; doesn't
  detect nested JSON-in-strings; doesn't handle multi-line strings any
  better than what we have.
- _Port the legacy `json-pretty-printer.js` behaviour properly._ The
  original was good — Costa wrote it. The port should match it: nested-JSON
  detection, newline visualisation, copy-as-JSON outputs valid JSON.

**Decision.** Reimplement the JSON view to match the legacy behaviour:

- Detect JSON-in-strings and pretty-print recursively.
- For strings containing `\n`, render them across multiple lines, preserving
  indent context.
- Provide a "copy" affordance on every JSON node (or at least the root) that
  produces well-formed JSON, with newlines escaped per JSON rules.
- Keep React-element rendering (no `innerHTML` — see `specs/security.md` §3).

**Falsifier.** A user pastes a tool response with `content[0].text` =
markdown including code fences, and the rendered view shows a single
unreadable line.

**Advisor sign-off.** Pending — UX critic to confirm the rendering matches
or beats the legacy behaviour.

**Status.** Active.

---

## DEC-004 — Mantine spec for layout, panels, log (2026-04-25)

**Problem.** v1.0 hand-rolled the shell layout. Result: panels not resizable
in all directions, tools list a fixed sliver, log a fixed bottom strip.

**Options considered.**

- _Keep the partial hand-rolled resizer (already in `src/ui/layout.tsx`)._
  Workable but limited to two axes; fragile.
- _Use Mantine's `<AppShell>` + an external `react-resizable-panels` for
  the inner splitter._ `react-resizable-panels` is the gold standard for
  this and has 1k+ stars; pairs cleanly with Mantine.
- _Use only `react-resizable-panels` without Mantine `<AppShell>`._ Doable
  but we lose the navbar / header niceties from `<AppShell>`.

**Decision.** Mantine `<AppShell>` for the chrome (header, navbar, aside,
optional footer). `react-resizable-panels` for the inner splits — at minimum
inspector-vs-request and main-vs-log. Sizes persist to localStorage under
`mcptc:ui.*` (already reserved in `specs/persistence.md`).

**Falsifier.** Resizable handles feel janky on common viewports (1280×800,
1920×1080, 2560×1440), or sizes don't persist across reloads.

**Advisor sign-off.** Pending — UX critic to walk three viewport sizes.

**Status.** Active.

---

## DEC-005 — CI bundle-size tripwire (2026-04-25)

**Problem.** The framework analyst (DEC-001 sign-off) flagged that
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

---

## DEC-006 — JSON view ships independently of the framework migration (2026-04-25)

**Problem.** The newline-respecting JSON view (DEC-003) blocks the most-cited
readability complaint and is independent of UI framework choice. Holding it
behind the framework migration delays the user-visible win.

**Options considered.**

- _Bundle into the Mantine migration PR._ Single big PR; longer to land.
- _Land as its own PR now, ahead of Mantine._ Gets the readability win to
  users this session; the framework migration then changes only chrome.

**Decision.** Land DEC-003's JSON view rewrite (with copy/save buttons)
ahead of the Mantine migration. CSS uses our existing tokens; no Mantine
dependencies; risk of regression on the Mantine PR is nil because the JSON
view sits inside whichever shell.

**Falsifier.** The CSS tokens conflict with Mantine theming when Mantine
lands. If they do, port the styling to use Mantine's CSS variables there.

**Advisor sign-off.** UX critic to confirm the rendered output passes the
"multi-line markdown in `content[0].text`" test before tagging v1.0.x.

**Status.** In flight — code merged in this session's commit; live URL
update follows the next deploy.
