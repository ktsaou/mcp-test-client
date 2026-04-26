import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  assertNoSecrets,
  buildShareUrl,
  createDebouncedUrlWriter,
  parse,
  pushUrlState,
  serialize,
  stripManagedParams,
  URL_PARAM_KEYS,
  type UrlState,
} from './url-state.ts';

describe('url-state.serialize', () => {
  it('returns empty for an empty state', () => {
    expect(serialize({})).toBe('');
  });

  it('emits known params in stable order', () => {
    const s = serialize({
      server: 'srv-1',
      tool: 'echo',
      args: { text: 'hi' },
      mode: 'form',
      logFilter: 'wire',
    });
    expect(s.startsWith('?')).toBe(true);
    const params = new URLSearchParams(s.slice(1));
    expect(params.get('server')).toBe('srv-1');
    expect(params.get('tool')).toBe('echo');
    expect(typeof params.get('args')).toBe('string');
    expect(params.get('mode')).toBe('form');
    expect(params.get('log_filter')).toBe('wire');
  });

  it('omits args for empty objects (keep URLs short)', () => {
    const s = serialize({ server: 'a', tool: 't', args: {} });
    expect(s.includes('args=')).toBe(false);
  });

  it('round-trips args through base64url', () => {
    const args = { libraryName: 'react', filters: { lang: 'tsx' }, n: 3 };
    const s = serialize({ server: 's', tool: 't', args });
    const parsed = parse(s);
    expect(parsed.args).toEqual(args);
  });

  it('round-trips unicode in args', () => {
    const args = { greeting: 'héllo 世界 🚀' };
    const s = serialize({ server: 's', tool: 't', args });
    const parsed = parse(s);
    expect(parsed.args).toEqual(args);
  });
});

describe('url-state.parse', () => {
  it('ignores junk params we do not own', () => {
    const parsed = parse('?other=1&foo=bar');
    expect(parsed).toEqual({});
  });

  it('falls back cleanly on malformed args + warns', () => {
    const warnings: string[] = [];
    const parsed = parse('?server=s&tool=t&args=zzzz', {
      onWarn: (m) => warnings.push(m),
    });
    expect(parsed.args).toBeUndefined();
    expect(parsed.server).toBe('s');
    expect(parsed.tool).toBe('t');
    expect(warnings).toEqual(['Ignoring malformed `args` URL parameter']);
  });

  it('falls back on valid base64 that is not JSON', () => {
    const warnings: string[] = [];
    // base64url for "hello"
    const parsed = parse('?args=aGVsbG8', { onWarn: (m) => warnings.push(m) });
    expect(parsed.args).toBeUndefined();
    expect(warnings).toHaveLength(1);
  });

  it('only accepts known mode values', () => {
    expect(parse('?mode=raw').mode).toBe('raw');
    expect(parse('?mode=form').mode).toBe('form');
    expect(parse('?mode=banana').mode).toBeUndefined();
  });

  it('only accepts known log filters', () => {
    expect(parse('?log_filter=errors').logFilter).toBe('errors');
    expect(parse('?log_filter=lol').logFilter).toBeUndefined();
  });

  it('accepts a leading ? or no prefix', () => {
    expect(parse('?server=a').server).toBe('a');
    expect(parse('server=a').server).toBe('a');
  });
});

describe('url-state.assertNoSecrets', () => {
  it('rejects a URL containing the active bearer token', () => {
    const url = 'https://example.com/?args=eyJ0b2tlbiI6InRlc3QtdG9rZW4tWFlaIn0';
    // The base64 above decodes to {"token":"test-token-XYZ"} but we
    // assert against the raw URL the bearer token might also appear
    // in plainly. Inline the token as a plain substring here so the
    // guard's verbatim check trips.
    const dirty = url + '#test-token-XYZ';
    expect(() => assertNoSecrets(dirty, { kind: 'bearer', token: 'test-token-XYZ' })).toThrow(
      /bearer token/,
    );
  });

  it('rejects a URL containing the active header value', () => {
    expect(() =>
      assertNoSecrets('https://example.com/?x=secret-value-123', {
        kind: 'header',
        name: 'X-Api-Key',
        value: 'secret-value-123',
      }),
    ).toThrow(/header value/);
  });

  it('rejects a URL containing the literal string "bearer"', () => {
    expect(() => assertNoSecrets('https://x/?h=Bearer-foo', { kind: 'none' })).toThrow();
  });

  it('rejects a URL containing "authorization"', () => {
    expect(() => assertNoSecrets('https://x/?authorization=foo', { kind: 'none' })).toThrow();
  });

  it('lets clean URLs through', () => {
    expect(() =>
      assertNoSecrets('https://example.com/?server=s&tool=add&args=eyJhIjoxfQ', {
        kind: 'bearer',
        token: 'test-token-XYZ',
      }),
    ).not.toThrow();
  });

  it('skips the auth check when auth is undefined', () => {
    expect(() =>
      assertNoSecrets('https://example.com/?server=s&tool=add', undefined),
    ).not.toThrow();
  });

  it('does not trip on empty token strings', () => {
    expect(() =>
      assertNoSecrets('https://example.com/', { kind: 'bearer', token: '' }),
    ).not.toThrow();
  });
});

