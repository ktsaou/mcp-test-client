# SOW-0009 - Bootstrap SOW Pointer Refresh

## Status

Status: completed

Sub-state: completed; stale global SOW pointers and durable personal-name references were removed from `AGENTS.md`.

## Requirements

### Purpose

Keep this project's SOW runtime authority local to `AGENTS.md`, reserve the global `bootstrap-sow` skill for setup/review/repair/migration, and avoid writing the user's personal name into durable repository instructions.

### User Request

The user approved reviewing this repository as part of the bootstrap-sow rollout. This project already has a strong SOW implementation, so the repair should be minimal and preservation-safe.

### Assistant Understanding

Facts:

- Audit passes before edits.
- `AGENTS.md` still references `~/.agents/skills/sow/SKILL.md`.
- `AGENTS.md` contains durable references to the user's personal name.
- Existing project-specific maintainer instructions are important and must be preserved.

### Acceptance Criteria

1. Exact old global SOW skill path references are removed from active `AGENTS.md`.
   - Verification: stale-path search.
2. Runtime SOW authority remains project-local.
   - Verification: inspect updated SOW System wording.
3. The user's personal name is not present in `AGENTS.md`.
   - Verification: name search.
4. Existing project-specific instructions remain semantically preserved.
   - Verification: diff review.
5. Audit remains clean.
   - Verification: `bash ~/.agents/skills/bootstrap-sow/scripts/audit.sh`.

## Analysis

Sources checked:

- `AGENTS.md`
- `bash ~/.agents/skills/bootstrap-sow/scripts/audit.sh`

Findings:

- Structural SOW audit is clean.
- Stale references remain in project instructions at old global SOW path locations.
- The handbook uses the user's personal name in several user-facing and assistant-facing rules.

## Implications And Decisions

No additional user decision is needed because the repair preserves behavior and wording semantics while replacing stale path references and personal-name mentions.

## Plan

1. Back up `AGENTS.md`.
2. Replace old global SOW path references with project-local runtime wording and `bootstrap-sow` setup/repair wording.
3. Replace personal-name mentions in `AGENTS.md` with `user`.
4. Run audit and searches.

## Execution Log

### 2026-05-01

- Opened this SOW.
- Backed up `AGENTS.md` to `AGENTS.md.pre-bootstrap-sow-20260501.bak` and verified it with `cmp`.
- Updated old global SOW path references to project-local runtime wording and `bootstrap-sow` setup/repair wording.
- Replaced personal-name mentions in `AGENTS.md` with `user`.
- Ran audit, stale-path search, name search, and diff check.

## Validation

Acceptance criteria evidence:

1. Exact old global SOW skill path references are removed from active `AGENTS.md`.
   - Evidence: `rg -n "Costa|~/.agents/skills/sow(/|$)|\\.agents/skills/sow(/|$)|skills/sow(/|$)" AGENTS.md || true` returned no matches.
2. Runtime SOW authority remains project-local.
   - Evidence: `AGENTS.md` now says project-local SOW runtime rules live in this file and `bootstrap-sow` is only for setup/repair/migration/re-review.
3. The user's personal name is not present in `AGENTS.md`.
   - Evidence: same search returned no personal-name matches.
4. Existing project-specific instructions remain semantically preserved.
   - Evidence: diff only updates stale SOW pointers and replaces personal-name mentions with `user`.
5. Audit remains clean.
   - Evidence: `bash ~/.agents/skills/bootstrap-sow/scripts/audit.sh` reports `SOW initialization complete and clean`.

Additional checks:

- `git diff --check -- AGENTS.md .agents/sow/current/SOW-0009-20260501-bootstrap-sow-pointer-refresh.md` passed.

Specs update:

- No spec update. Reason: assistant runtime instructions changed; product behavior, UX contracts, MCP behavior, and build/test behavior did not change.

Project skills update:

- No project skill update. Reason: the existing project skills already contain the relevant operating rules; this SOW repaired handbook pointers and personal-name usage only.

## Outcome

Completed.

- Updated `AGENTS.md`.
- Preserved existing project-specific SOW and maintainer rules.
- Changed no specs or skills.

## Lessons Extracted

- Even good SOW implementations can retain stale global-skill pointers after the global split.
- Durable project instructions must use `user`, not the user's personal name.

## Followup

None yet.
