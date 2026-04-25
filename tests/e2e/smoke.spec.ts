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

  await page.getByRole('button', { name: 'Add' }).click();
  // Mantine renders required-field labels as "URL *", so match by placeholder
  // which is stable.
  await page.getByPlaceholder('https://example.com/mcp or wss://…').fill(MOCK_MCP_URL);
  await page.getByPlaceholder('Friendly name (optional)').fill('Mock');
  await page.getByRole('button', { name: 'Save', exact: true }).click();

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

  // Fill the "text" field the tool declares as required. The request panel
  // is the last main panel — find the first textbox inside it.
  const textInput = page.locator('#request[data-panel]').getByRole('textbox').first();
  await textInput.fill('hi from test');

  await page.getByRole('button', { name: 'Send' }).click();

  await expect(page.locator('.json-string', { hasText: 'hi from test' }).first()).toBeVisible({
    timeout: 10_000,
  });
});
