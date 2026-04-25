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

  // Mantine's `Textarea` (autosize) and `ScrollArea` rely on browser APIs the
  // happy-dom environment doesn't ship: `document.fonts`, `ResizeObserver`,
  // and `matchMedia`. Stub them so component-level tests don't crash on
  // mount.
  if (typeof document !== 'undefined' && !(document as Document & { fonts?: unknown }).fonts) {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: {
        addEventListener: () => {},
        removeEventListener: () => {},
        ready: Promise.resolve(),
      },
    });
  }

  if (typeof window.ResizeObserver === 'undefined') {
    class StubResizeObserver {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: StubResizeObserver,
    });
  }

  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });
  }
}
