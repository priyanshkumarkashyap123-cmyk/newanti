// ESLint configuration for the BeamLab Ultimate web project
// Uses the new ESLint flat config format (eslint.config.js)

import baseConfig from '../../configs/eslint.base.mjs';
import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    baseConfig,
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            react: reactPlugin,
            'react-hooks': reactHooksPlugin,
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...reactHooksPlugin.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-empty-interface': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'no-case-declarations': 'off',
            '@typescript-eslint/no-unused-expressions': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            'no-loss-of-precision': 'warn',
            '@typescript-eslint/no-require-imports': 'error',
        },
    },
    {
        ignores: [
            'dist/**',
            'node_modules/**',
            'coverage/**',
            '*.config.js',
            '*.config.cjs',
            '.*.cjs',
            '*.d.ts',
            'tests/**/*.js',
            'public/**',
            '.storybook/**',
            'components/**',
            'e2e/**',
            'playwright.config.ts',
            'lighthouserc.js',
            'src/libs/**/*.js'
        ]
    }
);
