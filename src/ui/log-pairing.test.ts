import { describe, expect, it } from 'vitest';

import { applyFilter, findRequest, jsonByteLength, pairById } from './log-pairing.ts';
import type { LogEntry } from '../state/log.tsx';

function req(id: number, rpcId: number | string, method: string): LogEntry {
  return {
    kind: 'wire',
    id,
    direction: 'outgoing',
    timestamp: 1000 + id,
    message: { jsonrpc: '2.0', id: rpcId, method, params: {} },
  };
}

function res(id: number, rpcId: number | string, result: unknown = {}): LogEntry {
  return {
    kind: 'wire',
    id,
    direction: 'incoming',
    timestamp: 1000 + id,
    message: { jsonrpc: '2.0', id: rpcId, result } as unknown as LogEntry extends {
      kind: 'wire';
      message: infer M;
    }
      ? M
      : never,
  };
}

function note(id: number, method = 'notifications/initialized'): LogEntry {
  return {
    kind: 'wire',
    id,
    direction: 'incoming',
    timestamp: 1000 + id,
    message: { jsonrpc: '2.0', method },
  };
}

function sys(id: number, level: 'info' | 'warn' | 'error' = 'info'): LogEntry {
  return { kind: 'system', id, level, text: `m${id}`, timestamp: 1000 + id };
}

describe('pairById', () => {
  it('pairs a request with its matching response', () => {
    const entries = [req(1, 7, 'tools/list'), res(2, 7)];
    const pairs = pairById(entries);
    expect(pairs.get(1)).toBe(2);
    expect(pairs.get(2)).toBe(1);
  });

  it('does not pair a notification', () => {
    const entries = [req(1, 7, 'tools/list'), note(2), res(3, 7)];
    const pairs = pairById(entries);
    expect(pairs.get(1)).toBe(3);
    expect(pairs.get(3)).toBe(1);
    expect(pairs.has(2)).toBe(false);
  });

  it('handles id reuse without cross-pairing', () => {
    const entries = [
      req(1, 'a', 'tools/list'),
      res(2, 'a'),
      req(3, 'a', 'prompts/list'),
      res(4, 'a'),
    ];
    const pairs = pairById(entries);
    expect(pairs.get(1)).toBe(2);
    expect(pairs.get(2)).toBe(1);
    expect(pairs.get(3)).toBe(4);
    expect(pairs.get(4)).toBe(3);
  });

  it('leaves an unanswered request unpaired', () => {
    const entries = [req(1, 5, 'tools/list')];
    const pairs = pairById(entries);
    expect(pairs.has(1)).toBe(false);
  });
});

describe('applyFilter', () => {
  const entries = [
    req(1, 'a', 'tools/list'),
    res(2, 'a'),
    note(3),
    sys(4, 'info'),
    req(5, 'b', 'tools/call'),
  ];

  it('passes through everything for "all"', () => {
    expect(applyFilter(entries, 'all')).toHaveLength(5);
  });
  it('filters outgoing wire only', () => {
    const out = applyFilter(entries, 'outgoing');
    expect(out.map((e) => e.id)).toEqual([1, 5]);
  });
  it('filters incoming wire only', () => {
    const out = applyFilter(entries, 'incoming');
    expect(out.map((e) => e.id)).toEqual([2, 3]);
  });
  it('filters requests only (no responses, no notifications, no system)', () => {
    const out = applyFilter(entries, 'requests');
    expect(out.map((e) => e.id)).toEqual([1, 5]);
  });
  it('filters system only', () => {
    const out = applyFilter(entries, 'system');
    expect(out.map((e) => e.id)).toEqual([4]);
  });
});

describe('findRequest', () => {
  const entries = [
    sys(1),
    req(2, 'a', 'tools/list'),
    res(3, 'a'),
    note(4),
    req(5, 'b', 'tools/call'),
    res(6, 'b'),
    sys(7, 'warn'),
    req(8, 'c', 'prompts/get'),
  ];

  it('finds the next request from the start of the log', () => {
    expect(findRequest(entries, -1, 'next')).toBe(1); // index of req id 2
  });
  it('finds the next request, skipping non-requests', () => {
    expect(findRequest(entries, 1, 'next')).toBe(4); // skips res, note → req id 5
    expect(findRequest(entries, 4, 'next')).toBe(7); // skips res, sys → req id 8
  });
  it('returns -1 when there is no next request', () => {
    expect(findRequest(entries, 7, 'next')).toBe(-1);
  });
  it('finds the previous request', () => {
    expect(findRequest(entries, 7, 'prev')).toBe(4);
    expect(findRequest(entries, 4, 'prev')).toBe(1);
    expect(findRequest(entries, 1, 'prev')).toBe(-1);
  });
  it('finds the last request when starting from -1 backwards', () => {
    expect(findRequest(entries, -1, 'prev')).toBe(7);
  });
});

describe('jsonByteLength', () => {
  it('counts bytes of pretty-printed JSON', () => {
    const value = { a: 1 };
    // JSON.stringify(value, null, 2) → '{\n  "a": 1\n}' (12 bytes ASCII)
    expect(jsonByteLength(value)).toBe(JSON.stringify(value, null, 2).length);
  });
  it('counts UTF-8 bytes correctly for non-ASCII', () => {
    const value = { greeting: 'héllo' };
    // 'é' is 2 bytes in UTF-8.
    const expected = new TextEncoder().encode(JSON.stringify(value, null, 2)).byteLength;
    expect(jsonByteLength(value)).toBe(expected);
  });
});
