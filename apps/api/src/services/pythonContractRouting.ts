/**
 * Python contract routing classifier.
 *
 * Centralizes endpoint-family detection for request normalization and response
 * denormalization. Avoid substring heuristics to reduce accidental matches.
 */

export type PythonContractKind = "analysis" | "design-check" | "sections" | "generic";

const ANALYSIS_PREFIXES = [
  "/analysis",
  "/analyze",
  "/api/analysis",
  "/api/analyze",
  "/api/v1/analysis",
  "/api/v1/analyze",
] as const;

const DESIGN_CHECK_PREFIXES = [
  "/design/check",
  "/api/design/check",
  "/api/v1/design/check",
] as const;

const SECTIONS_PREFIXES = [
  "/sections",
  "/api/sections",
  "/api/v1/sections",
] as const;

function normalizePath(path: string): string {
  const pathOnly = path.split("?")[0] ?? path;
  const trimmed = pathOnly.trim();
  if (!trimmed) return "/";
  return trimmed.endsWith("/") && trimmed.length > 1
    ? trimmed.slice(0, -1)
    : trimmed;
}

function matchesPrefix(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`);
}

export function classifyPythonContractPath(path: string): PythonContractKind {
  const normalized = normalizePath(path);

  if (ANALYSIS_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix))) {
    return "analysis";
  }

  if (DESIGN_CHECK_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix))) {
    return "design-check";
  }

  if (SECTIONS_PREFIXES.some((prefix) => matchesPrefix(normalized, prefix))) {
    return "sections";
  }

  return "generic";
}
