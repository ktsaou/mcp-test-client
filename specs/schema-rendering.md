# Schema Rendering

How the schema renderer turns a JSON Schema into an interactive form.

**Supported dialect**: JSON Schema 2020-12, validated via `ajv@^8` +
`ajv-formats`. Older dialects (draft-07) are accepted on a best-effort basis.

**Reference**: https://json-schema.org/draft/2020-12/schema

---

## 1. Design goals

1. **Round-trip fidelity** — the form's output must, when serialized, match
   what the schema expects. A validator run on form output must pass.
2. **Graceful degradation** — if we can't render a construct, fall back to a
   raw JSON editor seeded with a sensible default, not a crash.
3. **One field type per file** — each construct is a small, unit-testable
   component under `src/schema-form/fields/`.
4. **No magic coercion** — if the schema says `integer`, an empty string
   becomes `undefined`, never `0`. Zero is a real value.

## 2. Construct support matrix

| Construct                         | Status | Widget                                              |
|-----------------------------------|--------|-----------------------------------------------------|
| `type: string`                    | ✅     | text input (textarea if `maxLength > 120`)          |
| `type: string, format: date`      | ✅     | native `<input type="date">`                        |
| `type: string, format: date-time` | ✅     | native `<input type="datetime-local">`              |
| `type: string, format: email`     | ✅     | native `<input type="email">`                       |
| `type: string, format: uri`       | ✅     | native `<input type="url">`                         |
| `type: string, format: password` (custom) | ✅ | masked text input                              |
| `type: string, contentMediaType: application/json` | ✅ | code editor, validated as JSON       |
| `type: number` / `integer`        | ✅     | numeric input with `min`/`max`/`step`               |
| `type: boolean`                   | ✅     | checkbox                                            |
| `type: "null"`                    | ✅     | fixed null display                                  |
| `type: array`                     | ✅     | add/remove rows, item schema recursed               |
| `type: array, items: { enum }`    | ✅     | checkbox set (multi-select)                         |
| `type: array, prefixItems: [...]` | ✅     | tuple form — one slot per position                  |
| `type: object`                    | ✅     | nested field group                                  |
| `type: object, additionalProperties: T` | ✅ | editable key/value rows, value typed by `T`     |
| `enum: [...]`                     | ✅     | `<select>` with "— unset —" option if not required  |
| `const`                           | ✅     | read-only display                                   |
| `oneOf` with `const`-discriminator | ✅    | tab switcher; discriminator fixes the branch        |
| `oneOf` / `anyOf` (general)       | ✅     | tab switcher between branches; user picks           |
| `allOf`                           | ✅     | merged schema before rendering (see §5)             |
| `not`                             | ⚠️     | rendered as the underlying form with a validator    |
| `$ref`, `$defs`                   | ✅     | resolved before rendering (see §4)                  |
| `if` / `then` / `else`            | ⚠️     | v1.0: ignored and warn; v1.1: conditional rendering |
| `dependentSchemas`                | ⚠️     | same as above                                       |
| `dependentRequired`               | ✅     | required markers update live                        |
| `pattern`                         | ✅     | validated on blur with the schema's pattern         |

## 3. Required vs. optional

- Required fields are marked with an asterisk in the label.
- Optional fields with no default and no user input are **omitted from the
  output**, not sent as `null` or empty string.

## 4. `$ref` / `$defs` resolution

- References resolved **before** rendering. We dereference against the schema
  root and cache the result.
- Circular references: detected; the recursive edge renders as a "recursive —
  use raw JSON" fallback to avoid infinite form growth.
- External `$ref` (URIs that require network fetch): not supported in v1.0.
  We warn and render as raw JSON.

## 5. `allOf` merging

We run a simple merger that combines properties, required arrays (union),
numeric bounds (intersection: max of mins, min of maxes), and string length
bounds. Conflicts (e.g. two incompatible `const` values) render as raw JSON
with a clear warning. The merger lives in `src/schema-form/merge.ts` and has
its own unit tests.

## 6. `oneOf` / `anyOf` behaviour

Both render as a tab switcher. The user picks a branch. Behind the scenes:

- `oneOf`: we validate against exactly one branch. If the current form output
  matches multiple, we warn.
- `anyOf`: we validate against at least one branch.

If branches are discriminable by a `const` property (the common MCP idiom for
typed unions), the tab label uses that const; otherwise we show
`option 1`, `option 2`, ...

## 7. Raw JSON fallback

Any construct we can't render cleanly falls back to a code editor seeded with
an empty value of the schema's type. On blur, the editor content is validated
by Ajv and errors surface in-line. This avoids MCP Inspector's "silent
degradation" issue (their issue #332).

## 8. Import-from-LLM-paste

The user can paste a raw JSON tool-call (often sloppy — trailing commas,
backtick-wrapped JSON, stringified nested JSON). Pipeline:

1. Strip leading ` ```json ` / trailing ` ``` ` code fences.
2. Strip matched backtick wrappers around the whole value.
3. Attempt `JSON.parse`.
4. If that fails, apply a permissive repair pass (jsonc-parser or a small
   hand-written tolerant parser for trailing commas and single-quoted keys).
5. If it looks like `{ "name": ..., "arguments": ... }`, extract the
   arguments and drop them into the form.
6. If repair fails, show the paste in the raw editor with the parse error.

## 9. Validation UX

- Client-side validation runs as the user types (debounced 150 ms) and on
  submit.
- A "send without client validation" escape hatch exists so users can
  deliberately send malformed requests to exercise server-side validation.
  This is a core differentiator.

## 10. Conformance test suite

Unit tests live in `tests/unit/schema-form/`. The conformance suite lives in
`tests/conformance/real-schemas/` and contains ~30 real tool schemas harvested
from public MCP servers. A new schema is added every time a user reports a
rendering bug. The test asserts: (1) the form renders without throwing, (2)
default form output validates against the schema, (3) round-trip through
form → raw → form is idempotent.
