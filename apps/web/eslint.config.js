// ESLint configuration for the BeamLab Ultimate web project
// Uses the new ESLint flat config format (eslint.config.js)

import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
    // Base recommended configs
    js.configs.recommended,
    ...tseslint.configs.recommended,

    // TypeScript specific config with type checking
    {
        languageOptions: {
            parserOptions: {
                project: './tsconfig.eslint.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    // React specific config
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
            // Logic from recommended configs that aren't flat config ready yet for plugins
            ...reactHooksPlugin.configs.recommended.rules,
            'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
            'react/prop-types': 'off', // Using TypeScript for props

            // Custom overrides
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            // Allow empty interfaces which are often used for React props
            '@typescript-eslint/no-empty-interface': 'off',
            // Allow any for rapid development (can be tightened later)
            '@typescript-eslint/no-explicit-any': 'warn',
            // Allow lexical declarations in case blocks (common pattern)
            'no-case-declarations': 'off',
            // Disable React compiler rules that are too strict for existing code
            '@typescript-eslint/no-unused-expressions': 'warn',
            '@typescript-eslint/ban-ts-comment': 'warn',
            // Disable rules that conflict with existing patterns
            '@typescript-eslint/no-unsafe-declaration-merging': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            'no-loss-of-precision': 'warn',
            '@typescript-eslint/no-require-imports': 'error',
        },
    },

    // Global ignores
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
