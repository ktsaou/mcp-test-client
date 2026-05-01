---
name: project-reviewing
description: Review discipline for the mcp-test-client project — when to spawn the UX critic / spec purist / accessibility auditor / cross-model reviewers, what each must check, and how to act on findings. MUST be followed for any review of code (yours or others') in this repo.
---

# project-reviewing

## Review priorities (in order)

1. **User value** — does the change help a user explore an MCP server in concrete terms?
2. **Visible-surface judgement** — pixel alignment, hover states, focus rings, keyboard paths (the things only a user sees)
3. **Spec compliance** — MCP wire spec; the contracts in `.agents/sow/specs/`
4. **Correctness** — type safety, race-condition guards, error paths
5. **Performance** — bundle size (DEC-005 cap), perceived latency
6. **Style** — last; the project-coding skill + Prettier handle the mechanical part

## When the UX critic is mandatory (DEC-002)

Any visible-surface change. Period. Visible-surface = anything a user sees on the page or in the wire log: layout, spacing, color, copy, hover/focus states, animations, modals, toasts, log row appearance, form fields, tooltips.

DEC-002 is non-negotiable. The `ui-surface-change` checklist (see `./ui-surface-change.md` sub-file when present) is the per-change protocol. The full UX-critic recipe (alignment-under-squeeze JS, bucketed half-pixel check, prompt template) lives at [`./ux-review.md`](./ux-review.md) — read it before spawning any critic.

## Standard review checklist (every PR / pre-ship)

- [ ] Did I run the change myself in the browser (or via headless playwright on the live deploy)?
- [ ] Are state values selected with `useCallback` deps that include all read state (exhaustive-deps)?
- [ ] Are async race conditions guarded (epoch refs, AbortController, etc.)?
- [ ] Does the error path preserve context (no silent catch)?
- [ ] Are tests added for new behavior, OR is the omission documented in the PR?
- [ ] Does the code match `project-coding` conventions?
- [ ] Bundle delta verified under DEC-005 cap (`npm run check:bundle`)?
- [ ] No native HTML `title=` on interactive elements (DEC-029)?
- [ ] If visible-surface: did the UX critic sign off on the LIVE deploy?
- [ ] If MCP-protocol-touching: did the spec purist sign off?

## Spawning a UX critic — what to give them

Pointer summary; for the full recipe + canonical prompt template, see [`./ux-review.md`](./ux-review.md).

- **The deployed URL** — always live deploy; never localhost. (Lesson from feedback-folding: maintainer-hosted localhost can mask deploy mismatches; only the live deploy proves what users see.)
- **Headless playwright tools** — `mcp__playwright_headless__*`. **Avoid `_take_screenshot` by default**; the image-processing pipeline has flaked at API-error-400 ("Could not process image"). Default evidence forms, ranked by reliability:
  1. `_evaluate` JSON (selector + computed style + attribute)
  2. `_snapshot` YAML (accessibility tree)
  3. `_take_screenshot` (filenames only — optional)
- **Concrete falsifiers** — numbered list of things that must hold (F1...F6) plus wave-regression spot checks (R-A...R-G). "This work is bad if X."
- **A test server**. Examples:
  - `https://mcp.deepwiki.com/mcp` — exposes `read_wiki_structure`, `read_wiki_contents`, `ask_question`
  - `https://mcp.context7.com/mcp` — exposes `resolve-library-id`, `get-library-docs`
- **Default critic scopes** (added 2026-04-25): iPhone-size viewport (390×844), share-link reload in fresh incognito (server + tool + method + arguments must reconstruct), bearer-token auth round-trip, 200+ messages in the log, modal a11y end-to-end including Enter-on-primary-input, alignment-under-squeeze for any list-of-rows surface.

## When to escalate to cross-model review

Per DEC-000 working framework and this project's `AGENTS.md` validation rules, escalate to cross-model review when:

- Chunk risk medium/high (visible surface, security, billing, data integrity)
- Diff > 500 lines or > 10 files
- User explicitly asks
- Migration / refactor that touches many call sites

Spawn 2+ different models (codex, gemini, qwen-code, glm) per the Unbiased Second Opinion Protocol (~/.claude/CLAUDE.md). Capture findings in the SOW Execution log.

## Project-specific concerns (lessons captured from prior bugs)

- **Native HTML `title=` on log rows stacked with Mantine `<Tooltip>`** → DEC-029 single-tooltip mandate. Reviewers must grep for `title=` on any interactive surface and reject.
- **v1.1.20 critic image-API flake** → default critic brief specifies `_evaluate` + `_snapshot` over `_take_screenshot`. Screenshots are nice-to-have, not load-bearing.
- **Cancellation-chain risk on serial GH Pages deploys** → always verify deploy via `curl` of the deployed `index-*.js` filename before announcing "live". Never claim a deploy you haven't verified.
- **DEC-014 chip-fold uses descendant CSS selectors** so wrapping `.log-row__chips` inside `.log-row__values` (DEC-031) preserves the chip-drop ladder. Reviewers must measure `data-chip-level` (0/1/2/3) at 280/320/360/400 px and verify monotonic-up behaviour, not just visual judgement.
- **Critic "PASS" verdict ≠ SOW acceptance criteria passing** (SOW-0007). The UX-critic returned SHIP-WITH-CAVEAT on SOW-0007's tabs-pills change; falsifier 1 was reported PASS qualitatively ("identifiable in <1 s") but the SOW's explicit ≥3:1 light-theme contrast target was missed (2.79:1 measured). Reviewers (and the maintainer reviewing the critic) must re-check the critic's numeric measurements against the SOW's acceptance criteria directly. Qualitative pass is necessary but not sufficient when criteria carry numeric thresholds.

## How to act on review findings

- **Must-fix** → fix before ship; new chunk in same SOW
- **Should-fix** → defer to SOW `## Followup` section if the user agrees
- **Nice-to-have** → file as a hygiene-queue task, ignore for this ship
- **False positive** → record in Execution log with reasoning so the next reviewer doesn't re-raise

## When in doubt

Spawn an advisor. The cost of a parallel critic agent is much lower than the cost of shipping a regression Costa flags by name.

## See also (sub-files)

- [`./ux-review.md`](./ux-review.md) — alignment-under-squeeze recipe; bucketed half-pixel check; UX-critic prompt template (canonical).
