/**
 * Request Normalizer — Convert Node API Requests to Python-Compatible Format
 * 
 * This module provides functions to convert request payloads from Node.js (camelCase, Node defaults)
 * to Python-compatible format (snake_case, Python defaults).
 * 
 * Applied before sending requests to Python backend service.
 */

import { logger } from '../utils/logger.js';

// ============================================
// TYPES
// ============================================

interface NodeAnalysisRequest {
  schema_version?: number;
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    z?: number;
    restraints?: {
      fx?: boolean;
      fy?: boolean;
      fz?: boolean;
      mx?: boolean;
      my?: boolean;
      mz?: boolean;
    };
  }>;
  members: Array<{
    id: string;
    startNodeId: string;
    endNodeId: string;
    E?: number;
    A?: number;
    I?: number;
  }>;
  loads?: Array<{
    nodeId?: string;
    memberId?: string;
    [key: string]: unknown;
  }>;
  memberLoads?: Array<{
    memberId: string;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface PythonAnalysisRequest {
  schema_version?: number;
  nodes: Array<{
    id: string;
    x: number;
    y: number;
    z?: number;
    restraints?: Record<string, boolean>;
  }>;
  members: Array<{
    id: string;
    start_node_id: string;
    end_node_id: string;
    E?: number;
    A?: number;
    I?: number;
  }>;
  node_loads?: unknown[];
  distributed_loads?: unknown[];
  [key: string]: unknown;
}

interface NodeDesignRequest {
  code: string;
  method?: string;
  members: Array<{
    id: string;
    memberId?: string;
    section?: Record<string, number>;
    sectionProperties?: Record<string, number>;
    forces?: Record<string, number>;
    length?: number;
    Kx?: number;
    Ky?: number;
    Cb?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

interface PythonDesignRequest {
  code: string;
  method?: string;
  members: Array<{
    member_id: string;
    section_name?: string;
    section_properties?: Record<string, unknown>;
    forces?: Record<string, unknown>;
    length?: number;
    Kx?: number;
    Ky?: number;
    Cb?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

// ============================================
// ANALYSIS REQUEST NORMALIZATION
// ============================================

/**
 * Normalize a Node analysis request to Python-compatible format.
 * 
 * Changes:
 * - Converts startNodeId → start_node_id
 * - Converts endNodeId → end_node_id
 * - Ensures z coordinate defaults to 0 if missing
 * - Converts memberLoads → distributed_loads (TODO: determine correct mapping)
 * - Converts loads → node_loads
 * 
 * @param req - Request from Node API
 * @returns Python-compatible request
 */
export function normalizeAnalysisRequestForPython(
  req: NodeAnalysisRequest | Record<string, unknown>,
): Record<string, unknown> {
  const request = req as Record<string, unknown>;

  // Normalize nodes: ensure z defaults to 0
  const nodes = (request.nodes as Array<Record<string, unknown>>) || [];
  const normalizedNodes = nodes.map((node) => {
    const z = typeof node.z === 'number' ? node.z : 0;
    return { ...node, z };
  });

  // Normalize members: startNodeId → start_node_id, endNodeId → end_node_id
  const members = (request.members as Array<Record<string, unknown>>) || [];
  const normalizedMembers = members.map((member) => {
    const startNodeId = (member.startNodeId as string) || (member.start_node_id as string);
    const endNodeId = (member.endNodeId as string) || (member.end_node_id as string);
    const normalized = { ...member };
    if (startNodeId) normalized.start_node_id = startNodeId;
    if (endNodeId) normalized.end_node_id = endNodeId;
    return normalized;
  });

  // Determine loads field name (prefer node_loads if present, otherwise normalize loads)
  let nodeLoads = request.node_loads;
  if (!nodeLoads && request.loads) {
    nodeLoads = request.loads;
  }

  // Determine distributed_loads field name (prefer distributed_loads if present, otherwise normalize memberLoads)
  let distributedLoads = request.distributed_loads;
  if (!distributedLoads && request.memberLoads) {
    distributedLoads = request.memberLoads;
  }

  const normalized: Record<string, unknown> = {
    nodes: normalizedNodes,
    members: normalizedMembers,
    ...request,
  };

  // Replace or add snake_case fields
  if (nodeLoads !== undefined) {
    normalized.node_loads = nodeLoads;
  }
  if (distributedLoads !== undefined) {
    normalized.distributed_loads = distributedLoads;
  }

  // Remove camelCase originals to avoid confusion
  delete normalized.startNodeId;
  delete normalized.endNodeId;
  delete normalized.memberLoads;

  return normalized;
}

// ============================================
// DESIGN REQUEST NORMALIZATION
// ============================================

/**
 * Normalize a Node design request to Python-compatible format.
 * 
 * Changes:
 * - Converts member.id → member_id
 * - Converts section/sectionProperties → section_properties
 * - Ensures common fields like Kx, Ky, Cb have sensible defaults
 * 
 * @param req - Request from Node API
 * @returns Python-compatible request
 */
export function normalizeDesignRequestForPython(
  req: NodeDesignRequest | Record<string, unknown>,
): Record<string, unknown> {
  const request = req as Record<string, unknown>;

  const members = (request.members as Array<Record<string, unknown>>) || [];
  const normalizedMembers = members.map((member) => {
    // Use member_id if present, otherwise use id or memberId
    const memberId = (member.member_id as string) || (member.id as string) || (member.memberId as string) || 'unknown';

    // Merge section and sectionProperties into section_properties
    const sectionProps = (member.section_properties as Record<string, unknown>) ||
      (member.section as Record<string, unknown>) ||
      (member.sectionProperties as Record<string, unknown>) ||
      {};

    // Extract forces or create empty
    const forces = (member.forces as Record<string, unknown>) || {};

    // Get numeric values with defaults
    const kx = typeof member.Kx === 'number' ? member.Kx : 1.0;
    const ky = typeof member.Ky === 'number' ? member.Ky : 1.0;
    const cb = typeof member.Cb === 'number' ? member.Cb : 1.0;

    const normalized: Record<string, unknown> = { ...member };
    normalized.member_id = memberId;
    normalized.section_properties = sectionProps;
    normalized.forces = forces;
    normalized.Kx = kx;
    normalized.Ky = ky;
    normalized.Cb = cb;

    return normalized;
  });

  return {
    code: (request.code as string) || 'AISC360',
    method: (request.method as string) || 'LRFD',
    members: normalizedMembers,
    ...request,
  };
}

// ============================================
// SECTIONS REQUEST NORMALIZATION
// ============================================

/**
 * Normalize a Node sections request to Python-compatible format.
 * 
 * Changes:
 * - Converts shapeType → shape_type
 * - Converts custom field names to snake_case
 * 
 * @param req - Request from Node API
 * @returns Python-compatible request
 */
export function normalizeSectionsRequestForPython(
  req: Record<string, unknown>,
): Record<string, unknown> {
  const normalized = { ...req };

  // Convert common camelCase fields to snake_case
  if (normalized.shapeType) {
    normalized.shape_type = normalized.shapeType;
    delete normalized.shapeType;
  }

  if (normalized.sectionType) {
    normalized.section_type = normalized.sectionType;
    delete normalized.sectionType;
  }

  return normalized;
}

// ============================================
// GENERIC FIELD NAME NORMALIZATION
// ============================================

/**
 * Convert all camelCase field names to snake_case recursively.
 * Used as a fallback for endpoints not explicitly normalized above.
 * 
 * @param obj - Input object
 * @param depth - Current recursion depth (limit to prevent stack overflow)
 * @returns New object with snake_case field names
 */
export function convertCamelToSnakeCase(
  obj: unknown,
  depth = 0,
): unknown {
  if (depth > 10) {
    logger.warn('[RequestNormalizer] convertCamelToSnakeCase: max depth exceeded');
    return obj;
  }

  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => convertCamelToSnakeCase(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    result[snakeKey] = convertCamelToSnakeCase(value, depth + 1);
  }

  return result;
}

// ============================================
// REQUEST ROUTING
// ============================================

/**
 * Normalize a request payload based on the target endpoint.
 * 
 * @param method - HTTP method
 * @param path - Request path (e.g., "/analysis", "/design/check")
 * @param payload - Request body
 * @returns Normalized payload for Python backend
 */
export function normalizeRequestForPython(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  path: string,
  payload: unknown,
): unknown {
  if (method === 'GET' || !payload || typeof payload !== 'object') {
    return payload;
  }

  const req = payload as Record<string, unknown>;

  // Route to appropriate normalizer
  if (path.includes('/analysis') || path.includes('/analyze')) {
    return normalizeAnalysisRequestForPython(req);
  }

  if (path.includes('/design/check')) {
    return normalizeDesignRequestForPython(req);
  }

  if (path.includes('/sections')) {
    return normalizeSectionsRequestForPython(req);
  }

  // Fallback: convert all camelCase to snake_case
  return convertCamelToSnakeCase(payload);
}

// ============================================
// LOGGING & DEBUGGING
// ============================================

/**
 * Log differences between original and normalized request (debug level).
 * Useful for troubleshooting contract issues.
 * 
 * @param label - Label for logging
 * @param original - Original request
 * @param normalized - Normalized request
 */
export function logNormalizationDiff(
  label: string,
  original: unknown,
  normalized: unknown,
): void {
  if (process.env.DEBUG_REQUEST_NORMALIZATION !== 'true') {
    return;
  }

  const originalStr = JSON.stringify(original, null, 2);
  const normalizedStr = JSON.stringify(normalized, null, 2);

  if (originalStr !== normalizedStr) {
    logger.info(`[RequestNormalizer] ${label} — original: ${originalStr.substring(0, 200)}`);
    logger.info(`[RequestNormalizer] ${label} — normalized: ${normalizedStr.substring(0, 200)}`);
  }
}
