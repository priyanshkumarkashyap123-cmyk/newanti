#!/usr/bin/env node
/*
 * Refactor audit for LOC compaction and route replaceability.
 * Usage: node scripts/refactor_audit.cjs
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = process.cwd();
const ALLOW_EXPANSION_PERCENT = Number(process.env.ALLOW_EXPANSION_PERCENT ?? 0);
const GROUP_ALLOW_EXPANSION_PERCENT = {
  designRoutes: Number(process.env.ALLOW_EXPANSION_PERCENT_DESIGN_ROUTES ?? 300),
};

let hasFailure = false;

function safeRead(relPath) {
  const full = path.join(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

function countLines(relPath) {
  const text = safeRead(relPath);
  if (!text) return 0;
  return text.split(/\r?\n/).length;
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function isThinReExportFile(relPath) {
  const text = safeRead(relPath);
  if (!text) return false;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > 3) return false;
  return lines.some((line) => /export\s*\{\s*default\s*\}\s*from/.test(line));
}

function extractRoutes(relPath) {
  const text = safeRead(relPath);
  const routes = [];
  const re = /router\.(get|post|put|patch|delete)\(\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    routes.push(`${m[1].toUpperCase()} ${m[2]}`);
  }
  return routes;
}

function unique(list) {
  return [...new Set(list)].sort();
}

function withPrefix(routes, prefix) {
  return routes.map((entry) => {
    const [method, routePath] = entry.split(" ");
    const normalized = routePath.startsWith("/") ? routePath : `/${routePath}`;
    return `${method} ${prefix}${normalized}`;
  });
}

function diffMissing(source, target) {
  const t = new Set(target);
  return source.filter((item) => !t.has(item));
}

function printSection(title) {
  console.log(`\n=== ${title} ===`);
}

const groups = {
  designRoutes: {
    old: ["apps/api/src/routes/design/index.ts"],
    present: [
      "apps/api/src/routes/design/index-modular.ts",
      "apps/api/src/routes/design/legacyCompat.ts",
      "apps/api/src/routes/design/middleware/forwardingUtils.ts",
      "apps/api/src/routes/design/steel/index.ts",
      "apps/api/src/routes/design/concrete/index.ts",
      "apps/api/src/routes/design/connections/index.ts",
      "apps/api/src/routes/design/geotech/index.ts",
    ],
  },
  optimization: {
    old: ["apps/web/src/optimization/StructuralOptimization.ts"],
    present: [
      "apps/web/src/optimization/types.ts",
      "apps/web/src/optimization/core/BaseOptimizer.ts",
    ],
  },
  promptBuilder: {
    old: ["apps/web/src/services/gemini_service/prompt_builder.ts"],
    present: [
      "apps/web/src/services/gemini_service/contextBuilders/modelContextPrompt.ts",
      "apps/web/src/services/gemini_service/templates/systemPrompt.ts",
      "apps/web/src/services/gemini_service/templates/taskPrompts.ts",
    ],
  },
};

printSection("LOC Compaction Report");
for (const [name, cfg] of Object.entries(groups)) {
  if (name === "designRoutes" && isThinReExportFile("apps/api/src/routes/design/index.ts")) {
    cfg.old = ["apps/api/src/routes/design/legacyCompat.ts"];
  }

  const missingOld = cfg.old.filter((f) => !exists(f));
  if (missingOld.length > 0) {
    hasFailure = true;
    console.log(`\n[${name}]`);
    console.log("status: FAIL");
    console.log("reason: missing baseline file(s)");
    missingOld.forEach((f) => console.log(`  - ${f}`));
    continue;
  }

  const oldLines = cfg.old.reduce((sum, f) => sum + countLines(f), 0);
  const presentLines = cfg.present.reduce((sum, f) => sum + countLines(f), 0);
  const delta = oldLines - presentLines;
  const pct = oldLines > 0 ? ((delta / oldLines) * 100).toFixed(1) : "0.0";
  const growthPct =
    oldLines > 0 && presentLines > oldLines
      ? (((presentLines - oldLines) / oldLines) * 100).toFixed(1)
      : "0.0";
  console.log(`\n[${name}]`);
  console.log(`old LOC: ${oldLines}`);
  console.log(`present LOC: ${presentLines}`);
  console.log(`delta LOC (old - present): ${delta}`);
  console.log(`compaction: ${pct}%`);
  if (oldLines <= 0) {
    hasFailure = true;
    console.log("status: FAIL");
    console.log("reason: invalid baseline LOC (<= 0)");
    continue;
  }

  if (presentLines > oldLines) {
    const growthNum = Number(growthPct);
    const allowedExpansion =
      GROUP_ALLOW_EXPANSION_PERCENT[name] ?? ALLOW_EXPANSION_PERCENT;
    if (growthNum > allowedExpansion) {
      hasFailure = true;
      console.log("status: FAIL");
      console.log(
        `reason: expanded by ${growthPct}% (allowed ${allowedExpansion.toFixed(1)}%)`
      );
    } else {
      console.log(
        `note: expanded by ${growthPct}% within allowed limit ${allowedExpansion.toFixed(1)}%`
      );
    }
  } else {
    console.log("status: PASS");
  }
}

printSection("Design Route Replaceability Check");
const legacyRouteSource = isThinReExportFile("apps/api/src/routes/design/index.ts")
  ? "apps/api/src/routes/design/legacyCompat.ts"
  : "apps/api/src/routes/design/index.ts";
const oldRoutes = unique(extractRoutes(legacyRouteSource));
const modularRoutesRaw = [
  ...extractRoutes("apps/api/src/routes/design/index-modular.ts"),
  ...extractRoutes("apps/api/src/routes/design/legacyCompat.ts"),
  ...withPrefix(extractRoutes("apps/api/src/routes/design/steel/index.ts"), "/steel"),
  ...withPrefix(extractRoutes("apps/api/src/routes/design/concrete/index.ts"), "/concrete"),
  ...withPrefix(extractRoutes("apps/api/src/routes/design/connections/index.ts"), "/connections"),
  ...withPrefix(extractRoutes("apps/api/src/routes/design/geotech/index.ts"), "/geotech"),
];
const modularRoutes = unique(modularRoutesRaw);

console.log(`legacy route count: ${oldRoutes.length}`);
console.log(`modular route count (normalized): ${modularRoutes.length}`);

const missingInModular = diffMissing(oldRoutes, modularRoutes);
if (oldRoutes.length === 0) {
  hasFailure = true;
  console.log("replaceability: FAIL (legacy route set is empty; cannot prove parity)");
} else if (missingInModular.length === 0) {
  console.log("replaceability: 100% route coverage parity achieved");
} else {
  hasFailure = true;
  console.log(`replaceability: NOT 100% (missing ${missingInModular.length} legacy routes)`);
  missingInModular.forEach((r) => console.log(`  - ${r}`));
}

printSection("Recommendation");
if (!hasFailure && missingInModular.length === 0) {
  console.log("Safe to switch DESIGN_ROUTER_VERSION=modular and schedule legacy deletion after test pass.");
} else {
  console.log("Keep legacy router active. Do not delete old file yet.");
  console.log("Use DESIGN_ROUTER_VERSION=modular in staging only and close missing route gaps first.");
}

if (hasFailure) {
  process.exit(1);
}
