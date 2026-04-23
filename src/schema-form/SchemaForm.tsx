/**
 * Top-level React entry for the schema-driven form.
 *
 * The <SchemaForm> takes a JSON Schema plus a value, renders an
 * interactive form, and pushes every change through `onChange`. It owns
 * no local editing state beyond what each field component keeps for its
 * own input mirror — the canonical state lives in the parent, matching
 * the rest of this app's components.
 *
 * Rendering dispatch lives in `FieldDispatcher` and is used recursively
 * by ObjectField, ArrayField, UnionField, and AdditionalPropsField, which
 * import it from this module. This creates a small circular import but
 * it's resolved by ES module semantics (the function is hoisted before
 * any field component calls it).
 */

import { useEffect } from 'react';

import type { FieldProps, JSONSchema } from './types.ts';
import { isPlainObject } from './types.ts';
import { derefSchema } from './resolve-refs.ts';
import { mergeAllOf } from './merge.ts';

import { StringField } from './fields/StringField.tsx';
import { NumberField } from './fields/NumberField.tsx';
import { BooleanField } from './fields/BooleanField.tsx';
import { EnumField } from './fields/EnumField.tsx';
import { ArrayField } from './fields/ArrayField.tsx';
import { ObjectField } from './fields/ObjectField.tsx';
import { UnionField } from './fields/UnionField.tsx';
import { FallbackField } from './fields/FallbackField.tsx';

// ── Public API ───────────────────────────────────────────────────────

export interface SchemaFormProps {
  schema: JSONSchema;
  value: unknown;
  onChange: (next: unknown) => void;
  rootPath?: string[];
}

/**
 * Renders a form for a JSON-Schema-described value. At the top level we
 * render as an object (the common MCP `inputSchema` shape) but also
 * support a root schema that's anything else (the dispatcher handles it).
 */
