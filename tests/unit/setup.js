import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock WebView2 / External IPC Bridge for Vitest
window.external = {
  ExecuteAction: vi.fn(),
};

window.chrome = {
  webview: {
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
  },
};
