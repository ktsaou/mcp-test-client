# SOW-0010 - Self-Contained SOW Framework

## Status

Status: completed

Sub-state: completed; runtime SOW framework is self-contained.

## Requirements

### Purpose

Make this project's SOW framework self-contained so future agents can operate from repository files alone after clone/checkout.

### User Request

The user clarified that project SOW frameworks must not rely on `~/.agents`, `~/.AGENTS.md`, global templates, or global scripts. Empty SOW directories must include placeholders so they are committed.

### Acceptance Criteria

1. Active runtime instructions do not point SOW operation at global SOW files.
2. `.agents/sow/SOW.template.md` exists.
3. `.agents/sow/audit.sh` exists.
4. Empty SOW directories have `.gitkeep` or `.keep`.
5. Local `.agents/sow/audit.sh` passes.

## Plan

1. Update `AGENTS.md` and project skills to use project-local SOW rules.
2. Add local SOW template and audit script.
3. Add placeholders for empty SOW directories.
4. Run local audit and diff validation.

## Execution Log

### 2026-05-01

- Opened this SOW for the self-contained framework repair.
- Updated `AGENTS.md` so normal SOW work uses project-local files only.
- Updated `project-reviewing` and `project-testing` skills to stop pointing at the old global SOW skill.
- Installed `.agents/sow/SOW.template.md` and `.agents/sow/audit.sh`.
- Added `.gitkeep` placeholders for empty SOW directories.

## Validation

Acceptance criteria evidence:

- `AGENTS.md` points SOW runtime work at project-local files.
- `.agents/skills/project-reviewing/SKILL.md` and `.agents/skills/project-testing/SKILL.md` no longer reference the old global SOW skill.
- `.agents/sow/SOW.template.md` exists.
- `.agents/sow/audit.sh` exists.
- Empty `.agents/sow/pending/` and `.agents/sow/current/` have `.gitkeep`.

Tests or equivalent validation:

- `bash .agents/sow/audit.sh` reports `SOW initialization complete and clean`.
- `git diff --check` passed.

Real-use evidence:

- Local audit used the project-local script at `.agents/sow/audit.sh`, not a global script.

Reviewer findings:

- No external reviewer used; this was a narrow framework metadata repair.

Same-failure scan:

- `rg -n "(~/.agents|~/.AGENTS|bootstrap-sow|global .*SOW)" AGENTS.md .agents/skills` returns only the self-contained no-global dependency sentence in `AGENTS.md`.

Specs update:

- No spec update needed. This changed assistant runtime framework files, not product behavior.

Project skills update:

- Updated `project-reviewing` and `project-testing` to point at project-local SOW rules.

Output/reference skills update:

- No output/reference skills exist in this project.

Lessons:

- SOW installs need local templates/audits and placeholders for empty directories so clone/checkout preserves the framework.

Follow-up mapping:

- No deferred item remains.

## Outcome

Completed.
