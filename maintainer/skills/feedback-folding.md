# Skill — feedback folding

How to absorb a feedback report. User feedback is fact, not opinion. The
job is to identify the underlying expectation it violated and fold it into
the live brain so the same failure cannot recur silently.

## Checklist

1. **Capture the verbatim report** (or a faithful paraphrase) in today's
   [`../log/`](../log/) entry, with attribution.
2. **For each item, identify the violated expectation.** If the
   expectation isn't already stated in
   [`../product/quality-bar.md`](../product/quality-bar.md), add it.
3. **For each item, ask "which skill should have prevented this?"** Update
   that skill's "Lessons Learnt" with `date — what happened — new
guardrail`.
4. **If a skill doesn't exist for that failure mode, create one in this
   PR.** The skills directory is the live brain; gaps in it are
   pre-baked future failures.
5. **Open / update an issue or DEC for the fix.** Decisions land in
   [`../decisions/`](../decisions/) before code.

## Lessons Learnt

- **2026-04-25 — No place to fold guardrails.** Costa's seven-point
  report came in with no place to fold guardrails until I established
  this skill structure. The information was scattered across `product.md`
  §4 and ad-hoc additions to `agents.md`. **Guardrail:** this skill
  itself, codified by
  [`../decisions/DEC-008-maintainer-restructure.md`](../decisions/DEC-008-maintainer-restructure.md).
