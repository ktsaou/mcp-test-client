/**
 * Typed, namespaced localStorage wrapper.
 *
 * All reads/writes go through {@link Store}. The class:
 *   - prefixes every key with `mcptc:` (see `schema.ts`)
 *   - transparently serializes/deserializes JSON
 *   - reports quota-exceeded errors without throwing — a degraded write is
 *     preferable to crashing the app when the user has filled their browser's
 *     localStorage.
 *
 * Tests mock a `Storage`-compatible object; production passes `window.localStorage`.
 */

import { STORAGE_PREFIX, prefixed } from './schema.ts';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/**
 * Called on quota-exceeded or other write failures so the UI can surface a
 * toast without the caller having to catch.
 */
export type StoreErrorSink = (err: Error, context: { key: string; op: 'write' | 'remove' }) => void;

export class Store {
  #storage: StorageLike;
  #onError: StoreErrorSink | undefined;

  constructor(storage: StorageLike, onError?: StoreErrorSink) {
    this.#storage = storage;
    this.#onError = onError;
  }

  /** Read a value. Returns `undefined` if missing or parse-failed. */
  read<T>(key: string): T | undefined {
    const raw = this.#storage.getItem(prefixed(key));
    if (raw === null) return undefined;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  /** Write a value. Returns `true` on success, `false` on quota/IO failure. */
  write<T>(key: string, value: T): boolean {
    try {
      this.#storage.setItem(prefixed(key), JSON.stringify(value));
      return true;
    } catch (err) {
      this.#onError?.(err instanceof Error ? err : new Error(String(err)), {
        key,
        op: 'write',
      });
      return false;
    }
  }

  /** Remove a value. Silent no-op if missing. */
  remove(key: string): void {
    try {
      this.#storage.removeItem(prefixed(key));
    } catch (err) {
      this.#onError?.(err instanceof Error ? err : new Error(String(err)), {
        key,
        op: 'remove',
      });
    }
  }

  /** List every `mcptc:*` key currently present (without the prefix). */
  keys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < this.#storage.length; i++) {
      const k = this.#storage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) out.push(k.slice(STORAGE_PREFIX.length));
    }
    return out;
  }

  /** Remove every `mcptc:*` key. Used by the "Reset all stored data" action. */
  clearAll(): void {
    for (const k of this.keys()) this.remove(k);
  }

  /** Access the underlying backend — intended for one-off bulk operations. */
  get backend(): StorageLike {
    return this.#storage;
  }
}
