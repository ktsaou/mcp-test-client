import { describe, it, expect } from 'vitest';

import { derefSchema, resolveRef } from './resolve-refs.ts';
import type { JSONSchema } from './types.ts';

describe('resolveRef', () => {
  const root: JSONSchema = {
    $defs: {
      person: { type: 'object', properties: { name: { type: 'string' } } },
      weird: { 'with/slash': { type: 'boolean' } } as unknown as JSONSchema,
    },
  };

  it('resolves simple fragments', () => {
    const r = resolveRef('#/$defs/person', root);
    expect(r?.type).toBe('object');
  });

  it('decodes RFC-6901 escapes', () => {
    const r = resolveRef('#/$defs/weird/with~1slash', root);
    expect(r?.type).toBe('boolean');
  });

  it('returns undefined on broken fragments', () => {
    expect(resolveRef('#/$defs/missing', root)).toBeUndefined();
  });

  it('returns undefined on external refs', () => {
    expect(resolveRef('https://example.com/schema', root)).toBeUndefined();
  });
});

describe('derefSchema', () => {
  it('follows a chain of $refs', () => {
    const root: JSONSchema = {
      $defs: {
        a: { $ref: '#/$defs/b' },
        b: { type: 'string' },
      },
    };
    const r = derefSchema({ $ref: '#/$defs/a' }, root);
    expect(r?.cyclic).toBe(false);
    expect(r?.schema.type).toBe('string');
  });

  it('detects cycles', () => {
    const root: JSONSchema = {
      $defs: {
        node: { $ref: '#/$defs/node' },
      },
    };
    const r = derefSchema({ $ref: '#/$defs/node' }, root);
    expect(r?.cyclic).toBe(true);
  });
});
