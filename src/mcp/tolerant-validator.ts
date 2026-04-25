/**
 * Resilience wrapper around the MCP SDK's `AjvJsonSchemaValidator`.
 *
 * Why this exists: the SDK 1.29's `Client.listTools()` calls
 * `cacheToolMetadata()` after the response, which iterates every tool and
 * eagerly compiles `tool.outputSchema` via the configured validator. The
 * default `AjvJsonSchemaValidator` does an unguarded `ajv.compile(schema)`
 * — if any single tool's `outputSchema` fails to compile (malformed,
 * unsupported feature, regex too complex for Ajv's code generator, …),
 * the throw propagates up through `cacheToolMetadata` and fails the
 * whole `listTools()` call. One bad tool blocks every tool. See DEC-024.
 *
 * This wrapper swallows compile errors per-schema, surfaces them via a
 * caller-supplied warning callback, and returns a permissive validator
 * (`valid: true`) so the SDK's eager cache loop continues. Output
 * validation is silently downgraded for the offender — the warning
 * callback is what makes the downgrade visible.
 */
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv-provider.js';
import type {
  JsonSchemaType,
  JsonSchemaValidator,
  jsonSchemaValidator as JsonSchemaValidatorProvider,
} from '@modelcontextprotocol/sdk/validation/types.js';

export interface SchemaCompileWarning {
  /** Ajv's error message (or whatever was thrown). */
  message: string;
  /** The schema that failed to compile, for debugging. */
  schema: JsonSchemaType;
}

export type SchemaWarningSink = (warning: SchemaCompileWarning) => void;

/**
 * Validator provider that delegates to the SDK's default Ajv-based
 * validator and catches compile errors. On error: emits a warning to the
 * provided sink and returns a no-op validator that accepts any input.
 */
/**
 * Build an Ajv instance with the SDK's default settings PLUS `logger: false`.
 *
 * Why: when Ajv's `compile()` fails, it calls `this.logger.error(...)` with
 * the (very long) generated function-code source BEFORE throwing. The default
 * logger is `console`, so a single un-compilable schema dumps a screenful of
 * scary stack traces into the user's console — even though our wrapper
 * already catches the throw and surfaces a clean per-schema warning to the
 * system-log. The user sees noise that looks like a hard failure when the
 * app is actually behaving correctly.
 *
 * Setting `logger: false` makes Ajv's logger no-ops (`{ log, warn, error }`
 * all become functions that swallow). Our wrapper still catches the throw
 * and emits its own structured warning via `onSchemaWarning`, so no
 * information is lost — only the redundant raw dump is suppressed.
 */
function buildSilentAjv() {
  const ajv = new Ajv({
    strict: false,
    validateFormats: true,
    validateSchema: false,
    allErrors: true,
    logger: false,
  });
  addFormats(ajv);
  return ajv;
}

export class TolerantValidator implements JsonSchemaValidatorProvider {
  #inner: JsonSchemaValidatorProvider;
  #onWarn: SchemaWarningSink;

  constructor(onWarn: SchemaWarningSink, inner?: JsonSchemaValidatorProvider) {
    this.#inner = inner ?? new AjvJsonSchemaValidator(buildSilentAjv());
    this.#onWarn = onWarn;
  }

  getValidator<T>(schema: JsonSchemaType): JsonSchemaValidator<T> {
    try {
      return this.#inner.getValidator<T>(schema);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.#onWarn({ message, schema });
      return permissiveValidator<T>();
    }
  }
}

function permissiveValidator<T>(): JsonSchemaValidator<T> {
  return (input: unknown) => ({
    valid: true,
    data: input as T,
    errorMessage: undefined,
  });
}
