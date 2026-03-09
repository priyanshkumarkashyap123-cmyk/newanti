/**
 * bridgeService.ts - Bridge between TypeScript and Python Backend
 *
 * Provides a unified interface for communicating with the Python structural engine.
 */

// ============================================
// CONFIGURATION
// ============================================

import { API_CONFIG } from "../config/env";
import { logger } from '../lib/logging/logger';
import { fetchJson, postJson, fetchWithTimeout } from '../utils/fetchUtils';

// Use Rust API directly for templates (100x faster)
const RUST_API = API_CONFIG.rustUrl;
// Node API gateway for project CRUD (MongoDB backed)
const NODE_API = API_CONFIG.baseUrl;
// Python for AI features (Gemini)
const PYTHON_API = API_CONFIG.pythonUrl;

// ============================================
// TYPES
// ============================================

export interface BridgeNode {
  id: string;
  x: number;
  y: number;
  z: number;
  support?: "PINNED" | "FIXED" | "ROLLER" | "NONE";
}

export interface BridgeMember {
  id: string;
  start_node: string;
  end_node: string;
  section_profile: string;
  member_type?: string;
}

export interface StructuralModel {
  nodes: BridgeNode[];
  members: BridgeMember[];
  metadata?: Record<string, string>;
}

export interface BridgeResponse {
  success: boolean;
  model?: StructuralModel;
  error?: string;
}

/** Return type from trainPINN */
export interface PINNTrainResult {
  job_id: string;
  status?: string;
  [key: string]: unknown;
}

/** Return type from getPINNStatus */
export interface PINNStatusResult {
  progress: number;
  status: string;
  model_id?: string;
  [key: string]: unknown;
}

/** Return type from loadProject */
export interface ProjectData {
  id?: string;
  name?: string;
  nodes?: Record<string, unknown>[];
  members?: Record<string, unknown>[];
  civilData?: Record<string, unknown>[];
  [key: string]: unknown;
}

/** Return type from listProjects */
export interface ProjectListItem {
  id: string;
  name?: string;
  [key: string]: unknown;
}

export type TemplateType =
  | "beam"
  | "continuous_beam"
  | "truss"
  | "frame"
  | "portal";

export interface BeamParams {
  span?: number;
  spans?: string; // Comma-separated for continuous beam
  support_type?: "simple" | "fixed" | "cantilever";
}

export interface TrussParams {
  span?: number;
  height?: number;
  bays?: number;
}

export interface FrameParams {
  width?: number;
  length?: number;
  height?: number;
  stories?: number;
  bays_x?: number;
  bays_z?: number;
}

export interface PortalParams {
  width?: number;
  height?: number;
  roof_angle?: number;
}

export type TemplateParams =
  | BeamParams
  | TrussParams
  | FrameParams
  | PortalParams;

// ============================================
// BRIDGE SERVICE
// ============================================

