# Working logs

One file per working day, named `YYYY-MM-DD.md`. Append the day's narrative as
it happens — what was said, what was decided, what was shipped, what was
learnt. File size is bounded by the day; we don't need a TOC.

## Five-section template

Every daily log file uses these sections, in order:

1. **Working session opens** — verbatim or close-paraphrase of the report,
   request, or feedback that kicked off the day, with attribution.
2. **Decisions taken** — links to each `DEC-NNN` file in
   [`../decisions/`](../decisions/) created or revised today, one-line
   rationale per link.
3. **Advisors run** — UX critic, framework analyst, spec purist, etc., with
   one-paragraph summary each and a link to where their report lives.
4. **Worker dispatched** — what brief went to which Worker, and the status at
   session close (in flight / merged / blocked).
5. **What I (the maintainer) learnt today** — methodology lessons. Where each
   lesson became a guardrail (which skill file under
   [`../skills/`](../skills/)).

## Where things flow

- Stable beliefs live in [`../skills/`](../skills/) (how we work) and in
  [`../product/`](../product/) (what we're building).
- Decisions land in [`../decisions/`](../decisions/) before code.
- Daily narrative lives here.

If a feedback item fires that a skill should have prevented, append to that
skill's "Lessons Learnt" with date + reason + the new guardrail. The skills
directory is the live brain.
