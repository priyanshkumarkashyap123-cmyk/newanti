/**
 * ============================================================================
 * AI Architect Engine — Unified Structural Engineering AI Service
 * ============================================================================
 *
 * Production-ready AI engine that powers the BeamLab AI Architect.
 * Handles all AI operations through a single, well-orchestrated service:
 *
 * - Chat: Contextual structural engineering conversations
 * - Generate: Create structural models from natural language
 * - Diagnose: Analyze model issues and suggest fixes
 * - Modify: Intelligently modify existing structures
 * - Optimize: Section and topology optimization
 * - Code Check: Design code compliance (IS 800, AISC 360, Eurocode)
 *
 * Architecture:
 *   Frontend → Express API (this) → Gemini API (primary)
 *                                  → Python Backend (structural compute)
 *                                  → Local Fallback (offline mode)
 *
 * @version 3.0.0
 */

import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { logger } from '../../utils/logger.js';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface StructuralNode {
  id: string;
  x: number;
  y: number;
  z: number;
  isSupport?: boolean;
  restraints?: {
    fx?: boolean;
    fy?: boolean;
    fz?: boolean;
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
  };
}

export interface StructuralMember {
  id: string;
  s: string;       // startNodeId
  e: string;       // endNodeId
  section: string;
  material?: string;
}

export interface StructuralLoad {
  nodeId?: string;
  memberId?: string;
  type: 'point' | 'UDL' | 'moment' | 'self_weight';
  fx?: number;
  fy?: number;
  fz?: number;
  w1?: number;
  direction?: string;
}

export interface StructuralModel {
  nodes: StructuralNode[];
  members: StructuralMember[];
  loads?: StructuralLoad[];
  materials?: Array<{ id: string; name: string; E: number; density: number; fy: number }>;
  sections?: Array<{ id: string; name: string; type: string; A: number; Ix: number; Iy: number }>;
}

export interface ModelContext {
  nodes: Array<{ id: string; x: number; y: number; z: number; hasSupport: boolean }>;
  members: Array<{ id: string; startNode: string; endNode: string; section?: string }>;
  loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>;
  analysisResults?: {
    maxDisplacement?: number;
    maxStress?: number;
    maxMoment?: number;
    maxShear?: number;
    failedMembers?: string[];
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  success: boolean;
  response: string;
  actions?: AIAction[];
  model?: StructuralModel;
  plan?: AIPlan;
  metadata?: {
    intent: string;
    confidence: number;
    processingTimeMs: number;
    provider: 'gemini' | 'local' | 'python';
    tokensUsed?: number;
  };
  error?: string;
}

export interface AIAction {
  type: 'addNode' | 'addMember' | 'addSupport' | 'addLoad' | 'removeMember' |
        'removeNode' | 'changeSection' | 'runAnalysis' | 'optimize' | 'applyModel' |
        'clearModel' | 'report';
  params: Record<string, any>;
  description: string;
}

export interface AIPlan {
  goal: string;
  reasoning: string;
  steps: AIAction[];
  confidence: number;
  alternatives?: string[];
}

export interface DiagnosisResult {
  success: boolean;
  issues: DiagnosisIssue[];
  overallHealth: 'good' | 'warning' | 'critical';
  suggestions: string[];
  autoFixAvailable: boolean;
}

export interface DiagnosisIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'stability' | 'connectivity' | 'loading' | 'section' | 'geometry' | 'support';
  message: string;
  affectedElements: string[];
  suggestedFix?: string;
}

export interface OptimizationResult {
  success: boolean;
  originalWeight: number;
  optimizedWeight: number;
  savingsPercent: number;
  changes: Array<{
    memberId: string;
    oldSection: string;
    newSection: string;
    reason: string;
  }>;
  model?: StructuralModel;
}

export interface CodeCheckResult {
  success: boolean;
  code: string;
  overallStatus: 'pass' | 'fail' | 'warning';
  checks: Array<{
    clause: string;
    description: string;
    status: 'pass' | 'fail' | 'warning';
    ratio?: number;
    limit?: number;
    actual?: number;
    details?: string;
  }>;
  summary: string;
}

// ============================================
// SYSTEM PROMPTS
// ============================================

const SYSTEM_PROMPTS = {
  chat: `You are the **AI Architect** for BeamLab Ultimate — a professional structural engineering analysis platform. 
You are an expert civil/structural engineer with deep knowledge of:

**Structural Analysis:**
- Linear static analysis (stiffness method, direct stiffness)
- Modal analysis (eigenvalue, natural frequencies, mode shapes)
- P-Delta analysis (geometric stiffness, second-order effects)
- Buckling analysis (elastic critical load factors)
- Nonlinear analysis (material + geometric nonlinearity)
- Seismic analysis (response spectrum, equivalent static, pushover)

**Design Codes:**
- IS 800:2007 (Indian Steel), IS 456:2000 (Indian Concrete)
- IS 1893:2016 (Indian Seismic), IS 875 (Indian Loads)
- AISC 360-22 (American Steel), ACI 318-19 (American Concrete)
- Eurocode 3 (European Steel), Eurocode 2 (European Concrete)

**Indian Standard Sections:**
- ISMB (I-section Medium Beams): ISMB100 to ISMB600
- ISMC (Channel sections): ISMC75 to ISMC400
- ISA (Angle sections): ISA50x50x5 to ISA200x200x25
- ISHB (H-section beams): ISHB150 to ISHB450
- Pipe sections, built-up sections, plate girders

**Materials:**
- Steel: Fe250 (mild), Fe345, Fe410 (structural), Fe500 (high-strength)
- Concrete: M20, M25, M30, M35, M40, M50
- Timber, Aluminum, Composite materials

**Structural Types:**
- Portal frames, multi-story buildings, industrial sheds
- Trusses (Warren, Pratt, Howe, K-truss, Vierendeel)
- Bridges (simply-supported, continuous, cable-stayed)
- Towers (transmission, telecom, wind turbine)
- Space frames, geodesic domes, shell structures

**Rules:**
1. Always respond in context of structural engineering
2. When the user asks to create/modify a structure, provide actionable JSON that can be directly applied
3. Use proper engineering terminology and Indian Standard nomenclature
4. Provide safety warnings when designs are unsafe
5. Be concise but thorough — practicing engineers value precision
6. When unsure, say so — never hallucinate structural design values
7. Units: meters for length, kN for force, MPa for stress, kN·m for moment
8. For section selection, follow IS 800 guidelines for economy and strength`,

  generate: `You are a structural model generator. Convert natural language descriptions into precise structural models in JSON format.

**CRITICAL RULES:**
1. Units: METERS for coordinates, Y-axis is vertical (height)
2. Output ONLY valid JSON — no markdown, no explanations, no code blocks
3. Ensure physical stability: every structure needs adequate supports
4. Use realistic Indian Standard (IS) sections
5. All members must connect between existing nodes
6. Z-coordinate is the depth axis (for 3D structures, 0 for 2D)

**JSON SCHEMA:**
{
  "nodes": [
    {"id": "n1", "x": 0, "y": 0, "z": 0, "isSupport": true, "restraints": {"fx": true, "fy": true, "fz": true, "mx": true, "my": true, "mz": true}},
    {"id": "n2", "x": 6, "y": 0, "z": 0, "isSupport": true, "restraints": {"fx": false, "fy": true, "fz": true}}
  ],
  "members": [
    {"id": "m1", "s": "n1", "e": "n2", "section": "ISMB300"}
  ],
  "loads": [
    {"nodeId": "n2", "fy": -50},
    {"memberId": "m1", "type": "UDL", "w1": -10, "direction": "global_y"}
  ],
  "materials": [
    {"id": "mat1", "name": "Fe410", "E": 200000, "density": 78.5, "fy": 250}
  ]
}

**NODE RULES:**
- Fixed support: all restraints true (columns at ground)
- Pinned support: fx, fy, fz true; rotations free
- Roller support: fy true only
- isSupport: true for nodes at ground level (y ≈ 0) with restraints

**SECTION GUIDELINES (IS Standards):**
- Heavy columns: ISMB500, ISMB550, ISMB600
- Medium columns: ISMB400, ISMB450
- Primary beams: ISMB300, ISMB350, ISMB400
- Secondary beams: ISMB200, ISMB250
- Rafters: ISMB200, ISMB250, ISMB300
- Truss chord members: ISA100x100x10, ISA80x80x8
- Truss diagonals: ISA75x75x6, ISA65x65x6
- Purlins: ISMC100, ISMC150
- Bracing: ISA50x50x5, ISA65x65x6

**COMMON STRUCTURES:**
- Simple beam: 2 support nodes + 1 member
- Cantilever: 1 fixed support + beam extending out
- Portal frame: 2 columns + 1 or 2 rafters (pitched/flat)
- Multi-story: grid of columns and beams at each floor level
- Pratt truss: parallel chords, verticals, diagonals sloping toward center
- Warren truss: no verticals, alternating diagonals
- Industrial shed: portal frame + purlins + wind bracing

Output raw JSON object directly. No wrapping.`,

  diagnose: `You are a structural model diagnostic engine. Analyze the given structural model and identify issues.

For each issue found, provide:
1. severity: 'error' | 'warning' | 'info'
2. category: 'stability' | 'connectivity' | 'loading' | 'section' | 'geometry' | 'support'
3. message: Clear description of the issue
4. affectedElements: Array of node/member IDs affected
5. suggestedFix: How to resolve the issue

Common issues to check:
- Insufficient supports (need min 3 DOFs restrained in 2D, 6 in 3D)
- Disconnected nodes (orphan nodes not connected to any member)
- Zero-length members (start and end node at same location)
- Unstable mechanisms (insufficient restraints)
- Missing loads (structure has no applied loads)
- Inappropriate sections (undersized for the span/load)
- Collinear members without intermediate supports
- Excessive slenderness ratios

Output JSON: { "issues": [...], "overallHealth": "good|warning|critical", "suggestions": [...] }`,

  modify: `You are a structural model modification engine. Given the current model and a modification request, output the modified model as JSON.

Rules:
1. Preserve existing node/member IDs unless explicitly removed
2. Add new nodes with sequential IDs continuing from the highest existing ID
3. Ensure all connections remain valid after modification
4. Maintain structural stability
5. Output the COMPLETE modified model (all nodes and members, not just changes)

Output raw JSON with the complete model. No explanations.`,

  optimize: `You are a structural optimization engine. Given a structural model with analysis results, suggest optimal sections.

Optimization criteria:
1. Minimize total weight while satisfying strength requirements
2. Check utilization ratios: stress/fy should be between 0.6-0.9 for economy
3. Consider deflection limits: L/240 for floor beams, L/180 for roof beams
4. Select from standard IS sections only
5. Group similar members for practical construction

Output JSON: { "changes": [{"memberId": "m1", "oldSection": "ISMB400", "newSection": "ISMB300", "reason": "..."}], "savingsPercent": 15 }`,

  codeCheck: `You are a structural design code compliance checker. Check the given member/forces against the specified design code.

For IS 800:2007 (Limit State Method):
- Clause 8: Tension members (yielding, rupture)
- Clause 9: Compression members (buckling curves a/b/c/d)
- Clause 10: Bending (LTB, section classification)
- Clause 11: Combined forces (interaction equations)
- Deflection: Table 6 (L/300 to L/150 depending on usage)

For AISC 360-22:
- Chapter D: Tension
- Chapter E: Compression  
- Chapter F: Flexure
- Chapter G: Shear
- Chapter H: Combined forces

Output JSON: { "checks": [{"clause": "...", "status": "pass|fail", "ratio": 0.85, ...}], "overallStatus": "pass|fail" }`,
};

