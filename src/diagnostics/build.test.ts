import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildDiagnosticBundle, bundleToJson } from './build.ts';
import type { LogEntry } from '../state/log.tsx';

vi.stubGlobal('__APP_VERSION__', '1.2.3-test');

describe('buildDiagnosticBundle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:34:56Z'));
  });

  it('produces a bundle with the advertised shape', () => {
    const bundle = buildDiagnosticBundle({
      log: [],
      connection: null,
    });

    expect(bundle.bundleVersion).toBe(1);
    expect(bundle.tool).toBe('mcp-test-client');
    expect(bundle.appVersion).toBe('1.2.3-test');
    expect(bundle.capturedAt).toBe('2026-04-23T12:34:56.000Z');
    expect(bundle.environment.userAgent).toBeDefined();
    expect(bundle.connection).toBeNull();
    expect(bundle.log).toEqual([]);
  });

  it('redacts bearer token in the connection snapshot', () => {
    const bundle = buildDiagnosticBundle({
      log: [],
      connection: {
        status: 'connected',
        server: {
          id: 's1',
          name: 'Example',
          url: 'https://example.com/mcp',
          transport: 'streamable-http',
          auth: { kind: 'bearer', token: 'ghp_supersecret_token_abc' },
        },
        inventory: { tools: 3, prompts: 1, resources: 0, resourceTemplates: 0 },
      },
    });

    const serialised = JSON.stringify(bundle);
    expect(serialised).not.toContain('ghp_supersecret_token_abc');
    expect(bundle.connection?.server?.auth).toEqual({
      kind: 'bearer',
      tokenLength: 'ghp_supersecret_token_abc'.length,
      tokenPreview: 'gh…bc',
    });
  });

  it("preserves the wire log as-is (payloads are the user's responsibility)", () => {
    const entries: LogEntry[] = [
      {
        kind: 'wire',
        id: 1,
        direction: 'outgoing',
        timestamp: 123,
        message: { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} },
      },
      {
        kind: 'system',
        id: 2,
        level: 'error',
        timestamp: 456,
        text: 'WebSocket closed: code 1006',
      },
    ];

    const bundle = buildDiagnosticBundle({ log: entries, connection: null });

    expect(bundle.log).toHaveLength(2);
    expect(bundle.log[0]).toMatchObject({
      kind: 'wire',
      direction: 'outgoing',
      message: { method: 'tools/list' },
    });
    expect(bundle.log[1]).toMatchObject({
      kind: 'system',
      level: 'error',
      text: 'WebSocket closed: code 1006',
    });
  });

  it('carries the user note through', () => {
    const bundle = buildDiagnosticBundle({
      log: [],
      connection: null,
      note: 'tools/call returned empty content',
    });
    expect(bundle.note).toBe('tools/call returned empty content');
  });
});

describe('bundleToJson', () => {
  it('produces pretty-printed, round-trippable JSON', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T12:34:56Z'));
    const bundle = buildDiagnosticBundle({ log: [], connection: null });
    const json = bundleToJson(bundle);
    expect(json).toContain('\n  ');
    expect(JSON.parse(json)).toEqual(bundle);
  });
});
