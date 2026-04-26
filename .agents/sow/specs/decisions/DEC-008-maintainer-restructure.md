# DEC-008 — Split the maintainer brain into per-day, per-skill, per-spec files (2026-04-25)

**Problem.** Three files (`product.md`, `feedback.md`, `decisions.md`) will
not scale. A year from now `feedback.md` is a 10 000-line single document I
will skim and miss things in. `decisions.md` is the same. `product.md` mixes
goals, the user, the quality bar, anti-goals, and design-system claims —
each grows at its own pace and pulls the file in different directions.
Costa's recurring feedback line is "if you don't write it down, you'll
forget" — single growing files are forgetting at scale.

A second symptom: the working framework has no "skills" layer. When the UX
critic told me to test mobile / share-link reload / bearer auth / 200+
messages, I had nowhere durable to put that. Today it's in `agents.md` as
a one-off addition; in three months it's lost.

**Options considered.**

- _Keep three growing files, add headers and a TOC._ Fails the scale test;
  papers over the underlying problem.
- _Split everything into one-file-per-thing._ Better, but no live narrative
  of what happened across a session, so context decays between sessions.
- _Two axes: live activity logs (per day), and stable knowledge (per skill,
  per decision, per spec)._ The activity log is _what happened_; the
  knowledge files are _what we now believe_. Feedback flows: an event lands
  in today's log, a guardrail lands in the relevant skill so it never
  happens again.

**Decision.** Adopt the two-axis layout:

```
maintainer/
├── README.md              — index of the directory
├── values.md              — short, focused user-value statement (~1 page)
├── log/
│   ├── README.md
│   └── YYYY-MM-DD.md      — one file per working day; what happened, who
│                            said what, what changed
├── decisions/
│   ├── README.md          — index of DECs with status
│   └── DEC-NNN-slug.md    — one file per ADR
├── skills/
│   ├── README.md          — index of skills
│   └── <job>.md           — one file per maintainer skill, with
│                            checklists and a Lessons Learnt section that
│                            grows with each feedback fold
├── product/
│   ├── README.md
│   ├── overview.md        — what we're building, for whom
│   ├── 60-second-flow.md  — canonical user journey
│   ├── quality-bar.md     — the visible-surface bar
│   ├── design-system.md   — Mantine v9, theme, typography, spacing
│   ├── differentiators.md
│   └── anti-goals.md
└── agents.md              — kept; the prompt-template store
```

Migration rule: every time _I_ edit a file in `maintainer/` for more than
typo-level changes, I stop and ask "should this be a worker brief?"
([`../skills/delegation.md`](../skills/delegation.md) captures the guardrail.)

Migration rule for feedback: when a user/advisor reports something, the
event entry lands in today's `log/`, and the guardrail lands in the
relevant `skills/` file so the same failure cannot recur silently. If no
skill exists for that failure mode, create one in the same edit.

**Falsifier.** If three months from now I am again opening
`feedback.md` to find anything, the split was wrong. Reconsider.

**Advisor sign-off.** None — process meta-decision. Triggered directly by
Costa's 2026-04-25 framework feedback.

**Status.** Active. Restructure delegated to a Worker in this session.