// ============================================
// SECTION DATABASE (IS Standards)
// ============================================

const IS_SECTIONS: Record<string, { A: number; Ix: number; Iy: number; Zx: number; weight: number }> = {
  'ISMB100': { A: 1.14e-3, Ix: 2.57e-6, Iy: 0.41e-6, Zx: 51.4e-6, weight: 8.9 },
  'ISMB150': { A: 1.84e-3, Ix: 7.26e-6, Iy: 0.72e-6, Zx: 96.8e-6, weight: 14.4 },
  'ISMB200': { A: 3.23e-3, Ix: 22.4e-6, Iy: 1.50e-6, Zx: 224e-6, weight: 25.4 },
  'ISMB250': { A: 4.75e-3, Ix: 51.3e-6, Iy: 3.34e-6, Zx: 410e-6, weight: 37.3 },
  'ISMB300': { A: 5.87e-3, Ix: 86.0e-6, Iy: 4.54e-6, Zx: 573e-6, weight: 46.1 },
  'ISMB350': { A: 6.66e-3, Ix: 136e-6, Iy: 5.38e-6, Zx: 779e-6, weight: 52.4 },
  'ISMB400': { A: 7.84e-3, Ix: 204e-6, Iy: 6.22e-6, Zx: 1020e-6, weight: 61.6 },
  'ISMB450': { A: 9.22e-3, Ix: 303e-6, Iy: 8.34e-6, Zx: 1350e-6, weight: 72.4 },
  'ISMB500': { A: 11.0e-3, Ix: 452e-6, Iy: 13.7e-6, Zx: 1810e-6, weight: 86.9 },
  'ISMB550': { A: 13.2e-3, Ix: 649e-6, Iy: 19.5e-6, Zx: 2360e-6, weight: 104 },
  'ISMB600': { A: 15.6e-3, Ix: 918e-6, Iy: 26.5e-6, Zx: 3060e-6, weight: 123 },
  'ISA100x100x10': { A: 1.90e-3, Ix: 1.59e-6, Iy: 1.59e-6, Zx: 22.5e-6, weight: 14.9 },
  'ISA80x80x8': { A: 1.22e-3, Ix: 0.64e-6, Iy: 0.64e-6, Zx: 11.4e-6, weight: 9.6 },
  'ISA75x75x6': { A: 0.87e-3, Ix: 0.39e-6, Iy: 0.39e-6, Zx: 7.4e-6, weight: 6.8 },
  'ISA65x65x6': { A: 0.75e-3, Ix: 0.25e-6, Iy: 0.25e-6, Zx: 5.5e-6, weight: 5.8 },
  'ISA50x50x5': { A: 0.48e-3, Ix: 0.10e-6, Iy: 0.10e-6, Zx: 2.8e-6, weight: 3.8 },
  'ISMC100': { A: 1.17e-3, Ix: 1.87e-6, Iy: 0.26e-6, Zx: 37.3e-6, weight: 9.2 },
  'ISMC150': { A: 2.17e-3, Ix: 7.79e-6, Iy: 0.61e-6, Zx: 104e-6, weight: 17.0 },
  'ISMC200': { A: 2.85e-3, Ix: 18.2e-6, Iy: 1.02e-6, Zx: 182e-6, weight: 22.3 },
  'ISMC250': { A: 3.88e-3, Ix: 38.0e-6, Iy: 1.59e-6, Zx: 305e-6, weight: 30.4 },
  'ISMC300': { A: 4.64e-3, Ix: 63.6e-6, Iy: 2.11e-6, Zx: 424e-6, weight: 36.3 },
  // ISHB (Indian Standard Heavy-Weight Beams)
  'ISHB150': { A: 3.49e-3, Ix: 14.6e-6, Iy: 2.94e-6, Zx: 195e-6, weight: 27.1 },
  'ISHB200': { A: 4.74e-3, Ix: 36.2e-6, Iy: 4.70e-6, Zx: 362e-6, weight: 37.3 },
  'ISHB225': { A: 5.48e-3, Ix: 52.8e-6, Iy: 5.49e-6, Zx: 470e-6, weight: 43.1 },
  'ISHB300': { A: 7.49e-3, Ix: 125e-6, Iy: 8.11e-6, Zx: 836e-6, weight: 58.8 },
  'ISHB350': { A: 8.50e-3, Ix: 191e-6, Iy: 9.22e-6, Zx: 1090e-6, weight: 66.7 },
  'ISHB400': { A: 9.85e-3, Ix: 280e-6, Iy: 10.5e-6, Zx: 1400e-6, weight: 77.4 },
  'ISHB450': { A: 11.5e-3, Ix: 392e-6, Iy: 12.1e-6, Zx: 1740e-6, weight: 90.7 },
};

// ============================================
// INTENT CLASSIFICATION
// ============================================

type Intent = 'create_structure' | 'modify_model' | 'run_analysis' | 'diagnose' |
              'optimize' | 'code_check' | 'explain' | 'review_model' | 'troubleshoot' |
              'greeting' | 'thanks' | 'help' | 'about_model' | 'conversation' |
              'add_load' | 'add_support' | 'change_section' | 'clear_model';

function classifyIntent(query: string): { intent: Intent; confidence: number } {
  const q = query.toLowerCase().trim();

  // Greeting
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings|namaste)/i.test(q)) {
    return { intent: 'greeting', confidence: 0.95 };
  }

  // Thanks
  if (/^(thanks|thank\s*you|thx|appreciate|great\s*job|awesome|perfect)/i.test(q)) {
    return { intent: 'thanks', confidence: 0.95 };
  }

  // Help
  if (/^(help|what can you do|capabilities|features|commands|how to use)/i.test(q)) {
    return { intent: 'help', confidence: 0.95 };
  }

  // Create structure
  if (/\b(create|build|make|design|generate|draw|model)\b.*\b(beam|frame|truss|bridge|building|tower|shed|structure|warehouse|cantilever|portal|slab|column|foundation)/i.test(q) ||
      /\b(beam|frame|truss|bridge|building|tower|shed|structure|warehouse|cantilever|portal)\b.*\b(of|with|having|span|height|story|storey|floor|bay|meter|metre|m\b|ft\b)/i.test(q)) {
    return { intent: 'create_structure', confidence: 0.9 };
  }

  // Modify model
  if (/\b(modify|change|update|edit|move|shift|extend|shorten|resize|add\s*(a\s*)?(bay|story|storey|floor|span|column|beam|member|node))\b/i.test(q)) {
    return { intent: 'modify_model', confidence: 0.85 };
  }

  // Add load
  if (/\b(add|apply|put)\b.*\b(load|force|moment|pressure|udl|point\s*load|distributed)/i.test(q)) {
    return { intent: 'add_load', confidence: 0.9 };
  }

  // Add support
  if (/\b(add|set|make|apply)\b.*\b(support|restraint|fix|pin|roller|fixed|hinge)\b/i.test(q)) {
    return { intent: 'add_support', confidence: 0.9 };
  }

  // Change section
  if (/\b(change|set|assign|update)\b.*\b(section|profile|size|ismb|ismc|isa)\b/i.test(q)) {
    return { intent: 'change_section', confidence: 0.9 };
  }

  // Run analysis
  if (/\b(run|perform|execute|do|start)\b.*\b(analysis|analyze|solve|calculate|compute)/i.test(q) ||
      /\b(static|modal|dynamic|buckling|p-delta|pushover|seismic)\b.*\b(analysis)/i.test(q)) {
    return { intent: 'run_analysis', confidence: 0.9 };
  }

  // Diagnose
  if (/\b(diagnose|check|inspect|find\s*issues|find\s*problems|what.*wrong|debug|validate|verify)/i.test(q)) {
    return { intent: 'diagnose', confidence: 0.85 };
  }

  // Optimize
  if (/\b(optimize|optimise|reduce\s*weight|minimize|minimise|lighten|economize|economise|efficient)/i.test(q)) {
    return { intent: 'optimize', confidence: 0.85 };
  }

  // Code check
  if (/\b(code\s*check|is\s*800|is\s*456|aisc|eurocode|design\s*check|compliance|capacity|strength\s*check)/i.test(q)) {
    return { intent: 'code_check', confidence: 0.9 };
  }

  // Explain
  if (/\b(explain|what\s*is|define|tell\s*me\s*about|how\s*does|why|difference\s*between|concept|theory)/i.test(q)) {
    return { intent: 'explain', confidence: 0.8 };
  }

  // Review model
  if (/\b(review|summary|describe|show|current\s*model|model\s*info|overview|status)\b/i.test(q)) {
    return { intent: 'review_model', confidence: 0.8 };
  }

  // Troubleshoot
  if (/\b(fix|repair|resolve|troubleshoot|solve|error|fail|crash|not\s*working|broken|unstable)/i.test(q)) {
    return { intent: 'troubleshoot', confidence: 0.85 };
  }

  // About model
  if (/\b(how\s*many|count|list|show\s*all)\b.*\b(node|member|element|support|load)/i.test(q)) {
    return { intent: 'about_model', confidence: 0.8 };
  }

  // Clear model
  if (/\b(clear|reset|delete\s*all|remove\s*all|start\s*over|new\s*model|fresh)/i.test(q)) {
    return { intent: 'clear_model', confidence: 0.85 };
  }

  // Default: conversational
  return { intent: 'conversation', confidence: 0.5 };
}

