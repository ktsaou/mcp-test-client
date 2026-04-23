import { describe, expect, it } from 'vitest';

import { redactServer, tokenPreview } from './redact.ts';

describe('tokenPreview', () => {
  it('returns empty string for empty input', () => {
    expect(tokenPreview('')).toBe('');
  });

  it('returns ellipsis for short strings (< 8 chars)', () => {
    expect(tokenPreview('abc')).toBe('…');
    expect(tokenPreview('1234567')).toBe('…');
  });

  it('shows first-2 + last-2 for strings >= 8 chars', () => {
    expect(tokenPreview('abcdefgh')).toBe('ab…gh');
    expect(tokenPreview('ghp_abcdefghijklmnop')).toBe('gh…op');
  });
});

describe('redactServer', () => {
  const base = {
    id: 's1',
    name: 'Example',
    url: 'https://example.com/mcp',
    transport: 'streamable-http' as const,
  };

  it('passes through none-auth untouched', () => {
    const out = redactServer({ ...base, auth: { kind: 'none' } });
    expect(out.auth).toEqual({ kind: 'none' });
  });

  it('treats missing auth as none', () => {
    const out = redactServer(base);
    expect(out.auth).toEqual({ kind: 'none' });
  });

  it('redacts a bearer token to length + preview', () => {
    const out = redactServer({
      ...base,
      auth: { kind: 'bearer', token: 'ghp_supersecret_token_abc' },
    });
    expect(out.auth).toEqual({
      kind: 'bearer',
      tokenLength: 'ghp_supersecret_token_abc'.length,
      tokenPreview: 'gh…bc',
    });
  });

  it('redacts a custom header value', () => {
    const out = redactServer({
      ...base,
      auth: { kind: 'header', name: 'X-Api-Key', value: 'secret12345' },
    });
    expect(out.auth).toEqual({
      kind: 'header',
      name: 'X-Api-Key',
      valueLength: 11,
      valuePreview: 'se…45',
    });
  });

  it('never includes the raw secret anywhere in the redacted object', () => {
    const raw = 'do-not-leak-this-token-anywhere';
    const out = redactServer({ ...base, auth: { kind: 'bearer', token: raw } });
    const serialised = JSON.stringify(out);
    expect(serialised).not.toContain(raw);
  });

  it('does not mutate the input object', () => {
    const input = { ...base, auth: { kind: 'bearer' as const, token: 'abc12345' } };
    const frozenBefore = JSON.stringify(input);
    redactServer(input);
    expect(JSON.stringify(input)).toBe(frozenBefore);
  });
});
