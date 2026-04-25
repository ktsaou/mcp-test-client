# Decisions — ADR-lite index

Every non-trivial product or technical decision lands here as its own file,
_before_ code is written. Reversed decisions stay; the falsifier shows what
changed.

| ID                                                         | Title                                                              | Date                 | Status    | Summary                                                                                       |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | -------------------- | --------- | --------------------------------------------------------------------------------------------- |
| [DEC-000](DEC-000-working-framework.md)                    | Adopt a maintainer/worker/advisor working framework                | 2026-04-25           | Active    | Three-mode operation with live `maintainer/*` documentation.                                  |
| [DEC-001](DEC-001-mantine-v9.md)                           | Adopt Mantine v9 as the UI component library                       | 2026-04-25 (revised) | Active    | Replace hand-rolled CSS + bare HTML with Mantine v9 components.                               |
| [DEC-002](DEC-002-ux-advisor-mandatory.md)                 | UX advisor sign-off mandatory for visible changes                  | 2026-04-25           | Active    | UX-critic sub-agent must sign off before any visible-surface change merges.                   |
| [DEC-003](DEC-003-json-view-newlines.md)                   | JSON view restores the legacy newline-respecting renderer          | 2026-04-25           | Active    | Reimplement JSON view to match `legacy/json-pretty-printer.js`.                               |
| [DEC-004](DEC-004-mantine-appshell-resizable.md)           | Mantine spec for layout, panels, log                               | 2026-04-25           | Active    | Mantine `<AppShell>` + `react-resizable-panels` for inner splits.                             |
| [DEC-005](DEC-005-bundle-budget.md)                        | CI bundle-size tripwire                                            | 2026-04-25           | Active    | CI fails when `dist/assets/*.js` exceed 350 KB gzipped.                                       |
| [DEC-006](DEC-006-json-view-ships-ahead.md)                | JSON view ships independently of the framework migration           | 2026-04-25           | In flight | Land DEC-003 ahead of the Mantine migration.                                                  |
| [DEC-007](DEC-007-non-costa-issues-into-v1-1.md)           | Additional non-Costa issues fold into v1.1, not v1.2               | 2026-04-25           | Active    | Modal a11y, real tabs, contrast, empty states join v1.1; virtualization to v1.1.1.            |
| [DEC-008](DEC-008-maintainer-restructure.md)               | Split the maintainer brain into per-day, per-skill, per-spec files | 2026-04-25           | Active    | Adopt the two-axis layout (live activity logs + stable knowledge).                            |
| [DEC-009](DEC-009-response-metrics.md)                     | Per-response metrics: bytes, duration, estimated tokens            | 2026-04-25           | Closed    | Subsumed into DEC-012 row design; chips on every response row + Last-result view.             |
| [DEC-010](DEC-010-v1-1-blockers.md)                        | v1.1 ship blockers (round 1)                                       | 2026-04-25           | Closed    | All three blockers closed across rounds 1 + 2; share-link, Enter-submit, mobile-collapse.     |
| [DEC-011](DEC-011-v1-1-round-2.md)                         | v1.1 ship blockers, round 2                                        | 2026-04-25           | Closed    | Mobile header overflow, Send/Share truncation, inventory error empty-state, Save-as toast.    |
| [DEC-012](DEC-012-v1-1-1-log-redesign.md)                  | v1.1.1: "the log, fixed"                                           | 2026-04-25           | Closed    | 13/13 rows pass; DEC-009 metrics subsumed into the row design; ships as v1.1.1.               |
| [DEC-013](DEC-013-notification-row-consistency.md)         | Notification rows render as full collapsible entries               | 2026-04-25           | Closed    | 6/6 rows pass; logic-only patch on the `!isNote` gate; bundle delta zero.                     |
| [DEC-014](DEC-014-log-row-alignment.md)                    | v1.1.2: log-row alignment under squeeze                            | 2026-04-25           | Closed    | Shipped as v1.1.2; chips fold behind copy/save via `data-chip-level`; buttons share X.        |
| [DEC-015](DEC-015-share-link-reproduction-flow.md)         | v1.1.3: share-link reproduction — precondition modals + repro      | 2026-04-25           | Open      | Server-missing / connect-error / tool-missing modals; Part A has new sidebar-active clue.     |
| [DEC-016](DEC-016-onboarding-and-connection-ergonomics.md) | v1.2.0: onboarding + connection ergonomics                         | 2026-04-25           | Open      | URL-driven add, connect-on-save, click-to-connect, header → status badge, cancel inflight.    |
| [DEC-017](DEC-017-curated-server-catalogs.md)              | v1.2.1: curated server catalogs                                    | 2026-04-25           | Open      | Auto-merge no-auth catalog into user list; auth-required as dropdown in add-server modal.     |
| [DEC-018](DEC-018-per-tool-form-persistence.md)            | v1.2.1: per-tool form-state persistence                            | 2026-04-25           | Open      | `mcptc:tool-state.<server>.<tool>` survives switching; form preserved after Send.             |
| [DEC-019](DEC-019-send-without-validation.md)              | v1.2.2: send without validation                                    | 2026-04-25           | Open      | Split-button: Send default, chevron reveals "Send without validation"; per-send only.         |
| [DEC-020](DEC-020-inflight-status-bar.md)                  | v1.2.2: inflight status bar                                        | 2026-04-25           | Open      | Animated activity icon in the connection bar; popover lists in-flight; future-proof.          |
| [DEC-021](DEC-021-settings-portability.md)                 | v1.2.2: settings portability (export / import)                     | 2026-04-25           | Open      | JSON round-trip of `mcptc:*` keys; "Include credentials [✓]" checkbox on export.              |
| [DEC-022](DEC-022-app-chrome-polish.md)                    | v1.2.2: GitHub icon + in-app docs viewer                           | 2026-04-25           | Open      | Full markdown + Mermaid (lazy); seed list + new "integrate your MCP server" doc.              |
| [DEC-023](DEC-023-llm-chat-test-this-mcp.md)               | v1.3.0: "Test this MCP" with an LLM chat                           | 2026-04-25           | Open      | Browser-direct LLM + MCP tool-call bridge; CORS feasibility confirmed; six design calls open. |
| [DEC-024](DEC-024-output-schema-compile-resilience.md)     | v1.1.3: output-schema compile resilience                           | 2026-04-25           | Closed    | Shipped as v1.1.3; TolerantValidator wrapper + system-log warning. Upstream PR TBD.           |

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
