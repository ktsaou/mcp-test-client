/**
 * Checkbox for boolean fields. Optional booleans with no default stay
 * `undefined` until the user interacts; once the user toggles, the value
 * becomes `true` or `false` — never `undefined` again (you can't
 * "un-check back to unknown" without an explicit clear button, which we
 * deliberately don't add for now).
 */

import type { FieldProps } from '../types.ts';

export function BooleanField({ name, value, onChange }: FieldProps) {
  const checked = value === true;
  return (
    <label className="sf-checkbox-row">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="muted">{checked ? 'true' : 'false'}</span>
      <span className="sf-label__key">{name}</span>
    </label>
  );
}
