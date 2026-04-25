/**
 * Pure chip-drop logic for the log row (DEC-014).
 *
 * The log-row layout reserves fixed-width slots for the chevron, direction,
 * timestamp, action icons and (optionally) pair-jump on the right edge.
 * What's left between the title and the action icons is shared between the
 * title (flex-grow ellipsis) and the metrics chips. When the row narrows we
 * **drop chips, not buttons** — so the right-edge actions stay aligned across
 * every row regardless of headline length, chip count, or panel width.
 *
 * Drop priority is **tokens → ms → bytes**: tokens carry the widest text
 * (`1234 ~tok`), ms is medium (`123 ms`), bytes is shortest and most-likely
 * to survive (`12 B`). Each step preserves the smaller, more-survivable
 * chips first, matching DEC-014's "least-survivable first" rule.
 *
 * The breakpoints below were measured against the live row at the
 * Mantine v9 default xs density (compact-xs button, xs Badge, 8 px gap):
 *
 *   chevron       12 px
 *   direction     12 px
 *   timestamp    ~56 px (HH:MM:SS, tabular-nums)
 *   gaps (4×8)    32 px
 *   horizontal padding         24 px
 *   action icons (copy + save) 56 px
 *   pair-jump (when present)   ~30 px
 *   title minimum             ~80 px (room for "tools/call …")
 *                            ─────
 *                             ~282 px chrome floor
 *
 * Per chip width including the leading 4 px chip gap:
 *   bytes  ~52 px
 *   ms     ~52 px
 *   tokens ~78 px (the `~tok` suffix is the widest token)
 *
 * Levels:
 *   level 0 — all three chips                         row >= 380 px
 *   level 1 — drop tokens (keep bytes + ms)           row >= 320 px
 *   level 2 — drop tokens + ms (keep bytes only)      row >= 280 px
 *   level 3 — drop everything                         row <  280 px
 *
 * Numbers are conservative: at exactly 280 px the row still shows the bytes
 * chip alongside an ellipsed title without bumping the action icons.
 */

export type ChipLevel = 0 | 1 | 2 | 3;

export interface ChipVisibility {
  showBytes: boolean;
  showMs: boolean;
  showTokens: boolean;
}

/**
 * Width thresholds (inclusive lower bound) at which each level becomes the
 * active drop level. Below the lowest threshold every chip is hidden.
 *
 * Exported for the unit test so the spec stays in one place.
 */
export const CHIP_LEVEL_THRESHOLDS: { readonly level: ChipLevel; readonly minWidth: number }[] = [
  { level: 0, minWidth: 380 },
  { level: 1, minWidth: 320 },
  { level: 2, minWidth: 280 },
  { level: 3, minWidth: 0 },
];

/**
 * Map a row width in pixels to a chip-drop level. Rows narrower than the
 * smallest threshold drop every chip so the action icons remain flush right.
 */
export function chipLevelFor(rowWidth: number): ChipLevel {
  if (!Number.isFinite(rowWidth) || rowWidth <= 0) return 3;
  for (const t of CHIP_LEVEL_THRESHOLDS) {
    if (rowWidth >= t.minWidth) return t.level;
  }
  return 3;
}

/**
 * Translate a chip level into per-chip visibility flags. The drop order is
 * tokens → ms → bytes; the order is preserved across both this function and
 * the CSS selectors that consume `data-chip-level`.
 */
export function chipVisibilityFor(level: ChipLevel): ChipVisibility {
  switch (level) {
    case 0:
      return { showBytes: true, showMs: true, showTokens: true };
    case 1:
      return { showBytes: true, showMs: true, showTokens: false };
    case 2:
      return { showBytes: true, showMs: false, showTokens: false };
    case 3:
      return { showBytes: false, showMs: false, showTokens: false };
  }
}

/** Convenience composition for the unit test. */
export function computeChipVisibility(rowWidth: number): ChipVisibility {
  return chipVisibilityFor(chipLevelFor(rowWidth));
}
