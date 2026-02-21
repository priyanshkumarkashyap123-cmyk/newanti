import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
    plugins: [react() as any],
    test: {
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        exclude: [
            'dist',
        ],
        testTimeout: 15000,
        hookTimeout: 15000,
        teardownTimeout: 5000,
        pool: 'vmForks',  // vmForks handles heavy module graphs best
        fileParallelism: false,  // Run test files sequentially to reduce memory pressure
        maxConcurrency: 3,
        server: {
            deps: {
                inline: ['react-router-dom', 'react-router'],
            },
        },
        coverage: {
            reporter: ['text', 'json', 'html', 'lcov'],
            exclude: ['node_modules/', 'src/__tests__/', 'src/**/*.d.ts', 'src/**/*.stories.tsx'],
            // Minimum coverage thresholds — CI will fail if these are not met.
            // Ramp these up over time: target 60% statements, 50% branches by Q3.
            thresholds: {
                statements: 20,
                branches: 15,
                functions: 15,
                lines: 20,
            },
        },
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
});
