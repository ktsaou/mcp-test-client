import { describe, it, expect } from 'vitest';

import { mergeAllOf } from './merge.ts';
import type { JSONSchema } from './types.ts';

describe('mergeAllOf', () => {
  it('merges properties from multiple branches', () => {
    const a: JSONSchema = {
      type: 'object',
      properties: { name: { type: 'string' } },
      required: ['name'],
    };
    const b: JSONSchema = {
      type: 'object',
      properties: { age: { type: 'integer' } },
      required: ['age'],
    };
    const result = mergeAllOf([a, b]);
    expect(result.conflict).toBe(false);
    expect(Object.keys(result.schema.properties ?? {})).toEqual(['name', 'age']);
    expect(result.schema.required?.sort()).toEqual(['age', 'name']);
  });

  it('intersects numeric bounds', () => {
    const r = mergeAllOf([
      { type: 'integer', minimum: 0, maximum: 100 },
      { type: 'integer', minimum: 10, maximum: 50 },
    ]);
    expect(r.schema.minimum).toBe(10);
    expect(r.schema.maximum).toBe(50);
  });

  it('intersects string length bounds', () => {
    const r = mergeAllOf([
      { type: 'string', minLength: 1, maxLength: 20 },
      { type: 'string', minLength: 5, maxLength: 10 },
    ]);
    expect(r.schema.minLength).toBe(5);
    expect(r.schema.maxLength).toBe(10);
  });

  it('conflicts on incompatible types', () => {
    const r = mergeAllOf([{ type: 'string' }, { type: 'number' }]);
    expect(r.conflict).toBe(true);
  });

  it('conflicts on incompatible consts', () => {
    const r = mergeAllOf([{ const: 'a' }, { const: 'b' }]);
    expect(r.conflict).toBe(true);
  });

  it('intersects enums', () => {
    const r = mergeAllOf([{ enum: ['a', 'b', 'c'] }, { enum: ['b', 'c', 'd'] }]);
    expect(r.schema.enum?.sort()).toEqual(['b', 'c']);
  });
});
