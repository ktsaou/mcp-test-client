/**
 * DEC-015 / SOW-0005 Chunk B — share-link recipient flow.
 *
 * The four flows we exercise here mirror the acceptance criteria in
 * SOW-0005:
 *
 *   B.1 — server missing → ServerMissingModal → Add server persists
 *   B.2 — connection error (bad URL) → ConnectionFailedModal carries
 *         the error message
 *   B.3 — tool not found → ToolNotFoundModal → Open as raw drops the
 *         JSON-RPC envelope into the raw editor
 *   B.4 — schema mismatch (negative): the form's existing Ajv 8
 *         validation surfaces the mismatch inline; NO modal opens
 *
 * The tests construct share-link hashes by importing the project's
 * encoder via `page.evaluate`'s dynamic import — keeping the encoding
 * scheme single-sourced. The mock MCP server (port 4321) provides
 * `echo` (text:string) and `add` (a:number, b:number).
 */

import { expect, test } from '@playwright/test';

const MOCK_MCP_URL = 'http://127.0.0.1:4321/mcp';

interface ShareInputState {
  v: 1;
  url: string;
  tool?: string;
  args?: unknown;
  raw?: string;
}

/**
 * Build a share-link URL by re-using the same compression scheme the
 * app's encoder uses (deflate-raw, base64url, prefixed `s=`). The
 * encoding contract is defined in `specs/shareable-urls.md` and
 * asserted by `src/share-url/encode.test.ts` — if the contract
 * changes, both sides update together.
 *
 * Implemented in Node (not the browser) so callers can build the URL
 * before any page navigation happens. Doing this in the browser would
 * force a `page.goto('/')` round-trip and the subsequent navigation
 * to `/#...` would be a hash-change — bypassing the share-url-loader
 * entirely (the loader's one-shot `consumedRef` is set on first
 * mount and the React app does not remount on hash-only changes).
 */
async function buildShareUrl(state: ShareInputState): Promise<string> {
  const json = JSON.stringify(state);
  let bytes: Uint8Array;
  try {
    const { promisify } = await import('node:util');
    const { deflateRaw } = await import('node:zlib');
    const compressed = await promisify(deflateRaw)(Buffer.from(json, 'utf8'));
    bytes = new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
  } catch {
    bytes = new TextEncoder().encode(json);
  }
  const b64 = Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `/#s=${b64}`;
}

// We deliberately do NOT pre-load `/` and reload here — `page.goto(url)`
// to a new path-with-hash inside the same origin is treated as a hash
// change (no full reload), so the share-url-loader's one-shot
// `consumedRef` would already be `true` from the first navigation and
// the loader would skip the hash. Each test below clears localStorage
// via `addInitScript` so the catalog auto-merge state starts fresh.

test.beforeEach(async ({ page }) => {
  // Wipe localStorage on the FIRST script execution of every page
  // load — this runs before our app boots, so neither the catalog
  // auto-merge nor any prior test's residue can survive into this
  // test's run.
  await page.addInitScript(() => {
    try {
      localStorage.clear();
    } catch {
      /* ignore — happy in incognito */
    }
  });
});

test('B.1 — server-missing modal opens for unknown URL; Add persists the server', async ({
  page,
}) => {
  const url = await buildShareUrl({
    v: 1,
    url: MOCK_MCP_URL,
    tool: 'echo',
    args: { text: 'hello' },
  });

  await page.goto(url);

  // The modal title verifies the resolver surfaced the server-missing
  // state; the URL appears in the body.
  await expect(page.getByText('Add a server to open this link')).toBeVisible();
  await expect(page.getByText(MOCK_MCP_URL).first()).toBeVisible();

  await page.getByRole('button', { name: 'Add server and continue' }).click();

  // A real ServerEntry for the shared URL now lives in localStorage —
  // the catalog auto-merge runs alongside, so we look up our entry by
  // URL rather than asserting on stored[0].
  type StoredEntry = { url?: string };
  const stored = await page.evaluate<StoredEntry[]>(() => {
    const raw = localStorage.getItem('mcptc:servers');
    return raw ? (JSON.parse(raw) as StoredEntry[]) : [];
  });
  expect(Array.isArray(stored)).toBe(true);
  const entry = stored.find((e) => e?.url === MOCK_MCP_URL);
  expect(entry).toBeDefined();
  expect(entry?.url).toBe(MOCK_MCP_URL);

  // Sidebar shows the new server.
  await expect(page.getByText('127.0.0.1:4321').first()).toBeVisible();
});

