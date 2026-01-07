// ESLint configuration for the BeamLab Ultimate web project
// Uses the new ESLint flat config format (eslint.config.js)
// Extends recommended rules for React and TypeScript

import js from '@eslint/js';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default [
    js.configs.recommended,
    ...tseslint.configs.recommended,
    {
        files: ['**/*.{ts,tsx}'],
        languageOptions: {
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: import.meta.dirname,
            },
        },
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
            // Commonly used rules – adjust as needed
            'react/react-in-jsx-scope': 'off', // Not needed with new JSX transform
            'react/prop-types': 'off', // Using TypeScript for props
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-module-boundary-types': 'off',
        },
    },
];
