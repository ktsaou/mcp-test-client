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

  // Click echo → the schema-driven form appears.
  await page.getByText('echo').first().click();

  // Fill the "text" field the tool declares as required.
  const textInput = page.locator('.shell__panel').last().getByRole('textbox').first();
  await textInput.fill('hi from test');

  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.locator('.json-string', { hasText: 'hi from test' }).first()).toBeVisible({
    timeout: 10_000,
  });
});
