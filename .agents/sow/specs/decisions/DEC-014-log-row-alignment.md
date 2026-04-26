# DEC-014 — Log-row alignment under squeeze (2026-04-25)

**Problem.** Costa flagged a layout bug the UX critic has missed across
three passes (DEC-012 first pass, DEC-013 patch pass, post-deploy prod
pass): when the log column is narrow, the metric chips
(`bytes · ms · ~tok`) push the copy and save buttons off the right
edge or out of horizontal alignment, so the action icons sit at a
different X offset on every row. The list looks broken; users mentally
scan a column of icons that doesn't actually form a column.

**The expectation it violated.** Across all rows in any list, the
right-edge action icons must sit at the same horizontal position
regardless of headline length, chip count, or container width.
Information density may flex; **button alignment may not**. Same
class as the v1.1 mobile-header overflow bug, on a different surface.

**Options considered.**

- _Wrap the chips below the headline when narrow._ Two-line rows. Hurts
  the scannability promise of "one row per entry". Reject.
- _Shrink the chip font / padding when narrow._ Eventually still
  collides with the buttons; only delays the same bug. Reject.
- _Hide the chips progressively when there isn't enough room._ The
  user retains row-alignment; the cost is "you have to expand to read
  the metric" at narrow widths. Accept — this matches Costa's stated
  preference: "the size/duration/tokens fold behind the 2 buttons …
  some information is truncated, instead of pushing the icons out of
  alignment or off the screen."

**Decision.** The log-row layout becomes:

```
[chevron] [dir] [time] [title (flex 1, ellipsis)] [chips (flex-shrink 1, overflow hidden)] [copy] [save] [pair-jump?]
```

Concretely, in CSS terms:

- Action-icon container (`copy`, `save`, `pair-jump`): `flex-shrink: 0`,
  fixed width, **always rendered**, always at the right edge.
- Chip group: `flex: 0 1 auto; overflow: hidden; min-width: 0`. When
  the row is narrow, individual chips drop one-by-one (largest /
  least-important first) until everything fits. Visual order:
  bytes (left, smallest, most-likely-to-survive) → ms → tokens (right,
  largest text, first to drop).
- Title (`method · discriminator`): `flex: 1 1 auto; min-width: 0;
text-overflow: ellipsis`. When the title is truncated by ellipsis,
  the row's `title` attribute carries the full method+discriminator
  so hover reveals it.

Implementation may use `ResizeObserver` on the log panel + per-row
class toggles (`.has-tokens .has-ms .has-bytes`), or pure CSS
container queries. Worker's call. Falsifier is unambiguous either way.

**Sub-item checklist:**

- [ ] At log-panel widths of 280, 320, 360, 400, 440, and 600 px,
      `getBoundingClientRect().right` of the copy button is identical
      across **every** wire row (allow ±0.5 px for sub-pixel rounding).
- [ ] At log-panel widths of 280, 320, 360, 400, 440, and 600 px,
      `getBoundingClientRect().right` of the save button is identical
      across every wire row.
- [ ] When chips drop, they drop in priority order: tokens first,
      then ms, then bytes.
- [ ] When the title ellipses, hover (or focus) reveals the full
      method+discriminator via the row `title` attribute.
- [ ] Action icons are visible (within the panel viewport) at every
      tested width down to 280 px.
- [ ] No row introduces horizontal scroll inside the log panel.

**Quality-bar update** (in [`../product/quality-bar.md`](../product/quality-bar.md)):
"The log is scannable" gains an explicit invariant: **action icons at
the right edge of every row share the same X offset; chips and titles
fold first when there's not enough room.**

**Skill / template update** (in [`../skills/ux-review.md`](../skills/ux-review.md)
and [`../agents.md`](../agents.md)): the new "alignment under squeeze"
mandatory scope. Resize the relevant panel to 280 / 320 / 360 / 400 px
and confirm the right-edge action icons share the same X offset across
all rows. This applies to any list-of-rows surface, not just the log.

**Falsifier.** A re-spawned UX critic narrows the log panel to 320 px
and `Array.from(document.querySelectorAll('.log-row [aria-label="copy as JSON"]')).map(b => b.getBoundingClientRect().right)` returns more
than one distinct value. Then the patch was wrong.

**Advisor sign-off.** Pending — UX critic re-pass with the new
"alignment under squeeze" scope per the updated template.

**Status.** Open. Worker brief drafts next; v1.1.2 push gated on
Worker delivering green pipeline + critic clearing the new scope.
