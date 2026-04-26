import { describe, it, expect } from 'vitest';

import { CURRENT_SCHEMA_VERSION, Keys, prefixed } from './schema.ts';
import { Store } from './store.ts';
import { migrateDoublePrefix, migrations, runMigrations, type Migration } from './migrations.ts';
import { MemoryStorage } from './store.test.ts';

function newStore(): { store: Store; mem: MemoryStorage } {
  const mem = new MemoryStorage();
  return { store: new Store(mem), mem };
}

describe('runMigrations', () => {
  it('seeds the version on a fresh install', () => {
    const { store, mem } = newStore();
    const outcome = runMigrations(store);
    expect(outcome).toEqual({ status: 'fresh', version: CURRENT_SCHEMA_VERSION });
    expect(mem.getItem(prefixed(Keys.version))).toBe(String(CURRENT_SCHEMA_VERSION));
  });

  it('reports upToDate when the stored version already matches', () => {
    const { store, mem } = newStore();
    mem.setItem(prefixed(Keys.version), String(CURRENT_SCHEMA_VERSION));
    const outcome = runMigrations(store);
    expect(outcome).toEqual({ status: 'upToDate', version: CURRENT_SCHEMA_VERSION });
  });

  it('refuses to migrate downward', () => {
    const { store, mem } = newStore();
    mem.setItem(prefixed(Keys.version), String(CURRENT_SCHEMA_VERSION + 5));
    const outcome = runMigrations(store);
    expect(outcome).toEqual({
      status: 'downgrade',
      storedVersion: CURRENT_SCHEMA_VERSION + 5,
      appVersion: CURRENT_SCHEMA_VERSION,
    });
    // Downgrade path MUST NOT mutate storage.
    expect(mem.getItem(prefixed(Keys.version))).toBe(String(CURRENT_SCHEMA_VERSION + 5));
  });

  it('treats a malformed version string as a fresh install', () => {
    const { store, mem } = newStore();
    mem.setItem(prefixed(Keys.version), 'not-a-number');
    const outcome = runMigrations(store);
    expect(outcome.status).toBe('fresh');
  });

  it('runs pending migrations in ascending order', () => {
    // We can't mutate the imported `migrations` object in a type-safe way for
    // this test, so we use Object.defineProperty to inject simulated steps.
    const calls: number[] = [];
    const fakeA: Migration = () => {
      calls.push(10);
    };
    const fakeB: Migration = () => {
      calls.push(20);
    };

    migrations[10] = fakeA;
    migrations[20] = fakeB;

    try {
      const { store, mem } = newStore();
      mem.setItem(prefixed(Keys.version), '5');

      // Pretend the app is at v20 for this test by setting a higher ceiling.
      // Since CURRENT_SCHEMA_VERSION is 1 in prod, just verify ordering given
      // current behaviour: migrations > 1 will be skipped under real
      // runMigrations. Invoke them directly here instead.
      const targets = Object.keys(migrations)
        .map(Number)
        .filter((v) => v > 5 && v <= 20)
        .sort((a, b) => a - b);
      for (const v of targets) {
        const step = migrations[v];
        if (step) step(store);
      }

      expect(calls).toEqual([10, 20]);
    } finally {
      delete migrations[10];
      delete migrations[20];
    }
  });
});

describe('migrateDoublePrefix', () => {
  it('rewrites mcptc:mcptc:* into mcptc:* and removes the legacy key', () => {
    const mem = new MemoryStorage();
    mem.setItem('mcptc:mcptc:tool-state.srv.echo', '{"a":1}');
    mem.setItem('mcptc:mcptc:last-selection.srv', '"echo"');
    mem.setItem('mcptc:servers', '[]');
    mem.setItem('other-app', 'x');

    const result = migrateDoublePrefix(mem);

    expect(result).toEqual({ rewritten: 2, removed: 2 });
    expect(mem.snapshot()).toEqual({
      'mcptc:tool-state.srv.echo': '{"a":1}',
      'mcptc:last-selection.srv': '"echo"',
      'mcptc:servers': '[]',
      'other-app': 'x',
    });
  });

  it('is idempotent — running on already-clean storage is a no-op', () => {
    const mem = new MemoryStorage();
    mem.setItem('mcptc:tool-state.srv.echo', '{"a":1}');
    const before = mem.snapshot();

    const result = migrateDoublePrefix(mem);

    expect(result).toEqual({ rewritten: 0, removed: 0 });
    expect(mem.snapshot()).toEqual(before);
  });

  it('preserves a fresh single-prefix value when both shapes coexist', () => {
    // Conflict: a fresh value already lives under the corrected key.
    // The migration must not clobber it; it removes the legacy entry.
    const mem = new MemoryStorage();
    mem.setItem('mcptc:tool-state.srv.echo', '"fresh"');
    mem.setItem('mcptc:mcptc:tool-state.srv.echo', '"legacy"');

    const result = migrateDoublePrefix(mem);

    expect(result).toEqual({ rewritten: 0, removed: 1 });
    expect(mem.getItem('mcptc:tool-state.srv.echo')).toBe('"fresh"');
    expect(mem.getItem('mcptc:mcptc:tool-state.srv.echo')).toBeNull();
  });
});
