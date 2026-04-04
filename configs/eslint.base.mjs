import globals from "globals";

/**
 * Base ESLint config. Extend this in service-specific configs.
 */
export default {
  languageOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    globals: {
      ...globals.browser,
      ...globals.node,
    },
  },
  linterOptions: {
    reportUnusedDisableDirectives: true,
  },
  rules: {
    "no-console": "warn",
    "no-debugger": "warn",
    "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    eqeqeq: ["error", "always"],
    curly: ["error", "all"],
  },
};
