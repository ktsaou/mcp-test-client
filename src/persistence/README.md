# persistence/

Typed, namespaced, versioned localStorage wrapper. Spec:
[`../../specs/persistence.md`](../../specs/persistence.md).

## Files

- `schema.ts` — the namespace (`mcptc:`), key naming helpers, value types
  (`ServerEntry`, `HistoryRecord`, etc.), and `CURRENT_SCHEMA_VERSION`.
- `store.ts` — the `Store` class. Every read/write goes through this; it
  handles the prefix, JSON serialization, and quota-exceeded errors.
- `migrations.ts` — schema-version migration framework. Empty until we ship
  a v2 that changes any persisted shape.

## Adding a new persisted value

1. Add the value's type to `schema.ts` (and a key helper if it's dynamic).
2. Use `store.read<Type>(key)` and `store.write(key, value)` from wherever
   needs it.
3. If you changed the shape of an _existing_ value:
   - Bump `CURRENT_SCHEMA_VERSION`.
   - Add a migration in `migrations.ts`.
   - Add a test.

## Tests

Everything runs against an in-memory mock that implements the `Storage`
interface. See `store.test.ts` / `migrations.test.ts`.
