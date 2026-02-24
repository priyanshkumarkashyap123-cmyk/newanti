/**
 * Commitlint configuration
 * 
 * Enforces conventional commit messages
 * 
 * Format: <type>(<scope>): <subject>
 * 
 * Types:
 *   feat:     New feature
 *   fix:      Bug fix
 *   docs:     Documentation changes
 *   style:    Code style changes (formatting, etc.)
 *   refactor: Code refactoring
 *   perf:     Performance improvements
 *   test:     Adding or updating tests
 *   build:    Build system or dependencies
 *   ci:       CI/CD configuration
 *   chore:    Maintenance tasks
 *   revert:   Reverting changes
 * 
 * Examples:
 *   feat(analysis): add beam deflection calculation
 *   fix(ui): resolve dark mode toggle issue
 *   docs: update API documentation
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Type must be one of the allowed values
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
      ],
    ],
    
    // Type is required
    'type-empty': [2, 'never'],
    
    // Subject is required
    'subject-empty': [2, 'never'],
    
    // Subject should not end with period
    'subject-full-stop': [2, 'never', '.'],
    
    // Subject should be lowercase
    'subject-case': [2, 'always', 'lower-case'],
    
    // Header max length (type + scope + subject)
    'header-max-length': [2, 'always', 200],
    
    // Body max line length - relaxed for semantic-release changelog bodies
    'body-max-line-length': [0, 'always', Infinity],
    
    // Footer max line length - relaxed for semantic-release
    'footer-max-line-length': [0, 'always', Infinity],
    
    // Scope is optional but should be lowercase
    'scope-case': [2, 'always', 'lower-case'],
  },
  
  // Custom scopes for this project
  prompt: {
    scopes: [
      'web',
      'api',
      'solver',
      'wasm',
      'ui',
      'analysis',
      'auth',
      'tests',
      'ci',
      'docs',
      'deps',
    ],
  },
};