describe('url-state.stripManagedParams', () => {
  it('removes our params and keeps siblings', () => {
    const s = stripManagedParams('?add=https://x/y&server=a&tool=t&args=zz&unknown=keep');
    const params = new URLSearchParams(s.slice(1));
    expect(params.get('add')).toBe('https://x/y');
    expect(params.get('unknown')).toBe('keep');
    expect(params.get('server')).toBeNull();
    expect(params.get('tool')).toBeNull();
    expect(params.get('args')).toBeNull();
  });

  it('returns empty when only managed params were present', () => {
    expect(stripManagedParams('?server=a&tool=t')).toBe('');
  });
});

describe('url-state.URL_PARAM_KEYS', () => {
  it('uses log_filter (snake_case) on the wire', () => {
    expect(URL_PARAM_KEYS.logFilter).toBe('log_filter');
  });
});

describe('url-state.pushUrlState + buildShareUrl', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    window.history.replaceState(null, '', '/');
  });

  it('replaces the URL with our managed query, preserving siblings', () => {
    window.history.replaceState(null, '', '/?add=https://existing/');
    pushUrlState({ server: 'a', tool: 't' }, undefined, 'replace');
    expect(window.location.search).toContain('add=https');
    expect(window.location.search).toContain('server=a');
    expect(window.location.search).toContain('tool=t');
  });

  it('drops our params when the state is empty', () => {
    window.history.replaceState(null, '', '/?server=old&tool=old');
    pushUrlState({}, undefined);
    expect(window.location.search).toBe('');
  });

  it('refuses to write a URL containing the active token', () => {
    // The token appears verbatim in the `tool` slice — that is the
    // literal-substring exfiltration path the secrets guard catches.
    // (Args are base64url-encoded, so a token tucked inside formValue
    // does NOT trip the literal substring check; that is by design.)
    expect(() =>
      pushUrlState(
        { server: 'a', tool: 'leaked-XYZ-tool' },
        { kind: 'bearer', token: 'leaked-XYZ-tool' },
      ),
    ).toThrow();
  });

  it('buildShareUrl returns origin + pathname + query + hash', () => {
    window.history.replaceState(null, '', '/path#frag');
    const url = buildShareUrl({ server: 'a' });
    expect(url.endsWith('/path?server=a#frag')).toBe(true);
  });
});

describe('url-state.createDebouncedUrlWriter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('coalesces rapid schedule calls into one push at 200 ms', () => {
    const writer = createDebouncedUrlWriter();
    writer.schedule({ server: 'a', tool: 'one' }, undefined);
    writer.schedule({ server: 'a', tool: 'two' }, undefined);
    writer.schedule({ server: 'a', tool: 'three' }, undefined);
    expect(window.location.search).toBe('');
    vi.advanceTimersByTime(199);
    expect(window.location.search).toBe('');
    vi.advanceTimersByTime(1);
    expect(window.location.search).toContain('tool=three');
  });

  it('flush forces an immediate write of the latest state', () => {
    const writer = createDebouncedUrlWriter();
    writer.schedule({ server: 'a', tool: 'echo' } satisfies UrlState, undefined);
    writer.flush();
    expect(window.location.search).toContain('tool=echo');
  });

  it('cancel drops a pending write', () => {
    const writer = createDebouncedUrlWriter();
    writer.schedule({ server: 'a', tool: 'echo' }, undefined);
    writer.cancel();
    vi.advanceTimersByTime(500);
    expect(window.location.search).toBe('');
  });

  it('swallows secret-guard throws so the subscriber never crashes', () => {
    const writer = createDebouncedUrlWriter();
    // Token surfaces directly in the tool slice — verbatim substring
    // hit. The debounced writer must swallow the throw, leaving the
    // URL unchanged.
    writer.schedule(
      { server: 'a', tool: 'leaked-XYZ-tool' },
      { kind: 'bearer', token: 'leaked-XYZ-tool' },
    );
    vi.advanceTimersByTime(250);
    expect(window.location.search).toBe('');
  });
});
