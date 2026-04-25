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
- Share-link reload in a fresh incognito tab — **explicitly verify the
  reconstructed scope: server, selected tool, method, and arguments
  must all come back. Anything less is a falsifier on
  [`../values.md`](../values.md)'s "share a reproducible tool call"
  promise.**
- Bearer-token auth flow — verify the token round-trips into the
  `Authorization` header on the network tab.
- 200+ messages in the log (scroll perf, JS heap growth).
- **Modal a11y end-to-end:** Esc closes, focus is trapped, **and
  Enter on the primary input submits**. The third one is easy to
  miss; verify it explicitly.
- **Alignment under squeeze.** For any list-of-rows surface (today: the
  log), resize its container to 280 / 320 / 360 / 400 px and confirm
  the **right-edge action icons share the same X offset across every
  row** (collect `getBoundingClientRect().right` on each per-row icon;
  the set must contain a single value, ±0.5 px). When content competes
  with the action icons for horizontal space, the **content folds**
  (truncates with ellipsis or progressively hides chips), the
  **buttons do not move**. This is the surface a critic walking
  visually misses repeatedly — make the measurement explicit.

## Lessons Learnt

- **2026-04-25 — Prompt scope was too narrow.** The critic's
  prompt-improvement suggestion was that I had not specified mobile,
  share-link reload, bearer auth, or 200+ message log. **Guardrail:**
  those four scopes are now defaults in the UX-critic template in
  [`../agents.md`](../agents.md), and listed above.
- **2026-04-25 (later) — "Share-link reload" was too vague.** Without
  spelling out _what_ must reconstruct, the v1.1 candidate silently
  shipped server-only restoration while
  [`../values.md`](../values.md) promises tool-call restoration. The
  critic flagged this themselves. **Guardrail:** the share-link scope
  is now spelled out (server + selected tool + method + arguments),
  not just "verify it works".
- **2026-04-25 (later) — "Modal a11y" was treated as one item.** The
  critic verified Esc + focus-trap (passes) but Enter-submit was
  missed in the implementation, and only the critic's manual probe
  caught it. **Guardrail:** Enter-submit is now a separate explicit
  scope, not lumped under "modal a11y".
- **2026-04-25 (still later) — "Mobile collapse" was scoped only to
  the panel area.** The DEC-010 brief said "panel collapse" and the
  critic's first pass implicitly assumed the header was fine because
  it didn't overflow at 1440 px. The patch fixed the panels but the
  header `<Group wrap="wrap">` still wrapped Connect/theme-toggle
  onto a second row at narrow widths, physically occluding the new
  tab strip. **Guardrail:** mobile-scope now demands verifying the
  header at 360 / 390 / 414 px in both Idle and Connected, and that
  no header element overlays the panel area.
- **2026-04-25 (after v1.1.1 prod ship) — log-row alignment under
  squeeze.** Three critic passes walked the log panel and never
  resized it narrow enough to surface the layout bug Costa flagged:
  metric chips push the copy/save buttons off-screen at narrow
  column widths, breaking the per-row right-edge alignment. Same
  pattern as the mobile-header miss, on a different surface.
  **Guardrail:** the new "alignment under squeeze" mandatory scope
  above. Every list-of-rows surface gets the icon-X-offset
  measurement at 280–400 px; a single distinct value is required.
