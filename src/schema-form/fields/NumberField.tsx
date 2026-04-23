/**
 * Numeric input for `number` and `integer`. Empty input → undefined (spec
 * §3): zero is a real value, so we never coerce empty to 0.
 *
 * We keep the input content in local state because the raw text is richer
 * than the parsed number: "1.", "-", "0.0" are all legal mid-typing and
 * Number() would collapse them. The local text resets whenever the
 * external value changes to a different parsed number.
 */

import { useEffect, useState } from 'react';

import type { FieldProps } from '../types.ts';

export function NumberField({ schema, value, onChange }: FieldProps) {
  const isInt = schema.type === 'integer';
  const num = typeof value === 'number' ? value : undefined;
  const [text, setText] = useState<string>(num === undefined ? '' : String(num));

  useEffect(() => {
    const parsed = text === '' ? undefined : Number(text);
    if (parsed !== num) {
      setText(num === undefined ? '' : String(num));
    }
    // We only want to resync when the outward number changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [num]);

  function handle(next: string) {
    setText(next);
    if (next.trim() === '') {
      onChange(undefined);
      return;
    }
    const parsed = Number(next);
    if (Number.isNaN(parsed)) return; // keep text; don't push garbage upstream
    if (isInt && !Number.isInteger(parsed)) return;
    onChange(parsed);
  }

  return (
    <input
      type="number"
      className="sf-input"
      value={text}
      onChange={(e) => handle(e.target.value)}
      min={schema.minimum}
      max={schema.maximum}
      step={schema.multipleOf ?? (isInt ? 1 : 'any')}
      spellCheck={false}
    />
  );
}
