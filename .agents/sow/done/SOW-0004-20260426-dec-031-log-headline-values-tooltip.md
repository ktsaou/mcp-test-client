# SOW-0004 | 2026-04-26 | dec-031-log-headline-values-tooltip

## Status

completed
Retroactively documented at SOW init time. The work itself shipped as v1.2.6 on 2026-04-26 immediately before the SOW system was adopted.

## Requirements

Costa-direct feedback on v1.2.5:

> The tooltip in the log are still wrong. The problem is that when the log is
> narrow, the user cannot see the VALUES (tool name, size, tokens, duration).
> The goal is to show the VALUES in the tooltip, when hovering. Be careful:
> this is needed to the whole log header line except the buttons that each
> line has.

Acceptance criteria:

- Given the log panel is narrow (`data-chip-level="3"`), when the user hovers
  the headline values area of a response row, then a Mantine tooltip appears
  after ~350ms with the format `method · discriminator · X KB · Y ms · ~N tokens`
  (tokens part omitted if not yet loaded).
- Given any hover on action buttons (`↔` / `⎘` / `⤓`), then EXACTLY ONE
  tooltip appears (the per-button tooltip), no stacking with the values
  tooltip.
- Given a system log row, when the user hovers its headline, then a single
  tooltip shows the full system text (no buttons there to conflict).
- Given the chip-fold ladder (DEC-014) at any `data-chip-level`, the action
  buttons remain right-edge-aligned (the DEC-014 invariant).

## Analysis

See `.agents/sow/specs/decisions/DEC-031-log-headline-values-tooltip.md` for
the full pre-code analysis.

## Implications and decisions

Captured in DEC-031. Highlights:

- Refactor the wire-row headline DOM: `.log-row__values` (chev / dir / ts /
  title / chips) becomes a flex sibling of `.log-row__actions` containers
  inside `.log-row__headline`.
- `MetricsChips withTooltips={false}` inside the headline so chips don't
  double-tooltip with the values wrapper.
- Token state lifted from `ResponseMetricsChips` to `LogRow` so tooltip and
  chip share source.
- System rows get the whole `.log-row__headline` wrapped in a single
  `<Tooltip label={entry.text}>`.

## Plan

Single-unit Worker brief; not chunked.

## Execution log

### 2026-04-26 — Worker brief → land → Costa-direct verify → ship

- Worker commit: `196bafc` — DOM refactor + values tooltip + `withTooltips`
  prop on MetricsChips + system-row tooltip + per-row test refactor.
- Bundle: 304.4 KB gz initial total (delta `+0.30 KB gz` on `index.js`),
  45.6 KB headroom under DEC-005's 350 KB cap.
- Verification: critic agent was spawned but stopped early because Costa
  tested DEC-031 himself on the live deploy and confirmed it works. Costa's
  sign-off supersedes the critic gate per `project-testing/SKILL.md`.
- Release: v1.2.6 tagged (`a6c0b14`) + deployed; live bundle
  `index-CAIPRM1t.js` carries the four DEC-031 markers.

## Validation

- [x] Acceptance criteria evidence — Costa-direct verification on the live
      deploy. F1-F6 falsifiers in DEC-031 all hold by construction (verified by
      the Worker via code-reading + by Costa via real use).
- [x] Real-use validation evidence — Costa tested the live deploy himself
      and confirmed.
- [x] Cross-model reviewer findings — N/A — reason: visible-surface refinement
      with a tight scope. Costa-direct sign-off is the strongest possible signal.
- [x] Lessons extracted — see `## Lessons extracted` below.
- [x] Same-failure-at-other-scales check — verified by `git grep` audit:
      `git grep -nE 'title=\{[^}]*\}|title="[^"]*"' src/ui src/state` returns
      only React component-prop matches (Modal, Drawer, Alert, EmptyState,
      Tooltip `label=`); no raw DOM `title=` reintroduced.

## Outcome

Shipped as **v1.2.6** (release commit `a6c0b14`, Worker commit `196bafc`,
live bundle `index-CAIPRM1t.js`). The narrow-log values gap is closed: at
chip-level 3 (only timestamp + method + actions visible), hovering the
headline values area surfaces the full method + bytes + duration + tokens
in a single Mantine tooltip after ~350ms. Action buttons keep their
per-button tooltips. The DEC-029 no-double-tooltip invariant holds. The
DEC-014 chip-fold ladder still works because the chip-fold CSS selectors
use descendant combinators (`.log-row__chips .metric-chip[data-chip="..."]`)
which match across the new `.log-row__values` nesting level.

## Lessons extracted

1. **Wrapping a clickable region in a parent Tooltip changes hover
   semantics.** Inside the values tooltip subtree, child elements that
   render their own `<Tooltip>` will stack — the inner chip tooltips would
   double-tooltip with the values wrapper. The fix (`withTooltips` prop
   passed `false` from the headline call site) is the canonical pattern:
   when adding a wrapping tooltip, audit all children that render their
   own tooltip and either omit them or suppress them via prop. Mapped
   artifact: `.agents/skills/project-reviewing/SKILL.md` review checklist
   "When adding a wrapping `<Tooltip>` to a parent, check children for
   their own `<Tooltip>` and resolve double-stacking explicitly".
2. **DEC-014 chip-fold's descendant CSS selectors made DEC-031 trivially
   compatible.** The chip-drop ladder uses `.log-row__chips .metric-chip[data-chip="..."]`
   (descendant combinator), not direct-child. Wrapping `.log-row__chips`
   one level deeper inside `.log-row__values` did NOT break the fold. This
   is a load-bearing CSS choice from DEC-014. Mapped artifact:
   `.agents/sow/specs/decisions/DEC-014-log-row-alignment.md` Status
   section already notes the descendant-selector reasoning; no new edit
   needed, but worth flagging as a positive pattern in
   `.agents/skills/project-coding/SKILL.md` "Common patterns".
3. **Costa-direct verification is the strongest possible advisor pass.**
   When the user has personally exercised the surface and confirmed the
   contract, that IS the gate — the critic exists to substitute for the
   user when the user isn't around. Mapped artifact:
   `.agents/skills/project-testing/SKILL.md` "Real-use validation
   patterns" already captures this principle.
