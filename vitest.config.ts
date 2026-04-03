import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Keep default include behavior, but never collect Playwright E2E suites.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      'apps/web/e2e/**',
      '**/apps/web/e2e/**',
      '**/playwright.config.*',
      '**/*.e2e.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
  },
});
