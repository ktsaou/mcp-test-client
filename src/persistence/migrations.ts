/**
 * Schema migrations.
 *
 * At app startup:
 *   1. Read `mcptc:version` from storage.
 *   2. If missing → treat as fresh install; write the current version; done.
 *   3. If less than current → run each intermediate migration in order, then
 *      write the current version.
 *   4. If greater than current → the user has downgraded. Refuse to touch
 *      anything; emit a warning through the error sink. Their data stays
 *      intact and the newer version can read it back.
 *
 * Adding a migration:
 *   - Bump `CURRENT_SCHEMA_VERSION` in `schema.ts`.
 *   - Register a function under the matching version number below.
 *   - Add a test in `migrations.test.ts`.
 */

import { CURRENT_SCHEMA_VERSION, Keys, prefixed } from './schema.ts';
import type { Store } from './store.ts';

/** Signature of a single migration step. Mutate storage in place. */
export type Migration = (store: Store) => void;

/**
 * The list of migrations to run. The key is the version we're migrating *to*.
 * For the move from v1 to v2, register `2: (store) => { ... }`.
 *
 * Currently empty because we're on v1.
 */
export const migrations: Record<number, Migration> = {
  // e.g. 2: (store) => { ... },
};

export type MigrationOutcome =
  | { status: 'fresh'; version: number }
  | { status: 'upToDate'; version: number }
  | { status: 'migrated'; fromVersion: number; toVersion: number }
  | { status: 'downgrade'; storedVersion: number; appVersion: number };

/**
 * Bring storage up to {@link CURRENT_SCHEMA_VERSION}.
 *
 * Callable at app startup. Returns a discriminated outcome so the UI can
 * decide what to tell the user.
 */
export function runMigrations(store: Store): MigrationOutcome {
  const storedRaw = store.backend.getItem(prefixed(Keys.version));
  const stored = storedRaw === null ? null : Number(storedRaw);

  if (stored === null || Number.isNaN(stored)) {
    // Fresh install. Seed the version; do nothing else.
    store.write(Keys.version, CURRENT_SCHEMA_VERSION);
    return { status: 'fresh', version: CURRENT_SCHEMA_VERSION };
  }

  if (stored === CURRENT_SCHEMA_VERSION) {
    return { status: 'upToDate', version: CURRENT_SCHEMA_VERSION };
  }

  if (stored > CURRENT_SCHEMA_VERSION) {
    return {
      status: 'downgrade',
      storedVersion: stored,
      appVersion: CURRENT_SCHEMA_VERSION,
    };
  }

  // stored < CURRENT — run every migration whose key is in (stored, CURRENT].
  const targets = Object.keys(migrations)
    .map((k) => Number(k))
    .filter((v) => v > stored && v <= CURRENT_SCHEMA_VERSION)
    .sort((a, b) => a - b);

  for (const v of targets) {
    const step = migrations[v];
    if (!step) continue;
    step(store);
  }

  store.write(Keys.version, CURRENT_SCHEMA_VERSION);
  return {
    status: 'migrated',
    fromVersion: stored,
    toVersion: CURRENT_SCHEMA_VERSION,
  };
}
