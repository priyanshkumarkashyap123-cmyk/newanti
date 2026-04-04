/**
 * API Response Validation Schemas
 * 
 * Zod schemas to validate all responses from backend APIs.
 * Ensures client-side resilience to schema drift.
 * 
 * Every response from rustApi, analysis endpoints, etc. is validated
 * against these schemas before being used in the application.
 */

import { z } from "zod";

/**
 * Common error response schema (all backends)
 */
export const ApiErrorResponseSchema = z.object({
  error: z.string().describe("Human-readable error message"),
  code: z.string().optional().describe("Machine-readable error code"),
  requestId: z.string().optional().describe("Request ID for correlation"),
  details: z.record(z.unknown()).optional().describe("Additional context"),
  timestamp: z.string().optional().describe("ISO timestamp"),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

/**
 * Analysis result schemas (Rust API responses)
 */

export const AnalysisNodeForceSchema = z.object({
  fx: z.number().describe("Axial force (kN)"),
  fy: z.number().describe("Shear force Y (kN)"),
  fz: z.number().describe("Shear force Z (kN)"),
  mx: z.number().describe("Moment X (kN·m)"),
  my: z.number().describe("Moment Y (kN·m)"),
  mz: z.number().describe("Moment Z (kN·m)"),
});

export const AnalysisNodeDisplacementSchema = z.object({
  dx: z.number().describe("Displacement X (mm)"),
  dy: z.number().describe("Displacement Y (mm)"),
  dz: z.number().describe("Displacement Z (mm)"),
  rx: z.number().describe("Rotation X (rad)"),
  ry: z.number().describe("Rotation Y (rad)"),
  rz: z.number().describe("Rotation Z (rad)"),
});

export const AnalysisResultSchema = z.object({
  success: z.boolean(),
  nodeForces: z.record(z.string(), AnalysisNodeForceSchema).optional(),
  nodeDisplacements: z.record(z.string(), AnalysisNodeDisplacementSchema).optional(),
  reactionForces: z.record(z.string(), AnalysisNodeForceSchema).optional(),
  timestamp: z.string(),
  analysisType: z.enum(["static", "pdelta", "modal", "buckling"]).optional(),
  error: ApiErrorResponseSchema.optional(),
  message: z.string().optional(),
});

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

/**
 * Design check result schemas (IS 456, IS 800, ACI 318, etc.)
 */

export const DesignCheckResultSchema = z.object({
  passed: z.boolean().describe("Did element pass the check?"),
  utilization: z.number().min(0).describe("Utilization ratio (0-1, >1 is failure)"),
  message: z.string().describe("Human-readable summary with code clause"),
  demands: z.record(z.unknown()).optional().describe("Applied demands"),
  capacities: z.record(z.unknown()).optional().describe("Calculated capacities"),
  code: z.string().optional().describe("Design code reference (e.g., IS 456 Cl. 40.1)"),
  safetyFactors: z.record(z.number()).optional().describe("Partial safety factors applied"),
  error: ApiErrorResponseSchema.optional(),
});

export type DesignCheckResult = z.infer<typeof DesignCheckResultSchema>;

/**
 * Report generation response schema
 */

export const ReportGenerationResponseSchema = z.object({
  success: z.boolean(),
  reportUrl: z.string().url().optional().describe("URL to download report"),
  reportId: z.string().optional().describe("Report ID for tracking"),
  format: z.enum(["pdf", "html", "docx"]).optional(),
  timestamp: z.string(),
  error: ApiErrorResponseSchema.optional(),
  message: z.string().optional(),
});

export type ReportGenerationResponse = z.infer<typeof ReportGenerationResponseSchema>;

/**
 * Validation helper functions
 */

export function validateAnalysisResult(data: unknown): {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
} {
  try {
    const validated = AnalysisResultSchema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return { success: false, error: `Analysis response validation failed: ${issues}` };
    }
    return { success: false, error: "Failed to validate analysis response" };
  }
}

export function validateDesignCheckResult(data: unknown): {
  success: boolean;
  data?: DesignCheckResult;
  error?: string;
} {
  try {
    const validated = DesignCheckResultSchema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return { success: false, error: `Design check response validation failed: ${issues}` };
    }
    return { success: false, error: "Failed to validate design check response" };
  }
}

export function validateReportGeneration(data: unknown): {
  success: boolean;
  data?: ReportGenerationResponse;
  error?: string;
} {
  try {
    const validated = ReportGenerationResponseSchema.parse(data);
    return { success: true, data: validated };
  } catch (err) {
    if (err instanceof z.ZodError) {
      const issues = err.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      return { success: false, error: `Report response validation failed: ${issues}` };
    }
    return { success: false, error: "Failed to validate report response" };
  }
}

export function parseApiError(data: unknown): {
  error: string;
  code?: string;
  remediation?: string;
} {
  if (!data || typeof data !== "object") {
    return { error: "Unknown error occurred" };
  }

  const obj = data as Record<string, unknown>;

  // Try to validate against error schema
  try {
    const errorData = ApiErrorResponseSchema.parse(data);
    return {
      error: errorData.error,
      code: errorData.code,
      // Remediation hints would be added from a separate mapping
    };
  } catch {
    // Fallback to generic extraction
    if (typeof obj.error === "string") {
      return { error: obj.error };
    }
    if (typeof obj.message === "string") {
      return { error: obj.message };
    }
    if (typeof obj.detail === "string") {
      return { error: obj.detail };
    }
    return { error: "An error occurred" };
  }
}
