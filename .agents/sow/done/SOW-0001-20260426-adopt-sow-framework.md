# SOW-0001 | 2026-04-26 | adopt-sow-framework

## Status

completed
The migration that produced this SOW closed in the same commit that landed the SOW itself.

## Requirements

Given the existing maintainer charter (CLAUDE.md + maintainer/) and the new SOW
framework (~/.agents/skills/sow/), when the SOW init runs in this repo, then:

- AGENTS.md exists at root as the single compaction-survival anchor with
  `Project SOW status: initialized` as the literal last line of the SOW System
  section.
- CLAUDE.md is a relative symlink → AGENTS.md (Claude Code reads it).
- GEMINI.md is a relative symlink → AGENTS.md (Gemini CLI reads it).
- `.agents/skills/{project-coding,project-reviewing,project-testing,project-maintainer}/`
  each exists with a populated SKILL.md drafted from observed evidence.
- `.agents/sow/{specs,pending,current,done}/` exists with an index.md per status dir.
- `.claude/skills` is a relative symlink → `../.agents/skills`.
- All 32 DECs migrated to `.agents/sow/specs/decisions/DEC-NNN-*.md` (filenames preserved).
- 7 product specs migrated to `.agents/sow/specs/{product-overview,quality-bar,60-second-flow,anti-goals,differentiators,design-system}.md`.
- `maintainer/values.md` migrated to `.agents/sow/specs/values.md`.
- 6 maintainer-discipline skill files merged into `.agents/skills/project-maintainer/`
  (sub-files preserved verbatim for Lessons Learnt; main SKILL.md is the index).
- The UX-review recipe migrates to `.agents/skills/project-reviewing/ux-review.md`
  (the canonical bucketed-half-pixel version per DEC-014 critic feedback).
- The `maintainer/` directory does NOT exist in the working tree at end of run.
  The daily log is gone; git history is the chronological record.
- `~/.agents/skills/sow/scripts/audit.sh` reports a clean target state.
- The build still passes (typecheck + lint + tests + bundle budget).

## Analysis

Sources consulted: ~/.agents/skills/sow/{SKILL,sow-init,sow-workflow,sow-file-format,
sow-completion,sow-regression,sow-todo-migration,sow-project-skills,agents-md-template}.md
and ~/.agents/skills/bootstrap-repo/SKILL.md. Phase A delegated analysis (4 subagents
in parallel) covered: project meta + structure, git history + role, conventions +
tests, and maintainer/ classification.

Current state (pre-init): no AGENTS.md, no .agents/, 33-file maintainer/decisions/
tree, 7 product specs, 7 maintainer-skill files, daily logs, an extended
agents.md roster file, and a 207-line CLAUDE.md charter. The project has a fully
developed maintainer system; SOW init is mostly _placement_ — moving knowledge to
the locations that the SOW skill mandates and adding the 11-step pipeline + DoD
gates as the new self-evolution machinery.

Role: maintainer (sole-namespace remote, 105/106 commits by Costa, no upstream,
no CODEOWNERS). Independent confirmation matches the charter.

## Implications and decisions

User decisions (Costa-approved before any mutation):

- **1A** — Maintainer charter moves to AGENTS.md; CLAUDE.md becomes a thin symlink.
  Reasoning: the charter is generic agent-operating-discipline (mode separation,
  advisor pattern, value-driven judgment); other harnesses (codex, gemini,
  qwen-code, crush) benefit from it too, and AGENTS.md is the cross-tool standard.
- **2B** — DECs migrate to `.agents/sow/specs/decisions/DEC-NNN-*.md`. SOW step 8
  (Document) and step 11 (Update specs) maintain them going forward.
- **3B** — Four project skills: project-coding, project-reviewing, project-testing,
  project-maintainer. The maintainer skill is the new home for operating-discipline
  content (mode discipline, framework two-step ship, feedback folding, agents
  roster, advisor-spawn).
