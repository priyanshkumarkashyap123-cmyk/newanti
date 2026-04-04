/**
 * Project Serialization / Deserialization
 *
 * Feature: space-planning-accuracy-and-tools
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import type { HousePlanProject } from './types';

/**
 * Serializes a HousePlanProject to a JSON string.
 * Date objects are automatically converted to ISO strings by JSON.stringify.
 */
export function serializeProject(project: HousePlanProject): string {
  return JSON.stringify(project);
}

/**
 * Deserializes a JSON string to a HousePlanProject.
 * Revives ISO date strings (createdAt, updatedAt) back to Date objects.
 * Returns { error: string } if the string is malformed or missing required fields.
 */
export function deserializeProject(
  json: string
): HousePlanProject | { error: string } {
  try {
    const parsed = JSON.parse(json, dateReviver);
    const validation = validateProjectShape(parsed);
    if (!validation.valid) {
      return { error: `Invalid project structure: ${validation.reason}` };
    }
    return parsed as HousePlanProject;
  } catch (e) {
    return { error: `JSON parse error: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * Revives ISO date strings back to Date objects.
 * Matches strings like "2024-01-15T10:30:00.000Z"
 */
function dateReviver(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    // Only revive if it's a valid date
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return value;
}

/**
 * Validates that the parsed object has the minimum required shape for a HousePlanProject.
 */
function validateProjectShape(obj: unknown): { valid: boolean; reason?: string } {
  if (!obj || typeof obj !== 'object') {
    return { valid: false, reason: 'not an object' };
  }
  const p = obj as Record<string, unknown>;
  if (!p.id || typeof p.id !== 'string') {
    return { valid: false, reason: 'missing or invalid id' };
  }
  if (!Array.isArray(p.floorPlans)) {
    return { valid: false, reason: 'missing floorPlans array' };
  }
  if (!p.plot || typeof p.plot !== 'object') {
    return { valid: false, reason: 'missing plot object' };
  }
  if (!p.structural || typeof p.structural !== 'object') {
    return { valid: false, reason: 'missing structural object' };
  }
  return { valid: true };
}