export function SchemaForm({ schema, value, onChange, rootPath = [] }: SchemaFormProps) {
  // Initialise missing required properties' defaults once so users see a
  // populated form on first render. We do this lazily via an effect to
  // avoid setState-during-render.
  useEffect(() => {
    if (!isPlainObject(value)) return;
    const resolved = resolveForRender(schema, schema, new Set());
    const s = resolved?.schema;
    if (!s?.properties) return;
    let next: Record<string, unknown> | null = null;
    for (const [k, propSchema] of Object.entries(s.properties)) {
      if (value[k] === undefined && isPlainObject(propSchema) && propSchema.default !== undefined) {
        next = next ?? { ...value };
        next[k] = propSchema.default;
      }
    }
    if (next) onChange(next);
    // Only run on schema change, not on every value update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema]);

  return (
    <div className="sf-root">
      {typeof schema.description === 'string' && rootPath.length === 0 ? (
        <p className="sf-description">{schema.description}</p>
      ) : null}
      <FieldDispatcher
        name={typeof schema.title === 'string' ? schema.title : ''}
        path={rootPath}
        schema={schema}
        required
        value={value}
        onChange={onChange}
        rootSchema={schema}
        refsInPath={new Set()}
      />
    </div>
  );
}

// ── Field dispatcher ─────────────────────────────────────────────────

interface DispatcherProps extends FieldProps {
  refsInPath: Set<string>;
}

/**
 * Resolve, merge, and dispatch a single field's schema to the appropriate
 * widget. Used by every compound field type.
 */
export function FieldDispatcher(props: DispatcherProps) {
  const { schema, rootSchema, refsInPath, value, onChange } = props;

  // Track `$ref`s we've followed on the way down. If we see one twice,
  // we render the fallback instead of recursing infinitely.
  let currentRefsInPath = refsInPath;
  let working = schema;

  if (typeof schema.$ref === 'string') {
    const nextRefs = new Set(refsInPath);
    if (refsInPath.has(schema.$ref)) {
      return <FallbackField {...props} reason="recursive schema" />;
    }
    nextRefs.add(schema.$ref);
    const derefed = derefSchema(schema, rootSchema, refsInPath);
    if (!derefed || derefed.cyclic) {
      return <FallbackField {...props} reason="unresolved $ref" />;
    }
    working = derefed.schema;
    currentRefsInPath = nextRefs;
  }

  // allOf merge.
  if (Array.isArray(working.allOf) && working.allOf.length > 0) {
    const merged = mergeAllOf([{ ...working, allOf: undefined }, ...working.allOf]);
    if (merged.conflict) {
      return <FallbackField {...props} reason={merged.reason ?? 'allOf conflict'} />;
    }
    working = merged.schema;
  }

  // const: read-only display.
  if (working.const !== undefined) {
    return <ConstField value={working.const} />;
  }

  // anyOf / oneOf tab switcher.
  if (Array.isArray(working.oneOf) && working.oneOf.length > 0) {
    return (
      <UnionField
        {...props}
        schema={working}
        branches={working.oneOf}
        kind="oneOf"
        refsInPath={currentRefsInPath}
      />
    );
  }
  if (Array.isArray(working.anyOf) && working.anyOf.length > 0) {
    return (
      <UnionField
        {...props}
        schema={working}
        branches={working.anyOf}
        kind="anyOf"
        refsInPath={currentRefsInPath}
      />
    );
  }

  // enum (single select). Must come before `type` switch because a
  // schema may have `type: string, enum: [...]` — we want the select.
  if (Array.isArray(working.enum) && working.enum.length > 0) {
    return <EnumField {...props} schema={working} />;
  }

  const t = Array.isArray(working.type) ? working.type[0] : working.type;

  switch (t) {
    case 'string':
      return <StringField {...props} schema={working} />;
    case 'number':
    case 'integer':
      return <NumberField {...props} schema={working} />;
    case 'boolean':
      return <BooleanField {...props} schema={working} />;
    case 'null':
      return <span className="sf-const">null</span>;
    case 'array':
      return <ArrayField {...props} schema={working} refsInPath={currentRefsInPath} />;
    case 'object':
      return <ObjectField {...props} schema={working} refsInPath={currentRefsInPath} />;
    default:
      // No explicit type. If the schema has `properties`, render as object.
      if (working.properties || working.additionalProperties !== undefined) {
        return (
          <ObjectField
            {...props}
            schema={{ ...working, type: 'object' }}
            refsInPath={currentRefsInPath}
          />
        );
      }
      if (working.items || working.prefixItems) {
        return (
          <ArrayField
            {...props}
            schema={{ ...working, type: 'array' }}
            refsInPath={currentRefsInPath}
          />
        );
      }
      // Last resort: raw JSON.
      return (
        <FallbackField
          schema={working}
          name={props.name}
          path={props.path}
          required={props.required}
          value={value}
          onChange={onChange}
          rootSchema={rootSchema}
          reason="no renderable type"
        />
      );
  }
}

// ── Helpers used only here ──────────────────────────────────────────

function ConstField({ value }: { value: unknown }) {
  return <span className="sf-const">{displayConst(value)}</span>;
}

function displayConst(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return '';
  }
}

/**
 * Internal helper: resolve `$ref` + `allOf` enough to answer "what are
 * this schema's properties?" without actually rendering. Used by the
 * top-level default-filling effect.
 */
function resolveForRender(
  schema: JSONSchema,
  rootSchema: JSONSchema,
  seen: Set<string>,
): { schema: JSONSchema } | undefined {
  let working = schema;
  if (typeof working.$ref === 'string') {
    const derefed = derefSchema(working, rootSchema, seen);
    if (!derefed || derefed.cyclic) return undefined;
    working = derefed.schema;
  }
  if (Array.isArray(working.allOf) && working.allOf.length > 0) {
    const merged = mergeAllOf([{ ...working, allOf: undefined }, ...working.allOf]);
    if (merged.conflict) return undefined;
    working = merged.schema;
  }
  return { schema: working };
}
