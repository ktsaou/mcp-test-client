/**
 * Key/value row editor for `additionalProperties: schema`. The user adds
 * rows, edits the key in a plain text input, and the value via whatever
 * widget the value schema dispatches to.
 *
 * We maintain a stable row-id index locally so renaming a key mid-type
 * doesn't shuffle React's key identity and destroy focus.
 */

import { useRef, useState } from 'react';

import type { FieldProps } from '../types.ts';
import { isPlainObject, defaultForSchema } from '../types.ts';
import { FieldDispatcher } from '../SchemaForm.tsx';

interface Props extends FieldProps {
  refsInPath: Set<string>;
}

interface Row {
  id: number;
  key: string;
  value: unknown;
}

export function AdditionalPropsField({
  name,
  schema,
  value,
  onChange,
  path,
  rootSchema,
  refsInPath,
}: Props) {
  // We keep rows in local state so editing the key doesn't immediately
  // commit and shuffle data. The parent `value` is always the
  // "committed" view — we push on every keystroke with the current
  // string (empty keys are dropped on commit).
  const idCounter = useRef(0);

  const [rows, setRows] = useState<Row[]>(() =>
    isPlainObject(value)
      ? Object.entries(value).map(([k, v]) => ({ id: idCounter.current++, key: k, value: v }))
      : [],
  );

  function commit(next: Row[]) {
    setRows(next);
    const out: Record<string, unknown> = {};
    for (const r of next) {
      if (r.key.length === 0) continue;
      if (r.value !== undefined) out[r.key] = r.value;
    }
    onChange(out);
  }

  function addRow() {
    commit([...rows, { id: idCounter.current++, key: '', value: defaultForSchema(schema) }]);
  }

  function updateKey(id: number, key: string) {
    commit(rows.map((r) => (r.id === id ? { ...r, key } : r)));
  }

  function updateValue(id: number, v: unknown) {
    commit(rows.map((r) => (r.id === id ? { ...r, value: v } : r)));
  }

  function removeRow(id: number) {
    commit(rows.filter((r) => r.id !== id));
  }

  return (
    <div className="sf-kv">
      <div className="sf-label">
        <span className="sf-label__name">{name}</span>
      </div>
      {rows.map((row) => (
        <div className="sf-kv__row" key={row.id}>
          <input
            className="sf-input sf-kv__key"
            type="text"
            value={row.key}
            onChange={(e) => updateKey(row.id, e.target.value)}
            placeholder="key"
            spellCheck={false}
          />
          <div className="sf-kv__value">
            <FieldDispatcher
              name={row.key || '(unnamed)'}
              path={[...path, row.key || `[${row.id}]`]}
              schema={schema}
              required={false}
              value={row.value}
              onChange={(v) => updateValue(row.id, v)}
              rootSchema={rootSchema}
              refsInPath={refsInPath}
            />
          </div>
          <button
            type="button"
            className="sf-btn sf-btn--remove"
            onClick={() => removeRow(row.id)}
            title="Remove"
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      ))}
      <button type="button" className="sf-btn sf-array__add" onClick={addRow}>
        + Add item
      </button>
    </div>
  );
}
