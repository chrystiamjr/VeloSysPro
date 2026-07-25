import { defineConfig } from 'cypress';

export default defineConfig({
  viewportWidth: 1920,
  viewportHeight: 1080,
  retries: {
    runMode: 1,
    openMode: 0,
  },
  e2e: {
    baseUrl: 'http://localhost:5173',
    specPattern: 'tests/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'tests/e2e/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
  },
});
