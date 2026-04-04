import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const workspaceRoot = process.cwd();
const indexFileCandidates = [
  "apps/backend/node/src/index.ts",
  "apps/api/src/index.ts",
];
const indexFile = indexFileCandidates
  .map((relPath) => resolve(workspaceRoot, relPath))
  .find((absPath) => existsSync(absPath));
const allowlistFile = resolve(
  workspaceRoot,
  "docs/specs/unversioned-route-allowlist.txt"
);

function loadAllowlist(filePath) {
  return new Set(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
  );
}

function extractUnversionedApiRoutes(fileContent) {
  const routes = new Set();
  const routeRegex =
    /\bapp\.(?:use|get|post|put|patch|delete)\(\s*["'](\/api\/(?!v1\/)[^"']*)["']/g;

  let match;
  while ((match = routeRegex.exec(fileContent)) !== null) {
    routes.add(match[1]);
  }

  return routes;
}

function main() {
  if (!indexFile) {
    console.error(
      `[Route Policy] Could not find backend entrypoint. Checked: ${indexFileCandidates.join(", ")}`
    );
    process.exit(1);
  }

  const fileContent = readFileSync(indexFile, "utf8");
  const allowlist = loadAllowlist(allowlistFile);
  const currentRoutes = extractUnversionedApiRoutes(fileContent);

  const unexpected = [...currentRoutes].filter((route) => !allowlist.has(route));

  if (unexpected.length > 0) {
    console.error("\n[Route Policy] New unversioned public API routes detected:\n");
    for (const route of unexpected.sort()) {
      console.error(` - ${route}`);
    }
    console.error(
      "\nPolicy: New public routes must use /api/v1/* during launch window."
    );
    console.error(
      "If this route is intentionally temporary, add it to docs/specs/unversioned-route-allowlist.txt with architecture approval.\n"
    );
    process.exit(1);
  }

  console.log(
    `[Route Policy] OK: ${currentRoutes.size} unversioned routes matched baseline allowlist.`
  );
}

main();
