import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import { loadCatalog } from './loader.ts';

describe('loadCatalog', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function respondWith(body: unknown, ok = true): void {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok,
      json: () => Promise.resolve(body),
    } as unknown as Response);
  }

  it('returns an empty catalog when fetch fails', async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('net'));
    const cat = await loadCatalog();
    expect(cat).toEqual({ version: 1, servers: [] });
  });

  it('returns an empty catalog when the response is non-ok', async () => {
    respondWith({}, false);
    const cat = await loadCatalog();
    expect(cat.servers).toEqual([]);
  });

  it('parses a valid catalog', async () => {
    respondWith({
      version: 1,
      servers: [
        {
          id: 'ex-a',
          name: 'Example A',
          url: 'https://example.invalid/mcp',
          transport: 'streamable-http',
          description: 'A demo server.',
          tags: ['demo'],
          auth: 'none',
          addedAt: '2026-01-01',
          status: 'active',
        },
      ],
    });
    const cat = await loadCatalog();
    expect(cat.servers).toHaveLength(1);
    expect(cat.servers[0]?.id).toBe('ex-a');
  });

  it('drops malformed server entries without failing the load', async () => {
    respondWith({
      version: 1,
      servers: [
        {
          id: 'good',
          name: 'Good',
          url: 'https://x.invalid/mcp',
          transport: 'streamable-http',
          description: 'ok',
          auth: 'none',
          addedAt: '2026-01-01',
          status: 'active',
        },
        { id: 'broken' /* missing everything */ },
        42,
        null,
      ],
    });
    const cat = await loadCatalog();
    expect(cat.servers.map((s) => s.id)).toEqual(['good']);
  });
});