export const Bridge = {
  /**
   * Check if Python server is online
   */
  async checkConnection(): Promise<boolean> {
    try {
      const response = await fetchWithTimeout<{ status: string }>(`${PYTHON_API}/health`, {
        timeout: 3000,
      });
      return response.success;
    } catch (e) {
      logger.warn('Bridge: Python server offline');
      return false;
    }
  },

  /**
   * Spawn a structural template from the Rust API
   *
   * @param type - Template type: beam, truss, frame, portal
   * @param params - Parameters for the template
   * @returns Structural model or null if server offline
   *
   * @example
   * const model = await Bridge.spawnTemplate('truss', { span: 12, height: 3, bays: 6 });
   */
  async spawnTemplate(
    type: TemplateType,
    params: TemplateParams = {},
  ): Promise<BridgeResponse | null> {
    try {
      // Build query string from params
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, String(value));
        }
      });

      // Use Rust API for templates (100x faster)
      const templateTypeMap: Record<TemplateType, string> = {
        beam: "beam",
        continuous_beam: "continuous-beam",
        truss: "truss",
        frame: "frame",
        portal: "portal",
      };

      const url = `${RUST_API}/api/templates/${templateTypeMap[type]}?${queryParams.toString()}`;

      const response = await fetchWithTimeout<{ success: boolean; nodes: Record<string, unknown>[]; members: Record<string, unknown>[]; metadata?: Record<string, string> }>(url, {});

      if (!response.success || !response.data) {
        logger.error('Bridge: Template fetch failed');
        return {
          success: false,
          error: response.error || 'Template fetch failed',
        };
      }

      const data = response.data;

      // Convert Rust response to Bridge format
      const bridgeResponse: BridgeResponse = {
        success: data.success,
        model: {
          nodes: data.nodes.map((n: Record<string, unknown>): BridgeNode => ({
            id: String(n.id),
            x: Number(n.x),
            y: Number(n.y),
            z: Number(n.z),
            support: "NONE",
          })),
          members: data.members.map((m: Record<string, unknown>): BridgeMember => ({
            id: String(m.id),
            start_node: String(m.startNodeId || m.start_node_id),
            end_node: String(m.endNodeId || m.end_node_id),
            section_profile: "ISMB300",
          })),
          metadata: data.metadata,
        },
      };

      logger.info('Bridge: Template loaded from Rust API', {
        type,
        nodeCount: bridgeResponse.model?.nodes.length,
        memberCount: bridgeResponse.model?.members.length,
      });

      return bridgeResponse;
    } catch (e) {
      logger.error('Bridge: Rust Template Server offline', { error: e });
      return null;
    }
  },

  /**
   * Generate structure from natural language prompt (AI)
   *
   * @param userText - Natural language description
   * @returns Structural model or null
   *
   * @example
   * const model = await Bridge.generateFromPrompt('Create a 15m bridge truss');
   */
  async generateFromPrompt(userText: string): Promise<BridgeResponse | null> {
    try {
      const response = await fetchWithTimeout<BridgeResponse>(`${PYTHON_API}/generate/ai`, {
        method: "POST",
        body: JSON.stringify({ prompt: userText }),
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error || 'AI generation failed',
        };
      }

      const data = response.data;

      logger.info('Bridge: AI generated model', {
        nodeCount: data.model?.nodes.length,
        memberCount: data.model?.members.length,
      });

      return data;
    } catch (e) {
      logger.error('Bridge: AI generation failed', { error: e });
      return null;
    }
  },

  /**
   * Validate a structural model
   *
   * @param model - Model to validate
   * @returns Validation result
   */
  async validateModel(model: StructuralModel): Promise<{
    valid: boolean;
    issues: string[];
    node_count: number;
    member_count: number;
    support_count: number;
  } | null> {
    try {
      const response = await fetchWithTimeout<{
        valid: boolean;
        issues: string[];
        node_count: number;
        member_count: number;
        support_count: number;
      }>(`${PYTHON_API}/validate`, {
        method: "POST",
        body: JSON.stringify(model),
      });
      return response.success ? response.data ?? null : null;
    } catch (e) {
      logger.error('Bridge: Validation failed', { error: e });
      return null;
    }
  },

  /**
   * Generate continuous beam with multiple spans
   *
   * @param spans - Array of span lengths
   * @returns Structural model
   */
  async spawnContinuousBeam(spans: number[]): Promise<BridgeResponse | null> {
    return this.spawnTemplate("continuous_beam", {
      spans: spans.join(","),
    });
  },

  /**
   * Generate Pratt truss
   *
   * @param span - Total span
   * @param height - Truss height
   * @param bays - Number of bays
   */
  async spawnTruss(
    span: number,
    height: number,
    bays: number,
  ): Promise<BridgeResponse | null> {
    return this.spawnTemplate("truss", { span, height, bays });
  },

  /**
   * Generate 3D building frame
   *
   * @param width - Width in X
   * @param length - Length in Z
   * @param height - Story height
   * @param stories - Number of stories
   */
  async spawnFrame(
    width: number,
    length: number,
    height: number,
    stories: number,
  ): Promise<BridgeResponse | null> {
    return this.spawnTemplate("frame", { width, length, height, stories });
  },

  /**
   * Generate portal frame with pitched roof
   *
   * @param width - Frame width
   * @param height - Eave height
   * @param roofAngle - Roof pitch angle
   */
  async spawnPortal(
    width: number,
    height: number,
    roofAngle: number = 15,
  ): Promise<BridgeResponse | null> {
    return this.spawnTemplate("portal", {
      width,
      height,
      roof_angle: roofAngle,
    });
  },

  // ============================================
  // PROJECT PERSISTENCE → Node.js API (MongoDB)
  // ============================================

  /**
   * List all saved projects
   */
  async listProjects(): Promise<ProjectListItem[]> {
    try {
      const response = await fetchWithTimeout<{ projects: ProjectListItem[] } | ProjectListItem[]>(`${NODE_API}/api/project`, {});
      if (!response.success || !response.data) return [];
      const result = response.data;
      // Handle both envelope and direct array response
      return Array.isArray(result) ? result : result.projects || [];
    } catch (e) {
      logger.error('Bridge: Failed to list projects', { error: e });
      return [];
    }
  },

  /**
   * Save project to backend
   */
  async saveProject(data: Record<string, unknown>): Promise<{ id: string; status: string } | null> {
    try {
      const response = await fetchWithTimeout<{ project: { id: string; status: string } } | { id: string; status: string }>(`${NODE_API}/api/project`, {
        method: "POST",
        body: JSON.stringify(data),
        withCsrf: true,
      });
      if (!response.success || !response.data) return null;
      const result = response.data;
      // Handle both envelope and direct response
      return 'project' in result ? result.project : result;
    } catch (e) {
      logger.error('Bridge: Failed to save project', { error: e });
      return null;
    }
  },

  /**
   * Load project from backend
   */
  async loadProject(id: string): Promise<ProjectData | null> {
    try {
      const response = await fetchWithTimeout<{ project: ProjectData } | ProjectData>(`${NODE_API}/api/project/${id}`, {});
      if (!response.success || !response.data) return null;
      const result = response.data;
      // Handle both envelope and direct response
      return ('project' in result ? result.project : result) as ProjectData;
    } catch (e) {
      logger.error('Bridge: Failed to load project', { error: e });
      return null;
    }
  },

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<boolean> {
    try {
      const response = await fetchWithTimeout(`${NODE_API}/api/project/${id}`, {
        method: "DELETE",
        withCsrf: true,
      });
      return response.success;
    } catch (e) {
      return false;
    }
  },

  // ============================================
  // PINN AI PHYSICS (Phase 4)
  // ============================================

  /**
   * Train a Physics-Informed Neural Network
   */
  async trainPINN(config: Record<string, unknown>): Promise<PINNTrainResult | null> {
    try {
      const response = await fetchWithTimeout<PINNTrainResult>(`${PYTHON_API}/pinn/train`, {
        method: "POST",
        body: JSON.stringify(config),
      });
      return response.success ? response.data ?? null : null;
    } catch (e) {
      logger.error('Bridge: PINN training failed', { error: e });
      return null;
    }
  },

  /**
   * Get PINN Training Status
   */
  async getPINNStatus(jobId: string): Promise<PINNStatusResult | null> {
    try {
      const response = await fetchWithTimeout<PINNStatusResult>(`${PYTHON_API}/pinn/status/${jobId}`, {});
      return response.success ? response.data ?? null : null;
    } catch (e) {
      return null;
    }
  },

  /**
   * Predict using trained PINN
   */
  async predictPINN(modelId: string, points = 100): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetchWithTimeout<Record<string, unknown>>(`${PYTHON_API}/pinn/predict`, {
        method: "POST",
        body: JSON.stringify({ model_id: modelId, num_points: points }),
      });
      return response.success ? response.data ?? null : null;
    } catch (e) {
      return null;
    }
  },
};

export default Bridge;
