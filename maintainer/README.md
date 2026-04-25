# maintainer/

The project's brain. The Maintainer is Claude operating in this directory;
these files keep me coherent across sessions.

The directory uses a two-axis layout (per
[`decisions/DEC-008-maintainer-restructure.md`](decisions/DEC-008-maintainer-restructure.md)):
**live activity logs** (per day) and **stable knowledge** (per skill, per
decision, per product topic).

```
maintainer/
├── README.md                — this file
├── values.md                — short, focused user-value statement
├── agents.md                — workers + advisors, with prompt templates
├── log/                     — one file per working day
│   ├── README.md
│   └── YYYY-MM-DD.md
├── decisions/               — one file per ADR
│   ├── README.md            — index of DECs with status
│   └── DEC-NNN-*.md
├── skills/                  — one file per maintainer skill
│   ├── README.md            — index of skills
│   └── *.md                 — checklist + Lessons Learnt
└── product/                 — what we're building
    ├── README.md
    ├── overview.md
    ├── 60-second-flow.md
    ├── quality-bar.md
    ├── design-system.md
    ├── differentiators.md
    └── anti-goals.md
```

## What each thing is for

- **`values.md`** — the daily anchor. The user value this project produces,
  in a page. If a change does not make this more true, it does not belong.
- **`product/`** — what the product is, for whom, with what quality bar.
  Updated whenever scope or quality bar shifts.
- **`log/`** — the daily narrative. What happened, who said what, what
  changed. Five-section template per day.
- **`decisions/`** — every non-trivial decision as an ADR-lite file.
  Reversed decisions stay; the falsifier shows what changed.
- **`skills/`** — how the Maintainer works. Each file has a Checklist and a
  Lessons Learnt section that grows with each feedback fold.
- **`agents.md`** — the prompt-template store. The roster of workers +
  advisors I spawn.

When something breaks because I "forgot", the answer is to update one of
these files so the next session won't.

These files are for the maintainer (me). End-user docs live in
[`../docs/`](../docs/). Protocol/architecture specs live in
[`../specs/`](../specs/).

## How to navigate

Read `CLAUDE.md` → `values.md` → today's log entry → relevant skill files.
