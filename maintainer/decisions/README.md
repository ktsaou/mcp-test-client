# Decisions — ADR-lite index

Every non-trivial product or technical decision lands here as its own file,
_before_ code is written. Reversed decisions stay; the falsifier shows what
changed.

| ID                                               | Title                                                              | Date                 | Status                | Summary                                                                                    |
| ------------------------------------------------ | ------------------------------------------------------------------ | -------------------- | --------------------- | ------------------------------------------------------------------------------------------ |
| [DEC-000](DEC-000-working-framework.md)          | Adopt a maintainer/worker/advisor working framework                | 2026-04-25           | Active                | Three-mode operation with live `maintainer/*` documentation.                               |
| [DEC-001](DEC-001-mantine-v9.md)                 | Adopt Mantine v9 as the UI component library                       | 2026-04-25 (revised) | Active                | Replace hand-rolled CSS + bare HTML with Mantine v9 components.                            |
| [DEC-002](DEC-002-ux-advisor-mandatory.md)       | UX advisor sign-off mandatory for visible changes                  | 2026-04-25           | Active                | UX-critic sub-agent must sign off before any visible-surface change merges.                |
| [DEC-003](DEC-003-json-view-newlines.md)         | JSON view restores the legacy newline-respecting renderer          | 2026-04-25           | Active                | Reimplement JSON view to match `legacy/json-pretty-printer.js`.                            |
| [DEC-004](DEC-004-mantine-appshell-resizable.md) | Mantine spec for layout, panels, log                               | 2026-04-25           | Active                | Mantine `<AppShell>` + `react-resizable-panels` for inner splits.                          |
| [DEC-005](DEC-005-bundle-budget.md)              | CI bundle-size tripwire                                            | 2026-04-25           | Active                | CI fails when `dist/assets/*.js` exceed 350 KB gzipped.                                    |
| [DEC-006](DEC-006-json-view-ships-ahead.md)      | JSON view ships independently of the framework migration           | 2026-04-25           | In flight             | Land DEC-003 ahead of the Mantine migration.                                               |
| [DEC-007](DEC-007-non-costa-issues-into-v1-1.md) | Additional non-Costa issues fold into v1.1, not v1.2               | 2026-04-25           | Active                | Modal a11y, real tabs, contrast, empty states join v1.1; virtualization to v1.1.1.         |
| [DEC-008](DEC-008-maintainer-restructure.md)     | Split the maintainer brain into per-day, per-skill, per-spec files | 2026-04-25           | Active                | Adopt the two-axis layout (live activity logs + stable knowledge).                         |
| [DEC-009](DEC-009-response-metrics.md)           | Per-response metrics: bytes, duration, estimated tokens            | 2026-04-25           | Open                  | Show three metrics on every response; ships as v1.1.1 after v1.1 deploys.                  |
| [DEC-010](DEC-010-v1-1-blockers.md)              | v1.1 ship blockers (round 1)                                       | 2026-04-25           | Open (1 of 3 partial) | 2 closed (share-link, Enter-submit); mobile-collapse partial — see DEC-011.                |
| [DEC-011](DEC-011-v1-1-round-2.md)               | v1.1 ship blockers, round 2                                        | 2026-04-25           | Open                  | Mobile header overflow, Send/Share truncation, inventory error empty-state, Save-as toast. |

## Format spec for new entries

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
