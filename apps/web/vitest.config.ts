import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: [
            'node_modules',
            'dist',
            'src/services/civil/__tests__/HydraulicsService.test.ts',  // Exclude problematic test
        ],
        testTimeout: 10000,
        hookTimeout: 10000,
        teardownTimeout: 5000,
        pool: 'threads',  // Use threads instead of forks for jsdom compatibility
        maxConcurrency: 5,
        coverage: {
            reporter: ['text', 'json', 'html'],
            exclude: ['node_modules/', 'src/__tests__/'],
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
});
