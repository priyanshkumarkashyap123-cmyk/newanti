import baseConfig from '../../configs/eslint.base.mjs';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  baseConfig,
  ...tseslint.configs.recommended,
  {
    ignores: [
      'dist/**',
      'build/**',
      'coverage/**',
      '.turbo/**',
      '.oryx/**',
      'node_modules/**',
      'deploy-api/**',
      'deploy-package/**',
      'api-deploy*/**',
      '**/*.js',
      '**/*.cjs',
      '**/*.mjs',
      '**/*.jsx',
      '**/*.tsx',
      '**/*.json',
      '**/*.yaml',
      '**/*.yml',
      '**/*.zip',
      '**/*.tar.gz',
      '**/* 2.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      'no-console': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/__tests__/**/*.ts', 'tests/**/*.ts', '**/*.d.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['scripts/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  }
);
