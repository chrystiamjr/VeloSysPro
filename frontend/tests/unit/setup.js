import '@testing-library/jest-dom';
import { vi } from 'vitest';

window.chrome = {
  webview: {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
};
