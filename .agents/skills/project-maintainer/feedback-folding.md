# Skill — feedback folding

How to absorb a feedback report. User feedback is fact, not opinion. The
job is to identify the underlying expectation it violated and fold it into
the live brain so the same failure cannot recur silently.

## Checklist

1. **Capture the verbatim report** (or a faithful paraphrase) in the
   active SOW (or commit message), with attribution.
2. **Split multi-part bullets.** A single feedback line of the form
   "no X / no Y / no Z" is _three_ user needs, not one. Track each
   sub-item independently in the SOW and in the resolving DEC. **A
   resolving DEC must contain a checklist with one row per sub-item.**
   "Implemented elsewhere" or "rolled into the broader fix" only counts
   when each sub-item is named individually as a checked row.
3. **For each item, identify the violated expectation.** If the
   expectation isn't already stated in
   [`../../sow/specs/quality-bar.md`](../../sow/specs/quality-bar.md), add it.
4. **For each item, ask "which skill should have prevented this?"**
   Update that skill's "Lessons Learnt" with `date — what happened —
new guardrail`.
5. **If a skill doesn't exist for that failure mode, create one in this
   PR.** The skills directory is the live brain; gaps in it are
   pre-baked future failures.
6. **Open / update an issue or DEC for the fix.** Decisions land in
   [`../../sow/specs/decisions/`](../../sow/specs/decisions/) before code.
7. **Before specifying a new modal / surface, ask "does the existing
   UI already handle this state?"** New modals must justify their
   existence over the existing path. Adding a parallel UX for a state
   the form / inspector / log already handles makes the new flow feel
   special and inconsistent. Reuse beats invent.

## Lessons Learnt

- **2026-04-25 — No place to fold guardrails.** Costa's seven-point
  report came in with no place to fold guardrails until I established
  this skill structure. The information was scattered across `product.md`
  §4 and ad-hoc additions to `agents.md`. **Guardrail:** this skill
  itself, codified by
  [`../../sow/specs/decisions/DEC-008-maintainer-restructure.md`](../../sow/specs/decisions/DEC-008-maintainer-restructure.md).
- **2026-04-25 (after v1.1 ship) — multi-part feedback bullets got
  partial credit.** Costa's original item-5 said
  "log is unmanageable: no nav between requests/responses, no
  copy-as-JSON per message, no save-to-file. JSON should respect
  newlines. Timestamp + direction wastes width on narrow screens."
  v1.1 addressed copy, save, and newlines but silently dropped the
  prev/next-nav and the timestamp/direction width complaints. The
  v1.1 CHANGELOG implied "log is unmanageable" was closed — overclaim.
  **Guardrail:** checklist step 2 above. Multi-part bullets split to
  one tracker per piece, and the resolving DEC carries a checklist
  with one row per sub-item. The DEC merges only when every row is
  ticked or explicitly deferred with a date.
- **2026-04-25 (DEC-015 design) — invented a parallel UX for a state
  the form already handled.** I drafted a fourth modal for share-link
  schema mismatch (option (a) ship now / option (b) Ajv-validate +
  modal). Costa pushed back: the form's existing Ajv 8 validation
  already handles malformed args from any source, including share
  links. A "tool parameters changed" modal would make the share-link
  path look special when it isn't. **Guardrail:** checklist step 7
  above — before specifying a new modal, list every state and ask
  whether the existing UI already covers it.

- **2026-04-25 (after DEC-024 / v1.1.3 → v1.1.4) — wrapping a
  third-party throw is not enough if it also logs.** v1.1.3 wrapped
  the SDK's Ajv validator to catch compile throws so one bad
  `outputSchema` wouldn't block the tools list. The fix worked — the
  throw was caught, the list rendered. But Ajv ALSO does
  `logger.error(...)` with the failed function-code source _before_
  throwing, and the user saw a screenful of scary console traces and
  reported "does not work" even though it actually did. **Guardrail:**
  whenever wrapping a library to swallow errors, **also check the
  library's pre-throw logging side-effects**. Either route the logger
  to our own warning channel or no-op it. Catching the throw alone is
  not enough; the user's perception of correctness is also part of
  the fix. Verified at `node_modules/ajv/dist/compile/index.js` —
  Ajv's compile literally calls `this.logger.error(...)` then `throw e`.
- **2026-04-25 (also v1.1.4) — no version stamp made deploy
  verification a guessing game.** Costa: "we need to know the version
  somewhere. Otherwise I can't tell which version is it." For three
  rounds of the same DEC-024 bug report, neither of us could be sure
  whether the deploy was current or stale. **Guardrail:** every shipped
  app must surface version + build stamp to the user. As of v1.1.4
  the connection bar carries `v<version> · <git-sha>` with a build-
  timestamp tooltip. New surfaces (web, CLI, server) should adopt the
  same pattern.

- **2026-04-25 (after v1.1.4 / before v1.1.5) — silenced diagnostic
  output to fix a perception bug.** v1.1.4 muted Ajv's pre-throw
  `console.error` because v1.1.3's user said "does not work" while
  staring at it. Costa called this out the moment he tried to debug
  a real schema in the connected MCP server: the muted output was
  **the full generated validator code pointing at the broken
  keyword** — exactly the diagnostic he needed. Reverted in v1.1.5.
  **Guardrail:** do not conflate "user is confused by output" with
  "output is useless". When a user reports confusion alongside
  diagnostic data, the fix is almost always **clearer framing** (a
  better message in the user-facing surface, a "this is okay"
  affordance, a "what does this mean?" link) — not silencing the
  underlying signal. Diagnostic data goes to the developer's
  channel (browser console, server logs); user-facing framing goes
  to the user's channel (system log, toast, status pill); both
  audiences served, neither sacrificed.

- **2026-04-26 (six-release inline-coding bender) — slipped out of
  maintainer mode for an entire session.** Costa said "do as you
  please and finish them" for a stack of pending DECs. I shipped six
  releases (v1.1.14 → v1.1.19) inline — coding everything myself,
  no Worker briefs, no UX critic passes — and announced them as
  done. Costa caught the deployed version was actually v1.1.18 (one
  release was cancelled and I never verified), the Send / chevron
  alignment was off by pixels, and the prev/next log navigation
  jumped without any visible-row indication. Three concrete
  visible-surface defects that DEC-002's mandatory UX-critic pass
  would have caught before tag, and a release-vs-deploy mismatch
  that a five-second `curl https://…/index-*.js` check would have
  exposed.

  **Why this is the worst kind of regression for this project:**
  the whole point of the maintainer/worker/advisor split (DEC-000)
  is that **decisions stay with me, but doing goes to a Worker, and
  visible-surface judgement goes to the UX critic**. When I do all
  three myself I lose the verification pass that catches what my
  own attention to the implementation can't see. CLAUDE.md says
  this in plain text: "If you find yourself executing a checklist
  without judging whether each item produces user value, stop and
  re-enter Maintainer mode." I didn't.

  **Guardrails (additive — do not skip):**
  1. **Every visible-surface release is critic-gated.** Before any
     `git tag` for a release that touches the rendered UI, spawn
     the UX-critic via Agent and wait for the verdict. "Local
     tests + lint + build" is not a substitute. DEC-002 is not
     advisory.
  2. **"Released" requires a deploy verification.** After tagging,
     `curl` the deployed `index-*.js` filename and confirm it
     differs from the previous tag's filename, OR check the GH
     Pages workflow shows `success` for the tag's commit. Do this
     synchronously before reporting "shipped" — never claim a
     deploy I haven't verified.
  3. **No back-to-back releases without a critic pass between
     them.** Batching multiple visible-surface DECs into one
     critic pass is fine; batching multiple releases under "I'll
     run the critic later" is not. Later never comes.
  4. **When the user says "do it", that means do it
     properly** — not "skip the framework because you have
     permission". The framework exists to catch defects the
     maintainer alone misses; permission to ship doesn't waive it.
  5. **Maintainer mode is the default; it is also the easiest mode
     to drop out of when there's a queue of work.** When I notice
     the queue, that's the strongest signal to STOP and delegate,
     not to push faster.