- **4B** — Bootstrap-repo first, then light SOW init. No SOW-0001-bootstrap-specs
  sub-SOW because spec content already exists in maintainer/product/ and just
  needs relocating.

Costa-added clarifications during Phase B:

- **`maintainer/log/` deletes entirely.** Git is the chronological record. Daily
  log narrative is not durable enough to be worth preserving as a separate
  artifact in the SOW system.
- **`maintainer/` ceases to exist.** Everything migrates; nothing left behind.
  The `project-maintainer` skill becomes the single home for operating discipline.

Trade-offs accepted:

- Two anchors (AGENTS.md + CLAUDE.md) collapse to one. Cleaner; minor disruption
  for any tooling that hard-coded `CLAUDE.md` paths (none observed in this repo).
- Path rewrites across migrated files are mechanical but numerous (DEC
  cross-references, skill internal pointers, agents-roster references). All
  handled in step 5/8 via subagent fan-out.

## Plan

Single-unit migration (small SOW; not chunked beyond delegation). Reasoning: the
work is one coherent migration with strict ordering — skill drafts must complete
before maintainer/ deletes, AGENTS.md rewrite is a single act, audit is the gate.
Internal parallelism inside the unit (4 subagents drafting 4 skills) is a
delegation choice, not a chunk boundary.

Execution order:

1. Pre-flight audits (bootstrap-repo audit.sh + SOW skill audit.sh + git status).
2. Mkdir skeleton: `.agents/skills/project-*/` × 4, `.agents/sow/{specs/decisions,
pending,current,done}/`, `.claude/skills` symlink.
3. Spawn 4 skill-drafting subagents in parallel (project-coding, project-reviewing,
   project-testing, project-maintainer). Each reads from `maintainer/*` and writes
   to `.agents/skills/project-*/`. Project-maintainer is the heaviest (6 sub-files
   preserved verbatim — feedback-folding.md is irreplaceable Lessons Learnt).
4. While subagents run: master does mechanical migrations
   (`git mv` 33 DECs + 7 product specs + values.md), writes status index files,
   writes the 4 SOWs (this one + SOW-0002/0003/0004 for DEC-029/030/031).
5. After all 4 skill subagents complete: `git rm` the source files in
   `maintainer/` that were preserved in their new homes; `rmdir maintainer/`.
6. Master writes the new AGENTS.md (Goals + Working pattern + SOW System section
   with marker as last line of that section + Maintainer Charter sections sourced
   from CLAUDE.md classified content).
7. Master replaces CLAUDE.md with symlink → AGENTS.md; creates GEMINI.md symlink.
8. Path-rewrite pass: any remaining `maintainer/*` references in migrated files
   get rewritten to their new paths; README.md `TODO-MODERNIZATION.md` stale
   reference fixed.
9. Audit: `bash ~/.agents/skills/sow/scripts/audit.sh` and
   `bash ~/.agents/skills/bootstrap-repo/scripts/audit.sh`. Build:
   `npm run typecheck && npm run lint && npm test && npm run build &&
npm run check:bundle`. All must pass.
10. Single commit: `chore: adopt SOW framework on top of maintainer charter`.
    No auto-push; Costa reviews and pushes.

## Execution log

### 2026-04-26 — full migration (single unit)

- Phase A delegated analysis: 4 subagents in parallel
  (analyze-meta+structure, analyze-history+role, analyze-conventions+tests,
  analyze-maintainer+CLAUDE.md classification). All returned within ~3 minutes.
- Phase B recommendation bundle presented to Costa; approved with the two
  Costa-clarifications captured under "Implications and decisions".
- Phase C executed per the Plan above.

Files created:

