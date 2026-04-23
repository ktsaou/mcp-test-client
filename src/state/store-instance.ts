/**
 * Shared Store instance backed by window.localStorage.
 *
 * Created lazily on first use so module import itself never touches the DOM.
 */

import { Store, type StorageLike } from '../persistence/store.ts';

type Handler = (err: Error, ctx: { key: string; op: 'write' | 'remove' }) => void;

let errorHandler: Handler = (err, ctx) => {
  console.warn(`[persistence] ${ctx.op} failed for ${ctx.key}:`, err);
};

export function setPersistenceErrorHandler(handler: Handler): void {
  errorHandler = handler;
}

let cached: Store | null = null;
let overrideStorage: StorageLike | null = null;

function resolveStorage(): StorageLike {
  if (overrideStorage !== null) return overrideStorage;
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis) {
    return (globalThis as { localStorage: StorageLike }).localStorage;
  }
  throw new Error('localStorage is not available in this environment');
}

export function getAppStore(): Store {
  if (cached === null) {
    cached = new Store(resolveStorage(), (err, ctx) => errorHandler(err, ctx));
  }
  return cached;
}

/**
 * For tests: swap the underlying Storage. Call with `null` to reset.
 */
export function __setStorageForTests(storage: StorageLike | null): void {
  overrideStorage = storage;
  cached = null;
}

/**
 * Convenience object that forwards every Store call through `getAppStore()`.
 * Prefer this in component code so call-sites remain terse.
 */
export const appStore = {
  read<T>(key: string): T | undefined {
    return getAppStore().read<T>(key);
  },
  write<T>(key: string, value: T): boolean {
    return getAppStore().write(key, value);
  },
  remove(key: string): void {
    getAppStore().remove(key);
  },
  keys(): string[] {
    return getAppStore().keys();
  },
  clearAll(): void {
    getAppStore().clearAll();
  },
};
