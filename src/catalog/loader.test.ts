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

  // DEC-033 / SOW-0006 — `instructions` and `instructions_url` are
  // optional string fields. The loader is defensive: schema enforces
  // length / URI; loader only requires `typeof === 'string'`.
  it('keeps a valid instructions string', async () => {
    respondWith({
      version: 1,
      servers: [
        {
          id: 'auth-a',
          name: 'Auth A',
          url: 'https://a.invalid/mcp',
          transport: 'streamable-http',
          description: 'auth required',
          auth: 'bearer',
          instructions: 'Generate a token at example.com → Profile → Tokens.',
          addedAt: '2026-04-28',
          status: 'active',
        },
      ],
    });
    const cat = await loadCatalog();
    expect(cat.servers[0]?.instructions).toBe(
      'Generate a token at example.com → Profile → Tokens.',
    );
    expect(cat.servers[0]?.instructions_url).toBeUndefined();
  });

  it('keeps a valid instructions_url string', async () => {
    respondWith({
      version: 1,
      servers: [
        {
          id: 'auth-b',
          name: 'Auth B',
          url: 'https://b.invalid/mcp',
          transport: 'streamable-http',
          description: 'auth required',
          auth: 'bearer',
          instructions_url: 'https://example.com/docs/auth',
          addedAt: '2026-04-28',
          status: 'active',
        },
      ],
    });
    const cat = await loadCatalog();
    expect(cat.servers[0]?.instructions_url).toBe('https://example.com/docs/auth');
    expect(cat.servers[0]?.instructions).toBeUndefined();
  });

  it('drops non-string instructions / instructions_url silently', async () => {
    respondWith({
      version: 1,
      servers: [
        {
          id: 'auth-c',
          name: 'Auth C',
          url: 'https://c.invalid/mcp',
          transport: 'streamable-http',
          description: 'auth required',
          auth: 'bearer',
          instructions: 42,
          instructions_url: { hostile: true },
          addedAt: '2026-04-28',
          status: 'active',
        },
      ],
    });
    const cat = await loadCatalog();
    // Entry survives — only the bad fields are dropped.
    expect(cat.servers).toHaveLength(1);
    expect(cat.servers[0]?.id).toBe('auth-c');
    expect(cat.servers[0]?.instructions).toBeUndefined();
    expect(cat.servers[0]?.instructions_url).toBeUndefined();
  });

  it('entry without either field still parses', async () => {
    respondWith({
      version: 1,
      servers: [
        {
          id: 'no-instr',
          name: 'No instructions',
          url: 'https://d.invalid/mcp',
          transport: 'streamable-http',
          description: 'auth required',
          auth: 'oauth',
          addedAt: '2026-04-28',
          status: 'active',
        },
      ],
    });
    const cat = await loadCatalog();
    expect(cat.servers).toHaveLength(1);
    expect(cat.servers[0]?.instructions).toBeUndefined();
    expect(cat.servers[0]?.instructions_url).toBeUndefined();
  });
});
