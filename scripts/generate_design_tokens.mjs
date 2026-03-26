import { readFile, writeFile } from 'fs/promises';
import path from 'path';

const cssPath = path.resolve('apps/web/src/styles/base.css');
const outputPath = path.resolve('apps/web/src/styles/design-tokens.json');

async function main() {
  const css = await readFile(cssPath, 'utf8');

  // Extract `--token: value;` entries in the theme block
  const regex = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  const tokens = {};

  let match;
  while ((match = regex.exec(css)) !== null) {
    const key = match[1].trim();
    const value = match[2].trim();
    // Prioritize token names from theme-level only rather than body overridden.
    // Ignore tokens in <style> set by Tailwind generated classes like --tw-* with prefixes.
    if (key.startsWith('tw-') || key.startsWith('-tw-')) continue;
    tokens[key] = value;
  }

  // Generate a simple structured view from token groups
  const structured = {
    colors: {},
    typography: {},
    radius: {},
    elevation: {},
    transitions: {},
    animations: {},
    unknown: {},
  };

  for (const [key, value] of Object.entries(tokens)) {
    if (key.startsWith('color-')) {
      structured.colors[key] = value;
    } else if (key.startsWith('font-')) {
      structured.typography[key] = value;
    } else if (key.startsWith('radius-')) {
      structured.radius[key] = value;
    } else if (key.startsWith('elevation-')) {
      structured.elevation[key] = value;
    } else if (key.startsWith('transition-') || key.startsWith('duration-') || key.startsWith('ease-')) {
      structured.transitions[key] = value;
    } else if (key.startsWith('duration-') || key.startsWith('ease-')) {
      structured.animations[key] = value;
    } else {
      structured.unknown[key] = value;
    }
  }

  await writeFile(outputPath, JSON.stringify(structured, null, 2));

  console.log(`Design tokens exported to ${outputPath} (${Object.keys(tokens).length} tokens)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
