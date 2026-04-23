/**
 * Raw-JSON editor used for constructs we can't cleanly render (external
 * `$ref`, circular `$ref`, `allOf` with an unresolvable conflict, and any
 * unknown top-level shape). Per spec §7 we seed it with a defaulted value
 * and validate on blur.
 *
 * The editor is controlled: we keep the raw text locally so users can type
 * invalid JSON without losing their progress; we only call `onChange` with
 * the parsed value when parsing succeeds.
 */

import { useEffect, useState } from 'react';

import type { FieldProps } from '../types.ts';

interface Props extends FieldProps {
  reason?: string;
}

export function FallbackField({ value, onChange, reason }: Props) {
  const [text, setText] = useState(() => stringify(value));
  const [error, setError] = useState<string | null>(null);

  // If the upstream value changes (e.g. user switched branches), sync the
  // local text. We intentionally don't use a useEffect dependency on
  // `text` because that would cause the user's typing to be clobbered.
  useEffect(() => {
    setText(stringify(value));
    setError(null);
  }, [value]);

  function handleChange(next: string) {
    setText(next);
    if (next.trim() === '') {
      setError(null);
      onChange(undefined);
      return;
    }
    try {
      const parsed: unknown = JSON.parse(next);
      setError(null);
      onChange(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="sf-fallback">
      {reason ? <div className="sf-warning">Falling back to raw JSON: {reason}.</div> : null}
      <textarea
        className="sf-textarea"
        spellCheck={false}
        value={text}
        onChange={(e) => handleChange(e.target.value)}
      />
      {error !== null ? <div className="sf-error">Parse error: {error}</div> : null}
    </div>
  );
}

function stringify(v: unknown): string {
  if (v === undefined) return '';
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return '';
  }
}
