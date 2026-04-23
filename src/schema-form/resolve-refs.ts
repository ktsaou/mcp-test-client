/**
 * $ref / $defs resolution against the schema root.
 *
 * We support only internal, fragment-style references (`#/$defs/foo`,
 * `#/definitions/foo`, `#/properties/...`). External URIs are returned as-is
 * and the caller must treat them as unresolvable (→ fallback field).
 *
 * Cycle detection is the caller's responsibility — each field component
 * tracks the set of `$ref`s it has already expanded along the current
 * render path and passes it down. When the same ref appears twice, the
 * field renders a "recursive" fallback instead of an infinite form tree.
 */

import type { JSONSchema } from './types.ts';

/**
 * Decode a single JSON-Pointer reference token (RFC 6901 §4).
 */
function decodeToken(token: string): string {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * Walk a JSON-Pointer fragment through `root`. Returns `undefined` if any
 * segment is missing.
 */
function walkPointer(root: unknown, pointer: string): unknown {
  if (pointer === '' || pointer === '/') return root;
  const parts = pointer.split('/').slice(1).map(decodeToken);
  let cur: unknown = root;
  for (const p of parts) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[p];
    if (cur === undefined) return undefined;
  }
  return cur;
}

/**
 * Resolve a `$ref` string against `root`. Only `#/...` fragments are
 * supported. Returns `undefined` when the ref can't be dereferenced (e.g.
 * external URI, broken pointer).
 */
export function resolveRef(ref: string, root: JSONSchema): JSONSchema | undefined {
  if (!ref.startsWith('#')) return undefined;
  const pointer = ref.slice(1);
  const target = walkPointer(root, pointer);
  if (target === null || typeof target !== 'object' || Array.isArray(target)) {
    return undefined;
  }
  return target as JSONSchema;
}

/**
 * Repeatedly follow `$ref` on `schema` until the top-level keyword is no
 * longer `$ref`. Mutates nothing. Returns `undefined` if any ref in the
 * chain can't be resolved, or if we revisit one we've already seen (cycle).
 *
 * The caller passes its `seen` set so nested renders can detect recursion
 * across field boundaries, not just inside a single deref call.
 */
export function derefSchema(
  schema: JSONSchema,
  root: JSONSchema,
  seen: Set<string> = new Set(),
): { schema: JSONSchema; cyclic: boolean } | undefined {
  let cur: JSONSchema = schema;
  const localSeen = new Set(seen);
  while (typeof cur.$ref === 'string') {
    const ref = cur.$ref;
    if (localSeen.has(ref)) {
      return { schema: cur, cyclic: true };
    }
    localSeen.add(ref);
    const next = resolveRef(ref, root);
    if (!next) return undefined;
    cur = next;
  }
  return { schema: cur, cyclic: false };
}
