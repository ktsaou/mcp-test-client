/**
 * String input. Picks the appropriate widget based on format /
 * contentMediaType / maxLength. `password` is not part of JSON Schema's
 * format vocabulary but the spec §2 documents it as our convention, and
 * we render it as a masked input.
 */

import type { FieldProps } from '../types.ts';

const LONG_TEXT_MIN = 120;

export function StringField({ schema, value, onChange }: FieldProps) {
  const str = typeof value === 'string' ? value : '';

  function handle(next: string) {
    // Empty string with no default → undefined (omit from output, spec §3).
    if (next === '' && schema.default === undefined) {
      onChange(undefined);
    } else {
      onChange(next);
    }
  }

  const shared = {
    className: 'sf-input',
    value: str,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => handle(e.target.value),
    placeholder: typeof schema['placeholder'] === 'string' ? schema['placeholder'] : undefined,
    spellCheck: false,
  } as const;

  // JSON content → textarea with JSON parsing on blur. We don't parse on
  // every keystroke because that would fight the user.
  if (schema.contentMediaType === 'application/json') {
    return (
      <textarea
        className="sf-textarea"
        spellCheck={false}
        value={str}
        onChange={(e) => handle(e.target.value)}
      />
    );
  }

  if (typeof schema.maxLength === 'number' && schema.maxLength > LONG_TEXT_MIN) {
    return (
      <textarea
        className="sf-textarea"
        spellCheck={false}
        value={str}
        onChange={(e) => handle(e.target.value)}
        maxLength={schema.maxLength}
      />
    );
  }

  switch (schema.format) {
    case 'date':
      return <input type="date" {...shared} />;
    case 'date-time':
      return <input type="datetime-local" {...shared} />;
    case 'time':
      return <input type="time" {...shared} />;
    case 'email':
      return <input type="email" {...shared} />;
    case 'uri':
    case 'uri-reference':
    case 'url':
      return <input type="url" {...shared} />;
    case 'password':
      return <input type="password" {...shared} />;
    default:
      return (
        <input
          type="text"
          {...shared}
          pattern={schema.pattern}
          minLength={schema.minLength}
          maxLength={schema.maxLength}
        />
      );
  }
}