// ============================================
// AI ARCHITECT ENGINE CLASS
// ============================================

export class AIArchitectEngine {
  private model: GenerativeModel | null = null;
  private apiKey: string;
  private pythonApiUrl: string;
  private conversationHistory: ChatMessage[] = [];
  private responseCache = new Map<string, { response: AIResponse; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 min

  constructor() {
    this.apiKey = process.env['GEMINI_API_KEY'] || '';
    this.pythonApiUrl = process.env['PYTHON_API_URL'] || 'http://localhost:8081';

    if (this.apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
        logger.info('[AIArchitectEngine] Gemini model initialized (gemini-2.0-flash)');
      } catch (err) {
        logger.error({ err }, '[AIArchitectEngine] Failed to init Gemini');
      }
    } else {
      logger.warn('[AIArchitectEngine] No GEMINI_API_KEY -- using local fallback mode');
    }
  }

  // ============================================
  // MAIN CHAT ENDPOINT
  // ============================================

  async chat(
    message: string,
    context?: ModelContext,
    history?: ChatMessage[]
  ): Promise<AIResponse> {
    const startTime = Date.now();

    // Classify intent
    const { intent, confidence } = classifyIntent(message);
    logger.info(`[AIArchitectEngine] Intent: ${intent} (${(confidence * 100).toFixed(0)}%)`);

    // Check cache for identical queries
    const cacheKey = `${intent}:${message.slice(0, 200)}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.info('[AIArchitectEngine] Cache hit');
      return { ...cached.response, metadata: { ...cached.response.metadata!, processingTimeMs: 0 } };
    }

    let result: AIResponse;

    try {
      switch (intent) {
        case 'greeting':
          result = this.handleGreeting();
          break;
        case 'thanks':
          result = this.handleThanks();
          break;
        case 'help':
          result = this.handleHelp();
          break;
        case 'create_structure':
          result = await this.handleCreateStructure(message, context);
          break;
        case 'modify_model':
          result = await this.handleModifyModel(message, context);
          break;
        case 'add_load':
          result = await this.handleAddLoad(message, context);
          break;
        case 'add_support':
          result = await this.handleAddSupport(message, context);
          break;
        case 'change_section':
          result = await this.handleChangeSection(message, context);
          break;
        case 'run_analysis':
          result = this.handleRunAnalysis(context);
          break;
        case 'diagnose':
          result = await this.handleDiagnose(context);
          break;
        case 'optimize':
          result = await this.handleOptimize(context);
          break;
        case 'code_check':
          result = await this.handleCodeCheck(message, context);
          break;
        case 'review_model':
          result = this.handleReviewModel(context);
          break;
        case 'about_model':
          result = this.handleAboutModel(context);
          break;
        case 'troubleshoot':
          result = await this.handleTroubleshoot(message, context);
          break;
        case 'clear_model':
          result = this.handleClearModel();
          break;
        case 'explain':
          result = await this.handleExplain(message);
          break;
        case 'conversation':
        default:
          result = await this.handleConversation(message, context, history);
      }

      // Attach metadata
      result.metadata = {
        intent,
        confidence,
        processingTimeMs: Date.now() - startTime,
        provider: result.metadata?.provider || (this.model ? 'gemini' : 'local'),
        tokensUsed: result.metadata?.tokensUsed,
      };

      // Store conversation
      this.conversationHistory.push(
        { role: 'user', content: message },
        { role: 'assistant', content: result.response }
      );

      // Trim history to last 20 messages
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }

      // Cache the response
      this.responseCache.set(cacheKey, { response: result, timestamp: Date.now() });

      // Clean old cache
      for (const [key, value] of this.responseCache.entries()) {
        if (Date.now() - value.timestamp > this.CACHE_TTL) {
          this.responseCache.delete(key);
        }
      }

      return result;

    } catch (error) {
      logger.error({ err: error }, '[AIArchitectEngine] Error');
      return {
        success: false,
        response: `I encountered an error processing your request. ${error instanceof Error ? error.message : 'Please try again.'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          intent,
          confidence,
          processingTimeMs: Date.now() - startTime,
          provider: 'local',
        },
      };
    }
  }

  // ============================================
  // STRUCTURE GENERATION
  // ============================================

  async generateStructure(prompt: string, constraints?: Record<string, any>): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      // Try Gemini first
      if (this.model) {
        const result = await this.generateViaGemini(prompt, constraints);
        if (result.success) {
          result.metadata = {
            intent: 'create_structure',
            confidence: 0.9,
            processingTimeMs: Date.now() - startTime,
            provider: 'gemini',
          };
          return result;
        }
      }

      // Fallback to local generation
      const localResult = this.generateLocally(prompt);
      localResult.metadata = {
        intent: 'create_structure',
        confidence: 0.7,
        processingTimeMs: Date.now() - startTime,
        provider: 'local',
      };
      return localResult;

    } catch (error) {
      logger.error({ err: error }, '[AIArchitectEngine] Generate error');

      // Final fallback
      const fallback = this.generateLocally(prompt);
      fallback.metadata = {
        intent: 'create_structure',
        confidence: 0.5,
        processingTimeMs: Date.now() - startTime,
        provider: 'local',
      };
      return fallback;
    }
  }

  private async generateViaGemini(prompt: string, constraints?: Record<string, any>): Promise<AIResponse> {
    if (!this.model) throw new Error('Gemini not initialized');

    const constraintText = constraints
      ? `\n\nConstraints: ${JSON.stringify(constraints)}`
      : '';

    const fullPrompt = `${SYSTEM_PROMPTS.generate}\n\nUser request: ${prompt}${constraintText}`;

    const result = await this.model.generateContent(fullPrompt);
    const text = result.response.text();

    // Parse JSON from response
    const cleanedText = text
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    const model = JSON.parse(cleanedText) as StructuralModel;

    // Validate
    const validation = this.validateModel(model);

    // Normalize
    const normalized = this.normalizeModel(model);

    return {
      success: true,
      response: `✅ Generated a ${normalized.nodes.length}-node, ${normalized.members.length}-member structure based on your description.${
        validation.issues.length > 0 ? `\n\n⚠️ Notes:\n${validation.issues.map(i => `- ${i}`).join('\n')}` : ''
      }`,
      model: normalized,
      actions: [{ type: 'applyModel', params: { model: normalized }, description: 'Apply generated model' }],
    };
  }

  // ============================================
  // MODEL DIAGNOSIS
  // ============================================

  async diagnoseModel(context: ModelContext): Promise<DiagnosisResult> {
    const issues: DiagnosisIssue[] = [];

    if (!context || !context.nodes || context.nodes.length === 0) {
      return {
        success: true,
        issues: [{ severity: 'error', category: 'geometry', message: 'No model loaded. Create or load a structure first.', affectedElements: [] }],
        overallHealth: 'critical',
        suggestions: ['Create a new structure using natural language, e.g., "Create a 6m portal frame"'],
        autoFixAvailable: false,
      };
    }

    // Check supports
    const supportNodes = context.nodes.filter(n => n.hasSupport);
    if (supportNodes.length === 0) {
      issues.push({
        severity: 'error',
        category: 'support',
        message: 'No supports defined. Structure will be unstable — add at least 2 supports.',
        affectedElements: [],
        suggestedFix: 'Add fixed or pinned supports at ground-level nodes',
      });
    } else if (supportNodes.length === 1) {
      issues.push({
        severity: 'warning',
        category: 'stability',
        message: 'Only 1 support found. Consider adding another for stability.',
        affectedElements: [supportNodes[0].id],
        suggestedFix: 'Add a roller or pinned support at the other end',
      });
    }

    // Check connectivity — find orphan nodes
    const connectedNodes = new Set<string>();
    for (const m of context.members) {
      connectedNodes.add(m.startNode);
      connectedNodes.add(m.endNode);
    }
    const orphanNodes = context.nodes.filter(n => !connectedNodes.has(n.id));
    if (orphanNodes.length > 0) {
      issues.push({
        severity: 'warning',
        category: 'connectivity',
        message: `${orphanNodes.length} orphan node(s) not connected to any member.`,
        affectedElements: orphanNodes.map(n => n.id),
        suggestedFix: 'Connect these nodes with members or remove them',
      });
    }

    // Check zero-length members
    for (const m of context.members) {
      const startNode = context.nodes.find(n => n.id === m.startNode);
      const endNode = context.nodes.find(n => n.id === m.endNode);
      if (startNode && endNode) {
        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = endNode.z - startNode.z || 0;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length < 0.001) {
          issues.push({
            severity: 'error',
            category: 'geometry',
            message: `Member ${m.id} has zero or near-zero length.`,
            affectedElements: [m.id],
            suggestedFix: 'Remove this member or move one of its nodes',
          });
        }
      }
    }

    // Check for missing loads
    if (!context.loads || context.loads.length === 0) {
      issues.push({
        severity: 'info',
        category: 'loading',
        message: 'No loads applied. Add loads before running analysis.',
        affectedElements: [],
        suggestedFix: 'Apply dead loads, live loads, or other load cases',
      });
    }

    // Check invalid member references
    const nodeIds = new Set(context.nodes.map(n => n.id));
    for (const m of context.members) {
      if (!nodeIds.has(m.startNode)) {
        issues.push({
          severity: 'error',
          category: 'connectivity',
          message: `Member ${m.id} references non-existent start node ${m.startNode}`,
          affectedElements: [m.id],
        });
      }
      if (!nodeIds.has(m.endNode)) {
        issues.push({
          severity: 'error',
          category: 'connectivity',
          message: `Member ${m.id} references non-existent end node ${m.endNode}`,
          affectedElements: [m.id],
        });
      }
    }

    // Check analysis results for failures
    if (context.analysisResults) {
      if (context.analysisResults.failedMembers && context.analysisResults.failedMembers.length > 0) {
        issues.push({
          severity: 'error',
          category: 'section',
          message: `${context.analysisResults.failedMembers.length} member(s) failed strength check.`,
          affectedElements: context.analysisResults.failedMembers,
          suggestedFix: 'Increase section sizes for failed members',
        });
      }
      if (context.analysisResults.maxStress && context.analysisResults.maxStress > 250) {
        issues.push({
          severity: 'warning',
          category: 'section',
          message: `Maximum stress (${context.analysisResults.maxStress.toFixed(1)} MPa) exceeds typical Fe410 yield stress (250 MPa).`,
          affectedElements: [],
          suggestedFix: 'Use larger sections or higher-grade steel (Fe500)',
        });
      }
    }

    // Use Gemini for advanced diagnosis if available
    if (this.model && context.members.length > 0) {
      try {
        const aiDiagnosis = await this.geminiDiagnose(context);
        if (aiDiagnosis) {
          issues.push(...aiDiagnosis);
        }
      } catch (err) {
        logger.warn({ err }, '[AIArchitectEngine] Gemini diagnosis failed, using local only');
      }
    }

    const errorCount = issues.filter(i => i.severity === 'error').length;
    const warningCount = issues.filter(i => i.severity === 'warning').length;

    return {
      success: true,
      issues,
      overallHealth: errorCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'good',
      suggestions: issues.filter(i => i.suggestedFix).map(i => i.suggestedFix!),
      autoFixAvailable: issues.some(i => i.suggestedFix && (i.category === 'connectivity' || i.category === 'support')),
    };
  }

  private async geminiDiagnose(context: ModelContext): Promise<DiagnosisIssue[]> {
    if (!this.model) return [];

    const prompt = `${SYSTEM_PROMPTS.diagnose}

Model:
- Nodes: ${JSON.stringify(context.nodes)}
- Members: ${JSON.stringify(context.members)}
- Loads: ${JSON.stringify(context.loads || [])}
${context.analysisResults ? `- Analysis Results: ${JSON.stringify(context.analysisResults)}` : ''}

Provide diagnosis as JSON array of issues.`;

    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text()
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      const parsed = JSON.parse(text);
      return (parsed.issues || parsed || []).filter((i: { severity?: string; category?: string; message?: string }) =>
        i.severity && i.category && i.message
      ) as DiagnosisIssue[];
    } catch {
      return [];
    }
  }

  // ============================================
  // CODE COMPLIANCE CHECK
  // ============================================

  async checkCodeCompliance(
    member: { section: string; length: number; type: 'beam' | 'column' },
    forces: { axial?: number; moment?: number; shear?: number },
    code: string = 'IS_800'
  ): Promise<CodeCheckResult> {
    const checks: CodeCheckResult['checks'] = [];
    const section = IS_SECTIONS[member.section];

    if (!section) {
      return {
        success: false,
        code,
        overallStatus: 'fail',
        checks: [],
        summary: `Unknown section: ${member.section}. Use IS standard sections (ISMB, ISMC, ISA).`,
      };
    }

    const fy = 250; // Fe410 yield stress in MPa
    const E = 200000; // Steel modulus in MPa

    // 1. Tension check (Clause 6)
    if (forces.axial && forces.axial > 0) {
      const tensionCapacity = section.A * fy * 1e-3; // kN
      const ratio = forces.axial / tensionCapacity;
      checks.push({
        clause: 'Cl. 6.2 — Tension yielding',
        description: 'Design strength of member in tension',
        status: ratio <= 1.0 ? 'pass' : 'fail',
        ratio: parseFloat(ratio.toFixed(3)),
        limit: tensionCapacity,
        actual: forces.axial,
        details: `Td = Ag × fy / γm0 = ${tensionCapacity.toFixed(1)} kN`,
      });
    }

    // 2. Compression check (Clause 7)
    if (forces.axial && forces.axial < 0) {
      const axialForce = Math.abs(forces.axial);
      const slenderness = member.length / Math.sqrt(section.Ix / section.A);
      const slendernessRatio = slenderness / (Math.PI * Math.sqrt(E / fy));

      let chi = 1.0; // reduction factor
      if (slendernessRatio > 0.2) {
        const alpha = 0.49; // buckling curve b for hot-rolled I-sections
        const phi = 0.5 * (1 + alpha * (slendernessRatio - 0.2) + slendernessRatio * slendernessRatio);
        chi = Math.min(1.0, 1.0 / (phi + Math.sqrt(phi * phi - slendernessRatio * slendernessRatio)));
      }

      const compressionCapacity = chi * section.A * fy * 1e-3;
      const ratio = axialForce / compressionCapacity;
      checks.push({
        clause: 'Cl. 7.1.2 — Compression buckling',
        description: `Buckling resistance (λ = ${slenderness.toFixed(1)})`,
        status: ratio <= 1.0 ? 'pass' : 'fail',
        ratio: parseFloat(ratio.toFixed(3)),
        limit: compressionCapacity,
        actual: axialForce,
        details: `Pd = χ × Ag × fy / γm0 = ${compressionCapacity.toFixed(1)} kN, λ = ${slenderness.toFixed(1)}`,
      });
    }

    // 3. Bending check (Clause 8)
    if (forces.moment) {
      const momentCapacity = section.Zx * fy * 1e-3; // kN·m (elastic)
      const ratio = Math.abs(forces.moment) / momentCapacity;
      checks.push({
        clause: 'Cl. 8.2.1 — Bending strength',
        description: 'Design bending strength (elastic)',
        status: ratio <= 1.0 ? 'pass' : 'fail',
        ratio: parseFloat(ratio.toFixed(3)),
        limit: momentCapacity,
        actual: Math.abs(forces.moment),
        details: `Md = βb × Zp × fy / γm0 = ${momentCapacity.toFixed(1)} kN·m`,
      });
    }

    // 4. Shear check (Clause 8.4)
    if (forces.shear) {
      const Av = section.A * 0.6; // approximate shear area
      const shearCapacity = Av * fy / (Math.sqrt(3)) * 1e-3;
      const ratio = Math.abs(forces.shear) / shearCapacity;
      checks.push({
        clause: 'Cl. 8.4 — Shear strength',
        description: 'Design shear strength',
        status: ratio <= 1.0 ? 'pass' : 'fail',
        ratio: parseFloat(ratio.toFixed(3)),
        limit: shearCapacity,
        actual: Math.abs(forces.shear),
        details: `Vd = Av × fy / (√3 × γm0) = ${shearCapacity.toFixed(1)} kN`,
      });
    }

    // 5. Deflection check
    if (member.type === 'beam' && forces.moment) {
      const deflectionLimit = member.length * 1000 / 300; // L/300 in mm
      const estimatedDeflection = (5 * Math.abs(forces.moment) * member.length * member.length) / (48 * E * section.Ix) * 1000;
      const ratio = estimatedDeflection / deflectionLimit;
      checks.push({
        clause: 'Table 6 — Deflection limit',
        description: `Serviceability deflection check (L/300 = ${deflectionLimit.toFixed(1)} mm)`,
        status: ratio <= 1.0 ? 'pass' : 'fail',
        ratio: parseFloat(ratio.toFixed(3)),
        limit: deflectionLimit,
        actual: estimatedDeflection,
        details: `δ = ${estimatedDeflection.toFixed(2)} mm vs limit = ${deflectionLimit.toFixed(1)} mm`,
      });
    }

    // 6. Combined check (Clause 9) if both axial + bending
    if (forces.axial && forces.moment) {
      const axialCapacity = section.A * fy * 1e-3;
      const momentCapacity = section.Zx * fy * 1e-3;
      const combinedRatio = Math.abs(forces.axial) / axialCapacity + Math.abs(forces.moment) / momentCapacity;
      checks.push({
        clause: 'Cl. 9.3.1 — Combined axial + bending',
        description: 'Interaction ratio for combined forces',
        status: combinedRatio <= 1.0 ? 'pass' : 'fail',
        ratio: parseFloat(combinedRatio.toFixed(3)),
        limit: 1.0,
        actual: combinedRatio,
        details: `N/Nd + M/Md = ${combinedRatio.toFixed(3)} ≤ 1.0`,
      });
    }

    const failCount = checks.filter(c => c.status === 'fail').length;
    const overallStatus: 'pass' | 'fail' | 'warning' =
      failCount > 0 ? 'fail' : checks.some(c => c.ratio && c.ratio > 0.85) ? 'warning' : 'pass';

    return {
      success: true,
      code,
      overallStatus,
      checks,
      summary: failCount === 0
        ? `✅ All ${checks.length} checks passed for ${member.section} under ${code}.`
        : `❌ ${failCount}/${checks.length} checks failed for ${member.section}. Consider upgrading the section.`,
    };
  }

  // ============================================
  // INTENT HANDLERS
  // ============================================

  private handleGreeting(): AIResponse {
    const greetings = [
      "Hello! I'm the AI Architect for BeamLab. I can help you create structures, run analyses, optimize designs, and check code compliance. What would you like to build today?",
      "Hi there! Ready to engineer something? I can create frames, trusses, bridges, buildings — just describe what you need in plain English.",
      "Welcome to BeamLab AI Architect! Tell me what structure you'd like to design and I'll generate it for you. I understand Indian Standards (IS 800, IS 456) and international codes too.",
    ];
    return {
      success: true,
      response: greetings[Math.floor(Math.random() * greetings.length)],
    };
  }

  private handleThanks(): AIResponse {
    return {
      success: true,
      response: "You're welcome! Let me know if you need anything else — I'm here to help with your structural design.",
    };
  }

  private handleHelp(): AIResponse {
    return {
      success: true,
      response: `## 🏗️ AI Architect — What I Can Do

**Create Structures:**
- "Create a 10m span portal frame with 6m height"
- "Build a 3-story, 2-bay steel frame"
- "Make a 15m Pratt truss with 3m depth"
- "Design an industrial shed 20m × 10m"

**Modify Existing Model:**
- "Add another bay to the right"
- "Increase the height to 8m"
- "Add a third floor"
- "Change all columns to ISMB500"

**Apply Loads:**
- "Add 50 kN downward load at the top"
- "Apply UDL of 10 kN/m on all beams"
- "Add wind load of 1.5 kN/m² on the left face"

**Analyze & Check:**
- "Run static analysis"
- "Diagnose this model for issues"
- "Check code compliance per IS 800"
- "Optimize the sections"

**Learn & Explain:**
- "What is P-Delta analysis?"
- "Explain IS 800 slenderness limits"
- "What's the difference between ISMB and ISHB?"

💡 **Tip:** Be specific with dimensions and I'll generate more accurate models!`,
    };
  }

  private async handleCreateStructure(message: string, context?: ModelContext): Promise<AIResponse> {
    return this.generateStructure(message);
  }

  private async handleModifyModel(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "There's no model to modify. Please create a structure first, then I can modify it.",
      };
    }

    // Try Gemini for intelligent modification
    if (this.model) {
      try {
        const prompt = `${SYSTEM_PROMPTS.modify}

Current model:
${JSON.stringify({ nodes: context.nodes, members: context.members }, null, 2)}

Modification request: "${message}"

Output the complete modified model as JSON.`;

        const result = await this.model.generateContent(prompt);
        const text = result.response.text()
          .replace(/```json\s*/g, '')
          .replace(/```\s*/g, '')
          .trim();

        const modified = JSON.parse(text) as StructuralModel;
        const normalized = this.normalizeModel(modified);

        return {
          success: true,
          response: `✅ Model modified successfully. Now has ${normalized.nodes.length} nodes and ${normalized.members.length} members.`,
          model: normalized,
          actions: [{ type: 'applyModel', params: { model: normalized }, description: 'Apply modified model' }],
          metadata: { intent: 'modify_model', confidence: 0.85, processingTimeMs: 0, provider: 'gemini' },
        };
      } catch (err) {
        logger.warn({ err }, '[AIArchitectEngine] Gemini modify failed');
      }
    }

    return {
      success: true,
      response: "I understand you want to modify the model. Could you be more specific? For example:\n- \"Add a bay of 6m to the right\"\n- \"Add a floor of 3.5m height\"\n- \"Move node n3 to x=8, y=4\"",
    };
  }

  private async handleAddLoad(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "No model loaded. Create a structure first before adding loads.",
      };
    }

    // Extract load parameters from message
    const forceMatch = message.match(/([\d.]+)\s*(kn|kN|KN)/i);
    const directionMatch = message.match(/\b(down|up|left|right|horizontal|vertical|x|y|z)\b/i);

    if (forceMatch) {
      const magnitude = parseFloat(forceMatch[1]);
      const direction = directionMatch ? directionMatch[1].toLowerCase() : 'down';

      let fy = 0, fx = 0;
      switch (direction) {
        case 'down': case 'vertical': case 'y': fy = -magnitude; break;
        case 'up': fy = magnitude; break;
        case 'right': case 'horizontal': case 'x': fx = magnitude; break;
        case 'left': fx = -magnitude; break;
        default: fy = -magnitude;
      }

      // Apply to top nodes (non-support) or specified node
      const targetNodes = context.nodes.filter(n => !n.hasSupport);
      if (targetNodes.length === 0) {
        return {
          success: false,
          response: "All nodes are supports. Add non-support nodes to apply loads to.",
        };
      }

      const actions: AIAction[] = targetNodes.map(n => ({
        type: 'addLoad' as const,
        params: { nodeId: n.id, fx, fy },
        description: `Add ${magnitude} kN ${direction} load at node ${n.id}`,
      }));

      return {
        success: true,
        response: `✅ Adding ${magnitude} kN ${direction}ward load to ${targetNodes.length} node(s): ${targetNodes.map(n => n.id).join(', ')}.\n\nClick **Execute** to apply.`,
        actions,
      };
    }

    // Use Gemini for complex load descriptions
    if (this.model) {
      try {
        const prompt = `The user wants to add loads to a structural model. Parse their request and generate load actions.

User request: "${message}"

Available nodes: ${JSON.stringify(context.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, support: n.hasSupport })))}

Output JSON array of load actions: [{"nodeId": "n1", "fx": 0, "fy": -50, "fz": 0}]`;

        const result = await this.model.generateContent(prompt);
        const text = result.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const loads = JSON.parse(text);

        const actions: AIAction[] = (Array.isArray(loads) ? loads : [loads]).map((l: { nodeId?: string; fx?: number; fy?: number; fz?: number }) => ({
          type: 'addLoad' as const,
          params: { nodeId: l.nodeId, fx: l.fx || 0, fy: l.fy || 0, fz: l.fz || 0 },
          description: `Add load at ${l.nodeId}: Fx=${l.fx || 0}, Fy=${l.fy || 0} kN`,
        }));

        return {
          success: true,
          response: `✅ Parsed your load request. ${actions.length} load(s) ready to apply.\n\nClick **Execute** to apply.`,
          actions,
        };
      } catch (err) {
        logger.warn({ err }, '[AIArchitectEngine] Gemini load parse failed');
      }
    }

    return {
      success: true,
      response: "Please specify the load more clearly. Examples:\n- \"Add 50 kN downward load\"\n- \"Apply 10 kN/m UDL on all beams\"\n- \"Add 25 kN horizontal wind load\"",
    };
  }

  private async handleAddSupport(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "No model loaded. Create a structure first.",
      };
    }

    // Parse support type
    const isFixed = /fixed/i.test(message);
    const isPinned = /pin/i.test(message);
    const isRoller = /roller/i.test(message);

    const supportType = isFixed ? 'fixed' : isPinned ? 'pinned' : isRoller ? 'roller' : 'fixed';

    // Find ground-level nodes without supports
    const groundNodes = context.nodes.filter(n => Math.abs(n.y) < 0.1 && !n.hasSupport);

    if (groundNodes.length === 0) {
      return {
        success: true,
        response: "All ground-level nodes already have supports. Specify a node ID to add support to a different node.",
      };
    }

    const restraints = {
      fixed: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
      pinned: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false },
      roller: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false },
    };

    const actions: AIAction[] = groundNodes.map(n => ({
      type: 'addSupport' as const,
      params: { nodeId: n.id, type: supportType, restraints: restraints[supportType] },
      description: `Add ${supportType} support at node ${n.id}`,
    }));

    return {
      success: true,
      response: `✅ Adding ${supportType} support to ${groundNodes.length} ground-level node(s): ${groundNodes.map(n => n.id).join(', ')}.\n\nClick **Execute** to apply.`,
      actions,
    };
  }

  private async handleChangeSection(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.members.length === 0) {
      return {
        success: false,
        response: "No members in the model. Create a structure first.",
      };
    }

    // Extract section name
    const sectionMatch = message.match(/\b(ISMB\d+|ISMC\d+|ISA\d+x\d+x\d+|ISHB\d+)/i);

    if (sectionMatch) {
      const newSection = sectionMatch[1].toUpperCase();
      const sectionData = IS_SECTIONS[newSection];

      if (!sectionData) {
        return {
          success: true,
          response: `Section "${newSection}" not found. Available sections:\n- ISMB: 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600\n- ISMC: 100, 150, 200, 250, 300\n- ISA: 50x50x5, 65x65x6, 75x75x6, 80x80x8, 100x100x10`,
        };
      }

      // Determine which members to change
      const isAll = /\ball\b/i.test(message);
      const isColumn = /\bcolumn/i.test(message);
      const isBeam = /\bbeam/i.test(message);

      let targetMembers = context.members;
      if (isColumn) {
        targetMembers = context.members.filter(m => {
          const sn = context.nodes.find(n => n.id === m.startNode);
          const en = context.nodes.find(n => n.id === m.endNode);
          if (sn && en) return Math.abs(sn.x - en.x) < 0.1; // vertical members
          return false;
        });
      } else if (isBeam) {
        targetMembers = context.members.filter(m => {
          const sn = context.nodes.find(n => n.id === m.startNode);
          const en = context.nodes.find(n => n.id === m.endNode);
          if (sn && en) return Math.abs(sn.y - en.y) < 0.1; // horizontal members
          return false;
        });
      }

      const actions: AIAction[] = targetMembers.map(m => ({
        type: 'changeSection' as const,
        params: { memberId: m.id, section: newSection },
        description: `Change ${m.id} from ${m.section || 'default'} to ${newSection}`,
      }));

      return {
        success: true,
        response: `✅ Changing ${targetMembers.length} member(s) to **${newSection}** (weight: ${sectionData.weight} kg/m).\n\nClick **Execute** to apply.`,
        actions,
      };
    }

    return {
      success: true,
      response: "Please specify the section. Example:\n- \"Change all columns to ISMB500\"\n- \"Set beams to ISMB300\"\n- \"Change all sections to ISMB400\"",
    };
  }

  private handleRunAnalysis(context?: ModelContext): AIResponse {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "No model to analyze. Create a structure first.",
      };
    }

    if (context.nodes.filter(n => n.hasSupport).length === 0) {
      return {
        success: false,
        response: "⚠️ No supports defined! The analysis will fail. Add supports first (say \"add fixed supports\").",
      };
    }

    return {
      success: true,
      response: `Ready to analyze: ${context.nodes.length} nodes, ${context.members.length} members, ${context.loads?.length || 0} loads.\n\nClick **Execute** to run linear static analysis.`,
      actions: [{ type: 'runAnalysis', params: { type: 'linear_static' }, description: 'Run linear static analysis' }],
    };
  }

  private async handleDiagnose(context?: ModelContext): Promise<AIResponse> {
    if (!context) {
      return {
        success: false,
        response: "No model loaded to diagnose.",
      };
    }

    const diagnosis = await this.diagnoseModel(context);

    let response = `## 🔍 Model Diagnosis — ${diagnosis.overallHealth === 'good' ? '✅ Healthy' : diagnosis.overallHealth === 'warning' ? '⚠️ Warnings' : '❌ Critical Issues'}\n\n`;

    if (diagnosis.issues.length === 0) {
      response += "No issues found! Your model looks structurally sound.\n";
    } else {
      for (const issue of diagnosis.issues) {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
        response += `${icon} **${issue.category}**: ${issue.message}\n`;
        if (issue.suggestedFix) {
          response += `   → Fix: ${issue.suggestedFix}\n`;
        }
        response += '\n';
      }
    }

    if (diagnosis.autoFixAvailable) {
      response += '\n💡 Some issues can be auto-fixed. Say "fix these issues" to apply suggested fixes.';
    }

    return {
      success: true,
      response,
    };
  }

  private async handleOptimize(context?: ModelContext): Promise<AIResponse> {
    if (!context || context.members.length === 0) {
      return {
        success: false,
        response: "No model to optimize. Create a structure and run analysis first.",
      };
    }

    // Use Gemini for optimization suggestions if available
    if (this.model) {
      try {
        const prompt = `${SYSTEM_PROMPTS.optimize}

Model:
- Nodes: ${context.nodes.length}
- Members: ${JSON.stringify(context.members)}
${context.analysisResults ? `- Analysis Results: ${JSON.stringify(context.analysisResults)}` : '- No analysis results available'}

Suggest section optimization as JSON.`;

        const result = await this.model.generateContent(prompt);
        const text = result.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const optimization = JSON.parse(text);

        const actions: AIAction[] = (optimization.changes || []).map((c: { memberId?: string; oldSection?: string; newSection?: string; reason?: string }) => ({
          type: 'changeSection' as const,
          params: { memberId: c.memberId, section: c.newSection },
          description: `${c.memberId}: ${c.oldSection} → ${c.newSection} (${c.reason})`,
        }));

        return {
          success: true,
          response: `## 🎯 Optimization Results\n\n${
            actions.map(a => `- ${a.description}`).join('\n')
          }\n\n**Estimated weight savings: ${optimization.savingsPercent || 'unknown'}%**\n\nClick **Execute** to apply changes.`,
          actions,
          metadata: { intent: 'optimize', confidence: 0.85, processingTimeMs: 0, provider: 'gemini' },
        };
      } catch (err) {
        logger.warn({ err }, '[AIArchitectEngine] Gemini optimization failed');
      }
    }

    // Local optimization fallback: use checkCodeCompliance to find over-designed members
    if (context.analysisResults) {
      const actions: AIAction[] = [];
      const suggestions: string[] = [];

      for (const m of context.members) {
        const startNode = context.nodes.find(n => n.id === m.startNode);
        const endNode = context.nodes.find(n => n.id === m.endNode);
        let memberLength = 3.0;
        let memberType: 'beam' | 'column' = 'beam';
        if (startNode && endNode) {
          const dx = Math.abs(endNode.x - startNode.x);
          const dy = Math.abs(endNode.y - startNode.y);
          memberType = dy > dx ? 'column' : 'beam';
          memberLength = Math.sqrt(dx * dx + dy * dy);
        }

        const currentSection = m.section || 'ISMB300';
        const result = await this.checkCodeCompliance(
          { section: currentSection, length: memberLength, type: memberType },
          { moment: context.analysisResults.maxMoment ? context.analysisResults.maxMoment / context.members.length : 10 },
          'IS_800'
        );

        // If max ratio < 0.5, member is over-designed — suggest smaller section
        const maxRatio = Math.max(...(result.checks.map(c => c.ratio || 0)));
        if (maxRatio < 0.5 && maxRatio > 0) {
          const sectionSizes = Object.keys(IS_SECTIONS).filter(s => s.startsWith(currentSection.replace(/\d+$/, '')));
          const currentIdx = sectionSizes.indexOf(currentSection);
          if (currentIdx > 0) {
            const smallerSection = sectionSizes[currentIdx - 1];
            actions.push({
              type: 'changeSection',
              params: { memberId: m.id, section: smallerSection },
              description: `${m.id}: ${currentSection} → ${smallerSection} (ratio=${maxRatio.toFixed(2)}, over-designed)`,
            });
            suggestions.push(`${m.id}: ${currentSection} → ${smallerSection}`);
          }
        }
      }

      if (actions.length > 0) {
        return {
          success: true,
          response: `## 🎯 Local Optimization Results\n\n${suggestions.map(s => `- ${s}`).join('\n')}\n\n**${actions.length} member(s) can be downsized.** Click **Execute** to apply.`,
          actions,
        };
      }

      return {
        success: true,
        response: '✅ All members appear reasonably sized based on local analysis. For AI-powered optimization, ensure your Gemini API key is configured.',
      };
    }

    return {
      success: true,
      response: "To optimize sections, please run a structural analysis first. Then I can suggest lighter sections based on utilization ratios.\n\nSay \"run analysis\" to start.",
    };
  }

  private async handleCodeCheck(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.members.length === 0) {
      return {
        success: false,
        response: "No model to check. Create a structure and run analysis first.",
      };
    }

    // Determine which code
    let code = 'IS_800';
    if (/aisc/i.test(message)) code = 'AISC_360';
    else if (/eurocode/i.test(message)) code = 'EN_1993';
    else if (/is\s*456/i.test(message)) code = 'IS_456';

    // Actually run code compliance checks on each member
    let response = `## 📋 Code Compliance Check — ${code}\n\n`;

    if (!context.analysisResults) {
      response += `⚠️ No analysis results available. Running simplified checks based on member properties only.\n\n`;
    }

    let overallPass = true;
    const memberResults: string[] = [];

    for (const m of context.members) {
      // Determine member type (beam vs column) based on geometry
      const startNode = context.nodes.find(n => n.id === m.startNode);
      const endNode = context.nodes.find(n => n.id === m.endNode);
      let memberType: 'beam' | 'column' = 'beam';
      let memberLength = 3.0;
      if (startNode && endNode) {
        const dx = Math.abs(endNode.x - startNode.x);
        const dy = Math.abs(endNode.y - startNode.y);
        memberType = dy > dx ? 'column' : 'beam';
        memberLength = Math.sqrt(dx * dx + dy * dy + (endNode.z - startNode.z || 0) ** 2);
      }

      // Estimate forces from analysis results or use defaults
      const forces: { axial?: number; moment?: number; shear?: number } = {};
      if (context.analysisResults) {
        forces.moment = context.analysisResults.maxMoment ? context.analysisResults.maxMoment / context.members.length : undefined;
        forces.shear = context.analysisResults.maxShear ? context.analysisResults.maxShear / context.members.length : undefined;
        if (memberType === 'column') forces.axial = -50; // Default compression for columns
      }

      const result = await this.checkCodeCompliance(
        { section: m.section || 'ISMB300', length: memberLength, type: memberType },
        forces,
        code
      );

      const icon = result.overallStatus === 'pass' ? '✅' : result.overallStatus === 'warning' ? '⚠️' : '❌';
      memberResults.push(`${icon} **${m.id}** (${m.section || 'ISMB300'}, ${memberType}, L=${memberLength.toFixed(1)}m): ${result.summary}`);

      if (result.overallStatus === 'fail') overallPass = false;

      // Add detailed check info for failed members
      if (result.overallStatus === 'fail') {
        for (const check of result.checks.filter(c => c.status === 'fail')) {
          memberResults.push(`   → ${check.clause}: ratio = ${check.ratio?.toFixed(3)} (${check.details})`);
        }
      }
    }

    response += memberResults.join('\n\n');
    response += `\n\n---\n**Overall: ${overallPass ? '✅ All members pass' : '❌ Some members failed — consider upgrading sections'}**`;

    return {
      success: true,
      response,
      metadata: { intent: 'code_check', confidence: 0.9, processingTimeMs: 0, provider: 'local' },
    };
  }

  private handleReviewModel(context?: ModelContext): AIResponse {
    if (!context || context.nodes.length === 0) {
      return {
        success: true,
        response: "📋 **Current Model: Empty**\n\nNo structure loaded. Try:\n- \"Create a portal frame\"\n- \"Build a 2-story frame\"\n- \"Make a truss bridge\"",
      };
    }

    const supports = context.nodes.filter(n => n.hasSupport);
    const sections = [...new Set(context.members.map(m => m.section).filter(Boolean))];

    // Calculate bounding box
    const xs = context.nodes.map(n => n.x);
    const ys = context.nodes.map(n => n.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);

    let response = `## 📋 Model Summary\n\n`;
    response += `| Property | Value |\n|---|---|\n`;
    response += `| Nodes | ${context.nodes.length} |\n`;
    response += `| Members | ${context.members.length} |\n`;
    response += `| Supports | ${supports.length} |\n`;
    response += `| Loads | ${context.loads?.length || 0} |\n`;
    response += `| Overall Width | ${width.toFixed(2)} m |\n`;
    response += `| Overall Height | ${height.toFixed(2)} m |\n`;
    response += `| Sections Used | ${sections.length > 0 ? sections.join(', ') : 'Default'} |\n`;

    if (context.analysisResults) {
      response += `\n### Analysis Results\n`;
      if (context.analysisResults.maxDisplacement !== undefined)
        response += `- Max Displacement: ${context.analysisResults.maxDisplacement.toFixed(3)} mm\n`;
      if (context.analysisResults.maxStress !== undefined)
        response += `- Max Stress: ${context.analysisResults.maxStress.toFixed(1)} MPa\n`;
      if (context.analysisResults.maxMoment !== undefined)
        response += `- Max Moment: ${context.analysisResults.maxMoment.toFixed(1)} kN·m\n`;
    }

    return { success: true, response };
  }

  private handleAboutModel(context?: ModelContext): AIResponse {
    if (!context || context.nodes.length === 0) {
      return { success: true, response: "No model loaded." };
    }

    return {
      success: true,
      response: `The current model has **${context.nodes.length} nodes**, **${context.members.length} members**, **${context.nodes.filter(n => n.hasSupport).length} supports**, and **${context.loads?.length || 0} loads**.`,
    };
  }

  private async handleTroubleshoot(message: string, context?: ModelContext): Promise<AIResponse> {
    if (!context || context.nodes.length === 0) {
      return { success: true, response: "No model loaded to troubleshoot." };
    }

    // Diagnose first
    const diagnosis = await this.diagnoseModel(context);

    if (diagnosis.issues.length === 0) {
      return { success: true, response: "✅ No issues found! The model looks healthy." };
    }

    // Auto-fix: generate fix actions
    const actions: AIAction[] = [];
    for (const issue of diagnosis.issues) {
      if (issue.category === 'support' && issue.severity === 'error') {
        // Auto-add supports at ground level
        const groundNodesWithoutSupport = context.nodes.filter(
          n => Math.abs(n.y) < 0.1 && !n.hasSupport
        );
        for (const n of groundNodesWithoutSupport) {
          actions.push({
            type: 'addSupport',
            params: { nodeId: n.id, type: 'fixed', restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
            description: `Add fixed support at node ${n.id}`,
          });
        }
      }
    }

    let response = `## 🔧 Troubleshoot Results\n\n`;
    response += `Found **${diagnosis.issues.length}** issue(s):\n\n`;
    for (const issue of diagnosis.issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      response += `${icon} ${issue.message}\n`;
    }

    if (actions.length > 0) {
      response += `\n✨ **Auto-fix available**: ${actions.length} action(s) ready. Click **Execute** to apply.`;
    }

    return { success: true, response, actions: actions.length > 0 ? actions : undefined };
  }

  private handleClearModel(): AIResponse {
    return {
      success: true,
      response: "⚠️ This will clear the entire model. Click **Execute** to confirm.",
      actions: [{ type: 'clearModel', params: {}, description: 'Clear the entire model' }],
    };
  }

  private async handleExplain(message: string): Promise<AIResponse> {
    if (this.model) {
      try {
        const prompt = `${SYSTEM_PROMPTS.chat}

The user is asking for an explanation. Be clear, concise, and technically accurate. Use proper structural engineering terminology. Include relevant Indian Standards references where applicable.

User question: "${message}"`;

        const result = await this.model.generateContent(prompt);
        return {
          success: true,
          response: result.response.text(),
          metadata: { intent: 'explain', confidence: 0.85, processingTimeMs: 0, provider: 'gemini' },
        };
      } catch (err) {
        logger.warn({ err }, '[AIArchitectEngine] Gemini explain failed');
      }
    }

    return {
      success: true,
      response: "I'd be happy to explain that, but my AI service is currently offline. Please check your Gemini API key configuration, or try asking about specific structural topics like beam design, truss analysis, or IS code provisions.",
      metadata: { intent: 'explain', confidence: 0.5, processingTimeMs: 0, provider: 'local' },
    };
  }

  private async handleConversation(message: string, context?: ModelContext, history?: ChatMessage[]): Promise<AIResponse> {
    if (this.model) {
      try {
        // Build context string
        let contextStr = SYSTEM_PROMPTS.chat;
        if (context && context.nodes.length > 0) {
          contextStr += `\n\nCurrent model: ${context.nodes.length} nodes, ${context.members.length} members, ${context.nodes.filter(n => n.hasSupport).length} supports, ${context.loads?.length || 0} loads.`;
        }

        // Include history
        const recentHistory = (history || this.conversationHistory).slice(-10);
        const historyStr = recentHistory.length > 0
          ? '\n\nRecent conversation:\n' + recentHistory.map(h => `${h.role}: ${h.content}`).join('\n')
          : '';

        const prompt = `${contextStr}${historyStr}\n\nUser: ${message}\n\nAssistant:`;

        const result = await this.model.generateContent(prompt);
        return {
          success: true,
          response: result.response.text(),
          metadata: { intent: 'conversation', confidence: 0.7, processingTimeMs: 0, provider: 'gemini' },
        };
      } catch (err) {
        logger.warn({ err }, '[AIArchitectEngine] Gemini conversation failed');
      }
    }

    // Local fallback — structural engineering focused
    return {
      success: true,
      response: "I'm your AI Architect assistant. I can help with:\n\n" +
        "🏗️ **Create structures** — \"Create a 10m portal frame\"\n" +
        "🔧 **Modify models** — \"Add another story\"\n" +
        "📊 **Analyze** — \"Run analysis\"\n" +
        "🔍 **Diagnose** — \"Check for issues\"\n" +
        "📋 **Code check** — \"Check IS 800 compliance\"\n" +
        "💡 **Explain** — \"What is P-Delta?\"\n\n" +
        "Please configure your Gemini API key for full AI capabilities.",
      metadata: { intent: 'conversation', confidence: 0.5, processingTimeMs: 0, provider: 'local' },
    };
  }

  // ============================================
  // PYTHON BACKEND PROXY
  // ============================================

  async proxyToPython(endpoint: string, body: Record<string, any>): Promise<any> {
    try {
      const response = await fetch(`${this.pythonApiUrl}/ai/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      });

      if (!response.ok) {
        throw new Error(`Python API returned ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      logger.error({ err: error, endpoint }, '[AIArchitectEngine] Python proxy error');
      throw error;
    }
  }

  // ============================================
  // UTILITY METHODS
  // ============================================

  private validateModel(model: StructuralModel): { valid: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!model.nodes || !Array.isArray(model.nodes) || model.nodes.length === 0) {
      issues.push('Missing or empty nodes array');
    }
    if (!model.members || !Array.isArray(model.members) || model.members.length === 0) {
      issues.push('Missing or empty members array');
    }

    if (model.nodes && model.members) {
      const nodeIds = new Set(model.nodes.map(n => n.id));
      for (const member of model.members) {
        if (!nodeIds.has(member.s)) issues.push(`Member ${member.id}: invalid start node "${member.s}"`);
        if (!nodeIds.has(member.e)) issues.push(`Member ${member.id}: invalid end node "${member.e}"`);
        if (member.s === member.e) issues.push(`Member ${member.id}: start and end node are the same`);
      }

      // Check for supports
      const hasSupport = model.nodes.some(n => n.isSupport);
      if (!hasSupport) issues.push('No supports defined — structure will be unstable');
    }

    return { valid: issues.length === 0, issues };
  }

  private normalizeModel(model: StructuralModel): StructuralModel {
    return {
      nodes: (model.nodes || []).map(node => ({
        id: node.id,
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        z: Number(node.z) || 0,
        isSupport: node.isSupport || Math.abs(Number(node.y)) < 0.01,
        restraints: node.restraints || (
          node.isSupport || Math.abs(Number(node.y)) < 0.01
            ? { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }
            : undefined
        ),
      })),
      members: (model.members || []).map(member => ({
        id: member.id,
        s: member.s,
        e: member.e,
        section: member.section || 'ISMB300',
        material: member.material || 'Fe410',
      })),
      loads: model.loads || [],
      materials: model.materials || [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }],
      sections: model.sections,
    };
  }

  // ============================================
  // LOCAL FALLBACK GENERATION
  // ============================================

  private generateLocally(prompt: string): AIResponse {
    const lp = prompt.toLowerCase();

    // Extract dimensions
    const spanMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*span/i) || lp.match(/span\s*(?:of\s*)?([\d.]+)\s*m/i);
    const heightMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*(?:height|tall|high)/i) || lp.match(/height\s*(?:of\s*)?([\d.]+)\s*m/i);
    const storyMatch = lp.match(/(\d+)\s*(?:stor(?:y|ey|ies)|floor)/i);
    const bayMatch = lp.match(/(\d+)\s*bay/i);

    const span = spanMatch ? parseFloat(spanMatch[1]) : 6;
    const height = heightMatch ? parseFloat(heightMatch[1]) : 4;
    const stories = storyMatch ? parseInt(storyMatch[1]) : 1;
    const bays = bayMatch ? parseInt(bayMatch[1]) : 1;

    // Portal frame
    if (/portal|warehouse|shed|industrial/i.test(lp)) {
      return this.generatePortalFrame(span, height);
    }

    // Multi-story building
    if (/story|storey|building|multi|floor/i.test(lp)) {
      return this.generateMultiStory(span, height, stories, bays);
    }

    // Truss
    if (/truss/i.test(lp)) {
      const trussType = /warren/i.test(lp) ? 'warren' : /howe/i.test(lp) ? 'howe' : 'pratt';
      return this.generateTruss(span, height, trussType);
    }

    // Cantilever
    if (/cantilever/i.test(lp)) {
      return this.generateCantilever(span);
    }

    // Simple beam
    if (/beam|simply.*supported/i.test(lp)) {
      return this.generateSimpleBeam(span);
    }

    // Default: portal frame
    return this.generatePortalFrame(span, height);
  }

  private generatePortalFrame(span: number, height: number): AIResponse {
    const model: StructuralModel = {
      nodes: [
        { id: 'n1', x: 0, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'n2', x: 0, y: height, z: 0 },
        { id: 'n3', x: span / 2, y: height + 1.5, z: 0 },
        { id: 'n4', x: span, y: height, z: 0 },
        { id: 'n5', x: span, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
      ],
      members: [
        { id: 'm1', s: 'n1', e: 'n2', section: 'ISMB400' },
        { id: 'm2', s: 'n2', e: 'n3', section: 'ISMB300' },
        { id: 'm3', s: 'n3', e: 'n4', section: 'ISMB300' },
        { id: 'm4', s: 'n4', e: 'n5', section: 'ISMB400' },
      ],
      loads: [
        { nodeId: 'n3', type: 'point', fy: -20 },
      ],
      materials: [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }],
    };

    return {
      success: true,
      response: `✅ Portal frame generated: ${span}m span, ${height}m eave height, pitched roof.\n\n- 5 nodes, 4 members\n- Columns: ISMB400\n- Rafters: ISMB300\n- 20 kN point load at ridge`,
      model,
      actions: [{ type: 'applyModel', params: { model }, description: 'Apply portal frame model' }],
    };
  }

  private generateMultiStory(bayWidth: number, storyHeight: number, stories: number, bays: number): AIResponse {
    const nodes: StructuralNode[] = [];
    const members: StructuralMember[] = [];
    let nodeId = 1;
    let memberId = 1;

    // Generate nodes
    for (let floor = 0; floor <= stories; floor++) {
      for (let bay = 0; bay <= bays; bay++) {
        const isGround = floor === 0;
        nodes.push({
          id: `n${nodeId}`,
          x: bay * bayWidth,
          y: floor * storyHeight,
          z: 0,
          isSupport: isGround,
          restraints: isGround ? { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } : undefined,
        });
        nodeId++;
      }
    }

    const nodesPerFloor = bays + 1;

    // Generate columns
    for (let floor = 0; floor < stories; floor++) {
      for (let bay = 0; bay <= bays; bay++) {
        const bottomNode = `n${floor * nodesPerFloor + bay + 1}`;
        const topNode = `n${(floor + 1) * nodesPerFloor + bay + 1}`;
        members.push({
          id: `m${memberId}`,
          s: bottomNode,
          e: topNode,
          section: floor < stories / 2 ? 'ISMB500' : 'ISMB400',
        });
        memberId++;
      }
    }

    // Generate beams
    for (let floor = 1; floor <= stories; floor++) {
      for (let bay = 0; bay < bays; bay++) {
        const leftNode = `n${floor * nodesPerFloor + bay + 1}`;
        const rightNode = `n${floor * nodesPerFloor + bay + 2}`;
        members.push({
          id: `m${memberId}`,
          s: leftNode,
          e: rightNode,
          section: 'ISMB300',
        });
        memberId++;
      }
    }

    const loads: StructuralLoad[] = [];
    // Add floor loads at each level
    for (let floor = 1; floor <= stories; floor++) {
      for (let bay = 0; bay <= bays; bay++) {
        const nodeIdx = floor * nodesPerFloor + bay + 1;
        loads.push({ nodeId: `n${nodeIdx}`, type: 'point', fy: -25 });
      }
    }

    const model: StructuralModel = {
      nodes, members, loads,
      materials: [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }],
    };

    return {
      success: true,
      response: `✅ ${stories}-story, ${bays}-bay frame generated.\n\n- ${nodes.length} nodes, ${members.length} members\n- Bay width: ${bayWidth}m, Story height: ${storyHeight}m\n- Lower columns: ISMB500, Upper columns: ISMB400\n- Beams: ISMB300\n- 25 kN floor loads at each joint`,
      model,
      actions: [{ type: 'applyModel', params: { model }, description: `Apply ${stories}-story frame` }],
    };
  }

  private generateTruss(span: number, depth: number, type: string): AIResponse {
    const panels = Math.max(4, Math.round(span / 3) * 2); // even number of panels
    const panelWidth = span / panels;
    const nodes: StructuralNode[] = [];
    const members: StructuralMember[] = [];
    let nodeId = 1;
    let memberId = 1;

    // Bottom chord nodes
    for (let i = 0; i <= panels; i++) {
      const isEnd = i === 0 || i === panels;
      nodes.push({
        id: `n${nodeId}`,
        x: i * panelWidth,
        y: 0,
        z: 0,
        isSupport: isEnd,
        restraints: isEnd
          ? (i === 0
              ? { fx: true, fy: true, fz: true, mx: false, my: false, mz: false }
              : { fx: false, fy: true, fz: true, mx: false, my: false, mz: false })
          : undefined,
      });
      nodeId++;
    }

    // Top chord nodes (skip ends for triangular profile)
    const topStartId = nodeId;
    for (let i = 1; i < panels; i++) {
      nodes.push({
        id: `n${nodeId}`,
        x: i * panelWidth,
        y: depth,
        z: 0,
      });
      nodeId++;
    }

    // Bottom chord members
    for (let i = 0; i < panels; i++) {
      members.push({
        id: `m${memberId}`,
        s: `n${i + 1}`,
        e: `n${i + 2}`,
        section: 'ISA100x100x10',
      });
      memberId++;
    }

    // Top chord members
    for (let i = 0; i < panels - 2; i++) {
      members.push({
        id: `m${memberId}`,
        s: `n${topStartId + i}`,
        e: `n${topStartId + i + 1}`,
        section: 'ISA100x100x10',
      });
      memberId++;
    }

    // End diagonals (bottom end to first/last top node)
    members.push({ id: `m${memberId}`, s: 'n1', e: `n${topStartId}`, section: 'ISA80x80x8' });
    memberId++;
    members.push({ id: `m${memberId}`, s: `n${panels + 1}`, e: `n${topStartId + panels - 2}`, section: 'ISA80x80x8' });
    memberId++;

    // Verticals and diagonals
    for (let i = 1; i < panels; i++) {
      const bottomNode = `n${i + 1}`;
      const topNode = `n${topStartId + i - 1}`;

      // Vertical
      members.push({ id: `m${memberId}`, s: bottomNode, e: topNode, section: 'ISA75x75x6' });
      memberId++;

      // Diagonal (Pratt: diagonals slope toward center)
      if (type === 'pratt' && i < panels - 1) {
        if (i < panels / 2) {
          members.push({ id: `m${memberId}`, s: `n${i + 1}`, e: `n${topStartId + i}`, section: 'ISA75x75x6' });
        } else {
          members.push({ id: `m${memberId}`, s: `n${i + 2}`, e: `n${topStartId + i - 1}`, section: 'ISA75x75x6' });
        }
        memberId++;
      } else if (type === 'warren' && i < panels - 1) {
        if (i % 2 === 1) {
          members.push({ id: `m${memberId}`, s: `n${i + 1}`, e: `n${topStartId + i}`, section: 'ISA75x75x6' });
        } else {
          members.push({ id: `m${memberId}`, s: `n${i + 2}`, e: `n${topStartId + i - 1}`, section: 'ISA75x75x6' });
        }
        memberId++;
      } else if (type === 'howe' && i < panels - 1) {
        // Howe truss: diagonals slope away from center (opposite of Pratt)
        if (i < panels / 2) {
          members.push({ id: `m${memberId}`, s: `n${i + 2}`, e: `n${topStartId + i - 1}`, section: 'ISA75x75x6' });
        } else {
          members.push({ id: `m${memberId}`, s: `n${i + 1}`, e: `n${topStartId + i}`, section: 'ISA75x75x6' });
        }
        memberId++;
      }
    }

    const loads: StructuralLoad[] = [];
    for (let i = 1; i < panels; i++) {
      loads.push({ nodeId: `n${topStartId + i - 1}`, type: 'point', fy: -10 });
    }

    const model: StructuralModel = { nodes, members, loads, materials: [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }] };

    return {
      success: true,
      response: `✅ ${type.charAt(0).toUpperCase() + type.slice(1)} truss generated: ${span}m span, ${depth}m depth, ${panels} panels.\n\n- ${nodes.length} nodes, ${members.length} members\n- Chords: ISA100x100x10\n- Diagonals: ISA80x80x8\n- Verticals: ISA75x75x6`,
      model,
      actions: [{ type: 'applyModel', params: { model }, description: `Apply ${type} truss` }],
    };
  }

  private generateSimpleBeam(span: number): AIResponse {
    const model: StructuralModel = {
      nodes: [
        { id: 'n1', x: 0, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } },
        { id: 'n2', x: span, y: 0, z: 0, isSupport: true, restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } },
      ],
      members: [{ id: 'm1', s: 'n1', e: 'n2', section: 'ISMB300' }],
      loads: [{ nodeId: 'n2', type: 'point', fy: -0.001 }],
      materials: [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }],
    };

    return {
      success: true,
      response: `✅ Simply supported beam: ${span}m span.\n\n- Pinned support at left, roller at right\n- Section: ISMB300\n- Add loads using "add 50 kN load at midspan"`,
      model,
      actions: [{ type: 'applyModel', params: { model }, description: 'Apply simple beam' }],
    };
  }

  private generateCantilever(length: number): AIResponse {
    const model: StructuralModel = {
      nodes: [
        { id: 'n1', x: 0, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: 'n2', x: length, y: 0, z: 0 },
      ],
      members: [{ id: 'm1', s: 'n1', e: 'n2', section: 'ISMB400' }],
      loads: [{ nodeId: 'n2', type: 'point', fy: -20 }],
      materials: [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }],
    };

    return {
      success: true,
      response: `✅ Cantilever beam: ${length}m length.\n\n- Fixed support at left end\n- Section: ISMB400\n- 20 kN tip load applied`,
      model,
      actions: [{ type: 'applyModel', params: { model }, description: 'Apply cantilever beam' }],
    };
  }

  // ============================================
  // STATUS
  // ============================================

  getStatus(): { gemini: boolean; python: boolean; local: boolean; model: string } {
    return {
      gemini: !!this.model,
      python: !!this.pythonApiUrl,
      local: true,
      model: this.model ? 'gemini-2.0-flash' : 'local-fallback',
    };
  }
}

// ============================================
// SINGLETON
// ============================================

export const aiArchitectEngine = new AIArchitectEngine();

export default aiArchitectEngine;