test('B.2 — connection-error modal carries the error message for an unreachable URL', async ({
  page,
}) => {
  // Pre-seed a server entry whose URL deliberately fails fast
  // (port 1 is reserved, the browser fails the request immediately).
  // We seed via `addInitScript` AFTER our beforeEach `localStorage.clear()`
  // init script — Playwright runs init scripts in registration order
  // — so the entry is in storage before the React app boots and the
  // share-url-loader sees the URL as already known.
  const badUrl = 'http://127.0.0.1:1/mcp';
  await page.addInitScript((u: string) => {
    localStorage.setItem(
      'mcptc:servers',
      JSON.stringify([
        {
          id: 'bad',
          url: u,
          name: 'bad',
          transport: 'streamable-http',
          auth: { kind: 'none' },
          addedAt: 1,
          lastUsed: null,
        },
      ]),
    );
  }, badUrl);

  const url = await buildShareUrl({
    v: 1,
    url: badUrl,
    tool: 'echo',
    args: { text: 'hi' },
  });

  await page.goto(url);

  // The loader hands the parsed payload to the resolver; with the
  // entry already saved we skip the server-missing modal and land on
  // 'connecting'. The user has to click Connect themselves (security
  // spec — no auto-connect).
  await expect(page.getByRole('button', { name: 'Connect' })).toBeVisible();
  await page.getByRole('button', { name: 'Connect' }).click();

  // Connect fails, the resolver flips to 'connection-error' and
  // ConnectionFailedModal opens with the live error message.
  await expect(page.getByText('Connection failed')).toBeVisible({ timeout: 15_000 });
  // The Alert region shows the actual error from the SDK; we don't
  // pin the exact wording (it varies across Chromium versions) but
  // any non-empty message must appear.
  const alertText = await page.locator('[role="alert"]').first().textContent();
  expect(alertText && alertText.trim().length > 0).toBeTruthy();
});

test('B.3 — tool-not-found modal opens; Open as raw drops the envelope into the raw editor', async ({
  page,
}) => {
  const url = await buildShareUrl({
    v: 1,
    url: MOCK_MCP_URL,
    tool: 'does-not-exist',
    args: { foo: 'bar' },
  });

  await page.goto(url);

  // First the server-missing modal (the URL isn't yet stored).
  await expect(page.getByText('Add a server to open this link')).toBeVisible();
  await page.getByRole('button', { name: 'Add server and continue' }).click();

  // Now click Connect — the security spec requires manual connect.
  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });

  // Inventory loaded, tool absent → tool-not-found modal opens.
  await expect(page.getByText('Tool not found on this server')).toBeVisible();
  await expect(page.getByText('does-not-exist')).toBeVisible();

  await page.getByRole('button', { name: 'Open as raw JSON-RPC anyway' }).click();

  // The raw editor (a Mantine Textarea inside the request panel) now
  // carries the envelope. Look up the request panel and find the
  // first textarea — request-panel.tsx renders it in raw mode.
  const requestPanel = page.locator('#request[data-panel]');
  const textarea = requestPanel.locator('textarea').first();
  await expect(textarea).toBeVisible();
  const value = await textarea.inputValue();
  expect(value).toContain('"method": "tools/call"');
  expect(value).toContain('"name": "does-not-exist"');
  expect(value).toContain('"foo": "bar"');
});

