/**
 * Tab switcher for `anyOf` / `oneOf`. Each branch becomes one tab. If the
 * branches are distinguishable by a shared `const` property, that const
 * becomes the tab label (the "discriminator" idiom common in MCP).
 *
 * Switching tabs emits that branch's default value so the form instantly
 * reflects the new constraints.
 */

import { useMemo, useState } from 'react';

import type { FieldProps, JSONSchema } from '../types.ts';
import { defaultForSchema, isPlainObject } from '../types.ts';
import { FieldDispatcher } from '../SchemaForm.tsx';

interface Props extends FieldProps {
  branches: JSONSchema[];
  kind: 'anyOf' | 'oneOf';
  /** Ref-path stack used to detect recursion when a branch contains `$ref`. */
  refsInPath: Set<string>;
}

export function UnionField({
  branches,
  name,
  path,
  rootSchema,
  value,
  onChange,
  refsInPath,
  required,
}: Props) {
  const labels = useMemo(() => computeTabLabels(branches), [branches]);

  // Pick the initial active branch by finding the first one the value
  // matches. If nothing matches, default to 0. This runs once per render
  // to allow the user to also override via state.
  const matched = useMemo(
    () => branches.findIndex((b) => valueMatchesBranch(value, b)),
    [branches, value],
  );
  const [active, setActive] = useState<number>(matched >= 0 ? matched : 0);

  function switchTo(i: number) {
    setActive(i);
    const branch = branches[i];
    if (branch && !valueMatchesBranch(value, branch)) {
      onChange(defaultForSchema(branch));
    }
  }

  const activeBranch = branches[active];
  if (!activeBranch) return null;

  return (
    <div className="sf-union">
      <div className="sf-union__tabs" role="tablist">
        {branches.map((_b, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            className={'sf-union__tab' + (i === active ? ' sf-union__tab--active' : '')}
            aria-selected={i === active}
            onClick={() => switchTo(i)}
          >
            {labels[i]}
          </button>
        ))}
      </div>
      <div className="sf-union__panel" role="tabpanel">
        <FieldDispatcher
          name={name}
          path={path}
          schema={activeBranch}
          required={required}
          value={value}
          onChange={onChange}
          rootSchema={rootSchema}
          refsInPath={refsInPath}
        />
      </div>
    </div>
  );
}

/** Does `value` plausibly match a branch? */
function valueMatchesBranch(value: unknown, branch: JSONSchema): boolean {
  if (value === undefined) return false;

  // If the branch fixes a const (or a nested `const` property), match on that.
  if (branch.const !== undefined) return Object.is(value, branch.const);

  // If the branch has properties with consts, and value is an object,
  // check each const.
  if (branch.properties && isPlainObject(value)) {
    for (const [k, propSchema] of Object.entries(branch.properties)) {
      if (isPlainObject(propSchema) && propSchema.const !== undefined) {
        if (!Object.is(value[k], propSchema.const)) return false;
      }
    }
  }

  if (Array.isArray(branch.enum)) {
    return branch.enum.some((e) => Object.is(e, value));
  }

  const t = Array.isArray(branch.type) ? branch.type[0] : branch.type;
  if (!t) return false;
  switch (t) {
    case 'string':
      return typeof value === 'string';
    case 'number':
      return typeof value === 'number';
    case 'integer':
      return typeof value === 'number' && Number.isInteger(value);
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'array':
      return Array.isArray(value);
    case 'object':
      return isPlainObject(value);
  }
  return false;
}

function computeTabLabels(branches: JSONSchema[]): string[] {
  // Prefer a discriminator const property that appears across every branch.
  const discriminators = findDiscriminator(branches);
  if (discriminators) {
    const [propName, values] = discriminators;
    return branches.map((_, i) => {
      const v = values[i];
      if (v === undefined) return `${propName}[${i}]`;
      return typeof v === 'string' ? v : JSON.stringify(v);
    });
  }

  return branches.map((b, i) => {
    if (typeof b.title === 'string') return b.title;
    if (typeof b.const !== 'undefined') {
      return typeof b.const === 'string' ? b.const : JSON.stringify(b.const);
    }
    const t = Array.isArray(b.type) ? b.type.join('|') : b.type;
    return t ? String(t) : `option ${i + 1}`;
  });
}

/**
 * If every branch pins the same property to a distinct `const`, that
 * property is the discriminator. Return its name plus the const value
 * from each branch (same index as branches), else null.
 */
function findDiscriminator(branches: JSONSchema[]): [string, unknown[]] | null {
  if (branches.length < 2) return null;
  const first = branches[0];
  if (!first?.properties) return null;

  const candidates = Object.entries(first.properties).filter(
    ([, s]) => isPlainObject(s) && s.const !== undefined,
  );

  for (const [propName] of candidates) {
    const values: unknown[] = [];
    let ok = true;
    for (const b of branches) {
      const propSchema = b.properties?.[propName];
      if (!isPlainObject(propSchema) || propSchema.const === undefined) {
        ok = false;
        break;
      }
      values.push(propSchema.const);
    }
    if (ok) return [propName, values];
  }
  return null;
}
