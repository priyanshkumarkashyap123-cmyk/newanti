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
        },
    },

    // Global ignores
    {
        ignores: ['dist/**', 'node_modules/**', 'coverage/**', '*.config.js', '*.d.ts']
    }
);
