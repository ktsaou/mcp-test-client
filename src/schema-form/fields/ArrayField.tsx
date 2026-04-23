/**
 * Handles three cases:
 *   1. `items.enum`  → checkbox set (multi-select)
 *   2. `prefixItems` → tuple form, one widget per position
 *   3. plain array   → add/remove rows, each item rendered via dispatcher
 *
 * We keep arrays sparse-safe: on remove we splice the live value; on add
 * we push a fresh default built from the item schema.
 */

import type { FieldProps, JSONSchema } from '../types.ts';
import { defaultForSchema } from '../types.ts';
import { FieldDispatcher } from '../SchemaForm.tsx';

interface Props extends FieldProps {
  refsInPath: Set<string>;
}

export function ArrayField(props: Props) {
  const { schema } = props;

  // Tuple form — prefixItems takes precedence over items.
  if (Array.isArray(schema.prefixItems) && schema.prefixItems.length > 0) {
    return <TupleField {...props} prefixItems={schema.prefixItems} />;
  }

  // Array of enum → checkbox set.
  const itemSchema = normaliseItemSchema(schema.items);
  if (itemSchema && Array.isArray(itemSchema.enum)) {
    return <ArrayOfEnumField {...props} itemSchema={itemSchema} />;
  }

  return <PlainArrayField {...props} itemSchema={itemSchema ?? { type: 'string' }} />;
}

function normaliseItemSchema(items: JSONSchema | JSONSchema[] | undefined): JSONSchema | undefined {
  if (!items) return undefined;
  if (Array.isArray(items)) return items[0];
  return items;
}

// ── plain array ───────────────────────────────────────────────────────

function PlainArrayField({
  value,
  onChange,
  path,
  rootSchema,
  refsInPath,
  itemSchema,
}: Props & { itemSchema: JSONSchema }) {
  const arr: unknown[] = Array.isArray(value) ? (value as unknown[]) : [];

  function updateItem(index: number, next: unknown) {
    const copy = [...arr];
    copy[index] = next;
    onChange(copy);
  }

  function removeItem(index: number) {
    const copy = [...arr];
    copy.splice(index, 1);
    onChange(copy);
  }

  function addItem() {
    onChange([...arr, defaultForSchema(itemSchema)]);
  }

  return (
    <div className="sf-array">
      <div className="sf-array__items">
        {arr.map((item, i) => (
          <div className="sf-array__row" key={i}>
            <FieldDispatcher
              name={`[${i}]`}
              path={[...path, String(i)]}
              schema={itemSchema}
              required
              value={item}
              onChange={(v) => updateItem(i, v)}
              rootSchema={rootSchema}
              refsInPath={refsInPath}
            />
            <button
              type="button"
              className="sf-btn sf-btn--remove"
              onClick={() => removeItem(i)}
              title="Remove"
              aria-label={`Remove item ${i}`}
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="sf-btn sf-array__add" onClick={addItem}>
        + Add item
      </button>
    </div>
  );
}

// ── array of enum (multi-select checkboxes) ──────────────────────────

function ArrayOfEnumField({ value, onChange, itemSchema }: Props & { itemSchema: JSONSchema }) {
  const arr: unknown[] = Array.isArray(value) ? (value as unknown[]) : [];
  const options = itemSchema.enum ?? [];

  function toggle(opt: unknown) {
    const idx = arr.findIndex((v) => Object.is(v, opt));
    if (idx === -1) onChange([...arr, opt]);
    else {
      const copy = [...arr];
      copy.splice(idx, 1);
      onChange(copy);
    }
  }

  return (
    <div className="sf-array sf-array__enum">
      {options.map((opt, i) => {
        const checked = arr.some((v) => Object.is(v, opt));
        return (
          <label key={i} className="sf-checkbox-row">
            <input type="checkbox" checked={checked} onChange={() => toggle(opt)} />
            <span>{displayOpt(opt)}</span>
          </label>
        );
      })}
    </div>
  );
}

function displayOpt(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return '';
  }
}

// ── tuple (prefixItems) ───────────────────────────────────────────────

function TupleField({
  value,
  onChange,
  prefixItems,
  path,
  rootSchema,
  refsInPath,
}: Props & { prefixItems: JSONSchema[] }) {
  const arr: unknown[] = Array.isArray(value) ? (value as unknown[]) : [];
  // Ensure we render one slot per prefixItems entry, even if the current
  // value is shorter. We don't persist these default values upstream
  // until the user touches them.
  const slots = prefixItems.map((s, i) => (i < arr.length ? arr[i] : defaultForSchema(s)));

  function updateSlot(i: number, next: unknown) {
    const copy: unknown[] = [...arr];
    // Pad to the target slot if needed.
    while (copy.length <= i) copy.push(undefined);
    copy[i] = next;
    onChange(copy);
  }

  return (
    <div className="sf-tuple">
      <div className="sf-tuple__positions">
        {prefixItems.map((pSchema, i) => {
          const label = typeof pSchema.title === 'string' ? pSchema.title : `position ${i}`;
          return (
            <div className="sf-field" key={i}>
              <div className="sf-label">
                <span className="sf-label__name">{label}</span>
                <span className="sf-label__key">[{i}]</span>
              </div>
              <FieldDispatcher
                name={`[${i}]`}
                path={[...path, String(i)]}
                schema={pSchema}
                required
                value={slots[i]}
                onChange={(v) => updateSlot(i, v)}
                rootSchema={rootSchema}
                refsInPath={refsInPath}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
