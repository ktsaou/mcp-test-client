import { describe, it, expect, vi } from 'vitest';

import { Store, type StorageLike } from './store.ts';

/** In-memory Storage-compatible mock used across persistence tests. */
export class MemoryStorage implements StorageLike {
  #data = new Map<string, string>();

  get length(): number {
    return this.#data.size;
  }

  key(index: number): string | null {
    const keys = [...this.#data.keys()];
    return keys[index] ?? null;
  }

  getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#data.set(key, value);
  }

  removeItem(key: string): void {
    this.#data.delete(key);
  }

  // Test hook: let a test simulate quota-exceeded on the next setItem.
  failNextWrite(err: Error = new DOMException('QuotaExceededError')): void {
    const realSet = this.setItem.bind(this);
    let tripped = false;
    this.setItem = (k: string, v: string) => {
      if (!tripped) {
        tripped = true;
        throw err;
      }
      realSet(k, v);
    };
  }

  snapshot(): Record<string, string> {
    return Object.fromEntries(this.#data);
  }
}

describe('Store', () => {
  it('prefixes every key with mcptc:', () => {
    const mem = new MemoryStorage();
    const store = new Store(mem);
    store.write('theme', 'dark');
    expect(mem.snapshot()['mcptc:theme']).toBe('"dark"');
    expect(mem.snapshot()['theme']).toBeUndefined();
  });

  it('round-trips JSON', () => {
    const store = new Store(new MemoryStorage());
    const value = { a: 1, b: ['x', 'y'] };
    store.write('servers', value);
    expect(store.read('servers')).toEqual(value);
  });

  it('returns undefined for missing keys', () => {
    const store = new Store(new MemoryStorage());
    expect(store.read('nope')).toBeUndefined();
  });

  it('returns undefined when the stored blob is malformed JSON', () => {
    const mem = new MemoryStorage();
    mem.setItem('mcptc:bad', '{not json');
    const store = new Store(mem);
    expect(store.read('bad')).toBeUndefined();
  });

  it('removes keys', () => {
    const mem = new MemoryStorage();
    const store = new Store(mem);
    store.write('theme', 'dark');
    store.remove('theme');
    expect(mem.snapshot()['mcptc:theme']).toBeUndefined();
  });

  it('reports quota failures via the error sink without throwing', () => {
    const mem = new MemoryStorage();
    const onError = vi.fn();
    const store = new Store(mem, onError);

    mem.failNextWrite();
    const ok = store.write('big', 'x');

    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalledOnce();
    const call = onError.mock.calls[0];
    expect(call).toBeDefined();
    expect(call?.[0]).toBeInstanceOf(Error);
    expect(call?.[1]).toEqual({ key: 'big', op: 'write' });
  });

  it('keys() returns only mcptc:* keys, stripped of the prefix', () => {
    const mem = new MemoryStorage();
    mem.setItem('other-app-thing', 'a');
    mem.setItem('mcptc:theme', '"dark"');
    mem.setItem('mcptc:servers', '[]');
    const store = new Store(mem);
    expect(store.keys().sort()).toEqual(['servers', 'theme']);
  });

  it('clearAll() wipes every mcptc:* key and leaves the rest intact', () => {
    const mem = new MemoryStorage();
    mem.setItem('other-app-thing', 'a');
    mem.setItem('mcptc:theme', '"dark"');
    mem.setItem('mcptc:servers', '[]');
    const store = new Store(mem);

    store.clearAll();

    expect(mem.snapshot()).toEqual({ 'other-app-thing': 'a' });
  });
});
