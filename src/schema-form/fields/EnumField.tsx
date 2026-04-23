/**
 * Single-select for `enum`. If the field is not required and has no
 * default, a leading "— unset —" option lets the user emit `undefined`.
 */

import type { FieldProps } from '../types.ts';

const UNSET = '__sf_unset__';

export function EnumField({ schema, value, required, onChange }: FieldProps) {
  const options = Array.isArray(schema.enum) ? schema.enum : [];

  // Translate the current value into the <option>'s value attribute. We
  // stringify so enum values like numbers or booleans round-trip cleanly.
  const current =
    value === undefined || value === null
      ? UNSET
      : options.findIndex((o) => Object.is(o, value)).toString();

  function handle(next: string) {
    if (next === UNSET) {
      onChange(undefined);
      return;
    }
    const idx = Number(next);
    if (Number.isInteger(idx) && idx >= 0 && idx < options.length) {
      onChange(options[idx]);
    }
  }

  return (
    <select className="sf-select" value={current} onChange={(e) => handle(e.target.value)}>
      {!required ? <option value={UNSET}>— unset —</option> : null}
      {options.map((opt, i) => (
        <option key={i} value={i.toString()}>
          {displayEnumOption(opt)}
        </option>
      ))}
    </select>
  );
}

function displayEnumOption(v: unknown): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try {
    return JSON.stringify(v) ?? '';
  } catch {
    return '';
  }
}
