#!/usr/bin/env node

/**
 * Prevent browser runtime regressions by blocking Node/CommonJS-only globals
 * in web source files.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const webSrcDir = path.resolve(repoRoot, 'apps/web/src');

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);

const forbiddenPatterns = [
  {
    id: 'require-call',
    regex: /(^|[^\w$.])require\s*\(/g,
    message: 'CommonJS require() is not available in browser ESM builds. Use static import or dynamic import().',
  },
  {
    id: 'module-exports',
    regex: /\bmodule\.exports\b/g,
    message: 'module.exports is Node/CommonJS-only. Use ESM export syntax.',
  },
  {
    id: 'exports-assignment',
    regex: /\bexports\.[A-Za-z_$][\w$]*\b/g,
    message: 'exports.* is Node/CommonJS-only. Use ESM export syntax.',
  },
  {
    id: 'dirname',
    regex: /\b__dirname\b/g,
    message: '__dirname is Node-only. Use import.meta.url and URL/file helpers where needed.',
  },
  {
    id: 'filename',
    regex: /\b__filename\b/g,
    message: '__filename is Node-only. Use import.meta.url and URL/file helpers where needed.',
  },
];

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
      continue;
    }

    const ext = path.extname(entry.name).toLowerCase();
    if (SOURCE_EXTENSIONS.has(ext)) files.push(fullPath);
  }

  return files;
}

function toRel(absPath) {
  return path.relative(repoRoot, absPath).replaceAll(path.sep, '/');
}

function lineNumberAt(content, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (content.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

async function main() {
  let files;
  try {
    files = await walk(webSrcDir);
  } catch (error) {
    console.error('❌ [web-compat] Could not scan apps/web/src');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const violations = [];

  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');

    for (const pattern of forbiddenPatterns) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;
      // eslint-disable-next-line no-cond-assign
      while ((match = regex.exec(content)) !== null) {
        const index = typeof match.index === 'number' ? match.index : 0;
        const line = lineNumberAt(content, index);
        violations.push({
          file: toRel(file),
          line,
          id: pattern.id,
          message: pattern.message,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log('✅ [web-compat] No Node/CommonJS browser-incompatible patterns found in apps/web/src');
    return;
  }

  console.error('❌ [web-compat] Found browser-incompatible patterns in web source:');
  for (const v of violations) {
    console.error(`  - ${v.file}:${v.line} [${v.id}] ${v.message}`);
  }
  console.error(`\nFailing check with ${violations.length} violation(s).`);
  process.exit(1);
}

main();
