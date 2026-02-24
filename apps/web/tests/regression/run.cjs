#!/usr/bin/env node
/**
 * Lightweight regression harness bootstrap.
 * Scans tests/regression fixtures and reports count. 
 * TODO: wire engine adapters to validate outputs against goldens.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../../');
const FIXTURE_DIR = path.join(ROOT, 'tests', 'regression');

function collectFixtures(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...collectFixtures(p));
    else if (e.isFile() && e.name.endsWith('.json')) files.push(p);
  }
  return files;
}

function main() {
  if (!fs.existsSync(FIXTURE_DIR)) {
    console.warn(`Fixture directory not found: ${FIXTURE_DIR}`);
    process.exit(0);
  }

  const fixtures = collectFixtures(FIXTURE_DIR);
  console.log(`Found ${fixtures.length} regression fixtures.`);
  fixtures.forEach((f) => {
    const rel = path.relative(ROOT, f);
    console.log(`- ${rel}`);
  });

  console.log('\nTODO: implement engine runners and comparisons to goldens.');
}

main();
