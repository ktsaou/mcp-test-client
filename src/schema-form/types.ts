/**
 * Shared types for the schema-form renderer.
 *
 * The JSONSchema type is intentionally *structural* — we don't pull in
 * @types/json-schema. We support the subset listed in
 * specs/schema-rendering.md §2; anything else falls back to the raw JSON
 * editor.
 */

export type JSONSchemaType =
  | 'string'
  | 'number'
  | 'integer'
  | 'boolean'
  | 'null'
  | 'array'
  | 'object';

export interface JSONSchema {
  // Core
  $ref?: string;
  $defs?: Record<string, JSONSchema>;
  definitions?: Record<string, JSONSchema>;

  // Metadata
  title?: string;
  description?: string;
  default?: unknown;
  examples?: unknown[];

  // Type & validation
  type?: JSONSchemaType | JSONSchemaType[];
  enum?: unknown[];
  const?: unknown;

  // String
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
  contentMediaType?: string;

  // Number
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  multipleOf?: number;

  // Object
  properties?: Record<string, JSONSchema>;
  required?: string[];
  additionalProperties?: boolean | JSONSchema;
  patternProperties?: Record<string, JSONSchema>;

  // Array
  items?: JSONSchema | JSONSchema[];
  prefixItems?: JSONSchema[];
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;

  // Composition
  anyOf?: JSONSchema[];
  oneOf?: JSONSchema[];
  allOf?: JSONSchema[];
  not?: JSONSchema;

  // Conditionals (v1 currently does not branch on these)
  if?: JSONSchema;
  then?: JSONSchema;
  else?: JSONSchema;
  dependentRequired?: Record<string, string[]>;
  dependentSchemas?: Record<string, JSONSchema>;

  // We accept unknown keywords without failing — allows graceful forward-compat.
  [key: string]: unknown;
}

/**
 * Props shared by every field component. `name` is the human-readable label
 * (defaulting to the property key); `value` / `onChange` follow React
 * controlled-component style. `rootSchema` is passed in so `$ref`
 * resolution can dereference against it.
 */
export interface FieldProps {
  name: string;
  /**
   * Full dotted path of this field within the root value. Used for form
   * control IDs, tooltips, and error addressing. The top-level form passes
   * in an empty path; nested fields append to it.
   */
  path: string[];
  schema: JSONSchema;
  required: boolean;
  value: unknown;
  onChange: (next: unknown) => void;
  rootSchema: JSONSchema;
}

/**
 * Produce a sensible default *form state* for a schema. Unlike Ajv's
 * useDefaults, we treat "no default" as `undefined` (omit from output), per
 * spec §3.
 */
export function defaultForSchema(schema: JSONSchema): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.const !== undefined) return schema.const;

  const t = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (t) {
    case 'string':
      return '';
    case 'number':
    case 'integer':
      return undefined;
    case 'boolean':
      return false;
    case 'array':
      return [];
    case 'object':
      return {};
    case 'null':
      return null;
    default:
      return undefined;
  }
}

/** Type guard — is this a plain object (not array, not null)? */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
