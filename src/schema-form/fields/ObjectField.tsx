/**
 * Object field with fixed `properties`. Each child is rendered via the
 * dispatcher. Children that emit `undefined` are dropped from the
 * resulting object — per spec §3, optional-missing fields are omitted
 * entirely rather than sent as `null` or `""`.
 *
 * A trailing `additionalProperties` section is rendered when the schema
 * also allows extra keys (`additionalProperties: schema` or `true`).
 */

import type { FieldProps, JSONSchema } from '../types.ts';
import { isPlainObject } from '../types.ts';
import { FieldDispatcher } from '../SchemaForm.tsx';
import { AdditionalPropsField } from './AdditionalPropsField.tsx';

interface Props extends FieldProps {
  refsInPath: Set<string>;
}

export function ObjectField({ schema, value, onChange, path, rootSchema, refsInPath }: Props) {
  const obj = isPlainObject(value) ? value : {};
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);

  function updateChild(key: string, next: unknown) {
    const copy: Record<string, unknown> = { ...obj };
    if (next === undefined) {
      delete copy[key];
    } else {
      copy[key] = next;
    }
    onChange(copy);
  }

  const extraKeys = Object.keys(obj).filter((k) => !(k in properties));
  const extraObj: Record<string, unknown> = {};
  for (const k of extraKeys) extraObj[k] = obj[k];

  const additional = schema.additionalProperties;
  // Show the key/value editor when the schema explicitly describes the
  // shape of extras. A bare `true` (or `undefined`, which defaults to
  // "allowed") doesn't carry a schema, so we skip it to avoid implying
  // more structure than exists.
  const showAdditional = additional !== undefined && typeof additional === 'object';
  const additionalSchema: JSONSchema =
    additional && typeof additional === 'object' ? additional : { type: 'string' };

  function updateExtras(nextExtras: unknown) {
    const extrasObj = isPlainObject(nextExtras) ? nextExtras : {};
    const copy: Record<string, unknown> = {};
    for (const k of Object.keys(properties)) {
      if (obj[k] !== undefined) copy[k] = obj[k];
    }
    for (const [k, v] of Object.entries(extrasObj)) copy[k] = v;
    onChange(copy);
  }

  return (
    <div className="sf-object">
      {Object.entries(properties).map(([key, propSchema]) => (
        <FieldBlock
          key={key}
          name={key}
          path={[...path, key]}
          schema={propSchema}
          required={required.has(key)}
          value={obj[key]}
          onChange={(next) => updateChild(key, next)}
          rootSchema={rootSchema}
          refsInPath={refsInPath}
        />
      ))}

      {showAdditional ? (
        <AdditionalPropsField
          name="(additional properties)"
          path={[...path, '*']}
          schema={additionalSchema}
          required={false}
          value={extraObj}
          onChange={updateExtras}
          rootSchema={rootSchema}
          refsInPath={refsInPath}
        />
      ) : null}
    </div>
  );
}

/**
 * Label + widget for a single property. The dispatcher is responsible for
 * picking the right widget based on the schema; we just handle the label
 * decoration.
 */
export function FieldBlock({
  name,
  path,
  schema,
  required,
  value,
  onChange,
  rootSchema,
  refsInPath,
}: Props) {
  const label = typeof schema.title === 'string' ? schema.title : name;

  return (
    <div className="sf-field">
      <div className="sf-label">
        <span className="sf-label__name">
          {label}
          {required ? <span className="sf-label__required">*</span> : null}
        </span>
        {label !== name ? <span className="sf-label__key">{name}</span> : null}
      </div>
      {typeof schema.description === 'string' ? (
        <p className="sf-description">{schema.description}</p>
      ) : null}
      <FieldDispatcher
        name={name}
        path={path}
        schema={schema}
        required={required}
        value={value}
        onChange={onChange}
        rootSchema={rootSchema}
        refsInPath={refsInPath}
      />
    </div>
  );
}
