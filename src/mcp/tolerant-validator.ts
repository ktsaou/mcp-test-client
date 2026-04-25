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
export class TolerantValidator implements JsonSchemaValidatorProvider {
  #inner: JsonSchemaValidatorProvider;
  #onWarn: SchemaWarningSink;

  constructor(onWarn: SchemaWarningSink, inner?: JsonSchemaValidatorProvider) {
    this.#inner = inner ?? new AjvJsonSchemaValidator();
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
