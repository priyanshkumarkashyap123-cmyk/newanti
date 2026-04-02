import {
  cacheSet,
  cacheGet,
  cacheDelPattern,
  cacheDel,
} from "./RedisClient.js";
import crypto from "crypto";

/**
 * Cache key patterns for different entity types
 * Useful for bulk invalidation by pattern
 */
export const CACHE_PATTERNS = {
  ANALYSIS: "analysis:*",
  SECTION: "section:*",
  DESIGN_TABLE: "design_table:*",
  STRUCTURE: "structure:*",
  PROJECT: "project:*",
};

/**
 * Cache TTL constants (in seconds)
 */
export const CACHE_TTL = {
  ANALYSIS_RESULT: 3600, // 1 hour - analysis results don't change
  SECTION_PROPERTY: 86400, // 24 hours - section database changes infrequently
  DESIGN_TABLE: 604800, // 7 days - design code tables don't change
  STRUCTURE_METADATA: 3600, // 1 hour - structure metadata
  COMPUTATION_RESULT: 1800, // 30 minutes - intermediate computation results
};

/**
 * Generate cache key for analysis result
 * Creates a hash of structure + load combination to ensure uniqueness
 * @param structureHash Hash of structure geometry
 * @param loadCombination Load combination identifier
 * @param analysisType Type of analysis (static, dynamic, buckling, etc.)
 */
export function getAnalysisCacheKey(
  structureHash: string,
  loadCombination: string,
  analysisType: string
): string {
  const combined = `${structureHash}:${loadCombination}:${analysisType}`;
  const hash = crypto.createHash("sha256").update(combined).digest("hex");
  return `analysis:${hash}`;
}

/**
 * Generate cache key for section properties
 * @param sectionId Section library ID
 */
export function getSectionCacheKey(sectionId: string): string {
  return `section:${sectionId}`;
}

/**
 * Generate cache key for design code tables
 * @param codeStandard Design code (IS456, IS800, ACI318, etc.)
 * @param tableType Type of table (reinforcement, stress limits, etc.)
 */
export function getDesignTableCacheKey(
  codeStandard: string,
  tableType: string
): string {
  return `design_table:${codeStandard}:${tableType}`;
}

/**
 * Generate cache key for structure metadata
 * @param structureId Structure document ID in MongoDB
 */
export function getStructureCacheKey(structureId: string): string {
  return `structure:${structureId}`;
}

/**
 * Generate cache key for project summary
 * @param projectId Project document ID in MongoDB
 */
export function getProjectCacheKey(projectId: string): string {
  return `project:${projectId}`;
}

/**
 * Create hash of structure geometry for cache key
 * Includes node coordinates, member connectivity, properties
 * @param structure Structural model object
 */
type BasicStructure = {
  nodes?: unknown;
  members?: unknown;
  elements?: unknown;
  materials?: unknown;
  sections?: unknown;
};

export function hashStructure(structure: BasicStructure): string {
  const json = JSON.stringify({
    nodes: structure.nodes ?? [],
    members: structure.members ?? [],
    elements: structure.elements ?? [],
    materials: structure.materials ?? [],
    sections: structure.sections ?? [],
  });
  return crypto.createHash("sha256").update(json).digest("hex");
}

// ============================================================================
// ANALYSIS CACHING STRATEGIES
// ============================================================================

/**
 * Cache analysis result with structure hash
 * @param structureHash Hash of structure geometry
 * @param loadCombination Load combination identifier
 * @param analysisType Analysis type
 * @param result Analysis result object
 */
export async function cacheAnalysisResult(
  structureHash: string,
  loadCombination: string,
  analysisType: string,
  result: unknown
): Promise<boolean> {
  const key = getAnalysisCacheKey(structureHash, loadCombination, analysisType);
  return cacheSet(key, result, CACHE_TTL.ANALYSIS_RESULT);
}

/**
 * Retrieve cached analysis result
 * Returns null if not found or expired
 */
export async function getCachedAnalysisResult(
  structureHash: string,
  loadCombination: string,
  analysisType: string
): Promise<unknown | null> {
  const key = getAnalysisCacheKey(structureHash, loadCombination, analysisType);
  return cacheGet(key);
}

/**
 * Invalidate all analysis cache for a structure
 * Called when structure geometry changes
 */
