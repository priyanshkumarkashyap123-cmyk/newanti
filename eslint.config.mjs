/**
 * Root ESLint configuration (flat config for ESLint v9+)
 * 
 * Individual apps have their own detailed configs.
 * This root config provides a minimal baseline for lint-staged.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        rules: {
            // Relax rules for cross-project root linting
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/ban-ts-comment': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-require-imports': 'off',
            'no-case-declarations': 'off',
            'no-empty': 'warn',
            'no-constant-condition': 'warn',
            'no-loss-of-precision': 'warn',
        },
    },
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/coverage/**',
            '**/*.config.js',
            '**/*.config.cjs',
            '**/*.config.mjs',
            '**/.*.cjs',
            '**/*.d.ts',
            '**/public/**',
            '.lintstagedrc.js',
            'commitlint.config.js',
        ],
    }
);
