/**
 * DEC-014 — log-row alignment under squeeze.
 *
 * The contract: across every row in the log panel, the right-edge action
 * icons (copy, save, pair-jump when present) sit at the same X offset
 * regardless of headline length, chip count, or panel width. Information
 * folds first; buttons do not.
 *
 * This test drives a real browser session against the mock MCP server,
 * generates 5+ wire entries, then narrows the viewport (mobile single-pane
 * layout, where the log fills the viewport) to each of the widths called
 * out by the DEC-014 sub-checklist: 280, 320, 360, 400, 440, 600 px.
 *
 * Falsifier (per DEC-014): if `getBoundingClientRect().right` of the copy
 * (or save) button returns more than one distinct value across all rows
 * at any of those widths, the patch failed.
 */

import { expect, test } from '@playwright/test';

const MOCK_MCP_URL = 'http://127.0.0.1:4321/mcp';
const TEST_WIDTHS = [280, 320, 360, 400, 440, 600] as const;
const ALIGNMENT_TOLERANCE_PX = 0.5;

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('right-edge action icons stay aligned across rows from 280 px to 600 px', async ({ page }) => {
  // Start on the desktop layout to add the server, then we'll squeeze it.
  await page.setViewportSize({ width: 1200, height: 900 });

  await expect(page.getByText('MCP Test Client')).toBeVisible();

  await page.getByRole('button', { name: 'Add' }).click();
  await page.getByPlaceholder('https://example.com/mcp or wss://…').fill(MOCK_MCP_URL);
  await page.getByPlaceholder('Friendly name (optional)').fill('Mock');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Mock').first()).toBeVisible();

  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });

  // Generate >= 5 wire entries: initialize + tools/list happen on connect,
  // then we call echo three times so the log has request + response pairs
  // with a mix of headline lengths. The third call uses a long discriminator
  // to stress the title ellipsis path.
  await expect(page.getByText('echo').first()).toBeVisible();
  await page.getByText('echo').first().click();

  for (const text of ['hi', 'hello world', 'a longer payload to make the row interesting']) {
    const textInput = page.locator('#request[data-panel]').getByRole('textbox').first();
    await textInput.fill(text);
    await page.getByRole('button', { name: 'Send' }).click();
    // Wait for the corresponding response to land in the log before sending
    // the next one.
    await expect(page.locator('.json-string', { hasText: text }).first()).toBeVisible({
      timeout: 10_000,
    });
  }

  // Switch to mobile single-pane layout so the log occupies the full
  // viewport at every test width. The mobile breakpoint in the app is
  // 768 px (see layout.tsx), so 280–600 px all land in mobile mode.
  await page.setViewportSize({ width: 600, height: 900 });
  // Wait for the mobile tab strip to render, then activate the Log tab.
  await page.getByRole('tab', { name: 'Log' }).click();

  for (const width of TEST_WIDTHS) {
    await test.step(`width ${width}px`, async () => {
      await page.setViewportSize({ width, height: 900 });
      // Allow the ResizeObserver + container queries to settle.
      await page.waitForTimeout(150);

      // The panel root must exist and report a chip-level matching the
      // width threshold. We don't pin the exact level here (CSS is the
      // source of truth) but we do confirm the attribute is set.
      const panel = page.locator('[data-log-panel-root="1"]');
      await expect(panel).toBeVisible();
      const chipLevel = await panel.getAttribute('data-chip-level');
      expect(chipLevel).toMatch(/^[0-3]$/);

      // Sub-item 1 + 2: copy and save buttons must share their X offset
      // across every wire row.
      const copyRights = await page
        .locator('.log-row [aria-label="copy as JSON"]')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
      expect(copyRights.length).toBeGreaterThanOrEqual(5);
      assertAligned(copyRights, `copy buttons @ ${width}px`);

      const saveRights = await page
        .locator('.log-row [aria-label="save as JSON file"]')
        .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
      expect(saveRights.length).toBeGreaterThanOrEqual(5);
      assertAligned(saveRights, `save buttons @ ${width}px`);

      // Sub-item 5: action icons stay within the panel viewport.
      const panelRect = await panel.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: r.left, right: r.right };
      });
      for (const x of copyRights) {
        expect(x).toBeLessThanOrEqual(panelRect.right + ALIGNMENT_TOLERANCE_PX);
        expect(x).toBeGreaterThanOrEqual(panelRect.left);
      }
      for (const x of saveRights) {
        expect(x).toBeLessThanOrEqual(panelRect.right + ALIGNMENT_TOLERANCE_PX);
        expect(x).toBeGreaterThanOrEqual(panelRect.left);
      }

      // Sub-item 6: no horizontal scrollbar inside the log panel. We only
      // care about elements that actually create their own scroll context
      // (overflow: auto / scroll), not children whose layout box is wider
      // than the parent — flex-shrink: 0 children intentionally do that
      // without producing a scrollbar.
      const overflow = await panel.evaluate((el) => {
        const offenders: { tag: string; cls: string; sw: number; cw: number }[] = [];
        const candidates: Element[] = [el, ...Array.from(el.querySelectorAll('*'))];
        for (const c of candidates) {
          if (!(c instanceof HTMLElement)) continue;
          const overflowX = getComputedStyle(c).overflowX;
          if (overflowX !== 'auto' && overflowX !== 'scroll') continue;
          if (c.scrollWidth > c.clientWidth + 0.5) {
            offenders.push({
              tag: c.tagName,
              cls: c.className.toString().slice(0, 80),
              sw: c.scrollWidth,
              cw: c.clientWidth,
            });
          }
        }
        return offenders;
      });
      expect(overflow, `no horizontal scroll inside log panel @ ${width}px`).toEqual([]);
    });
  }
});

function assertAligned(values: number[], label: string): void {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min > ALIGNMENT_TOLERANCE_PX) {
    throw new Error(
      `${label}: expected all values within ${ALIGNMENT_TOLERANCE_PX}px; ` +
        `got min=${min} max=${max} spread=${(max - min).toFixed(2)}px values=${JSON.stringify(values)}`,
    );
  }
}
