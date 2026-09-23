import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';

function createStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key) {
      store.delete(key);
    },
    setItem(key, value) {
      store.set(key, value);
    },
  };
}

beforeEach(() => {
  // Specs that run in the node environment (the prerender's) have no window.
  if (typeof window === 'undefined') return;

  const storage = createStorage();

  Object.defineProperty(window, 'localStorage', {
    value: storage,
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
});
