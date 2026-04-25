# Skill — feedback folding

How to absorb a feedback report. User feedback is fact, not opinion. The
job is to identify the underlying expectation it violated and fold it into
the live brain so the same failure cannot recur silently.

## Checklist

1. **Capture the verbatim report** (or a faithful paraphrase) in today's
   [`../log/`](../log/) entry, with attribution.
2. **Split multi-part bullets.** A single feedback line of the form
   "no X / no Y / no Z" is _three_ user needs, not one. Track each
   sub-item independently in the log and in the resolving DEC. **A
   resolving DEC must contain a checklist with one row per sub-item.**
   "Implemented elsewhere" or "rolled into the broader fix" only counts
   when each sub-item is named individually as a checked row.
3. **For each item, identify the violated expectation.** If the
   expectation isn't already stated in
   [`../product/quality-bar.md`](../product/quality-bar.md), add it.
4. **For each item, ask "which skill should have prevented this?"**
   Update that skill's "Lessons Learnt" with `date — what happened —
new guardrail`.
5. **If a skill doesn't exist for that failure mode, create one in this
   PR.** The skills directory is the live brain; gaps in it are
   pre-baked future failures.
6. **Open / update an issue or DEC for the fix.** Decisions land in
   [`../decisions/`](../decisions/) before code.
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
  [`../decisions/DEC-008-maintainer-restructure.md`](../decisions/DEC-008-maintainer-restructure.md).
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
