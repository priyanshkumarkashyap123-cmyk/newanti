/**
 * lint-staged configuration
 *
 * Runs linters on staged files before commit
 */
module.exports = {
  // TypeScript/JavaScript files
  "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],

  // JSON files
  "*.json": ["prettier --write"],

  // CSS/SCSS files
  "*.{css,scss}": ["prettier --write"],

  // Markdown files
  "*.md": ["prettier --write"],

  // Rust files
  "*.rs": ["cargo fmt --"],
};
