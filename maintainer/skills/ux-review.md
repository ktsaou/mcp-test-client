# Skill — UX review

How to run a UX-critic pass. Mandatory before merging any change to a
user-visible surface (per
[`../decisions/DEC-002-ux-advisor-mandatory.md`](../decisions/DEC-002-ux-advisor-mandatory.md)).

## Checklist

1. **Spawn the UX-critic template** from [`../agents.md`](../agents.md).
2. **Provide:**
   - The live URL (or local dev build URL).
   - A link to [`../product/quality-bar.md`](../product/quality-bar.md)
     — that is the standard the critic grades against.
   - A link to today's [`../log/`](../log/) entry.
   - A real public MCP server URL the critic can connect to (from
     `public/public-servers.json`), or a documented mock.
3. **Demand:** §3-flow walkthrough; quality-bar pass/partial/fail table;
   top-5 painful issues; top-3 things-already-good (so we don't
   regress); verdict (ship / no-ship); prompt-improvement suggestion.
4. **Capture the verdict in the relevant DEC file** — not just in the
   log. The log records the event; the DEC records the conclusion.

The critic must test these scopes by default (added 2026-04-25):

- iPhone-size viewport (390×844).
- Share-link reload in a fresh incognito tab.
- Bearer-token auth flow.
- 200+ messages in the log (scroll perf).

## Lessons Learnt

- **2026-04-25 — Prompt scope was too narrow.** The critic's
  prompt-improvement suggestion was that I had not specified mobile,
  share-link reload, bearer auth, or 200+ message log. **Guardrail:**
  those four scopes are now defaults in the UX-critic template in
  [`../agents.md`](../agents.md), and listed above.
