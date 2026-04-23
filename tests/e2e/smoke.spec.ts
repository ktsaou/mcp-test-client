import { expect, test } from '@playwright/test';

const MOCK_MCP_URL = 'http://127.0.0.1:4321/mcp';

test.beforeEach(async ({ page }) => {
  // Start each test from a clean browser storage state.
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('loads, connects to mock server, and sees its tools', async ({ page }) => {
  await expect(page.getByText('MCP Test Client')).toBeVisible();

  await page.getByRole('button', { name: /\+ Add/ }).click();
  await page.getByLabel('URL', { exact: true }).fill(MOCK_MCP_URL);
  await page.getByLabel('Name', { exact: true }).fill('Mock');
  await page.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText('Mock').first()).toBeVisible();

  await page.getByRole('button', { name: 'Connect' }).click();

  await expect(page.locator('.pill--ok', { hasText: 'Connected' })).toBeVisible({
    timeout: 15_000,
  });

  // The mock exposes an "echo" and an "add" tool.
  await expect(page.getByText('echo').first()).toBeVisible();
  await expect(page.getByText('add').first()).toBeVisible();

  // Click echo → a JSON-RPC template should land in the textarea.
  await page.getByText('echo').first().click();
  const editor = page.locator('textarea.textarea');
  await expect(editor).toContainText('tools/call');
  await expect(editor).toContainText('"echo"');

  // Fire the request with the default empty arguments.
  // Fill in a string to exercise real content.
  const raw = await editor.inputValue();
  const patched = raw.replace(
    '"arguments": {}',
    '"arguments": { "text": "hi from test" }',
  );
  await editor.fill(patched);

  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.locator('.json-string', { hasText: 'hi from test' }).first()).toBeVisible({
    timeout: 10_000,
  });
});
