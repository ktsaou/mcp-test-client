# DEC-012 — v1.1.1: "the log, fixed" (2026-04-25)

**Problem.** Costa's 2026-04-25 follow-up flagged five items, three of
which v1.1 missed:

1. Response size + duration + estimated tokens not visible
   ([DEC-009](DEC-009-response-metrics.md), already deferred).
2. **Log scroll → prev/next request navigation** missing.
3. Per-message copy-as-JSON exists but is hover-only — not discoverable.
4. **Timestamp + direction icon waste left-margin width**, especially on
   narrow screens.
5. **NEW:** each entry needs a bold method-summary headline; per-entry
   collapse/expand; global Collapse-all / Expand-all so the user can scan
   the flow.

The first UX-critic pass on v1.0 had already noted #4 ("on narrow screens
timestamp + direction icon waste width"); I marked it as a v1.1.1
borderline rather than as a quality-bar item. The "feedback-folding"
skill now requires multi-part bullets to split per-piece — the related
skills/feedback-folding.md update is part of this same fix.

**Sub-item checklist** (per the new feedback-folding rule, every row must
be ticked or explicitly deferred-with-date):

- [ ] (1) Response size in bytes shown on each entry.
- [ ] (1) End-to-end duration in ms shown on each entry.
- [ ] (1) Estimated tokens (gpt-tokenizer / o200k_base) shown on each
      entry.
- [ ] (1) Same three metrics in the request panel's "Last result" view.
- [ ] (2) Prev-request / next-request buttons in the log toolbar.
- [ ] (2) Keyboard shortcuts: `j` next, `k` prev (matches Gmail/Linear
      conventions).
- [ ] (3) Copy-as-JSON button always visible per entry (not hover-only).
- [ ] (3) Save-as-file button always visible per entry.
- [ ] (3) Both emit the original raw JSON via `JSON.stringify(value, null, 2)`.
- [ ] (4) Timestamp + direction live inline in the headline; no
      fixed-width left column pushing content right.
- [ ] (5) Bold method-summary headline (`<method> · <discriminator>`).
- [ ] (5) Per-entry collapse/expand. Default collapsed.
- [ ] (5) Global "Collapse all" / "Expand all" buttons in the log
      toolbar.

**Direction.**

The log row becomes a row inside an accordion-like collapsible. Default
collapsed; expanding reveals the full JSON via the existing `<JsonView>`
(DEC-003 newline rendering preserved).

Headline shape, single row at compact density:

```
[▾]  ←  17:24:31   tools/call · echo                    312 B · 42 ms · 78 ~tok   [⎘] [⤓]
```

Where:

- `[▾]` toggle for collapse/expand.
- `←` / `→` direction glyph; small, no fixed-width left column.
- `17:24:31` timestamp inline, dimmed, monospaced for column-alignment-
  by-eye, not by layout.
- **`tools/call · echo`** is the bold method-summary headline. Discriminator
  comes from `params.name` (tools/call, prompts/get) or `params.uri`
  (resources/read) or `result.protocolVersion` (initialize) — mechanical
  per `method`.
- `312 B · 42 ms · 78 ~tok` are the three metrics chips (DEC-009).
  Tokens labelled `~tok` to communicate "estimate" honestly.
- `[⎘]` copy-as-JSON, `[⤓]` save-as-file. Always-visible; small icon
  buttons in the headline row.

System messages (info/warn/error from the connection layer) get the same
shape but with a `•` glyph instead of the direction arrow and no metrics
chips.

Toolbar additions (existing log header):

- `[Expand all] [Collapse all] [↑ prev] [↓ next] [filter ▾]`.
- `j` / `k` keyboard handlers scoped to focus-within the log section.
- "Filter" defaults to "All"; options All / Outgoing / Incoming /
  Requests-only / System.
- "Auto-collapse system" preference persisted in localStorage.

**Tokenizer choice (carry-over from DEC-009).** `gpt-tokenizer` with
`o200k_base`. ~25 KB gz; fits inside the [DEC-005](DEC-005-bundle-budget.md)
budget (current headroom: 82 KB). Label every token chip explicitly with
`~tok` to communicate "estimate, not authoritative".

**Performance note.** Tokenizing every response synchronously on the main
thread is fine up to ~50 KB responses per the perf analyst from DEC-009.
For larger responses, do it lazy on expand (the headline shows `— B / —
ms / — tok` until the entry is expanded the first time, with the chip
filling in once the work completes). Don't ship a Web Worker until a
real perf complaint lands.

**Falsifier.** A user runs the §3 60-second flow and the §3 step-5
(reading a multi-paragraph response) and afterwards cannot answer:
"how many bytes was that response, how long did it take, roughly how
many tokens, and where in the log was it relative to the request?"
without opening DevTools or hovering. Then the redesign was wrong.

**Advisor sign-off.** Pending. Spawn the UX critic against the dev
build per [`../skills/ui-surface-change.md`](../skills/ui-surface-change.md);
critic must verify every checked row above against the live UI. Spawn
a perf analyst if the on-expand tokenizer call introduces visible
jank (subjective; the analyst will measure).

**Status.** Open. Worker brief drafted next; v1.1.1 ships when every
checklist row is ticked AND the UX-critic pass is clean AND a fresh
prod-deploy critic pass clears the same.

**Out of scope (still deferred).** Light-theme contrast on log
timestamps will resolve naturally with the redesign (timestamp moves to
the headline; new colour will be picked from Mantine tokens). ARIA
`valuemin > valuemax` on the third panel separator stays a
v1.1.x-or-later cleanup. Log virtualization is still deferred —
collapsing-by-default removes most of the heap pressure (the body is
the heavy cost), so virtualization may not be needed; revisit after
this lands.
