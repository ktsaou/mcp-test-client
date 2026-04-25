/**
 * Unit tests for the chip-drop logic (DEC-014).
 *
 * The DEC-014 sub-checklist requires that at log-panel widths of 280, 320,
 * 360, 400, 440, and 600 px the chips drop in priority order
 * (tokens → ms → bytes). These tests pin that contract so the e2e visual
 * check has a deterministic floor to land on.
 */

import { describe, expect, it } from 'vitest';

import {
  chipLevelFor,
  chipVisibilityFor,
  computeChipVisibility,
  CHIP_LEVEL_THRESHOLDS,
} from './log-chip-visibility.ts';

describe('chipLevelFor — DEC-014', () => {
  it('returns level 0 (all chips) at the wide end of the spectrum', () => {
    expect(chipLevelFor(600)).toBe(0);
    expect(chipLevelFor(440)).toBe(0);
    expect(chipLevelFor(400)).toBe(0);
    expect(chipLevelFor(380)).toBe(0);
  });

  it('returns level 1 (drop tokens) between 320 and 380 px', () => {
    expect(chipLevelFor(379)).toBe(1);
    expect(chipLevelFor(360)).toBe(1);
    expect(chipLevelFor(320)).toBe(1);
  });

  it('returns level 2 (drop tokens + ms) between 280 and 320 px', () => {
    expect(chipLevelFor(319)).toBe(2);
    expect(chipLevelFor(300)).toBe(2);
    expect(chipLevelFor(280)).toBe(2);
  });

  it('returns level 3 (drop everything) below 280 px or for invalid input', () => {
    expect(chipLevelFor(279)).toBe(3);
    expect(chipLevelFor(0)).toBe(3);
    expect(chipLevelFor(-1)).toBe(3);
    expect(chipLevelFor(Number.NaN)).toBe(3);
  });

  it('thresholds are sorted descending and cover every level once', () => {
    const widths = CHIP_LEVEL_THRESHOLDS.map((t) => t.minWidth);
    expect(widths).toEqual([...widths].sort((a, b) => b - a));
    const levels = CHIP_LEVEL_THRESHOLDS.map((t) => t.level).sort();
    expect(levels).toEqual([0, 1, 2, 3]);
  });
});

describe('chipVisibilityFor — DEC-014 drop order', () => {
  it('level 0 keeps bytes + ms + tokens', () => {
    expect(chipVisibilityFor(0)).toEqual({ showBytes: true, showMs: true, showTokens: true });
  });

  it('level 1 drops tokens first', () => {
    expect(chipVisibilityFor(1)).toEqual({ showBytes: true, showMs: true, showTokens: false });
  });

  it('level 2 drops tokens, then ms — bytes survives longest', () => {
    expect(chipVisibilityFor(2)).toEqual({ showBytes: true, showMs: false, showTokens: false });
  });

  it('level 3 drops every chip', () => {
    expect(chipVisibilityFor(3)).toEqual({ showBytes: false, showMs: false, showTokens: false });
  });
});

describe('computeChipVisibility — sub-item checklist widths', () => {
  // The exact widths the DEC-014 e2e test will exercise. We pin the chip
  // visibility at each so a regression that flips the drop order shows up
  // here even when the e2e harness isn't available.
  it.each([
    [600, { showBytes: true, showMs: true, showTokens: true }],
    [440, { showBytes: true, showMs: true, showTokens: true }],
    [400, { showBytes: true, showMs: true, showTokens: true }],
    [360, { showBytes: true, showMs: true, showTokens: false }],
    [320, { showBytes: true, showMs: true, showTokens: false }],
    [280, { showBytes: true, showMs: false, showTokens: false }],
  ])('width %d px → %o', (width, expected) => {
    expect(computeChipVisibility(width)).toEqual(expected);
  });
});
