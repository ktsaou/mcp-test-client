// Vitest setup — runs once before every test file.
import '@testing-library/jest-dom/vitest';

/**
 * Neither jsdom nor happy-dom in vitest 4 reliably expose a functional
 * localStorage; both give back an empty object. Install a simple in-memory
 * polyfill so components that touch `window.localStorage` work in tests.
 */
class MemoryLocalStorage implements Storage {
  #data = new Map<string, string>();

  get length(): number {
    return this.#data.size;
  }

  key(index: number): string | null {
    return [...this.#data.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.#data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.#data.delete(key);
  }

  clear(): void {
    this.#data.clear();
  }
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: new MemoryLocalStorage(),
    configurable: true,
    writable: true,
  });
}
