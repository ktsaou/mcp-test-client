# SOW-0002 | 2026-04-26 | dec-029-no-double-tooltips

## Status

completed
Retroactively documented at SOW init time. The work itself shipped as v1.2.4 on 2026-04-26 before the SOW system was adopted.

## Requirements

Costa-direct feedback on v1.2.3:

> logs have 2 tooltips - make sure there are no double tooltips anywhere
> now there are 2 spinners: the connect/disconnect spinner should be 'abort',
> tristate: connect/disconnect/abort

Acceptance criteria:

- Given any hover surface in the app, when the user hovers, then EXACTLY ONE
  tooltip appears (no native HTML `title=` stacking with Mantine `<Tooltip>`).
- Given the connection state machine, when an inflight connect is in progress,
  then the primary connection action button reads "Abort" with destructive
  styling, NOT a duplicate spinner alongside a separate cancel control.
- Given the connect/abort/disconnect tristate, when state transitions
  (idle → connecting → connected → disconnecting), then the button label and
  color reflect the current state with no overlapping affordances.

## Analysis

See `.agents/sow/specs/decisions/DEC-029-tooltips-and-tristate-button.md` for
the full pre-code analysis.

## Implications and decisions

Captured in DEC-029. Highlights:

- The double-tooltip root cause: native HTML `title=` on the log row headline
  stacked with Mantine `<Tooltip>` on action icons. Project-wide audit removed
  every native `title=` on interactive elements.
- The tristate button: state-driven `<Button>` color/label/handler chosen from
  `status.state`. Toast suppression on user-initiated abort to avoid the
  "you cancelled — error!" anti-UX.

## Plan

Single-unit Worker brief; not chunked.

## Execution log

### 2026-04-26 — Worker brief → land → critic gate → ship

- Worker commit: project-wide native-`title=` audit (1 removed) +
  `connection-bar.tsx` tristate refactor + toast suppression.
- Critic gate: first attempt crashed on image-processing API (folded as a
  Lessons Learnt entry into `project-maintainer/feedback-folding.md`); re-spawn
  with `_evaluate` + `_snapshot` defaults returned a clean PASS.
- Release: v1.2.4 tagged, deployed to GitHub Pages, verified via
  `curl index-*.js` for the DEC-029 markers.

## Validation

- [x] Acceptance criteria evidence — verified on the live deploy by the
      UX-critic agent walking F1-F6 falsifiers in DEC-029. F2 (tristate) and F4
      (no double tooltips) — the Costa-direct asks — both PASS.
- [x] Real-use validation evidence — UX-critic agent on the LIVE deploy
      (https://ktsaou.github.io/mcp-test-client/), bundle `index-XXXXX.js`.
      Costa later exercised the surface himself.
- [x] Cross-model reviewer findings — N/A — reason: low-risk visible-surface
      polish; UX critic single-model gate sufficient per DEC-002.
- [x] Lessons extracted — see `## Lessons extracted` below.
- [x] Same-failure-at-other-scales check — verified: project-wide audit for
      raw DOM `title=` returned only React component-prop matches (Modal,
      Drawer, Alert, EmptyState). The audit query lives in DEC-029's Falsifier
      section.

## Outcome

Shipped as **v1.2.4** (release commit + tag). Native HTML `title=` removed
from one log-row headline (was the source of the double-tooltip stack).
Tristate Connect/Abort/Disconnect button replaces the prior dual-control
"connect spinner + cancel button" UX. Toast notifications suppressed when
the user is the one who initiated the abort (no "your action errored" for a
deliberate cancel).

## Lessons extracted

1. **Critic agents must default to `_evaluate` + `_snapshot` for evidence;
   `_take_screenshot` is opt-in.** Reason: Anthropic's image-processing API
   has flaked on the screenshot path with HTTP 400. Mapped artifact:
   `.agents/skills/project-maintainer/feedback-folding.md` (entry dated
   2026-04-26 captures this).
2. **Project-wide native `title=` is a class of bug, not a single instance.**
   The audit query `git grep -nE 'title=\{[^}]*\}|title="[^"]*"' src/ui src/state`
   should be part of every visible-surface review going forward. Mapped
   artifact: `.agents/skills/project-reviewing/SKILL.md` review checklist
   item "No native HTML `title=` on interactive elements".
