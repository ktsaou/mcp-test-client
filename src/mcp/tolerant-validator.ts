/**
 * Resilience wrapper around the MCP SDK's `CfWorkerJsonSchemaValidator`.
 *
 * Why this exists: the SDK 1.29's `Client.listTools()` calls
 * `cacheToolMetadata()` after the response, which iterates every tool
 * and eagerly compiles `tool.outputSchema` via the configured validator.
 * The default validator does an unguarded compile — if any single tool's
 * `outputSchema` fails (malformed, unsupported feature, …), the throw
 * propagates up through `cacheToolMetadata` and fails the whole
 * `listTools()` call. One bad tool blocks every tool. See DEC-024.
 *
 * Why `CfWorkerJsonSchemaValidator` instead of the default Ajv-based
 * one: Ajv compiles by generating JavaScript at runtime, which our
 * Content Security Policy (`script-src 'self'`, no `'unsafe-eval'`)
 * blocks. Every Ajv compile failed in production with "Evaluating a
 * string as JavaScript violates the following Content Security Policy
 * directive". CfWorker interprets schemas at runtime instead — no
 * runtime code generation, no CSP conflict. The MCP SDK ships this
 * provider explicitly for edge runtimes (Cloudflare Workers, also
 * subject to no-eval policies); browsers with strict CSP fall in the
 * same bucket.
 *
 * This wrapper still swallows compile errors per-schema and surfaces
 * them via a caller-supplied warning callback, returning a permissive
 * validator (`valid: true`) so the SDK's eager cache loop continues.
 * The wrapper is no longer expected to fire often (CfWorker doesn't
 * compile, it interprets — fewer failure modes), but a malformed
 * schema can still raise during `new Validator(schema)` setup, and
 * we want to keep one bad tool from blocking the whole list.
 */
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker-provider.js';
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
 *
 * Diagnostics on console.error: Ajv's `compile()` calls
 * `this.logger.error("Error compiling schema, function code:", source)`
 * before throwing. We deliberately do NOT silence that output — it is
 * exactly the diagnostic a developer needs when their MCP server's
 * schema fails our validator: the full generated function code points
 * straight at the broken keyword. v1.1.4 muted it; v1.1.5 restored it
 * after the muting hid information Costa needed during a real debug
 * session.
 */
export class TolerantValidator implements JsonSchemaValidatorProvider {
  #inner: JsonSchemaValidatorProvider;
  #onWarn: SchemaWarningSink;

  constructor(onWarn: SchemaWarningSink, inner?: JsonSchemaValidatorProvider) {
    this.#inner = inner ?? new CfWorkerJsonSchemaValidator();
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