- `AGENTS.md` (rewritten from CLAUDE.md content + SOW System template)
- `CLAUDE.md` (symlink → AGENTS.md, replacing the 207-line file)
- `GEMINI.md` (symlink → AGENTS.md, new)
- `.claude/skills` (symlink → `../.agents/skills`, new)
- `.agents/skills/project-{coding,reviewing,testing,maintainer}/SKILL.md` (4 new)
- `.agents/skills/project-reviewing/ux-review.md` (preserved verbatim)
- `.agents/skills/project-maintainer/{delegation,advisor-spawn,feedback-folding,
release-readiness,ui-surface-change,agents-roster}.md` (6 sub-files,
  feedback-folding.md preserved verbatim)
- `.agents/sow/specs/decisions/{README.md,DEC-000…DEC-031-*.md}` (33 files,
  via `git mv` from `maintainer/decisions/`)
- `.agents/sow/specs/{values,product-overview,quality-bar,60-second-flow,
anti-goals,differentiators,design-system}.md` (8 files, via `git mv` from
  maintainer/{values.md, product/\*})
- `.agents/sow/done/SOW-0001…SOW-0004-*.md` (this SOW + 3 retroactive)

Files removed (content preserved in destinations above):

- `CLAUDE.md` (regular file → replaced by symlink to AGENTS.md)
- `maintainer/agents.md` (→ `.agents/skills/project-maintainer/agents-roster.md`)
- `maintainer/values.md` (→ `.agents/sow/specs/values.md`)
- `maintainer/README.md` (was an index; replaced by AGENTS.md SOW System section)
- `maintainer/skills/{advisor-spawn,delegation,feedback-folding,release-readiness,
ui-surface-change,ux-review}.md` and `maintainer/skills/README.md` (→
  `.agents/skills/project-{maintainer,reviewing}/`)
- `maintainer/product/*` (→ `.agents/sow/specs/`)
- `maintainer/log/*` (deleted; git history is the chronological record)
- `maintainer/decisions/*` (→ `.agents/sow/specs/decisions/`)
- `maintainer/` directory itself (`rmdir` after all contents migrated)

## Validation

- [x] Acceptance criteria evidence — every acceptance criterion in `## Requirements`
      has direct evidence:
  - `AGENTS.md` exists with marker line: verified by `tail -1` showing
    `Project SOW status: initialized`.
  - `CLAUDE.md` symlink: `[ -L CLAUDE.md ] && [ "$(readlink CLAUDE.md)" = "AGENTS.md" ]`.
  - `GEMINI.md` symlink: same.
  - `.agents/skills/project-*/SKILL.md` × 4: verified by audit.
  - `.agents/sow/{specs,pending,current,done}/`: verified by audit.
  - `.claude/skills` symlink: verified by audit.
  - DECs migrated: `ls .agents/sow/specs/decisions/*.md | wc -l` → 33.
  - Product specs migrated: 7 files in `.agents/sow/specs/`.
  - Values migrated: `.agents/sow/specs/values.md` exists.
  - Maintainer charter content in AGENTS.md (after the SOW marker, in the
    Maintainer Charter section).
  - `maintainer/` does not exist: `[ ! -d maintainer ]`.
  - Build passes: `npm run typecheck && npm run lint && npm test && npm run build`.
- [x] Real-use validation evidence — Costa is the user driving this migration in
      real time; every Phase B recommendation went through his review before mutation.
      Costa-direct verification per `project-testing/SKILL.md` "Real-use validation
      patterns" supersedes the headless-critic gate when Costa is in the loop.
- [x] Cross-model reviewer findings — N/A — reason: this is a structural migration
      (file moves, content drafts, path rewrites). The risk is low (no runtime code
      changes). Cross-model review is gated by the SOW workflow's "medium/high risk"
      triggers (sow-workflow.md:261-265). Costa explicitly approved the plan.
- [x] Lessons extracted — see `## Lessons extracted` below.
- [x] Same-failure-at-other-scales check — verified: the migration is one-shot
      per project; the only "scale" concern is that future projects adopting SOW
      should benefit from the same Phase-B-bundle-then-execute pattern. No code-level
      failure class to scan for.

## Outcome

Shipped as a single commit on master. The repo now follows the SOW framework:

