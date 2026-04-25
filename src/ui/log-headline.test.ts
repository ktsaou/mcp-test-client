import { describe, expect, it } from 'vitest';

import {
  formatHeadline,
  headlineForRequest,
  headlineForResponse,
  isNotification,
  isRequest,
  isResponse,
  rpcId,
} from './log-headline.ts';
import type { JSONRPCMessage } from '../mcp/types.ts';

describe('headlineForRequest', () => {
  it('extracts the tool name for tools/call', () => {
    const msg: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'echo', arguments: { text: 'hi' } },
    };
    expect(headlineForRequest(msg)).toEqual({
      method: 'tools/call',
      discriminator: 'echo',
      isError: false,
    });
    expect(formatHeadline(headlineForRequest(msg))).toBe('tools/call · echo');
  });

  it('extracts the prompt name for prompts/get', () => {
    const msg: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 2,
      method: 'prompts/get',
      params: { name: 'greet', arguments: {} },
    };
    expect(formatHeadline(headlineForRequest(msg))).toBe('prompts/get · greet');
  });

  it('extracts the URI for resources/read', () => {
    const msg: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/read',
      params: { uri: 'file:///etc/hosts' },
    };
    expect(formatHeadline(headlineForRequest(msg))).toBe('resources/read · file:///etc/hosts');
  });

  it.each([
    ['tools/list'],
    ['prompts/list'],
    ['resources/list'],
    ['resources/templates/list'],
    ['initialize'],
    ['ping'],
  ])('does not append a discriminator for %s', (method) => {
    const msg: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method, params: {} };
    expect(formatHeadline(headlineForRequest(msg))).toBe(method);
  });

  it.each([['notifications/initialized'], ['notifications/cancelled'], ['notifications/progress']])(
    'does not append a discriminator for notification %s',
    (method) => {
      const msg: JSONRPCMessage = { jsonrpc: '2.0', method };
      expect(formatHeadline(headlineForRequest(msg))).toBe(method);
    },
  );

  it('handles missing params object gracefully', () => {
    const msg = { jsonrpc: '2.0', id: 1, method: 'tools/call' } as unknown as JSONRPCMessage;
    expect(formatHeadline(headlineForRequest(msg))).toBe('tools/call');
  });
});

describe('headlineForResponse', () => {
  it('reuses the paired request headline', () => {
    const req: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'echo' },
    };
    const res: JSONRPCMessage = { jsonrpc: '2.0', id: 1, result: {} };
    expect(formatHeadline(headlineForResponse(res, req))).toBe('tools/call · echo');
  });

  it('flags an error response', () => {
    const req: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'broken' },
    };
    const res: JSONRPCMessage = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -1, message: 'no such tool' },
    };
    expect(formatHeadline(headlineForResponse(res, req))).toBe('tools/call · broken (error)');
  });

  it('falls back to "response" for an orphan response', () => {
    const res: JSONRPCMessage = { jsonrpc: '2.0', id: 99, result: {} };
    expect(formatHeadline(headlineForResponse(res, undefined))).toBe('response');
  });
});

describe('rpcId / isRequest / isResponse / isNotification', () => {
  it('identifies a request', () => {
    const msg: JSONRPCMessage = { jsonrpc: '2.0', id: 1, method: 'ping' };
    expect(rpcId(msg)).toBe(1);
    expect(isRequest(msg)).toBe(true);
    expect(isResponse(msg)).toBe(false);
    expect(isNotification(msg)).toBe(false);
  });

  it('identifies a response', () => {
    const msg: JSONRPCMessage = { jsonrpc: '2.0', id: 1, result: {} };
    expect(rpcId(msg)).toBe(1);
    expect(isRequest(msg)).toBe(false);
    expect(isResponse(msg)).toBe(true);
    expect(isNotification(msg)).toBe(false);
  });

  it('identifies a notification', () => {
    const msg: JSONRPCMessage = { jsonrpc: '2.0', method: 'notifications/initialized' };
    expect(rpcId(msg)).toBeUndefined();
    expect(isRequest(msg)).toBe(false);
    expect(isResponse(msg)).toBe(false);
    expect(isNotification(msg)).toBe(true);
  });

  it('handles a string id', () => {
    const msg: JSONRPCMessage = { jsonrpc: '2.0', id: 'a-1', method: 'ping' };
    expect(rpcId(msg)).toBe('a-1');
    expect(isRequest(msg)).toBe(true);
  });
});
