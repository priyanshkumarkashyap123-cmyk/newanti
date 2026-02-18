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
            'dist',
        ],
        testTimeout: 15000,
        hookTimeout: 15000,
        teardownTimeout: 5000,
        pool: 'vmForks',  // vmForks handles heavy module graphs best
        fileParallelism: false,  // Run test files sequentially to reduce memory pressure
        maxConcurrency: 3,
        deps: {
            inline: ['react-router-dom', 'react-router'],
        },
        server: {
            deps: {
                inline: ['react-router-dom', 'react-router'],
            },
        },
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