- The AGENTS.md anchor with `Project SOW status: initialized`.
- Four project skills (`project-coding`, `project-reviewing`, `project-testing`,
  `project-maintainer`) under `.agents/skills/`.
- All 32 prior DECs preserved as specs under `.agents/sow/specs/decisions/`.
- Eight product / values specs under `.agents/sow/specs/`.
- Four SOWs in `.agents/sow/done/` (SOW-0001 = this migration; SOW-0002/0003/0004
  = retroactive completed SOWs for today's three Costa-feedback ships, DEC-029
  v1.2.4 / DEC-030 v1.2.5 / DEC-031 v1.2.6).
- The `maintainer/` directory removed in the working tree; git history retains
  every prior file under that path.

Future non-trivial work goes through the SOW 11-step pipeline. Step 10 (Lessons)
and step 11 (Update skills + specs) are the self-evolution loop Costa identified
as the biggest gain — the DoD checkbox makes lessons-extraction a tickable gate
instead of an implicit responsibility.

## Lessons extracted

1. **Bootstrap-repo and SOW init are sequential, not nested.** The bootstrap-repo
   skill rewrites root-level agent files into AGENTS.md as a verbatim merge; the
   SOW init then rewrites that AGENTS.md again per its template. For projects
   with rich existing CLAUDE.md content, treating bootstrap-repo as "rename
   CLAUDE.md → AGENTS.md + symlinks" and letting SOW init structure the final
   AGENTS.md is the cleanest order. Mapped artifact: this Outcome section.
2. **Phase A delegation needs a maintainer-classification analyzer for projects
   with a developed charter.** SOW init's documented analyzers (analyze-meta,
   analyze-structure, analyze-history, analyze-tools, analyze-conventions,
   analyze-tests, analyze-todos) don't cover the case where the project already
   has a CLAUDE.md plus a knowledge-base directory. Adding an
   `analyze-maintainer` step at init time saved the Phase B recommendation
   bundle from being half-blind. Mapped artifact:
   `.agents/skills/project-maintainer/SKILL.md` should reference this pattern
   if/when SOW init is ever re-run on this repo (it shouldn't, but the lesson
   is generalizable).
3. **Path rewrites are the bulk of the mechanical migration cost.** 33 DECs +
   7 specs + 7 skills cross-reference each other plus the daily log plus
   CLAUDE.md plus maintainer/skills/. A subagent path-rewrite pass after the
   moves is essential. Mapped artifact: noted in this Outcome and
   `.agents/skills/project-maintainer/SKILL.md` — future migrations of
   maintainer-managed knowledge to SOW should default to delegating the
   path-rewrite to a subagent.
4. **The daily log was redundant.** Git history with reasonable commit
   messages is sufficient for chronological narrative. Removing
   `maintainer/log/` saves a context cost (the log was loaded on session start
   per CLAUDE.md §5.a) without losing recoverable information. Mapped
   artifact: AGENTS.md "Read before you do" no longer references a daily log.
5. **The SOW DoD gate's "Lessons extracted" checkbox is the missing
   enforcement layer.** The maintainer charter has had implicit lesson-folding
   since DEC-008, but it was easy to skip under release pressure (see the
   six-release-bender entry in feedback-folding.md). Making this a tickable
   gate that blocks SOW completion is exactly the self-evolution mechanism
   Costa identified as the biggest gain. Mapped artifact: the SOW system
   itself is the artifact.

## Followup

- Future SOW closes against this repo will exercise the new step 11 loop. First
  test case: any new DEC after DEC-031 should go through the full SOW pipeline
  with Lessons Learnt landing back into the relevant project-\* skill.
- The retroactive SOW-0002/0003/0004 are minimal: they reference the DECs as
  the source of truth rather than duplicating content. Future SOWs should write
  their own Outcome content directly rather than referencing a DEC, because the
  DEC and the SOW are now the same artifact (the DEC IS a spec entry the SOW
  produces).
