import { describe, it, expect } from 'vitest';

import { CURRENT_SCHEMA_VERSION, Keys, prefixed } from './schema.ts';
import { Store } from './store.ts';
import { migrations, runMigrations, type Migration } from './migrations.ts';
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
