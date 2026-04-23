/**
 * Public surface for the schema-form package. Consumers should import
 * only from here; the field components and internal helpers are not part
 * of the public API.
 */

export { SchemaForm } from './SchemaForm.tsx';
export type { SchemaFormProps } from './SchemaForm.tsx';
export type { JSONSchema, JSONSchemaType, FieldProps } from './types.ts';
export { validate } from './validate.ts';
export type { ValidationFailure } from './validate.ts';
