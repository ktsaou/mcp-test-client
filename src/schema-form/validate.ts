/**
 * Thin wrapper around `@cfworker/json-schema` so the form can surface
 * validation errors without leaking validator internals into every field
 * component.
 *
 * History: this module previously used Ajv 8 with the 2020-12 dialect.
 * Ajv compiles validators by generating JavaScript at runtime, which
 * our deployed Content Security Policy (`script-src 'self'`, no
 * `'unsafe-eval'`) blocks. Every Ajv compile threw, so the form's
 * gate degraded to "Schema compile error" for every tool. We now use
 * `@cfworker/json-schema` (the same library the MCP SDK ships as its
 * alternative for edge runtimes), which interprets schemas at runtime
 * with no runtime code generation, no CSP conflict. See DEC-024 for
 * the full story.
 *
 * Validators are cached per schema-object identity (WeakMap) — a new
 * validator is constructed only when the schema reference changes.
 */

import { Validator, type OutputUnit } from '@cfworker/json-schema';

import type { JSONSchema } from './types.ts';

const validatorCache = new WeakMap<object, Validator>();

function getValidator(schema: JSONSchema): Validator {
  const cached = validatorCache.get(schema);
  if (cached) return cached;
  // 2020-12 matches the dialect used by Ajv 2020 in the previous
  // implementation. shortCircuit:false matches Ajv's `allErrors:true` —
  // surface every failure so the form can render them per-field, not
  // just the first one.
  const validator = new Validator(schema, '2020-12', false);
  validatorCache.set(schema, validator);
  return validator;
}

export interface ValidationFailure {
  path: string;
  message: string;
}

/**
 * Validate `value` against `schema`. Returns `null` on success, or a list
 * of `{ path, message }` tuples on failure.
 */
export function validate(schema: JSONSchema, value: unknown): ValidationFailure[] | null {
  const v = getValidator(schema);
  const result = v.validate(value);
  if (result.valid) return null;
  return result.errors.map(errorToFailure);
}

function errorToFailure(err: OutputUnit): ValidationFailure {
  return {
    // cfworker uses RFC 6901 instance pointers (e.g., `/name`); empty
    // string means the root, which we render as `/`.
    path: err.instanceLocation || '/',
    message: err.error || 'validation failed',
  };
}