test('B.4 (negative) — schema mismatch shows form-level Ajv errors; NO modal opens', async ({
  page,
}) => {
  // The mock's `echo` tool requires `text: string` (required). Send a
  // share link whose args carry a `number` instead — the form must
  // surface the validation error inline; no precondition modal pops.
  const url = await buildShareUrl({
    v: 1,
    url: MOCK_MCP_URL,
    tool: 'echo',
    args: { text: 42 },
  });

  await page.goto(url);

  await expect(page.getByText('Add a server to open this link')).toBeVisible();
  await page.getByRole('button', { name: 'Add server and continue' }).click();

  await page.getByRole('button', { name: 'Connect' }).click();
  await expect(page.getByText('Connected', { exact: true })).toBeVisible({ timeout: 15_000 });

  // The tool exists on the server, so the resolver advances to
  // 'loaded' and seeds the inbox; the request panel applies it. The
  // form attempts to render the args; clicking Send must trigger
  // Ajv validation and surface the mismatch inline.
  // Crucially, the tool-not-found modal must NOT appear.
  await expect(page.getByText('Tool not found on this server')).toHaveCount(0);
  await expect(page.getByText('Connection failed')).toHaveCount(0);
  await expect(page.getByText('Add a server to open this link')).toHaveCount(0);

  // The selection should land on the `echo` tool — confirm it's
  // visible in the request panel header.
  await expect(page.locator('#request[data-panel]').getByText('echo').first()).toBeVisible();
});

test('A — share-link with two pre-existing servers: sidebar / banner / URL / storage all flip to the share-linked server (DEC-015 Part A regression)', async ({
  page,
}) => {
  // SOW-0005 Chunk A regression test. The v1.1.2 UX-critic observation
  // was that a recipient with pre-existing servers in localStorage saw
  // the sidebar's `data-active=true` row stay on a previously-clicked
  // entry while the request panel correctly drove the shared server's
  // tool. The bug is empirically gone on v1.2.6+ (likely closed by
  // DEC-026 URL-as-state); this test codifies that so any future
  // regression is caught.
  //
  // Pre-seed: two servers, srv-a active, srv-b inactive. Navigate to
  // the share link for srv-b. After settle: every active-server source
  // (sidebar `data-active`, connection-bar banner, URL `?server=`,
  // localStorage `mcptc:servers:active`) must point at srv-b.
  await page.addInitScript((mockUrl: string) => {
    const now = Date.now();
    localStorage.setItem(
      'mcptc:servers',
      JSON.stringify([
        {
          id: 'srv-a',
          name: 'Alpha',
          url: 'http://127.0.0.1:9999/a',
          transport: 'streamable-http',
          auth: { kind: 'none' },
          addedAt: now,
          lastUsed: null,
        },
        {
          id: 'srv-b',
          name: 'Beta',
          url: mockUrl,
          transport: 'streamable-http',
          auth: { kind: 'none' },
          addedAt: now,
          lastUsed: null,
        },
      ]),
    );
    localStorage.setItem('mcptc:servers:active', JSON.stringify('srv-a'));
  }, MOCK_MCP_URL);

  const url = await buildShareUrl({
    v: 1,
    url: MOCK_MCP_URL,
    tool: 'echo',
    args: { text: 'hello' },
  });

  await page.goto(url);

  // The loader sees srv-b's URL in the seeded list, calls setActive('srv-b'),
  // and resolves down the chain. The four active-server sources must agree
  // by the time the resolver settles.

  // 1. Sidebar's data-active row points at srv-b ("Beta").
  await expect(
    page.locator('aside a.mantine-NavLink-root[data-active="true"]').filter({ hasText: 'Beta' }),
  ).toBeVisible({ timeout: 5_000 });
  // Conversely, srv-a's row is no longer data-active.
  await expect(
    page.locator('aside a.mantine-NavLink-root[data-active="true"]').filter({ hasText: 'Alpha' }),
  ).toHaveCount(0);

  // 2. localStorage active key reflects srv-b.
  const activeId = await page.evaluate(() => {
    const raw = localStorage.getItem('mcptc:servers:active');
    return raw ? (JSON.parse(raw) as string) : null;
  });
  expect(activeId).toBe('srv-b');

  // 3. The URL (after the share-link consumer rewrites it) carries
  // ?server=srv-b — DEC-026 URL-as-state contract.
  await expect.poll(() => page.url(), { timeout: 5_000 }).toMatch(/[?&]server=srv-b\b/);
});
