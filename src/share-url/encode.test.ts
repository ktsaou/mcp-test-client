import { describe, it, expect } from 'vitest';

import { decodeShareState, encodeShareState, type ShareState } from './encode.ts';

describe('shareable URL encoder', () => {
  it('round-trips a minimal state', async () => {
    const state: ShareState = { v: 1, url: 'https://example.com/mcp' };
    const encoded = await encodeShareState(state);
    expect(encoded.startsWith('s=')).toBe(true);
    const decoded = await decodeShareState(encoded);
    expect(decoded).toEqual(state);
  });

  it('round-trips a full state', async () => {
    const state: ShareState = {
      v: 1,
      url: 'https://example.com/mcp',
      t: 'streamable-http',
      tool: 'echo',
      args: { text: 'hi', nested: { a: 1, b: [true, null] } },
      connect: true,
    };
    const decoded = await decodeShareState(await encodeShareState(state));
    expect(decoded).toEqual(state);
  });

  it('accepts a leading #', async () => {
    const state: ShareState = { v: 1, url: 'https://example.com/mcp' };
    const encoded = '#' + (await encodeShareState(state));
    const decoded = await decodeShareState(encoded);
    expect(decoded).toEqual(state);
  });

  it('returns null on junk', async () => {
    expect(await decodeShareState('')).toBeNull();
    expect(await decodeShareState('s=%%%')).toBeNull();
    expect(await decodeShareState('s=aGVsbG8')).toBeNull(); // valid base64, not JSON
  });

  it('returns null on wrong version', async () => {
    const payload = btoa(JSON.stringify({ v: 99, url: 'https://x.y/mcp' }));
    const decoded = await decodeShareState('s=' + payload);
    expect(decoded).toBeNull();
  });
});
