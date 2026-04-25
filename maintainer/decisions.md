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

## DEC-001 — Adopt a real UI component library (2026-04-25)

**Problem.** v1.0 used hand-rolled CSS + bare HTML elements. Result: no
visible button states, no tooltips, no proper modals, no toasts, hand-rolled
resizable layout that almost works. Costa's feedback singled this out as
the root visible failure.

**Options considered.**

- _Mantine v8._ Batteries-included. ~250 components, dark/light theme
  built in, modals, tooltips, notifications, command palette, splitter,
  resizable, code highlighter. ~100–150 KB gzipped on top of what we have.
  Opinionated visual style, slightly "Mantine-looking".
- _shadcn/ui + Tailwind v4._ Components copied into the repo, fully owned.
  Most popular for "Linear / Vercel" aesthetic. Tree-shaken. Requires
  Tailwind setup. We hand-style each component (more code, more taste
  needed, slower to "done" — exactly what bit me last time).
- _Chakra UI v3._ Similar to Mantine. Fewer components. Different aesthetic.
- _Radix Themes._ What MCP Inspector uses. Pre-themed Radix primitives but
  smaller component set than Mantine; we'd still hand-build splitter, code
  view, command palette. Means more hand-styling. Not what we need.

**Decision.** **Mantine v8.** Lowest time-to-good, biggest component set,
the project is small enough that the bundle is acceptable. Batteries-included
matters because the v1.0 failure was repeatedly running out of time at the
"polish" step. Mantine eliminates that step.

I will _use_ Mantine components — splitter, modals, tooltips, notifications,
buttons with variants, code highlight — rather than re-styling them into
something custom. Visual style is "default Mantine", not bespoke. If I want
bespoke later, I'll override CSS variables.

**Falsifier.** If after the migration the §4 quality-bar items are still
failing — buttons without active states, missing tooltips, prompt() instead
of modals — Mantine wasn't the bottleneck and DEC-001 was wrong. Try again.

**Advisor sign-off.** Pending — UX critic to be spawned to read the v1.0
deploy + this decision and tell me whether Mantine genuinely closes the gap.

**Status.** Active, advisor sign-off pending.

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
