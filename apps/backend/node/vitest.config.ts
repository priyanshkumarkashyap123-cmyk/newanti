import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
        testTimeout: 15000,
        hookTimeout: 10000,
        coverage: {
            reporter: ['text', 'json', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'dist/'],
            thresholds: {
                statements: 15,
                branches: 10,
                functions: 15,
                lines: 15,
            },
        },
    },
});