export async function invalidateStructureAnalysisCache(
  _structureHash: string
): Promise<number> {
  const pattern = `analysis:*`;
  // For better control, structure hash could be embedded in key
  // For now, pattern invalidation works but is broad
  return cacheDelPattern(pattern);
}

// ============================================================================
// SECTION CACHING STRATEGIES
// ============================================================================

/**
 * Cache section property data
 * @param sectionId Section ID
 * @param properties Section properties (area, inertia, etc.)
 */
export async function cacheSectionProperties(
  sectionId: string,
  properties: unknown
): Promise<boolean> {
  const key = getSectionCacheKey(sectionId);
  return cacheSet(key, properties, CACHE_TTL.SECTION_PROPERTY);
}

/**
 * Retrieve cached section properties
 */
export async function getCachedSectionProperties(
  sectionId: string
): Promise<unknown | null> {
  const key = getSectionCacheKey(sectionId);
  return cacheGet(key);
}

/**
 * Invalidate all section cache
 * Call when section library is updated
 */
export async function invalidateSectionCache(): Promise<number> {
  return cacheDelPattern(CACHE_PATTERNS.SECTION);
}

// ============================================================================
// DESIGN CODE TABLE CACHING STRATEGIES
// ============================================================================

/**
 * Cache design code lookup table
 * @param codeStandard Standard code (IS456, IS800, etc.)
 * @param tableType Table type identifier
 * @param table Table data
 */
export async function cacheDesignTable(
  codeStandard: string,
  tableType: string,
  table: unknown
): Promise<boolean> {
  const key = getDesignTableCacheKey(codeStandard, tableType);
  return cacheSet(key, table, CACHE_TTL.DESIGN_TABLE);
}

/**
 * Retrieve cached design table
 */
export async function getCachedDesignTable(
  codeStandard: string,
  tableType: string
): Promise<unknown | null> {
  const key = getDesignTableCacheKey(codeStandard, tableType);
  return cacheGet(key);
}

/**
 * Invalidate all design code tables
 * Call when design codes are updated
 */
export async function invalidateDesignTableCache(): Promise<number> {
  return cacheDelPattern(CACHE_PATTERNS.DESIGN_TABLE);
}

// ============================================================================
// STRUCTURE & PROJECT CACHING STRATEGIES
// ============================================================================

/**
 * Cache structure metadata
 * @param structureId MongoDB structure document ID
 * @param metadata Structure metadata
 */
export async function cacheStructureMetadata(
  structureId: string,
  metadata: unknown
): Promise<boolean> {
  const key = getStructureCacheKey(structureId);
  return cacheSet(key, metadata, CACHE_TTL.STRUCTURE_METADATA);
}

/**
 * Retrieve cached structure metadata
 */
export async function getCachedStructureMetadata(
  structureId: string
): Promise<unknown | null> {
  const key = getStructureCacheKey(structureId);
  return cacheGet(key);
}

/**
 * Invalidate structure cache when structure is updated
 */
export async function invalidateStructureMetadataCache(
  structureId: string
): Promise<boolean> {
  const key = getStructureCacheKey(structureId);
  return cacheDel(key);
}

/**
 * Cache project summary data
 */
export async function cacheProjectMetadata(
  projectId: string,
  metadata: unknown
): Promise<boolean> {
  const key = getProjectCacheKey(projectId);
  return cacheSet(key, metadata, CACHE_TTL.STRUCTURE_METADATA);
}

/**
 * Retrieve cached project metadata
 */
export async function getCachedProjectMetadata(
  projectId: string
): Promise<unknown | null> {
  const key = getProjectCacheKey(projectId);
  return cacheGet(key);
}

/**
 * Invalidate project cache when project is updated
 */
export async function invalidateProjectMetadataCache(
  projectId: string
): Promise<boolean> {
  const key = getProjectCacheKey(projectId);
  return cacheDel(key);
}

/**
 * Invalidate all caches for a user project
 * Called on bulk operations (delete, reset, etc.)
 */
export async function invalidateProjectAllCaches(
  projectId: string
): Promise<number> {
  // Delete project-specific caches
  await invalidateProjectMetadataCache(projectId);

  // Could extend to invalidate structures, analyses within this project
  // For now, uses pattern matching for broad invalidation
  return cacheDelPattern(CACHE_PATTERNS.ANALYSIS);
}
