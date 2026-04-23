/**
 * `allOf` merger.
 *
 * We intentionally implement only the safe, no-surprise intersections the
 * spec lists (§5):
 *   - properties merge by key (right overrides left if both are objects;
 *     both are then recursively merged so defaults from multiple branches
 *     line up)
 *   - required: union
 *   - minimum/maximum: intersection (max of mins, min of maxes)
 *   - minLength/maxLength: same intersection rule as numeric bounds
 *   - type: if both set and different → conflict (caller falls back to raw JSON)
 *   - const: if both set and different → conflict
 *   - enum: intersection (values present in *every* branch)
 *
 * A `conflict` result tells the caller to render raw JSON with a warning.
 */

import type { JSONSchema } from './types.ts';
import { isPlainObject } from './types.ts';

export interface MergeResult {
  schema: JSONSchema;
  conflict: boolean;
  reason?: string;
}

/**
 * Merge a list of schemas under an `allOf`. Returns a freshly constructed
 * schema (never mutates inputs). On an unresolvable conflict, `conflict`
 * is true and the caller should fall back.
 */
export function mergeAllOf(branches: JSONSchema[]): MergeResult {
  if (branches.length === 0) return { schema: {}, conflict: false };
  if (branches.length === 1) {
    const first = branches[0];
    // branches[0] is defined because length === 1.
    return { schema: first ?? {}, conflict: false };
  }

  let acc: JSONSchema = {};
  for (const branch of branches) {
    const res = mergePair(acc, branch);
    if (res.conflict) return res;
    acc = res.schema;
  }
  return { schema: acc, conflict: false };
}

function mergePair(a: JSONSchema, b: JSONSchema): MergeResult {
  const out: JSONSchema = { ...a };

  // ── type ───────────────────────────────────────────────────────────────
  if (b.type !== undefined) {
    if (a.type !== undefined && !typesCompatible(a.type, b.type)) {
      return { schema: out, conflict: true, reason: 'type conflict' };
    }
    out.type = b.type;
  }

  // ── const ──────────────────────────────────────────────────────────────
  if (b.const !== undefined) {
    if (a.const !== undefined && !deepEqual(a.const, b.const)) {
      return { schema: out, conflict: true, reason: 'const conflict' };
    }
    out.const = b.const;
  }

  // ── enum: intersection ────────────────────────────────────────────────
  if (Array.isArray(b.enum)) {
    if (Array.isArray(a.enum)) {
      out.enum = a.enum.filter((v) => b.enum!.some((bv) => deepEqual(bv, v)));
      if (out.enum.length === 0) {
        return { schema: out, conflict: true, reason: 'enum intersection empty' };
      }
    } else {
      out.enum = [...b.enum];
    }
  }

  // ── required: union ────────────────────────────────────────────────────
  if (Array.isArray(a.required) || Array.isArray(b.required)) {
    const set = new Set<string>();
    (a.required ?? []).forEach((k) => set.add(k));
    (b.required ?? []).forEach((k) => set.add(k));
    out.required = [...set];
  }

  // ── properties: recursive merge per key ───────────────────────────────
  if (a.properties || b.properties) {
    const merged: Record<string, JSONSchema> = { ...(a.properties ?? {}) };
    for (const [key, bProp] of Object.entries(b.properties ?? {})) {
      const aProp = merged[key];
      if (aProp && isPlainObject(aProp) && isPlainObject(bProp)) {
        const nested = mergePair(aProp, bProp);
        if (nested.conflict) {
          return {
            schema: out,
            conflict: true,
            reason: `nested property \`${key}\`: ${nested.reason ?? 'conflict'}`,
          };
        }
        merged[key] = nested.schema;
      } else {
        merged[key] = bProp;
      }
    }
    out.properties = merged;
  }

  // ── numeric bounds: intersection ──────────────────────────────────────
  out.minimum = maxOf(a.minimum, b.minimum);
  out.maximum = minOf(a.maximum, b.maximum);
  out.exclusiveMinimum = maxOf(a.exclusiveMinimum, b.exclusiveMinimum);
  out.exclusiveMaximum = minOf(a.exclusiveMaximum, b.exclusiveMaximum);

  // ── string bounds: intersection ───────────────────────────────────────
  out.minLength = maxOf(a.minLength, b.minLength);
  out.maxLength = minOf(a.maxLength, b.maxLength);

  // ── array bounds: intersection ───────────────────────────────────────
  out.minItems = maxOf(a.minItems, b.minItems);
  out.maxItems = minOf(a.maxItems, b.maxItems);

  // ── title / description: prefer `b` but keep `a` as fallback ─────────
  if (b.title !== undefined) out.title = b.title;
  if (b.description !== undefined) out.description = b.description;

  // Other keys from b that we don't specifically handle — copy shallowly.
  for (const key of Object.keys(b)) {
    if (
      out[key] === undefined &&
      ![
        'type',
        'const',
        'enum',
        'required',
        'properties',
        'minimum',
        'maximum',
        'exclusiveMinimum',
        'exclusiveMaximum',
        'minLength',
        'maxLength',
        'minItems',
        'maxItems',
        'title',
        'description',
      ].includes(key)
    ) {
      out[key] = b[key];
    }
  }

  return { schema: out, conflict: false };
}

function typesCompatible(a: JSONSchema['type'], b: JSONSchema['type']): boolean {
  const aList = Array.isArray(a) ? a : [a];
  const bList = Array.isArray(b) ? b : [b];
  return aList.some((t) => bList.includes(t));
}

function maxOf(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.max(a, b);
}

function minOf(a: number | undefined, b: number | undefined): number | undefined {
  if (a === undefined) return b;
  if (b === undefined) return a;
  return Math.min(a, b);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ak = Object.keys(a);
    const bk = Object.keys(b);
    if (ak.length !== bk.length) return false;
    return ak.every((k) =>
      deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return false;
}
