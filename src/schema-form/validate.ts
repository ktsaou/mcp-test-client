/**
 * Thin wrapper around Ajv 8 (2020-12 dialect) so the form can surface
 * validation errors without leaking Ajv internals into every field
 * component.
 *
 * We lazy-initialise the Ajv instance and cache compiled validators per
 * schema reference; a new validator is compiled only when the schema
 * object identity changes, which matches how tools/list responses flow
 * (one schema per tool, rarely recompiled).
 */

import Ajv2020 from 'ajv/dist/2020.js';
import type { ErrorObject, ValidateFunction } from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

import type { JSONSchema } from './types.ts';

let sharedAjv: Ajv2020 | null = null;
const validatorCache = new WeakMap<object, ValidateFunction>();

function getAjv(): Ajv2020 {
  if (sharedAjv === null) {
    // `strict: false` — real-world MCP schemas often include extra keywords
    // (like `examples` in odd places, or draft-07-isms); we don't want the
    // form to crash on anything Ajv considers "too strict".
    sharedAjv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(sharedAjv);
  }
  return sharedAjv;
}

function getValidator(schema: JSONSchema): ValidateFunction {
  const cached = validatorCache.get(schema);
  if (cached) return cached;
  const validator = getAjv().compile(schema);
  validatorCache.set(schema, validator);
  return validator;
}

export interface ValidationFailure {
  path: string;
  message: string;
}

/**
 * Validate `value` against `schema`. Returns `null` on success, or a list
 * of `{ path, message }` tuples on failure. Errors from Ajv internals
 * (malformed schema) are caught and reported as a single failure so the
 * form never throws out of a render.
 */
export function validate(schema: JSONSchema, value: unknown): ValidationFailure[] | null {
  try {
    const v = getValidator(schema);
    const ok = v(value);
    if (ok) return null;
    return (v.errors ?? []).map(errorToFailure);
  } catch (e) {
    return [
      {
        path: '',
        message: `Schema compile error: ${e instanceof Error ? e.message : String(e)}`,
      },
    ];
  }
}

function errorToFailure(err: ErrorObject): ValidationFailure {
  return {
    path: err.instancePath || '/',
    message: err.message ?? 'validation failed',
  };
}
