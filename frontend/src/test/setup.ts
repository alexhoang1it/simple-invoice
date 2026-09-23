import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { setBearer } from '~/lib/http';

beforeEach(() => {
  window.localStorage.clear();
  setBearer(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// jsdom implements neither, and the shell touches both.
vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  addListener: vi.fn(),
  removeListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

window.scrollTo = vi.fn();