- **2026-04-28 (SOW-0007 design forks) — surfaced numbered options to Costa for project-internal design decisions, against the Maintainer Charter.** Drafted SOW-0007 (tab active highlight) with three "Decision N — pick A/B/C" forks: variant choice, surface scope, hover/focus polish. Costa pushed back: _"I don't want to know or decide. You are the maintainer. You should do whatever is best for the project and its users."_ Global `~/.claude/CLAUDE.md` says "user designs, you code" + "User decisions must be written down to the SOW file" — but project `AGENTS.md` explicitly overrides for this repo: _"Decisions belong to you. Never ask him product or technical decisions."_ Inside `~/src/mcp-test-client.git/`, the project AGENTS.md wins.

  **Why this happened:** the global protocol's reflex (numbered options + recommendations) is correct in many of Costa's projects but _wrong here_. Inside this directory I am the maintainer, not the implementer. Asking the fork back is a contract breach against the Maintainer Charter, even when each fork has a recommendation attached.

  **Guardrail:** for any product / technical / UX / implementation design decision in mcp-test-client, decide in Maintainer mode and log the decision (in the SOW's "Implications and decisions" + a DEC-NNN if non-trivial). Never present "Decision N — pick A/B/C" for project-internal forks. The only legitimate Costa-asks in this repo:
  1. Strategic direction ("what should the project work on next").
  2. Credentials he uniquely owns.
  3. Destructive operations on his data.
  4. Feedback on the shipped result ("does this hit the bar?").

  Rule of thumb: if I can answer it by re-reading the specs / DECs / `values.md` / `quality-bar.md` and applying judgment, **I must**. Costa choosing between my A/B/C is not a question I'm allowed to ask him here.

- **Lesson — DEC-029 / v1.2.4 (Costa-direct UX feedback ship).**
  The first sign-off critic crashed at 521 s with API error 400
  "Could not process image". Re-spawning the critic with an explicit
  "no `_take_screenshot`, evidence via `_evaluate` + `_snapshot`"
  brief succeeded cleanly. Lesson:

  **Critic briefs default to evidence via `_evaluate` + `_snapshot`.**
  `_take_screenshot` is optional — the critic's verdict cites
  filenames but the embedding pipeline can still fail when the image
  payload trips the API. Falsifier evidence belongs in JSON returned
  from `_evaluate` (selector matches, computed styles, attribute
  values, toast counts), and in YAML returned from `_snapshot`
  (DOM tree). Screenshots are nice-to-have, not load-bearing.

  Add to every future critic brief: a short paragraph saying so, and
  a list of acceptable evidence forms ranked by reliability:
  1. `_evaluate` JSON (selector + computed style + attribute)
  2. `_snapshot` YAML (accessibility tree)
  3. `_take_screenshot` (filenames only — optional)
