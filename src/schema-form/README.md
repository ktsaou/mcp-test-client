# `src/schema-form/`

React port of the vanilla-JS form generator at
`legacy/mcp-schema-ui-generator.js`. Behaviour is described in
[`specs/schema-rendering.md`](../../specs/schema-rendering.md).

## Layout

- `SchemaForm.tsx` — top-level component + the internal `FieldDispatcher`
  used by every compound field.
- `fields/` — one widget per file. Add new widgets here.
- `resolve-refs.ts` — `$ref` / `$defs` dereferencing (fragment-only; external
  URIs fall back to raw JSON).
- `merge.ts` — `allOf` merger (union of properties/required, intersection of
  bounds, conflict detection).
- `validate.ts` — thin Ajv 8 (2020-12) wrapper with a per-schema validator
  cache.
- `types.ts` — shared types including the structural `JSONSchema`.
- `schema-form.css` — `sf-*` classes built on the `--color-*`, `--radius-*`
  CSS custom properties from `ui/theme.css`.

## Public API

```ts
import { SchemaForm } from './schema-form';

<SchemaForm schema={tool.inputSchema} value={args} onChange={setArgs} />
```

`SchemaFormProps.value` is the canonical state — the component is
controlled. Changes flow through `onChange(next)` on every keystroke.

## Fallback policy

Any construct we can't render cleanly (external `$ref`, circular `$ref`,
unresolvable `allOf`, `not`, `if`/`then`/`else`) renders a raw JSON
editor with a warning banner. The editor parses on every change and
pushes up the parsed value when it's valid JSON.
