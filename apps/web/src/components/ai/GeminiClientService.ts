/**
 * GeminiClientService.ts
 *
 * Direct client-side Gemini API integration (free tier).
 * Calls Gemini 1.5 Flash directly from the browser — no backend needed.
 *
 * Used as a parallel provider alongside our local BeamLabAI engine.
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  ChatSession,
  Content,
} from "@google/generative-ai";
import { useModelStore } from "../../store/model";

// ============================================
// TYPES
// ============================================

export interface GeminiResponse {
  text: string;
  source: "gemini";
  model: string;
  tokensUsed?: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export interface GeminiChatMessage {
  role: "user" | "model";
  content: string;
}

// ============================================
// SYSTEM PROMPT
// ============================================

const SYSTEM_PROMPT = `You are the AI Architect assistant for **BeamLab** — a professional structural analysis & design web application (like STAAD.Pro / ETABS but browser-based).

You have deep expertise in:
1. **Structural Engineering**: beams, columns, trusses, frames, plates, cables, foundations
2. **Analysis Methods**: FEM, direct stiffness method, P-Delta, modal analysis, buckling, nonlinear
3. **Design Codes**: IS 800 (Indian steel), IS 456 (Indian concrete), AISC 360, Eurocode 3, AS 4100
4. **Materials**: structural steel (E250–E550), concrete (M15–M60), timber, aluminum, composites
5. **Section Properties**: ISMB, ISMC, ISA, W-shapes, HSS, pipe sections — I, Z, A, r, etc.
6. **Load Combinations**: Dead, Live, Wind, Seismic as per IS 875, ASCE 7, Eurocode 1
7. **Deflection & Serviceability**: L/300, L/360 limits, camber, vibration control
8. **Stability**: Euler buckling, LTB (lateral-torsional buckling), local buckling, frame stability
9. **Connection Design**: bolted, welded, moment connections, shear connections
10. **Software Concepts**: node numbering, member connectivity, support conditions, load cases

**Your personality:**
- Expert structural engineer but approachable
- Give practical, code-referenced answers
- Include formulas when useful (use text formatting, not LaTeX)
- Reference IS 800 / IS 456 by default (Indian codes) unless user specifies otherwise
- Keep answers concise but thorough
- When discussing the current model, use the context provided

**BeamLab commands the user can run (guide them):**
- "Add node at (x, y, z)" / "Add member from N1 to N2"
- "Apply 20 kN/m UDL on M1" / "Add 50 kN load at N3"
- "Add fixed/pinned/roller support at N1"
- "Show reactions" / "Show forces in M1" / "Max deflection?"
- "Show BMD" / "Show SFD" / "Check stability"
- "Select N1" / "Delete M3" / "Change section to ISMB400"

Always include practical BeamLab commands when relevant.`;

// ============================================
// GEMINI CLIENT SERVICE
// ============================================

class GeminiClientService {
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private chatSession: ChatSession | null = null;
  private apiKey: string = "";
  private modelName: string = "gemini-1.5-flash";
  private chatHistory: Content[] = [];
  private _isConfigured: boolean = false;

  constructor() {
    // Try to load API key from localStorage or env
    this.loadApiKey();
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  private loadApiKey(): void {
    // Priority: localStorage > env variable
    const storedKey = localStorage.getItem("beamlab_gemini_api_key");
    const envKey = import.meta.env.VITE_GEMINI_API_KEY;

    const key = storedKey || envKey || "";
    if (key) {
      this.configure(key);
    }
  }

  configure(apiKey: string, modelName?: string): void {
    this.apiKey = apiKey;
    this.modelName = modelName || "gemini-1.5-flash";

    if (!apiKey) {
      this._isConfigured = false;
      this.client = null;
      this.model = null;
      this.chatSession = null;
      return;
    }

    try {
      this.client = new GoogleGenerativeAI(apiKey);
      this.model = this.client.getGenerativeModel({
        model: this.modelName,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          topK: 40,
          maxOutputTokens: 2048,
        },
        systemInstruction: SYSTEM_PROMPT,
      });
      this._isConfigured = true;

      // Save key to localStorage
      localStorage.setItem("beamlab_gemini_api_key", apiKey);

      // Reset chat session
      this.chatSession = null;
      this.chatHistory = [];

// console.log("[GeminiClient] Configured with model:", this.modelName);
    } catch (err) {
      console.error("[GeminiClient] Configuration error:", err);
      this._isConfigured = false;
    }
  }

  get isConfigured(): boolean {
    return this._isConfigured && !!this.client && !!this.model;
  }

  getApiKey(): string {
    return this.apiKey;
  }

  removeApiKey(): void {
    localStorage.removeItem("beamlab_gemini_api_key");
    this.apiKey = "";
    this._isConfigured = false;
    this.client = null;
    this.model = null;
    this.chatSession = null;
  }

  // ============================================
  // CONTEXT BUILDER — Captures current model state
  // ============================================

  private buildModelContext(): string {
    const store = useModelStore.getState();
    const parts: string[] = [];

    if (store.nodes.size === 0 && store.members.size === 0) {
      parts.push("[Model is empty — no structure created yet]");
      return parts.join("\n");
    }

    parts.push(
      `[Current BeamLab Model: ${store.nodes.size} nodes, ${store.members.size} members]`,
    );

    // Supports
    const supports: string[] = [];
    store.nodes.forEach((n, id) => {
      if (n.restraints) {
        const r = n.restraints;
        if (r.fx && r.fy && r.fz && r.mx && r.my && r.mz)
          supports.push(`${id}: Fixed at (${n.x},${n.y},${n.z})`);
        else if (r.fx && r.fy && r.fz)
          supports.push(`${id}: Pinned at (${n.x},${n.y},${n.z})`);
        else if (r.fy) supports.push(`${id}: Roller at (${n.x},${n.y},${n.z})`);
      }
    });
    if (supports.length > 0) parts.push(`Supports: ${supports.join("; ")}`);

    // Loads summary
    if (store.loads.length > 0) parts.push(`Node loads: ${store.loads.length}`);
    if (store.memberLoads.length > 0)
      parts.push(`Member loads: ${store.memberLoads.length}`);

    // Sections used
    const sections = new Set<string>();
    store.members.forEach((m) => sections.add(m.sectionId || "Default"));
    if (sections.size > 0)
      parts.push(`Sections: ${Array.from(sections).join(", ")}`);

    // Analysis results
    if (store.analysisResults) {
      parts.push("[Analysis has been run — results available]");
      if (store.analysisResults.equilibriumCheck) {
        parts.push(
          `Equilibrium: ${store.analysisResults.equilibriumCheck.pass ? "PASS" : "FAIL"} (err=${store.analysisResults.equilibriumCheck.error_percent.toFixed(3)}%)`,
        );
      }
    } else {
      parts.push("[Analysis not yet run]");
    }

    // Selected elements
    if (store.selectedIds.size > 0) {
      parts.push(
        `Selected: ${Array.from(store.selectedIds).slice(0, 5).join(", ")}${store.selectedIds.size > 5 ? ` +${store.selectedIds.size - 5} more` : ""}`,
      );
    }

    return parts.join("\n");
  }

  // ============================================
  // CHAT (multi-turn conversation)
  // ============================================

  async chat(
    message: string,
    history?: GeminiChatMessage[],
  ): Promise<GeminiResponse> {
    if (!this.isConfigured || !this.model) {
      return {
        text: "",
        source: "gemini",
        model: this.modelName,
        latencyMs: 0,
        success: false,
        error: "Gemini API not configured. Add your API key in Settings.",
      };
    }

    const startTime = performance.now();

    try {
      // Build context-enriched message
      const context = this.buildModelContext();
      const enrichedMessage = `${context}\n\nUser: ${message}`;

      // Initialize chat if needed
      if (!this.chatSession) {
        this.chatSession = this.model.startChat({
          history: this.chatHistory,
        });
      }

      const result = await this.chatSession.sendMessage(enrichedMessage);
      const response = result.response;
      const text = response.text();

      // Track in history
      this.chatHistory.push(
        { role: "user", parts: [{ text: enrichedMessage }] },
        { role: "model", parts: [{ text }] },
      );

      // Keep history manageable (last 20 turns)
      if (this.chatHistory.length > 40) {
        this.chatHistory = this.chatHistory.slice(-40);
      }

      return {
        text,
        source: "gemini",
        model: this.modelName,
        latencyMs: performance.now() - startTime,
        success: true,
        tokensUsed: response.usageMetadata?.totalTokenCount,
      };
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : "Unknown Gemini error";
      console.error("[GeminiClient] Chat error:", err);

      // Handle rate limits
      if (errMsg.includes("429") || errMsg.toLowerCase().includes("rate")) {
        return {
          text: "",
          source: "gemini",
          model: this.modelName,
          latencyMs: performance.now() - startTime,
          success: false,
          error:
            "Gemini rate limit reached (free tier: 15 req/min). Please wait a moment.",
        };
      }

      return {
        text: "",
        source: "gemini",
        model: this.modelName,
        latencyMs: performance.now() - startTime,
        success: false,
        error: errMsg,
      };
    }
  }

  // ============================================
  // ONE-SHOT (no conversation context)
  // ============================================

  async generate(prompt: string): Promise<GeminiResponse> {
    if (!this.isConfigured || !this.model) {
      return {
        text: "",
        source: "gemini",
        model: this.modelName,
        latencyMs: 0,
        success: false,
        error: "Gemini not configured.",
      };
    }

    const startTime = performance.now();

    try {
      const context = this.buildModelContext();
      const result = await this.model.generateContent(
        `${context}\n\n${prompt}`,
      );
      const text = result.response.text();

      return {
        text,
        source: "gemini",
        model: this.modelName,
        latencyMs: performance.now() - startTime,
        success: true,
        tokensUsed: result.response.usageMetadata?.totalTokenCount,
      };
    } catch (err) {
      return {
        text: "",
        source: "gemini",
        model: this.modelName,
        latencyMs: performance.now() - startTime,
        success: false,
        error: err instanceof Error ? err.message : "Gemini generation error",
      };
    }
  }

  // ============================================
  // STRUCTURAL ANALYSIS HELPER
  // ============================================

  async analyzeStructure(question: string): Promise<GeminiResponse> {
    const store = useModelStore.getState();

    // Build detailed model description
    const detailedContext: string[] = [
      "STRUCTURAL MODEL DETAILS:",
      `Nodes (${store.nodes.size}):`,
    ];

    store.nodes.forEach((n, id) => {
      let support = "Free";
      if (n.restraints) {
        const r = n.restraints;
        if (r.fx && r.fy && r.fz && r.mx && r.my && r.mz) support = "Fixed";
        else if (r.fx && r.fy && r.fz) support = "Pinned";
        else if (r.fy) support = "Roller";
      }
      detailedContext.push(`  ${id}: (${n.x}, ${n.y}, ${n.z}) [${support}]`);
    });

    detailedContext.push(`Members (${store.members.size}):`);
    store.members.forEach((m, id) => {
      const s = store.nodes.get(m.startNodeId);
      const e = store.nodes.get(m.endNodeId);
      const len =
        s && e
          ? Math.sqrt(
              (e.x - s.x) ** 2 + (e.y - s.y) ** 2 + (e.z - s.z) ** 2,
            ).toFixed(2)
          : "?";
      detailedContext.push(
        `  ${id}: ${m.startNodeId}→${m.endNodeId} (${len}m) [${m.sectionId || "Default"}]`,
      );
    });

    if (store.loads.length > 0) {
      detailedContext.push(`Point Loads (${store.loads.length}):`);
      store.loads.forEach((l) => {
        detailedContext.push(
          `  ${l.nodeId}: Fx=${l.fx || 0}, Fy=${l.fy || 0}, Fz=${l.fz || 0} kN`,
        );
      });
    }

    if (store.memberLoads.length > 0) {
      detailedContext.push(`Member Loads (${store.memberLoads.length}):`);
      store.memberLoads.forEach((l) => {
        detailedContext.push(`  ${l.memberId}: ${l.type} w=${l.w1 || 0} kN/m`);
      });
    }

    if (store.analysisResults) {
      detailedContext.push("ANALYSIS RESULTS AVAILABLE");
      if (store.analysisResults.reactions) {
        detailedContext.push("Reactions:");
        store.analysisResults.reactions.forEach((r, nodeId) => {
          detailedContext.push(
            `  ${nodeId}: Fx=${r.fx.toFixed(2)}, Fy=${r.fy.toFixed(2)}, Mz=${r.mz.toFixed(2)}`,
          );
        });
      }
      if (store.analysisResults.displacements) {
        let maxD = 0,
          maxDNode = "";
        store.analysisResults.displacements.forEach((d, nId) => {
          const res = Math.sqrt(d.dx ** 2 + d.dy ** 2 + d.dz ** 2);
          if (res > maxD) {
            maxD = res;
            maxDNode = nId;
          }
        });
        detailedContext.push(
          `Max displacement: ${(maxD * 1000).toFixed(3)}mm at ${maxDNode}`,
        );
      }
    }

    const fullPrompt = `${detailedContext.join("\n")}\n\nENGINEER'S QUESTION: ${question}\n\nProvide a thorough structural engineering analysis. Include relevant formulas, code references (IS 800/IS 456), and practical recommendations.`;

    return this.generate(fullPrompt);
  }

  // ============================================
  // RESET CHAT
  // ============================================

  resetChat(): void {
    this.chatSession = null;
    this.chatHistory = [];
  }
}

// Singleton
export const geminiClient = new GeminiClientService();
export default geminiClient;
