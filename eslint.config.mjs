/**
 * Root ESLint configuration (flat config for ESLint v9+)
 * 
 * Individual apps have their own detailed configs.
 * This root config provides a minimal baseline for lint-staged.
 */
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        plugins: {
            'react-hooks': reactHooks,
        },
        rules: {
            // Relax rules for cross-project root linting
            '@typescript-eslint/no-unused-vars': 'off',
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
            'no-undef': 'off',
            'prefer-const': 'off',
            'react-hooks/exhaustive-deps': 'off',
            'react-hooks/refs': 'off',
        },
    },
    {
        ignores: [
            '**/dist/**',
            '**/node_modules/**',
            '**/.copilot-safety-backup-*/**',
            'apps/backend-python/.venv/**',
            'deploy-pkg/**',
            'docs/**',
            'scripts/**',
            '**/pkg/**',
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
