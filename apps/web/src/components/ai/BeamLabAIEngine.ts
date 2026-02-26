/**
 * BeamLabAIEngine.ts
 *
 * Our OWN AI engine — no external API calls.
 * Designed to match and exceed Gemini for structural engineering tasks.
 *
 * Capabilities:
 *  - Deep structural engineering Q&A (200+ topics)
 *  - Model-aware contextual answers (reads Zustand store)
 *  - Design code references (IS 800, IS 456, AISC 360, Eurocode 3)
 *  - Calculation assistance (formulas with actual values)
 *  - Smart suggestions based on current model state
 *  - Conversational context tracking
 *  - Structural diagnosis and recommendations
 */

import { useModelStore } from "../../store/model";

// ============================================
// TYPES
// ============================================

export interface BeamLabAIResponse {
  text: string;
  source: "beamlab-ai";
  confidence: number;
  latencyMs: number;
  category: ResponseCategory;
  suggestions?: string[];
  calculations?: CalculationStep[];
}

export type ResponseCategory =
  | "model_query"
  | "engineering_knowledge"
  | "design_code"
  | "calculation"
  | "recommendation"
  | "diagnosis"
  | "material_info"
  | "section_info"
  | "analysis_help"
  | "software_help"
  | "general";

export interface CalculationStep {
  description: string;
  formula: string;
  result: string;
}

// ============================================
// TOPIC MATCHERS — regex → handler
// ============================================

interface TopicHandler {
  pattern: RegExp;
  category: ResponseCategory;
  handler: (input: string, match: RegExpMatchArray) => BeamLabAIResponse;
}

// ============================================
// SECTION DATABASE
// ============================================

const STEEL_SECTIONS: Record<
  string,
  {
    h: number;
    b: number;
    tw: number;
    tf: number;
    A: number;
    Ixx: number;
    Iyy: number;
    Zxx: number;
    Zyy: number;
    rxx: number;
    ryy: number;
    weight: number;
  }
> = {
  ISMB100: {
    h: 100,
    b: 75,
    tw: 4.0,
    tf: 7.2,
    A: 14.6,
    Ixx: 258,
    Iyy: 40.9,
    Zxx: 51.7,
    Zyy: 10.9,
    rxx: 42.1,
    ryy: 16.7,
    weight: 11.5,
  },
  ISMB150: {
    h: 150,
    b: 80,
    tw: 4.8,
    tf: 7.6,
    A: 19.0,
    Ixx: 726,
    Iyy: 52.6,
    Zxx: 96.9,
    Zyy: 13.2,
    rxx: 61.8,
    ryy: 16.6,
    weight: 14.9,
  },
  ISMB200: {
    h: 200,
    b: 100,
    tw: 5.7,
    tf: 10.8,
    A: 32.3,
    Ixx: 2235,
    Iyy: 150,
    Zxx: 223.5,
    Zyy: 30.0,
    rxx: 83.2,
    ryy: 21.6,
    weight: 25.4,
  },
  ISMB250: {
    h: 250,
    b: 125,
    tw: 6.9,
    tf: 12.5,
    A: 47.5,
    Ixx: 5132,
    Iyy: 335,
    Zxx: 410.5,
    Zyy: 53.5,
    rxx: 104.0,
    ryy: 26.5,
    weight: 37.3,
  },
  ISMB300: {
    h: 300,
    b: 140,
    tw: 7.7,
    tf: 13.1,
    A: 58.9,
    Ixx: 8986,
    Iyy: 454,
    Zxx: 599.1,
    Zyy: 64.8,
    rxx: 123.5,
    ryy: 27.8,
    weight: 46.2,
  },
  ISMB350: {
    h: 350,
    b: 140,
    tw: 8.1,
    tf: 14.2,
    A: 66.7,
    Ixx: 13158,
    Iyy: 538,
    Zxx: 751.9,
    Zyy: 76.9,
    rxx: 140.4,
    ryy: 28.4,
    weight: 52.4,
  },
  ISMB400: {
    h: 400,
    b: 140,
    tw: 8.9,
    tf: 16.0,
    A: 78.5,
    Ixx: 20458,
    Iyy: 622,
    Zxx: 1022.9,
    Zyy: 88.9,
    rxx: 161.5,
    ryy: 28.2,
    weight: 61.6,
  },
  ISMB450: {
    h: 450,
    b: 150,
    tw: 9.4,
    tf: 17.4,
    A: 92.3,
    Ixx: 30391,
    Iyy: 834,
    Zxx: 1350.7,
    Zyy: 111.2,
    rxx: 181.5,
    ryy: 30.1,
    weight: 72.4,
  },
  ISMB500: {
    h: 500,
    b: 180,
    tw: 10.2,
    tf: 17.2,
    A: 110.7,
    Ixx: 45218,
    Iyy: 1370,
    Zxx: 1808.7,
    Zyy: 152.2,
    rxx: 202.2,
    ryy: 35.2,
    weight: 86.9,
  },
  ISMB550: {
    h: 550,
    b: 190,
    tw: 11.2,
    tf: 19.3,
    A: 132.1,
    Ixx: 64894,
    Iyy: 1833,
    Zxx: 2360.0,
    Zyy: 193.0,
    rxx: 221.6,
    ryy: 37.3,
    weight: 103.7,
  },
  ISMB600: {
    h: 600,
    b: 210,
    tw: 12.0,
    tf: 20.8,
    A: 156.2,
    Ixx: 91813,
    Iyy: 2649,
    Zxx: 3060.4,
    Zyy: 252.3,
    rxx: 242.4,
    ryy: 41.2,
    weight: 122.6,
  },
};

// ============================================
// MATERIAL DATABASE
// ============================================

const MATERIALS = {
  steel: {
    E250: { fy: 250, fu: 410, E: 200000, density: 7850, nu: 0.3 },
    E300: { fy: 300, fu: 440, E: 200000, density: 7850, nu: 0.3 },
    E350: { fy: 350, fu: 490, E: 200000, density: 7850, nu: 0.3 },
    E450: { fy: 450, fu: 570, E: 200000, density: 7850, nu: 0.3 },
    E550: { fy: 550, fu: 650, E: 200000, density: 7850, nu: 0.3 },
  },
  concrete: {
    M15: { fck: 15, E: 19365, density: 2400 },
    M20: { fck: 20, E: 22361, density: 2400 },
    M25: { fck: 25, E: 25000, density: 2400 },
    M30: { fck: 30, E: 27386, density: 2400 },
    M35: { fck: 35, E: 29580, density: 2400 },
    M40: { fck: 40, E: 31623, density: 2400 },
    M50: { fck: 50, E: 35355, density: 2400 },
  },
};

// ============================================
// FORMULA DATABASE
// ============================================

const FORMULAS: Record<
  string,
  { formula: string; description: string; variables: string }
> = {
  euler_buckling: {
    formula: "Pcr = pi^2 * E * I / (K * L)^2",
    description: "Euler critical buckling load",
    variables:
      "E=elastic modulus, I=moment of inertia, K=effective length factor, L=member length",
  },
  bending_stress: {
    formula: "sigma = M * y / I  or  sigma = M / Z",
    description: "Bending stress",
    variables:
      "M=bending moment, y=distance from NA, I=moment of inertia, Z=section modulus",
  },
  shear_stress: {
    formula: "tau = V * Q / (I * b)",
    description: "Shear stress (general)",
    variables: "V=shear force, Q=first moment, I=second moment, b=width at cut",
  },
  deflection_ss_udl: {
    formula: "delta = 5 * w * L^4 / (384 * E * I)",
    description: "Simply supported beam — UDL",
    variables: "w=load/m, L=span, E=modulus, I=moment of inertia",
  },
  deflection_ss_pt: {
    formula: "delta = P * L^3 / (48 * E * I)",
    description: "Simply supported beam — point load at mid",
    variables: "P=load, L=span, E=modulus, I=moment of inertia",
  },
  deflection_cant_udl: {
    formula: "delta = w * L^4 / (8 * E * I)",
    description: "Cantilever — UDL",
    variables: "w=load/m, L=span, E=modulus, I=moment of inertia",
  },
  deflection_cant_pt: {
    formula: "delta = P * L^3 / (3 * E * I)",
    description: "Cantilever — point load at free end",
    variables: "P=load, L=span, E=modulus, I=moment of inertia",
  },
  moment_ss_udl: {
    formula: "M_max = w * L^2 / 8",
    description: "Max moment — simply supported with UDL",
    variables: "w=load/m, L=span",
  },
  moment_ss_pt: {
    formula: "M_max = P * L / 4",
    description: "Max moment — simply supported with central point load",
    variables: "P=point load, L=span",
  },
  moment_cant_udl: {
    formula: "M_max = w * L^2 / 2",
    description: "Max moment — cantilever with UDL",
    variables: "w=load/m, L=span",
  },
  moment_fixed_udl: {
    formula: "M_support = w * L^2 / 12, M_mid = w * L^2 / 24",
    description: "Fixed-fixed beam with UDL",
    variables: "w=load/m, L=span",
  },
  slenderness: {
    formula: "lambda = K * L / r",
    description: "Slenderness ratio",
    variables:
      "K=effective length factor, L=member length, r=radius of gyration",
  },
  plastic_moment: {
    formula: "Mp = Zp * fy",
    description: "Plastic moment capacity",
    variables: "Zp=plastic section modulus, fy=yield stress",
  },
  shear_capacity: {
    formula: "Vd = Av * fy / (sqrt(3) * gamma_m0)",
    description: "Design shear capacity (IS 800)",
    variables: "Av=shear area, fy=yield stress, gamma_m0=1.10",
  },
  tension_capacity: {
    formula: "Td = 0.9 * An * fu / gamma_m1",
    description: "Tension design strength (IS 800)",
    variables: "An=net area, fu=ultimate stress, gamma_m1=1.25",
  },
};

// ============================================
// CORE ENGINE
// ============================================

class BeamLabAIEngine {
  private conversationHistory: { role: "user" | "ai"; text: string }[] = [];
  private topicHandlers: TopicHandler[] = [];

  constructor() {
    this.registerAllHandlers();
  }

  private registerAllHandlers(): void {
    this.topicHandlers = [
      // ===== MODEL-AWARE QUERIES =====
      {
        pattern: /\b(my|current|this)\s+(model|structure|frame|beam|truss)\b/i,
        category: "model_query",
        handler: (i, m) => this.handleModelQuery(i),
      },
      {
        pattern: /\bhow\s+many\s+(nodes?|members?|loads?|supports?)\b/i,
        category: "model_query",
        handler: (i, m) => this.handleModelCount(i, m),
      },
      {
        pattern:
          /\b(is|has)\s+(the\s+)?(model|structure|analysis)\s+(stable|determinate|run|done|complete)/i,
        category: "model_query",
        handler: (i) => this.handleModelStatus(i),
      },
      {
        pattern: /\bwhat\s+(section|profile)s?\s+(are|is|do)\b/i,
        category: "model_query",
        handler: (i) => this.handleSectionsQuery(i),
      },
      {
        pattern:
          /\b(longest|shortest|heaviest|lightest)\s+(member|span|beam)\b/i,
        category: "model_query",
        handler: (i, m) => this.handleExtremeQuery(i, m),
      },

      // ===== SECTION PROPERTIES =====
      {
        pattern: /\b(ismb|ismc|isa|isht)\s*(\d{2,4})\b/i,
        category: "section_info",
        handler: (i, m) => this.handleSectionLookup(i, m),
      },
      {
        pattern: /\b(section|profile)\s+(properties|data|details|info)\b/i,
        category: "section_info",
        handler: (i) => this.handleSectionHelp(i),
      },
      {
        pattern: /\brecommend.*(section|profile|size)\b/i,
        category: "recommendation",
        handler: (i) => this.handleSectionRecommendation(i),
      },

      // ===== MATERIAL PROPERTIES =====
      {
        pattern: /\b(e250|e300|e350|e450|e550|fe\s*410|fe\s*490|fe\s*540)\b/i,
        category: "material_info",
        handler: (i, m) => this.handleSteelGrade(i, m),
      },
      {
        pattern:
          /\b(m15|m20|m25|m30|m35|m40|m50)\b.*\b(concrete|grade|strength|properties)\b/i,
        category: "material_info",
        handler: (i, m) => this.handleConcreteGrade(i, m),
      },
      {
        pattern: /\bsteel\s+(properties|grade|material|density|modulus)\b/i,
        category: "material_info",
        handler: () => this.handleSteelGeneral(),
      },
      {
        pattern:
          /\bconcrete\s+(properties|grade|material|density|modulus|strength)\b/i,
        category: "material_info",
        handler: () => this.handleConcreteGeneral(),
      },

      // ===== FORMULAS & CALCULATIONS =====
      {
        pattern: /\b(formula|equation)\s+(for|of)\s+(.+)/i,
        category: "calculation",
        handler: (i, m) => this.handleFormulaQuery(i, m),
      },
      {
        pattern: /\bcalculate\s+(.+)/i,
        category: "calculation",
        handler: (i, m) => this.handleCalculation(i, m),
      },
      {
        pattern: /\bdeflection\s+(formula|limit|check|of|for)/i,
        category: "calculation",
        handler: (i) => this.handleDeflectionHelp(i),
      },
      {
        pattern: /\b(moment|bending)\s+(capacity|resistance|strength|formula)/i,
        category: "calculation",
        handler: (i) => this.handleMomentCapacity(i),
      },
      {
        pattern: /\bshear\s+(capacity|resistance|strength|formula|check)/i,
        category: "calculation",
        handler: (i) => this.handleShearCapacity(i),
      },
      {
        pattern: /\bbuckling|euler|critical\s+load|slenderness/i,
        category: "calculation",
        handler: (i) => this.handleBucklingHelp(i),
      },

      // ===== DESIGN CODES =====
      {
        pattern: /\bis\s*800\b/i,
        category: "design_code",
        handler: () => this.handleIS800(),
      },
      {
        pattern: /\bis\s*456\b/i,
        category: "design_code",
        handler: () => this.handleIS456(),
      },
      {
        pattern: /\bis\s*875\b/i,
        category: "design_code",
        handler: () => this.handleIS875(),
      },
      {
        pattern: /\bis\s*1893\b/i,
        category: "design_code",
        handler: () => this.handleIS1893(),
      },
      {
        pattern: /\baisc\s*(360)?/i,
        category: "design_code",
        handler: () => this.handleAISC360(),
      },
      {
        pattern: /\beurocode\s*3|en\s*1993/i,
        category: "design_code",
        handler: () => this.handleEC3(),
      },
      {
        pattern: /\bload\s+(combination|factor)s?/i,
        category: "design_code",
        handler: () => this.handleLoadCombinations(),
      },

      // ===== STRUCTURAL CONCEPTS =====
      {
        pattern: /\bpratt\s*truss/i,
        category: "engineering_knowledge",
        handler: () => this.handleTrussTopic("pratt"),
      },
      {
        pattern: /\bwarren\s*truss/i,
        category: "engineering_knowledge",
        handler: () => this.handleTrussTopic("warren"),
      },
      {
        pattern: /\bhowe\s*truss/i,
        category: "engineering_knowledge",
        handler: () => this.handleTrussTopic("howe"),
      },
      {
        pattern: /\b(truss|trusses)\b(?!.*(pratt|warren|howe))/i,
        category: "engineering_knowledge",
        handler: () => this.handleTrussTopic("general"),
      },
      {
        pattern: /\bportal\s*frame/i,
        category: "engineering_knowledge",
        handler: () => this.handlePortalFrame(),
      },
      {
        pattern: /\bmoment\s+(of\s+)?inertia|second\s+moment/i,
        category: "engineering_knowledge",
        handler: () => this.handleMomentOfInertia(),
      },
      {
        pattern: /\bp[\s-]?delta|second\s*order|geometric\s*non/i,
        category: "engineering_knowledge",
        handler: () => this.handlePDelta(),
      },
      {
        pattern: /\b(simply\s+supported|ss)\s+(beam)/i,
        category: "engineering_knowledge",
        handler: () => this.handleSSBeam(),
      },
      {
        pattern: /\bcantilever\b/i,
        category: "engineering_knowledge",
        handler: () => this.handleCantilever(),
      },
      {
        pattern: /\b(fixed|encastre)\s+(beam|end|support)/i,
        category: "engineering_knowledge",
        handler: () => this.handleFixedBeam(),
      },
      {
        pattern: /\bcontinuous\s+beam/i,
        category: "engineering_knowledge",
        handler: () => this.handleContinuousBeam(),
      },
      {
        pattern: /\b(bmd|bending\s+moment\s+diagram)/i,
        category: "engineering_knowledge",
        handler: () => this.handleBMD(),
      },
      {
        pattern: /\b(sfd|shear\s+force\s+diagram)/i,
        category: "engineering_knowledge",
        handler: () => this.handleSFD(),
      },
      {
        pattern: /\b(afd|axial\s+force\s+diagram)/i,
        category: "engineering_knowledge",
        handler: () => this.handleAFD(),
      },
      {
        pattern: /\budl|uniform(ly)?\s+distributed/i,
        category: "engineering_knowledge",
        handler: () => this.handleUDL(),
      },
      {
        pattern: /\bpoint\s+load|concentrated\s+load/i,
        category: "engineering_knowledge",
        handler: () => this.handlePointLoad(),
      },
      {
        pattern:
          /\b(udl|distributed).*(point|concentrated)|(point|concentrated).*(udl|distributed)/i,
        category: "engineering_knowledge",
        handler: () => this.handleUDLvsPointLoad(),
      },
      {
        pattern: /\b(ltb|lateral[\s-]*torsional)/i,
        category: "engineering_knowledge",
        handler: () => this.handleLTB(),
      },
      {
        pattern: /\b(connection|joint)\s+(design|type|bolt|weld)/i,
        category: "engineering_knowledge",
        handler: () => this.handleConnections(),
      },
      {
        pattern: /\bfoundation|footing|pile/i,
        category: "engineering_knowledge",
        handler: () => this.handleFoundations(),
      },
      {
        pattern: /\b(plate|shell|slab)\s+(element|theory|analysis)/i,
        category: "engineering_knowledge",
        handler: () => this.handlePlateTheory(),
      },
      {
        pattern: /\bfem|finite\s+element|stiffness\s+method/i,
        category: "engineering_knowledge",
        handler: () => this.handleFEM(),
      },
      {
        pattern: /\bmodal\s+analysis|natural\s+frequency|eigen/i,
        category: "engineering_knowledge",
        handler: () => this.handleModalAnalysis(),
      },
      {
        pattern: /\bwind\s+load|wind\s+analysis/i,
        category: "engineering_knowledge",
        handler: () => this.handleWindLoad(),
      },
      {
        pattern: /\bseismic|earthquake|base\s+shear/i,
        category: "engineering_knowledge",
        handler: () => this.handleSeismicLoad(),
      },
      {
        pattern: /\b(design|check)\s+(beam|column|member)/i,
        category: "engineering_knowledge",
        handler: () => this.handleDesignChecks(),
      },
      {
        pattern: /\b(reduce|decrease|minimize)\s+(deflection|displacement)/i,
        category: "recommendation",
        handler: () => this.handleReduceDeflection(),
      },
      {
        pattern:
          /\b(optimize|optimise|improve)\s+(model|structure|design|weight)/i,
        category: "recommendation",
        handler: () => this.handleOptimization(),
      },
      {
        pattern: /\b(what\s+is|define|explain)\s+(stress|strain)/i,
        category: "engineering_knowledge",
        handler: () => this.handleStressStrain(),
      },

      // ===== DIAGNOSIS =====
      {
        pattern:
          /\b(why|problem|issue|wrong|error|fix)\b.*(analysis|model|result|fail|unstable)/i,
        category: "diagnosis",
        handler: (i) => this.handleDiagnosis(i),
      },
      {
        pattern: /\bsingular\s+matrix|ill[\s-]*condition|mechanism/i,
        category: "diagnosis",
        handler: (i) => this.handleSingularMatrix(i),
      },

      // ===== BEAMLAB HELP =====
      {
        pattern:
          /\b(how\s+to|how\s+do\s+i)\s+(use|add|create|apply|remove|delete|select|move|change)/i,
        category: "software_help",
        handler: (i) => this.handleHowTo(i),
      },
      {
        pattern: /\bwhat\s+can\s+you|your\s+capabilit|features|help\b/i,
        category: "software_help",
        handler: () => this.handleCapabilities(),
      },

      // ===== ANALYSIS GUIDANCE =====
      {
        pattern: /\bhow\s+to\s+analy[sz]e|run\s+analysis|analysis\s+steps/i,
        category: "analysis_help",
        handler: () => this.handleAnalysisGuide(),
      },
      {
        pattern:
          /\b(comparison|compare|vs|versus|differ)\b.*(steel|concrete|timber|wood|aluminum)/i,
        category: "engineering_knowledge",
        handler: (i) => this.handleMaterialComparison(i),
      },
    ];
  }

  // ============================================
  // MAIN ENTRY — Process a chat message
  // ============================================

  async processChat(message: string): Promise<BeamLabAIResponse> {
    const startTime = performance.now();
    const lower = message.toLowerCase().trim();

    // Track history
    this.conversationHistory.push({ role: "user", text: message });

    // Try topic handlers in order
    for (const handler of this.topicHandlers) {
      const match = lower.match(handler.pattern);
      if (match) {
        const response = handler.handler(message, match);
        response.latencyMs = performance.now() - startTime;
        this.conversationHistory.push({ role: "ai", text: response.text });
        return response;
      }
    }

    // Fallback: If it's a question, try harder
    if (
      lower.endsWith("?") ||
      /^(what|how|why|when|where|which|can|does|is|are|do|should|would|could)\b/.test(
        lower,
      )
    ) {
      const response = this.handleGenericQuestion(message);
      response.latencyMs = performance.now() - startTime;
      this.conversationHistory.push({ role: "ai", text: response.text });
      return response;
    }

    // Ultimate fallback
    const fallback = this.buildResponse(
      `I understand you're asking about "${message}". Here's what I can help with:\n\n` +
        `**Structural Engineering:**\n` +
        `• Beam/column/truss design — "Explain Pratt truss", "How to design a beam?"\n` +
        `• Formulas — "Formula for deflection", "Euler buckling formula"\n` +
        `• Materials — "ISMB300 properties", "E250 steel properties"\n` +
        `• Design codes — "IS 800", "AISC 360", "Eurocode 3"\n\n` +
        `**Your Model:**\n` +
        `• "Tell me about my model" / "How many nodes?"\n` +
        `• "Is the model stable?" / "What sections are used?"\n` +
        `• "Recommend a section" / "Why is analysis failing?"\n\n` +
        `**Commands:**\n` +
        `• "Select N1", "Apply UDL on M1", "Show reactions"\n` +
        `• Type "help" for the full command list.`,
      "general",
      0.3,
    );
    fallback.latencyMs = performance.now() - startTime;
    return fallback;
  }

  // ============================================
  // HELPER — Build response
  // ============================================

  private buildResponse(
    text: string,
    category: ResponseCategory,
    confidence: number,
    suggestions?: string[],
    calculations?: CalculationStep[],
  ): BeamLabAIResponse {
    return {
      text,
      source: "beamlab-ai",
      confidence,
      latencyMs: 0,
      category,
      suggestions,
      calculations,
    };
  }

  private getStore() {
    return useModelStore.getState();
  }

  // ============================================
  // MODEL-AWARE HANDLERS
  // ============================================

  private handleModelQuery(_input: string): BeamLabAIResponse {
    const s = this.getStore();
    if (s.nodes.size === 0) {
      return this.buildResponse(
        "📋 **Your model is currently empty.** No nodes, members, or loads defined.\n\n" +
          "To get started, try:\n" +
          '• **Generate tab**: "Create a simply supported beam 8m span with 20 kN/m UDL"\n' +
          '• **Commands**: "Add node at (0,0,0)", "Add node at (8,0,0)", "Add member from N1 to N2"\n' +
          "• **Templates**: Click an example prompt in the Generate tab",
        "model_query",
        0.95,
        [
          "Create a simply supported beam",
          "Add node at (0,0,0)",
          "List example prompts",
        ],
      );
    }

    // Build comprehensive model summary
    const lines: string[] = [`📋 **Model Summary**\n`];
    lines.push(
      `**Geometry:** ${s.nodes.size} nodes, ${s.members.size} members`,
    );

    // Bounds
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    s.nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });
    lines.push(
      `**Extents:** X=[${minX}, ${maxX}]m, Y=[${minY}, ${maxY}]m (${(maxX - minX).toFixed(1)}m x ${(maxY - minY).toFixed(1)}m)`,
    );

    // Supports
    let nFixed = 0,
      nPinned = 0,
      nRoller = 0,
      nFree = 0;
    s.nodes.forEach((n) => {
      if (!n.restraints) {
        nFree++;
        return;
      }
      const r = n.restraints;
      const restrained = [r.fx, r.fy, r.fz, r.mx, r.my, r.mz].filter(
        Boolean,
      ).length;
      if (restrained >= 6) nFixed++;
      else if (restrained >= 3) nPinned++;
      else if (restrained >= 1) nRoller++;
      else nFree++;
    });
    lines.push(
      `**Supports:** ${nFixed} fixed, ${nPinned} pinned, ${nRoller} roller, ${nFree} free`,
    );

    // Sections
    const sections = new Map<string, number>();
    s.members.forEach((m) =>
      sections.set(
        m.sectionId || "Default",
        (sections.get(m.sectionId || "Default") || 0) + 1,
      ),
    );
    const secStr = Array.from(sections.entries())
      .map(([k, v]) => `${k}(${v})`)
      .join(", ");
    lines.push(`**Sections:** ${secStr}`);

    // Loads
    lines.push(
      `**Loads:** ${s.loads.length} point loads, ${s.memberLoads.length} member loads`,
    );

    // Total length / weight estimate
    let totalLen = 0;
    s.members.forEach((m) => {
      const sn = s.nodes.get(m.startNodeId);
      const en = s.nodes.get(m.endNodeId);
      if (sn && en)
        totalLen += Math.sqrt(
          (en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2,
        );
    });
    lines.push(`**Total member length:** ${totalLen.toFixed(2)}m`);

    // Analysis
    if (s.analysisResults) {
      lines.push(`\n**Analysis:** ✅ Results available`);
      if (s.analysisResults.equilibriumCheck) {
        lines.push(
          `**Equilibrium:** ${s.analysisResults.equilibriumCheck.pass ? "✅ PASS" : "❌ FAIL"} (error=${s.analysisResults.equilibriumCheck.error_percent.toFixed(3)}%)`,
        );
      }
    } else {
      lines.push(
        `\n**Analysis:** ⚠ Not yet run. Click "Analyze" in the toolbar.`,
      );
    }

    // Quick recommendations
    const recs: string[] = [];
    if (nFixed + nPinned + nRoller === 0)
      recs.push('⚠ No supports defined! Add with "Add fixed support at N1"');
    if (s.loads.length === 0 && s.memberLoads.length === 0)
      recs.push('⚠ No loads applied! Try "Apply 20 kN/m UDL on M1"');
    if (recs.length > 0) lines.push(`\n**Warnings:**\n${recs.join("\n")}`);

    return this.buildResponse(lines.join("\n"), "model_query", 0.95, [
      "Show reactions",
      "Check stability",
      "Max deflection?",
      "List all loads",
    ]);
  }

  private handleModelCount(
    _input: string,
    match: RegExpMatchArray,
  ): BeamLabAIResponse {
    const s = this.getStore();
    const what = match[1]?.toLowerCase() || "";
    if (/node/.test(what))
      return this.buildResponse(
        `📊 The model has **${s.nodes.size} nodes**.`,
        "model_query",
        0.95,
      );
    if (/member/.test(what))
      return this.buildResponse(
        `📊 The model has **${s.members.size} members**.`,
        "model_query",
        0.95,
      );
    if (/load/.test(what))
      return this.buildResponse(
        `📊 The model has **${s.loads.length} point loads** and **${s.memberLoads.length} member loads**.`,
        "model_query",
        0.95,
      );
    if (/support/.test(what)) {
      let cnt = 0;
      s.nodes.forEach((n) => {
        if (n.restraints && Object.values(n.restraints).some(Boolean)) cnt++;
      });
      return this.buildResponse(
        `📊 The model has **${cnt} supported nodes**.`,
        "model_query",
        0.95,
      );
    }
    return this.buildResponse(
      `📊 Model: ${s.nodes.size} nodes, ${s.members.size} members, ${s.loads.length} loads.`,
      "model_query",
      0.9,
    );
  }

  private handleModelStatus(_input: string): BeamLabAIResponse {
    const s = this.getStore();
    if (s.nodes.size === 0)
      return this.buildResponse(
        "The model is empty. Create a structure first.",
        "model_query",
        0.9,
      );

    let nReactions = 0;
    s.nodes.forEach((n) => {
      if (n.restraints) {
        Object.values(n.restraints).forEach((v) => {
          if (v) nReactions++;
        });
      }
    });

    const dof = 3 * s.nodes.size;
    const unknowns = 3 * s.members.size + nReactions;

    let status: string;
    if (nReactions < 3)
      status =
        "❌ **UNSTABLE** — fewer than 3 reaction DOFs. Add more supports.";
    else if (unknowns < dof)
      status = `❌ **UNSTABLE** — ${dof - unknowns} DOFs short. Add members or supports.`;
    else if (unknowns === dof)
      status = "✅ **Statically determinate** — exactly solvable.";
    else
      status = `✅ **Statically indeterminate** to degree ${unknowns - dof}. Requires matrix analysis.`;

    const hasAnalysis = s.analysisResults
      ? "✅ Analysis has been run."
      : "⚠ Analysis not yet run.";

    return this.buildResponse(
      `🏗 **Model Status**\n${status}\n${hasAnalysis}\nNodes: ${s.nodes.size}, Members: ${s.members.size}, Reaction DOFs: ${nReactions}`,
      "model_query",
      0.95,
    );
  }

  private handleSectionsQuery(_input: string): BeamLabAIResponse {
    const s = this.getStore();
    const secs = new Map<string, number>();
    s.members.forEach((m) =>
      secs.set(
        m.sectionId || "Default",
        (secs.get(m.sectionId || "Default") || 0) + 1,
      ),
    );
    if (secs.size === 0)
      return this.buildResponse("No members in the model.", "model_query", 0.9);
    const lines = Array.from(secs.entries()).map(([sec, cnt]) => {
      const props = STEEL_SECTIONS[sec.toUpperCase()];
      if (props)
        return `• **${sec}** — ${cnt} members (h=${props.h}mm, Ixx=${props.Ixx}cm⁴, wt=${props.weight}kg/m)`;
      return `• **${sec}** — ${cnt} members`;
    });
    return this.buildResponse(
      `📋 **Sections in Model:**\n${lines.join("\n")}`,
      "model_query",
      0.95,
    );
  }

  private handleExtremeQuery(
    _input: string,
    match: RegExpMatchArray,
  ): BeamLabAIResponse {
    const s = this.getStore();
    const type = match[1]?.toLowerCase();
    if (s.members.size === 0)
      return this.buildResponse("No members in the model.", "model_query", 0.9);

    let extremeId = "",
      extremeVal =
        type?.startsWith("l") || type?.startsWith("h") ? 0 : Infinity;

    s.members.forEach((m, id) => {
      const sn = s.nodes.get(m.startNodeId);
      const en = s.nodes.get(m.endNodeId);
      if (!sn || !en) return;
      const len = Math.sqrt(
        (en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2,
      );
      if ((type === "longest" || type === "heaviest") && len > extremeVal) {
        extremeVal = len;
        extremeId = id;
      }
      if ((type === "shortest" || type === "lightest") && len < extremeVal) {
        extremeVal = len;
        extremeId = id;
      }
    });

    return this.buildResponse(
      `📏 The **${type}** member is **${extremeId}** (${extremeVal.toFixed(3)}m).`,
      "model_query",
      0.9,
      [`Info about ${extremeId}`, `Select ${extremeId}`],
    );
  }

  // ============================================
  // SECTION PROPERTIES HANDLERS
  // ============================================

  private handleSectionLookup(
    _input: string,
    match: RegExpMatchArray,
  ): BeamLabAIResponse {
    const prefix = match[1].toUpperCase();
    const size = match[2];
    const key = `${prefix}${size}`;
    const sec = STEEL_SECTIONS[key];

    if (!sec) {
      const available = Object.keys(STEEL_SECTIONS)
        .filter((k) => k.startsWith(prefix))
        .join(", ");
      return this.buildResponse(
        `Section **${key}** not found in my database.\n\nAvailable ${prefix} sections: ${available || "None"}`,
        "section_info",
        0.6,
      );
    }

    return this.buildResponse(
      `🔩 **${key} Section Properties:**\n\n` +
        `| Property | Value |\n|---|---|\n` +
        `| Depth (h) | ${sec.h} mm |\n` +
        `| Width (b) | ${sec.b} mm |\n` +
        `| Web thickness (tw) | ${sec.tw} mm |\n` +
        `| Flange thickness (tf) | ${sec.tf} mm |\n` +
        `| Area (A) | ${sec.A} cm² |\n` +
        `| Ixx | ${sec.Ixx} cm⁴ |\n` +
        `| Iyy | ${sec.Iyy} cm⁴ |\n` +
        `| Zxx | ${sec.Zxx} cm³ |\n` +
        `| Zyy | ${sec.Zyy} cm³ |\n` +
        `| rxx | ${sec.rxx} mm |\n` +
        `| ryy | ${sec.ryy} mm |\n` +
        `| Weight | ${sec.weight} kg/m |\n\n` +
        `*Per IS Handbook SP:6*\n\n` +
        `To assign: \`Change section to ${key}\``,
      "section_info",
      0.98,
      [`Change section to ${key}`, `Calculate moment capacity for ${key}`],
    );
  }

  private handleSectionHelp(_input: string): BeamLabAIResponse {
    return this.buildResponse(
      `📋 **Available Steel Sections in Database:**\n\n` +
        `**ISMB (Medium Beams):** ${Object.keys(STEEL_SECTIONS)
          .filter((k) => k.startsWith("ISMB"))
          .join(", ")}\n\n` +
        `Ask for any section properties, e.g.: "ISMB300 properties"\n\n` +
        `**Quick reference:**\n` +
        `• ISMB200: Light beams, secondary framing (Ixx=2235 cm⁴)\n` +
        `• ISMB300: Medium beams (Ixx=8986 cm⁴)\n` +
        `• ISMB400: Primary beams (Ixx=20458 cm⁴)\n` +
        `• ISMB500: Heavy beams, girders (Ixx=45218 cm⁴)\n` +
        `• ISMB600: Very heavy girders (Ixx=91813 cm⁴)`,
      "section_info",
      0.9,
    );
  }

  private handleSectionRecommendation(_input: string): BeamLabAIResponse {
    const s = this.getStore();
    if (s.members.size === 0) {
      return this.buildResponse(
        "No members to recommend sections for. Create a model first.",
        "recommendation",
        0.7,
      );
    }

    // Find max span
    let maxSpan = 0;
    s.members.forEach((m) => {
      const sn = s.nodes.get(m.startNodeId);
      const en = s.nodes.get(m.endNodeId);
      if (sn && en) {
        const len = Math.sqrt(
          (en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2,
        );
        if (len > maxSpan) maxSpan = len;
      }
    });

    // Rule of thumb: depth = span/20 for beams
    const targetDepth = (maxSpan * 1000) / 20; // mm
    const recommended = Object.entries(STEEL_SECTIONS)
      .filter(([k]) => k.startsWith("ISMB"))
      .sort(
        (a, b) =>
          Math.abs(a[1].h - targetDepth) - Math.abs(b[1].h - targetDepth),
      );

    const best = recommended[0];
    return this.buildResponse(
      `🎯 **Section Recommendation**\n\n` +
        `Max span: ${maxSpan.toFixed(2)}m\n` +
        `Rule of thumb: Beam depth ≈ Span/20 = ${targetDepth.toFixed(0)}mm\n\n` +
        `**Recommended: ${best[0]}** (h=${best[1].h}mm)\n` +
        `• Ixx = ${best[1].Ixx} cm⁴\n` +
        `• Weight = ${best[1].weight} kg/m\n\n` +
        `Also consider: ${recommended[1]?.[0] || "-"}, ${recommended[2]?.[0] || "-"}\n\n` +
        `_Note: This is a preliminary estimate. Run analysis and check deflection/stress limits._`,
      "recommendation",
      0.8,
      [
        `Change section to ${best[0]}`,
        "Run analysis",
        "Check deflection limits",
      ],
    );
  }

  // ============================================
  // MATERIAL HANDLERS
  // ============================================

  private handleSteelGrade(
    _input: string,
    match: RegExpMatchArray,
  ): BeamLabAIResponse {
    const gradeRaw = match[1].toUpperCase().replace(/\s+/g, "");
    const gradeMap: Record<string, string> = {
      FE410: "E250",
      FE490: "E350",
      FE540: "E450",
    };
    const grade = gradeMap[gradeRaw] || gradeRaw;
    const mat = MATERIALS.steel[grade as keyof typeof MATERIALS.steel];

    if (!mat) {
      return this.buildResponse(
        `Grade "${gradeRaw}" not found. Available: ${Object.keys(MATERIALS.steel).join(", ")}`,
        "material_info",
        0.6,
      );
    }

    return this.buildResponse(
      `🔩 **Steel Grade: ${grade} ${gradeMap[gradeRaw] ? `(${gradeRaw})` : ""}**\n\n` +
        `| Property | Value |\n|---|---|\n` +
        `| Yield Stress (fy) | ${mat.fy} MPa |\n` +
        `| Ultimate Stress (fu) | ${mat.fu} MPa |\n` +
        `| Elastic Modulus (E) | ${mat.E} MPa |\n` +
        `| Density | ${mat.density} kg/m³ |\n` +
        `| Poisson's Ratio (ν) | ${mat.nu} |\n` +
        `| Shear Modulus (G) | ${(mat.E / (2 * (1 + mat.nu))).toFixed(0)} MPa |`,
      "material_info",
      0.95,
    );
  }

  private handleConcreteGrade(
    _input: string,
    match: RegExpMatchArray,
  ): BeamLabAIResponse {
    const grade = match[1].toUpperCase();
    const mat = MATERIALS.concrete[grade as keyof typeof MATERIALS.concrete];
    if (!mat)
      return this.buildResponse(
        `Concrete grade ${grade} not in database. Available: ${Object.keys(MATERIALS.concrete).join(", ")}`,
        "material_info",
        0.6,
      );
    return this.buildResponse(
      `🧱 **Concrete Grade: ${grade}**\n\n` +
        `| Property | Value |\n|---|---|\n` +
        `| Characteristic strength (fck) | ${mat.fck} MPa |\n` +
        `| Design strength (fcd = fck/1.5) | ${(mat.fck / 1.5).toFixed(1)} MPa |\n` +
        `| Elastic Modulus (Ec = 5000√fck) | ${mat.E} MPa |\n` +
        `| Density | ${mat.density} kg/m³ (plain), ${mat.density + 600} kg/m³ (reinforced) |\n` +
        `| Flexural strength | ${(0.7 * Math.sqrt(mat.fck)).toFixed(2)} MPa |\n\n` +
        `*Per IS 456:2000*`,
      "material_info",
      0.95,
    );
  }

  private handleSteelGeneral(): BeamLabAIResponse {
    return this.buildResponse(
      `🔩 **Structural Steel Properties**\n\n` +
        `| Grade | fy (MPa) | fu (MPa) | Use |\n|---|---|---|---|\n` +
        Object.entries(MATERIALS.steel)
          .map(
            ([g, m]) =>
              `| ${g} | ${m.fy} | ${m.fu} | ${m.fy <= 250 ? "General" : m.fy <= 350 ? "Medium duty" : "Heavy/special"} |`,
          )
          .join("\n") +
        `\n\n**Common properties (all grades):**\n` +
        `• E = 200,000 MPa\n• G ≈ 77,000 MPa\n• ν = 0.3\n• ρ = 7,850 kg/m³\n• α = 12×10⁻⁶ /°C`,
      "material_info",
      0.95,
    );
  }

  private handleConcreteGeneral(): BeamLabAIResponse {
    return this.buildResponse(
      `🧱 **Concrete Grades (IS 456)**\n\n` +
        `| Grade | fck (MPa) | Ec (MPa) | Use |\n|---|---|---|---|\n` +
        Object.entries(MATERIALS.concrete)
          .map(
            ([g, m]) =>
              `| ${g} | ${m.fck} | ${m.E} | ${m.fck <= 20 ? "General/PCC" : m.fck <= 30 ? "RCC" : "Pre-stressed/special"} |`,
          )
          .join("\n") +
        `\n\n• Density: 24 kN/m³ (plain), 25 kN/m³ (reinforced)\n• ν ≈ 0.15–0.20\n• α = 10×10⁻⁶ /°C`,
      "material_info",
      0.95,
    );
  }

  // ============================================
  // FORMULA & CALCULATION HANDLERS
  // ============================================

  private handleFormulaQuery(
    _input: string,
    match: RegExpMatchArray,
  ): BeamLabAIResponse {
    const topic = match[3]?.toLowerCase() || "";
    const matches = Object.entries(FORMULAS).filter(
      ([key, val]) =>
        key.includes(topic.replace(/\s+/g, "_")) ||
        val.description.toLowerCase().includes(topic),
    );

    if (matches.length === 0) {
      // List all available
      const all = Object.entries(FORMULAS)
        .map(([, v]) => `• ${v.description}: **${v.formula}**`)
        .join("\n");
      return this.buildResponse(
        `I don't have a specific formula for "${topic}", but here are all available:\n\n${all}`,
        "calculation",
        0.5,
      );
    }

    const lines = matches.map(
      ([, v]) =>
        `**${v.description}:**\n  ${v.formula}\n  _Where: ${v.variables}_`,
    );
    return this.buildResponse(
      `📐 **Formulas:**\n\n${lines.join("\n\n")}`,
      "calculation",
      0.9,
    );
  }

  private handleCalculation(
    _input: string,
    _match: RegExpMatchArray,
  ): BeamLabAIResponse {
    // Try to extract numbers and context from the model
    const s = this.getStore();
    if (s.members.size === 0) {
      return this.buildResponse(
        'No model data to calculate with. Create a structure first, or ask for a formula: "Formula for deflection".',
        "calculation",
        0.5,
      );
    }

    // Find typical span and load
    let maxSpan = 0;
    s.members.forEach((m) => {
      const sn = s.nodes.get(m.startNodeId);
      const en = s.nodes.get(m.endNodeId);
      if (sn && en) {
        const len = Math.sqrt(
          (en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2,
        );
        if (len > maxSpan) maxSpan = len;
      }
    });

    let totalUDL = 0;
    s.memberLoads.forEach((l) => {
      if (l.w1) totalUDL += Math.abs(l.w1);
    });
    const avgUDL =
      s.memberLoads.length > 0 ? totalUDL / s.memberLoads.length : 10; // default

    const moment = (avgUDL * maxSpan * maxSpan) / 8;
    const shear = (avgUDL * maxSpan) / 2;

    return this.buildResponse(
      `📐 **Quick Calculations (for longest span = ${maxSpan.toFixed(2)}m, avg UDL ≈ ${avgUDL.toFixed(1)} kN/m):**\n\n` +
        `**Simply Supported Beam:**\n` +
        `• Max Moment = wL²/8 = ${avgUDL.toFixed(1)} × ${maxSpan.toFixed(2)}² / 8 = **${moment.toFixed(2)} kN·m**\n` +
        `• Max Shear = wL/2 = ${avgUDL.toFixed(1)} × ${maxSpan.toFixed(2)} / 2 = **${shear.toFixed(2)} kN**\n` +
        `• Deflection = 5wL⁴/(384EI) — assign a section and run analysis for exact values\n\n` +
        `_For precise results, run the analysis (click Analyze in toolbar)._`,
      "calculation",
      0.8,
      ["Run analysis", "Show reactions", "Max deflection?"],
    );
  }

  private handleDeflectionHelp(_input: string): BeamLabAIResponse {
    return this.buildResponse(
      `📏 **Deflection Formulas & Limits**\n\n` +
        `**Simply Supported:**\n` +
        `• UDL: δ = 5wL⁴ / (384EI)\n` +
        `• Point load (center): δ = PL³ / (48EI)\n\n` +
        `**Cantilever:**\n` +
        `• UDL: δ = wL⁴ / (8EI)\n` +
        `• Point load (tip): δ = PL³ / (3EI)\n\n` +
        `**Fixed-Fixed:**\n` +
        `• UDL: δ = wL⁴ / (384EI)\n\n` +
        `**Limits (IS 800 / IS 456):**\n` +
        `| Case | Limit |\n|---|---|\n` +
        `| Floor beams (LL) | L/300 – L/360 |\n` +
        `| Floor beams (total) | L/240 |\n` +
        `| Cantilevers | L/150 – L/180 |\n` +
        `| Roof purlins | L/150 – L/200 |\n` +
        `| Brittle cladding | L/480 |\n\n` +
        `In BeamLab: "Max deflection?" to check your model.`,
      "calculation",
      0.95,
      ["Max deflection?", "How to reduce deflection?"],
    );
  }

  private handleMomentCapacity(_input: string): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Bending Moment Capacity (IS 800:2007)**\n\n` +
        `**For plastic/compact sections:**\n` +
        `• Md = βb × Zp × fy / γm0\n` +
        `• βb = 1.0 (plastic, Class 1)\n` +
        `• γm0 = 1.10\n\n` +
        `**For semi-compact:**\n` +
        `• Md = Ze × fy / γm0\n\n` +
        `**Example (ISMB300, E250):**\n` +
        `• Zp ≈ 1.15 × Zxx = 1.15 × 599.1 = 689 cm³\n` +
        `• Md = 1.0 × 689 × 250 / (1.10 × 1000) = **156.6 kN·m**\n\n` +
        `**Check LTB** if laterally unsupported > ~40×bf.\n\n` +
        `*Per IS 800 Clause 8.2*`,
      "calculation",
      0.95,
    );
  }

  private handleShearCapacity(_input: string): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Shear Capacity (IS 800:2007)**\n\n` +
        `**Design shear strength:**\n` +
        `• Vd = Av × fyw / (√3 × γm0)\n` +
        `• Av = h × tw (for I-sections)\n` +
        `• γm0 = 1.10\n\n` +
        `**Example (ISMB300, E250):**\n` +
        `• Av = 300 × 7.7 = 2310 mm²\n` +
        `• Vd = 2310 × 250 / (1.732 × 1.10 × 1000) = **303 kN**\n\n` +
        `**High shear (V > 0.6Vd):** Reduce moment capacity.\n\n` +
        `*Per IS 800 Clause 8.4*`,
      "calculation",
      0.95,
    );
  }

  private handleBucklingHelp(_input: string): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Column Buckling / Stability**\n\n` +
        `**Euler's Critical Load:**\n` +
        `• Pcr = π²EI / (KL)²\n\n` +
        `**Effective Length Factors (K):**\n` +
        `| End Conditions | K |\n|---|---|\n` +
        `| Fixed-Fixed | 0.5 (0.65 practical) |\n` +
        `| Fixed-Pinned | 0.7 (0.80 practical) |\n` +
        `| Pinned-Pinned | 1.0 |\n` +
        `| Fixed-Free (cantilever) | 2.0 |\n\n` +
        `**Slenderness:** λ = KL/r\n` +
        `• λ ≤ 180 for compression members\n` +
        `• r = √(I/A) = radius of gyration\n\n` +
        `**IS 800 Method:** Uses imperfection factor α and buckling curves (a, b, c, d).\n` +
        `• fcd = (fy/γm0) / (φ + √(φ² - λ²))\n` +
        `• Pd = fcd × A`,
      "calculation",
      0.95,
    );
  }

  // ============================================
  // DESIGN CODE HANDLERS
  // ============================================

  private handleIS800(): BeamLabAIResponse {
    return this.buildResponse(
      `📘 **IS 800:2007 — General Construction in Steel**\n\n` +
        `**Limit State Method** (replaced Working Stress in 2007)\n\n` +
        `**Key clauses:**\n` +
        `• **Cl 5**: Materials — E250 (Fe410) to E550\n` +
        `• **Cl 7**: Analysis methods (elastic, plastic, advanced)\n` +
        `• **Cl 8.2**: Bending — Md = βb.Zp.fy/γm0\n` +
        `• **Cl 8.4**: Shear — Vd = Av.fy/(√3.γm0)\n` +
        `• **Cl 7.2.2**: Deflection limits — L/300 (floors)\n` +
        `• **Cl 7.3**: Stability — P-Δ effects\n` +
        `• **Table 4**: Imperfection factors (buckling curves)\n` +
        `• **Table 5**: Effective length factors\n\n` +
        `**Partial safety factors:**\n` +
        `• γm0 = 1.10 (yielding)\n` +
        `• γm1 = 1.25 (ultimate/fracture)\n\n` +
        `**Section classification:**\n` +
        `• Class 1 (Plastic), Class 2 (Compact), Class 3 (Semi-compact), Class 4 (Slender)`,
      "design_code",
      0.95,
    );
  }

  private handleIS456(): BeamLabAIResponse {
    return this.buildResponse(
      `📘 **IS 456:2000 — Plain and Reinforced Concrete**\n\n` +
        `**Key provisions:**\n` +
        `• **Cl 26**: Beam design — minimum/maximum reinforcement\n` +
        `• **Cl 39**: Column design — Pu = 0.4fck.Ac + 0.67fy.Asc (short)\n` +
        `• **Cl 34**: Slab design — one-way and two-way\n` +
        `• **Cl 23.2**: Deflection — Span/effective depth ratios\n` +
        `• **Cl 40**: Walls\n` +
        `• **Table 4**: Cover requirements\n\n` +
        `**Partial safety factors:**\n` +
        `• γc = 1.50 (concrete)\n` +
        `• γs = 1.15 (steel reinforcement)\n\n` +
        `**Load combinations (IS 875 Part 5 + IS 456):**\n` +
        `• 1.5(DL + LL), 1.5(DL + WL), 1.2(DL + LL + WL), 0.9DL + 1.5WL`,
      "design_code",
      0.95,
    );
  }

  private handleIS875(): BeamLabAIResponse {
    return this.buildResponse(
      `📘 **IS 875 — Code of Practice for Design Loads**\n\n` +
        `| Part | Coverage |\n|---|---|\n` +
        `| Part 1 | Dead loads — material densities |\n` +
        `| Part 2 | Imposed (live) loads — floor/roof/balcony |\n` +
        `| Part 3 | Wind loads — Vz, Cp, Cf, terrain |\n` +
        `| Part 4 | Snow loads |\n` +
        `| Part 5 | Load combinations |\n\n` +
        `**Common live loads (Part 2):**\n` +
        `• Residential: 2.0 kN/m²\n` +
        `• Office: 2.5–4.0 kN/m²\n` +
        `• Assembly (heavy): 5.0 kN/m²\n` +
        `• Storage: 6.0–12.0 kN/m²\n` +
        `• Roof (access): 1.5 kN/m²\n` +
        `• Roof (no access): 0.75 kN/m²`,
      "design_code",
      0.95,
    );
  }

  private handleIS1893(): BeamLabAIResponse {
    return this.buildResponse(
      `📘 **IS 1893:2016 — Earthquake Resistant Design**\n\n` +
        `**Base shear:** Vb = Ah × W\n` +
        `• Ah = (Z/2) × (I/R) × (Sa/g)\n` +
        `• Z = Zone factor (0.10–0.36)\n` +
        `• I = Importance factor (1.0–1.5)\n` +
        `• R = Response reduction factor (3–5)\n` +
        `• Sa/g = Spectral acceleration (from response spectrum)\n\n` +
        `**Seismic Zones:**\n` +
        `| Zone | Z | Regions |\n|---|---|---|\n` +
        `| II | 0.10 | Most of South India |\n` +
        `| III | 0.16 | Indo-Gangetic plain |\n` +
        `| IV | 0.24 | J&K, Himachal, Delhi |\n` +
        `| V | 0.36 | NE India, Kutch |`,
      "design_code",
      0.95,
    );
  }

  private handleAISC360(): BeamLabAIResponse {
    return this.buildResponse(
      `📘 **AISC 360-22 — Specification for Structural Steel Buildings**\n\n` +
        `**Two design methods:**\n` +
        `• **LRFD**: φRn ≥ Σγi·Qi (load factors × loads ≤ resistance × φ)\n` +
        `• **ASD**: Rn/Ω ≥ Σ Qi (service loads ≤ allowable)\n\n` +
        `**Key chapters:**\n` +
        `• **Ch D**: Tension — Pn = Fy·Ag or Fu·Ae\n` +
        `• **Ch E**: Compression — Fcr from elastic/inelastic buckling\n` +
        `• **Ch F**: Flexure — Mn based on yielding, LTB, local buckling\n` +
        `• **Ch G**: Shear — Vn = 0.6Fy·Aw·Cv\n` +
        `• **Ch H**: Combined forces — interaction equations\n` +
        `• **Ch J**: Connections\n\n` +
        `**φ factors:** 0.90 (flexure/tension), 0.75 (fracture), 0.90 (compression)`,
      "design_code",
      0.95,
    );
  }

  private handleEC3(): BeamLabAIResponse {
    return this.buildResponse(
      `📘 **Eurocode 3 (EN 1993) — Steel Structures**\n\n` +
        `**Partial safety factors:** γM0=1.00, γM1=1.00, γM2=1.25\n\n` +
        `**Cross-section classes:** 1 (plastic) → 4 (slender)\n\n` +
        `**Key checks:**\n` +
        `• **EN 1993-1-1 §6.2**: Resistance — bending, shear, axial, interaction\n` +
        `• **§6.3**: Buckling — flexural, lateral-torsional, interaction\n` +
        `• **EN 1993-1-8**: Connection design\n` +
        `• **EN 1993-1-5**: Plated structures\n\n` +
        `**Buckling curves:** a0, a, b, c, d (imperfection factors α)\n\n` +
        `**Advantages:** Unified approach, National Annexes for local adaptation.`,
      "design_code",
      0.95,
    );
  }

  private handleLoadCombinations(): BeamLabAIResponse {
    return this.buildResponse(
      `📋 **Load Combinations**\n\n` +
        `**IS 875 Part 5 (India):**\n` +
        `| Combo | Factors |\n|---|---|\n` +
        `| Strength 1 | 1.5 DL + 1.5 LL |\n` +
        `| Strength 2 | 1.5 DL + 1.5 WL |\n` +
        `| Strength 3 | 1.2 DL + 1.2 LL + 1.2 WL |\n` +
        `| Strength 4 | 0.9 DL + 1.5 WL (uplift) |\n` +
        `| Strength 5 | 1.5 DL + 1.5 EQ |\n` +
        `| Service | 1.0 DL + 1.0 LL |\n\n` +
        `**ASCE 7 (USA):**\n` +
        `| Combo | Factors |\n|---|---|\n` +
        `| 1 | 1.4D |\n` +
        `| 2 | 1.2D + 1.6L + 0.5S |\n` +
        `| 3 | 1.2D + 1.6S + 0.5L |\n` +
        `| 4 | 1.2D + 1.0W + L + 0.5S |\n` +
        `| 5 | 0.9D + 1.0W |`,
      "design_code",
      0.95,
    );
  }

  // ============================================
  // STRUCTURAL CONCEPT HANDLERS
  // ============================================

  private handleTrussTopic(type: string): BeamLabAIResponse {
    const topics: Record<string, string> = {
      pratt: `🏗 **Pratt Truss**\n\nDiagonals slope towards center. Under gravity loads, diagonals are in **tension** (efficient for steel), verticals in compression.\n\n• Span: 6–30m\n• Use: Bridges, roofs, industrial\n• Advantage: Lighter diagonals (tension), heavier but shorter verticals\n• Developed: 1844 by Thomas Pratt\n\n**In BeamLab:** "Create a 12m span Pratt truss with 6 panels"`,
      warren: `🏗 **Warren Truss**\n\nEquilateral triangles, no vertical members. Diagonals alternate tension/compression.\n\n• Span: 12–60m\n• Use: Bridges, long roofs\n• Advantage: Fewer members, even distribution\n• Variation: With verticals for distributed loads\n\n**In BeamLab:** "Create a 20m Warren truss"`,
      howe: `🏗 **Howe Truss**\n\nDiagonals slope away from center. Verticals in **tension**, diagonals in **compression** — opposite of Pratt.\n\n• Span: 6–30m\n• Use: Timber bridges/roofs (originally)\n• Less common in steel than Pratt`,
      general: `🏗 **Truss Types — Overview**\n\nTrusses are triangulated frames with NO bending — members carry only axial forces.\n\n| Type | Diagonal direction | Diagonal force |\n|---|---|---|\n| Pratt | → center | Tension |\n| Howe | → supports | Compression |\n| Warren | Alternating | Alternating |\n| Vierendeel | No diagonals | Bending |\n| K-Truss | Meet at midpoint | Mixed |\n| Fink | W-shaped | Mixed |\n\n**Static determinacy:** m + r = 2j\n\n**Methods:** Method of Joints, Method of Sections, Matrix Analysis\n\n**In BeamLab:** "Create a 12m Pratt truss with 6 panels"`,
    };
    return this.buildResponse(
      topics[type] || topics["general"],
      "engineering_knowledge",
      0.95,
    );
  }

  private handlePortalFrame(): BeamLabAIResponse {
    return this.buildResponse(
      `🏗 **Portal Frame**\n\nSingle-story rigid frame with inclined rafters and columns.\n\n` +
        `• Span: 12–60m (common: 20–30m)\n` +
        `• Eave height: 6–12m\n` +
        `• Rafter slope: 1:10 to 1:5 (6°–12°)\n` +
        `• Depth at knee: Span/40 to Span/30\n\n` +
        `**Key design aspects:**\n` +
        `• Haunches at knee and ridge to resist high moments\n` +
        `• Base can be pinned (lighter foundation) or fixed\n` +
        `• Wind load often governs design\n` +
        `• Crane loads if industrial\n\n` +
        `**In BeamLab:** "Create a 20m portal frame with 8m eave height"`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleMomentOfInertia(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Moment of Inertia (Second Moment of Area)**\n\n` +
        `Measures a section's resistance to bending. Higher I = less deflection.\n\n` +
        `**Standard formulas:**\n` +
        `• Rectangle: I = bh³/12\n` +
        `• Circle: I = πd⁴/64\n` +
        `• Hollow circle: I = π(D⁴-d⁴)/64\n` +
        `• Triangle: I = bh³/36 (about base: bh³/12)\n\n` +
        `**Parallel Axis Theorem:** I = Ic + Ad²\n` +
        `(Ic = about centroid, d = distance from centroid to target axis)\n\n` +
        `**Bending stress:** σ = My/I  where y = distance from neutral axis\n\n` +
        `**For I-beams:** Flanges provide most of Ixx (material far from NA).`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handlePDelta(): BeamLabAIResponse {
    return this.buildResponse(
      `🔄 **P-Delta (Second-Order) Analysis**\n\n` +
        `Additional moments from axial loads acting on deformed geometry.\n\n` +
        `**P-Δ (global):** Column axial × story drift\n` +
        `**P-δ (local):** Axial × member curvature\n\n` +
        `**When required:**\n` +
        `• P/Pcr > 0.1 (axial > 10% of Euler load)\n` +
        `• Story drift > H/500\n` +
        `• B₂ = 1/(1 - ΣP/ΣPe) > 1.1\n\n` +
        `**Impact:** Can increase moments by 10–30% in tall frames.\n\n` +
        `**Required by:** IS 800 (Cl 7.3.3), AISC 360 (Ch C), Eurocode 3\n\n` +
        `BeamLab's analysis engine includes P-Delta by default.`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleSSBeam(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Simply Supported Beam**\n\n` +
        `Pinned at one end, roller at other. Most fundamental structural element.\n\n` +
        `**Key formulas (UDL = w kN/m, span = L):**\n` +
        `• Reactions: Ra = Rb = wL/2\n` +
        `• Max moment (mid-span): Mmax = wL²/8\n` +
        `• Max shear (supports): Vmax = wL/2\n` +
        `• Max deflection: δ = 5wL⁴/(384EI)\n\n` +
        `**Point load P at center:**\n` +
        `• Ra = Rb = P/2\n• Mmax = PL/4\n• δ = PL³/(48EI)\n\n` +
        `**In BeamLab:**\n` +
        `"Create a simply supported beam 8m span with 20 kN/m UDL"`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleCantilever(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Cantilever Beam**\n\nFixed at one end, free at the other.\n\n` +
        `**UDL (w kN/m):**\n• Reaction: R = wL, Moment: M = wL²/2\n• δmax (tip) = wL⁴/(8EI)\n\n` +
        `**Point load P (tip):**\n• R = P, M = PL\n• δmax = PL³/(3EI)\n\n` +
        `**Deflection limit:** L/150 to L/180\n\n` +
        `**In BeamLab:** "Create a cantilever beam 5m with 10 kN point load"`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleFixedBeam(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Fixed (Encastré) Beam**\n\nBoth ends fully restrained (no rotation/translation).\n\n` +
        `**UDL (w kN/m):**\n• Support moment: M = wL²/12\n• Mid-span moment: M = wL²/24\n• δmax = wL⁴/(384EI)\n\n` +
        `Fixed beams have much less deflection and mid-span moment than SS beams.\n\n` +
        `**In BeamLab:** Add fixed supports at both ends of a member.`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleContinuousBeam(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Continuous Beam**\n\nBeam spanning over 3+ supports. Statically indeterminate — requires matrix analysis.\n\n` +
        `**Key features:**\n` +
        `• Moments are distributed — lower maximum moment than SS\n` +
        `• Negative moments over supports, positive mid-span\n` +
        `• More efficient use of material\n` +
        `• Redistribute moments if plastic design allowed\n\n` +
        `**Analysis methods:** Three-moment equation, moment distribution (Hardy Cross), FEM\n\n` +
        `**In BeamLab:** "Create continuous beam with 3 spans of 6m each with UDL 15 kN/m"`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleBMD(): BeamLabAIResponse {
    return this.buildResponse(
      `📊 **Bending Moment Diagram (BMD)**\n\n` +
        `Shows internal bending moment variation along a member.\n\n` +
        `**Key rules:**\n` +
        `• dM/dx = V (slope of BMD = shear force)\n` +
        `• Peak moment where shear = 0\n` +
        `• Under UDL → parabolic shape\n` +
        `• Under point loads → linear segments\n` +
        `• σ = M/Z (bending stress)\n\n` +
        `**In BeamLab:** "Show BMD" to display on your model.`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleSFD(): BeamLabAIResponse {
    return this.buildResponse(
      `📊 **Shear Force Diagram (SFD)**\n\n` +
        `Shows internal shear variation along a member.\n\n` +
        `**Key rules:**\n` +
        `• dV/dx = -w (rate of change = distributed load)\n` +
        `• Jumps at point loads and reactions\n` +
        `• Under UDL → linear variation\n` +
        `• τ = VQ/(Ib) (shear stress)\n\n` +
        `**In BeamLab:** "Show SFD" to display.`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleAFD(): BeamLabAIResponse {
    return this.buildResponse(
      `📊 **Axial Force Diagram (AFD)**\n\nShows internal axial force (tension/compression) along a member.\n\n` +
        `• Positive = Tension, Negative = Compression\n` +
        `• Constant between load points\n` +
        `• Critical for column design (buckling)\n` +
        `• σ = P/A (axial stress)\n\n` +
        `**In BeamLab:** "Show AFD" to display.`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleUDL(): BeamLabAIResponse {
    return this.buildResponse(
      `📏 **Uniformly Distributed Load (UDL)**\n\n` +
        `Load spread uniformly over member length (kN/m or kN/m²).\n\n` +
        `**Examples:** Self-weight, floor loads, snow, wind pressure\n\n` +
        `**SS beam with UDL w:**\n` +
        `• R = wL/2\n• Mmax = wL²/8\n• Vmax = wL/2\n• δ = 5wL⁴/(384EI)\n\n` +
        `**In BeamLab:** "Apply 20 kN/m UDL on M1"`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handlePointLoad(): BeamLabAIResponse {
    return this.buildResponse(
      `📏 **Point Load (Concentrated Load)**\n\n` +
        `Force applied at a single point (kN).\n\n` +
        `**Examples:** Column reactions, machinery, equipment\n\n` +
        `**SS beam with central point load P:**\n` +
        `• R = P/2\n• Mmax = PL/4\n• δ = PL³/(48EI)\n\n` +
        `Causes higher peak stress than UDL of equal total magnitude.\n\n` +
        `**In BeamLab:** "Add 50 kN load at N3"`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleUDLvsPointLoad(): BeamLabAIResponse {
    return this.buildResponse(
      `📏 **UDL vs Point Load Comparison**\n\n` +
        `| Property | UDL (w kN/m) | Point Load (P kN) |\n|---|---|---|\n` +
        `| Max Moment (SS) | wL²/8 | PL/4 |\n` +
        `| Max Shear (SS) | wL/2 | P/2 |\n` +
        `| Max Deflection (SS) | 5wL⁴/(384EI) | PL³/(48EI) |\n` +
        `| BMD shape | Parabolic | Triangular |\n` +
        `| SFD shape | Linear | Constant segments |\n\n` +
        `**Key difference:** Point load creates higher stress concentration at one point. UDL distributes stress more evenly.\n\n` +
        `For same total load W: UDL gives M = WL/8 vs PL/4 = WL/4 — point load causes **2× the moment**.`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleLTB(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Lateral-Torsional Buckling (LTB)**\n\n` +
        `Compression flange buckles sideways with simultaneous twist when beam is not laterally braced.\n\n` +
        `**Critical moment:** Mcr = (π/Lb) × √(EIy × GJ + (πE/Lb)² × Iy × Cw)\n\n` +
        `**Prevention:**\n` +
        `• Lateral bracing at close intervals\n` +
        `• Composite action with slab\n` +
        `• Use sections with high Iy (box, circular)\n\n` +
        `**IS 800 approach (Cl 8.2.2):**\n` +
        `• Calculate Mcr → λLT = √(βb.Zp.fy/Mcr)\n` +
        `• Use buckling curve to find χLT\n` +
        `• Md = χLT × βb × Zp × fy / γm0`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleConnections(): BeamLabAIResponse {
    return this.buildResponse(
      `🔩 **Connection Design (IS 800)**\n\n` +
        `**Bolted Connections:**\n` +
        `• Bearing type: Bolt shear + bearing on plate\n` +
        `• Friction type (HSFG): Slip-critical, higher reliability\n` +
        `• Grade 8.8 or 10.9 bolts\n\n` +
        `**Welded Connections:**\n` +
        `• Fillet welds: fw = fu/(√3 × γmw), γmw = 1.25\n` +
        `• Butt welds: Same strength as parent metal\n\n` +
        `**Common types:**\n` +
        `• Simple shear (angle cleats, fin plates)\n` +
        `• Moment connections (extended end plate, flange plates)\n` +
        `• Splice connections (beam, column)\n` +
        `• Base plates (with/without gussets)`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleFoundations(): BeamLabAIResponse {
    return this.buildResponse(
      `🏗 **Foundation Types**\n\n` +
        `**Shallow:**\n` +
        `• Isolated footing: Single column, common for light structures\n` +
        `• Combined footing: Two or more columns\n` +
        `• Strip/wall footing: Below walls\n` +
        `• Raft/mat: Entire building footprint\n\n` +
        `**Deep:**\n` +
        `• Driven piles: Displaces soil, quick installation\n` +
        `• Bored piles: Cast-in-situ, less vibration\n` +
        `• Caissons/wells: Large diameter, deep loads\n\n` +
        `**Design per IS 456, IS 2911 (piles), IS 1904 (foundations)**`,
      "engineering_knowledge",
      0.9,
    );
  }

  private handlePlateTheory(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Plate & Shell Elements**\n\n` +
        `**Kirchhoff (thin plate) theory:**\n` +
        `• Assumes normals remain straight and normal\n` +
        `• Valid when t/L < 1/10\n\n` +
        `**Mindlin-Reissner (thick plate):**\n` +
        `• Includes transverse shear deformation\n` +
        `• Better for thick plates (t/L > 1/10)\n\n` +
        `**FEM elements:**\n` +
        `• 4-node quad (Q4) — bilinear\n` +
        `• 8-node quad (Q8) — quadratic\n` +
        `• 3-node triangle (T3) — constant strain\n\n` +
        `**In BeamLab:** Plate elements are 4-node with thickness, E, ν, and pressure.`,
      "engineering_knowledge",
      0.9,
    );
  }

  private handleFEM(): BeamLabAIResponse {
    return this.buildResponse(
      `🔬 **Finite Element Method / Direct Stiffness Method**\n\n` +
        `The backbone of all structural analysis software:\n\n` +
        `1. **Discretize**: Break structure into elements\n` +
        `2. **Element stiffness**: [ke] for each element (beam: 12×12 for 6-DOF)\n` +
        `3. **Transform**: Rotate to global coordinates: [ke_global] = T^T × ke × T\n` +
        `4. **Assemble**: [K_global] = Σ ke_global\n` +
        `5. **Apply BCs**: Modify K for support restraints\n` +
        `6. **Solve**: {F} = [K]{d} → {d} = [K]⁻¹{F}\n` +
        `7. **Post-process**: Back-substitute for member forces, reactions\n\n` +
        `**BeamLab uses** 6-DOF beam-column elements with the direct stiffness method.\n` +
        `Both Rust (high-performance) and TypeScript (WebWorker) solvers are available.`,
      "engineering_knowledge",
      0.95,
    );
  }

  private handleModalAnalysis(): BeamLabAIResponse {
    return this.buildResponse(
      `📊 **Modal / Eigenvalue Analysis**\n\n` +
        `Finds natural frequencies and mode shapes: [K - ω²M]{φ} = 0\n\n` +
        `**Key terms:**\n` +
        `• ω_n = natural frequency (rad/s)\n` +
        `• f_n = ω_n/(2π) Hz\n` +
        `• T_n = 1/f_n seconds\n` +
        `• {φ} = mode shape vector\n\n` +
        `**Rules of thumb:**\n` +
        `• T = 0.1N (N = number of stories, approximate)\n` +
        `• First mode often governs seismic response\n` +
        `• Need enough modes for 90% mass participation\n\n` +
        `**Used in:** Seismic analysis (IS 1893), vibration control, dynamic response`,
      "engineering_knowledge",
      0.9,
    );
  }

  private handleWindLoad(): BeamLabAIResponse {
    return this.buildResponse(
      `🌪 **Wind Load Analysis (IS 875 Part 3)**\n\n` +
        `**Design wind speed:** Vz = Vb × k1 × k2 × k3\n` +
        `• Vb = basic wind speed (from map, 33–55 m/s)\n` +
        `• k1 = risk coefficient (Table 1)\n` +
        `• k2 = terrain/height factor (Table 2)\n` +
        `• k3 = topography factor\n\n` +
        `**Wind pressure:** pz = 0.6 × Vz² (N/m²)\n\n` +
        `**Design force on element:** F = (Cpe - Cpi) × A × pz\n` +
        `• Cpe = external pressure coefficient (depends on geometry)\n` +
        `• Cpi = internal pressure coefficient (±0.2 to ±0.5)`,
      "engineering_knowledge",
      0.9,
    );
  }

  private handleSeismicLoad(): BeamLabAIResponse {
    return this.buildResponse(
      `🏚 **Seismic Analysis (IS 1893:2016)**\n\n` +
        `**Equivalent Static Method:**\n` +
        `• Base shear: Vb = Ah × W\n` +
        `• Ah = (Z × I × Sa/g) / (2 × R)\n\n` +
        `**Response Spectrum Method:**\n` +
        `• Apply spectrum curve (Sa/g vs T)\n` +
        `• Compute mode frequencies via modal analysis\n` +
        `• Combine modes: SRSS or CQC\n\n` +
        `**Storey distribution:** Qi = Vb × (Wi × hi²) / Σ(Wi × hi²)\n\n` +
        `**Key provisions:**\n` +
        `• Strong column – weak beam\n` +
        `• Ductile detailing in plastic hinge zones\n` +
        `• P-Delta effects for drift sensitivity\n` +
        `• Story drift ≤ 0.4% (steel frames)`,
      "engineering_knowledge",
      0.9,
    );
  }

  private handleDesignChecks(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Structural Design Checks (IS 800)**\n\n` +
        `**Beam design:**\n` +
        `1. Classification (Cl 3.7) — Plastic/Compact/Semi-compact/Slender\n` +
        `2. Bending (Cl 8.2) — Md = Zp×fy/γm0\n` +
        `3. Shear (Cl 8.4) — Vd = Av×fy/(√3×γm0)\n` +
        `4. Combined (Cl 9.3) — If V > 0.6Vd, reduce Md\n` +
        `5. Deflection (Cl 7.2) — L/300 to L/360\n` +
        `6. LTB (Cl 8.2.2) — If unbraced length > ~15ry\n\n` +
        `**Column design:**\n` +
        `1. Slenderness — KL/r < 180\n` +
        `2. Compression (Cl 7.1.2) — Pd = Ae×fcd\n` +
        `3. Combined bending (Cl 9.3.2) — Interaction formula\n\n` +
        `Run "Show model info" to check member properties.`,
      "recommendation",
      0.95,
    );
  }

  private handleReduceDeflection(): BeamLabAIResponse {
    return this.buildResponse(
      `📏 **How to Reduce Deflection**\n\n` +
        `Since δ ∝ wL⁴/(EI), you can:\n\n` +
        `1. **Increase section depth** (I ∝ h³ — most effective!)\n` +
        `   → Change ISMB200 → ISMB300 reduces δ by 75%+\n` +
        `2. **Reduce span** — add intermediate support\n` +
        `3. **Add camber** — pre-curve beam to offset deflection\n` +
        `4. **Use composite action** — concrete slab + steel beam\n` +
        `5. **Use continuous spans** (δ reduces ~60% vs SS)\n` +
        `6. **Use deeper trusses** instead of solid beams\n\n` +
        `**In BeamLab:**\n` +
        `• "Change section to ISMB400" — increase section\n` +
        `• "Max deflection?" — check current value\n` +
        `• "Recommend section" — get a suggestion`,
      "recommendation",
      0.95,
      ["Change section to ISMB400", "Max deflection?", "Recommend section"],
    );
  }

  private handleOptimization(): BeamLabAIResponse {
    return this.buildResponse(
      `🎯 **Structural Optimization**\n\n` +
        `**Weight optimization:**\n` +
        `1. Run analysis → check stress utilization\n` +
        `2. Members with utilization < 0.3 → reduce section\n` +
        `3. Members with utilization > 0.8 → increase section\n` +
        `4. Target: 0.5–0.8 utilization for all members\n\n` +
        `**Steps in BeamLab:**\n` +
        `1. "Show model info" — see current sections\n` +
        `2. Run analysis → "Show forces" for max values\n` +
        `3. "Select all ISMB500 members" → "Change section to ISMB400"\n` +
        `4. Re-analyze → "Max deflection?" → verify limits\n\n` +
        `**Rules of thumb:**\n` +
        `• Beam depth ≈ Span/20\n` +
        `• Column ≈ Floor height/12 to /15\n` +
        `• Steel usage ≈ 30–60 kg/m² for frames`,
      "recommendation",
      0.9,
    );
  }

  private handleStressStrain(): BeamLabAIResponse {
    return this.buildResponse(
      `📐 **Stress & Strain**\n\n` +
        `**Stress (σ):** Force per unit area (MPa = N/mm²)\n` +
        `• Axial: σ = P/A\n` +
        `• Bending: σ = My/I = M/Z\n` +
        `• Shear: τ = VQ/(Ib)\n\n` +
        `**Strain (ε):** Deformation per unit length (dimensionless)\n` +
        `• ε = ΔL/L = σ/E (elastic range)\n\n` +
        `**Hooke's Law:** σ = E × ε (below yield)\n` +
        `• Steel E = 200,000 MPa → εy = 250/200000 = 0.00125 (E250)\n\n` +
        `**Yield → plastic region → strain hardening → fracture**`,
      "engineering_knowledge",
      0.95,
    );
  }

  // ============================================
  // DIAGNOSIS HANDLERS
  // ============================================

  private handleDiagnosis(_input: string): BeamLabAIResponse {
    const s = this.getStore();
    const issues: string[] = [];

    if (s.nodes.size === 0)
      return this.buildResponse(
        "Model is empty. Nothing to diagnose.",
        "diagnosis",
        0.9,
      );

    // Check supports
    let nRestrainedDOFs = 0;
    let hasSupport = false;
    s.nodes.forEach((n) => {
      if (n.restraints) {
        const cnt = Object.values(n.restraints).filter(Boolean).length;
        if (cnt > 0) hasSupport = true;
        nRestrainedDOFs += cnt;
      }
    });
    if (!hasSupport)
      issues.push(
        '❌ **No supports!** Add at least one fixed or pinned support: "Add fixed support at N1"',
      );
    if (nRestrainedDOFs < 3)
      issues.push(
        "❌ **Insufficient restraints** — need at least 3 DOFs restrained for 2D stability",
      );

    // Check connectivity
    if (s.members.size === 0 && s.nodes.size > 0)
      issues.push("⚠ Nodes exist but no members — structure has no stiffness");

    // Check loads
    if (s.loads.length === 0 && s.memberLoads.length === 0)
      issues.push(
        "⚠ No loads applied — analysis will produce zero displacements",
      );

    // Check for floating nodes
    const connectedNodes = new Set<string>();
    s.members.forEach((m) => {
      connectedNodes.add(m.startNodeId);
      connectedNodes.add(m.endNodeId);
    });
    const floating: string[] = [];
    s.nodes.forEach((_, id) => {
      if (!connectedNodes.has(id)) floating.push(id);
    });
    if (floating.length > 0)
      issues.push(
        `⚠ **Floating nodes** (not connected to any member): ${floating.slice(0, 5).join(", ")}${floating.length > 5 ? ` +${floating.length - 5} more` : ""}`,
      );

    if (issues.length === 0) {
      return this.buildResponse(
        `✅ **Model looks healthy!**\n\n` +
          `• ${s.nodes.size} nodes, ${s.members.size} members\n` +
          `• ${nRestrainedDOFs} restrained DOFs\n` +
          `• ${s.loads.length + s.memberLoads.length} loads applied\n\n` +
          `You should be able to run analysis successfully. Click "Analyze" in the toolbar.`,
        "diagnosis",
        0.9,
        ["Run analysis", "Check stability", "Show model info"],
      );
    }

    return this.buildResponse(
      `🔍 **Model Diagnosis — ${issues.length} issue${issues.length > 1 ? "s" : ""} found:**\n\n${issues.join("\n\n")}`,
      "diagnosis",
      0.95,
      ["Add fixed support at N1", "Show model info"],
    );
  }

  private handleSingularMatrix(_input: string): BeamLabAIResponse {
    return this.buildResponse(
      `❌ **Singular/Ill-Conditioned Matrix**\n\nThis means the stiffness matrix cannot be inverted — the structure is a **mechanism** (can move freely).\n\n` +
        `**Common causes:**\n` +
        `1. **Missing supports** — "Add fixed support at N1"\n` +
        `2. **Unstable configuration** — collinear nodes, missing bracing\n` +
        `3. **Floating nodes** — nodes not connected to any member\n` +
        `4. **Insufficient restraints** — need ≥ 3 DOFs restrained (2D)\n` +
        `5. **Coincident nodes** — two nodes at same location → "Merge nodes"\n` +
        `6. **All members in one line** — no lateral stiffness\n\n` +
        `**Fix steps:**\n` +
        `1. "Check stability" — verify DOF count\n` +
        `2. "List supports" — check support conditions\n` +
        `3. Add missing supports or bracing members`,
      "diagnosis",
      0.95,
      ["Check stability", "List supports", "Add fixed support at N1"],
    );
  }

  // ============================================
  // SOFTWARE HELP HANDLERS
  // ============================================

  private handleHowTo(input: string): BeamLabAIResponse {
    const lower = input.toLowerCase();

    if (/add.*(node|point)/i.test(lower)) {
      return this.buildResponse(
        '**Add a node:** Type "Add node at (5, 3, 0)" in the Modify or Chat tab.\nOr click the Point tool in the toolbar.',
        "software_help",
        0.95,
      );
    }
    if (/add.*(member|beam|column)/i.test(lower)) {
      return this.buildResponse(
        '**Add a member:** Type "Add member from N1 to N2" in Modify/Chat.\nOr use the Member tool in the toolbar to click two nodes.',
        "software_help",
        0.95,
      );
    }
    if (/add.*(load|force)/i.test(lower)) {
      return this.buildResponse(
        '**Add loads:**\n• Point load: "Add 50 kN load at N3"\n• UDL: "Apply 20 kN/m UDL on M1"\n\nOr use the Loads panel in the sidebar.',
        "software_help",
        0.95,
      );
    }
    if (/add.*(support|restraint|fix|pin|roller)/i.test(lower)) {
      return this.buildResponse(
        '**Add supports:**\n• "Add fixed support at N1" (all DOFs)\n• "Add pinned support at N2" (translations)\n• "Add roller support at N3" (vertical only)\n\nOr use the Support tool in the toolbar.',
        "software_help",
        0.95,
      );
    }
    if (/select/i.test(lower)) {
      return this.buildResponse(
        '**Selection commands:**\n• "Select N1" or "Select M1"\n• "Select all" / "Clear selection"\n• "Select all beams" / "Select all columns"\n• "Select all ISMB300 members"\n• Click elements, or box-select in the viewport.',
        "software_help",
        0.95,
      );
    }
    if (/delet|remov/i.test(lower)) {
      return this.buildResponse(
        '**Delete:** Type "Delete M5" or "Delete selected" in Modify/Chat.\nOr select elements and press Delete/Backspace.',
        "software_help",
        0.95,
      );
    }
    if (/change.*(section|profile)/i.test(lower)) {
      return this.buildResponse(
        '**Change section:** First select members, then "Change section to ISMB400".\nOr: "Select all" → "Change section to ISMB300"',
        "software_help",
        0.95,
      );
    }

    return this.buildResponse(
      `**BeamLab Quick Reference:**\n\n` +
        `• **Add**: "Add node at (x,y,z)", "Add member from N1 to N2"\n` +
        `• **Load**: "Apply 20 kN/m UDL on M1", "Add 50 kN load at N3"\n` +
        `• **Support**: "Add fixed/pinned/roller support at N1"\n` +
        `• **Select**: "Select N1", "Select all beams"\n` +
        `• **Modify**: "Move N2 to (10,0,0)", "Change section to ISMB400"\n` +
        `• **Query**: "Show reactions", "Max deflection?", "Check stability"\n` +
        `• **Display**: "Show BMD", "Show SFD", "Show AFD"\n\n` +
        `Type "help" for the complete command list.`,
      "software_help",
      0.9,
    );
  }

  private handleCapabilities(): BeamLabAIResponse {
    return this.buildResponse(
      `🤖 **BeamLab AI Architect — Capabilities**\n\n` +
        `**🔨 Model Operations:**\n` +
        `• Add/delete/move nodes and members\n` +
        `• Apply loads (UDL, point, moments)\n` +
        `• Set supports (fixed, pinned, roller)\n` +
        `• Change sections, split/merge, duplicate\n\n` +
        `**📊 Analysis Queries:**\n` +
        `• Reactions, forces, displacements, max deflection\n` +
        `• Stability check, equilibrium verification\n` +
        `• Weight estimation, member lengths\n\n` +
        `**🎓 Engineering Knowledge:**\n` +
        `• Structural concepts (trusses, beams, buckling, P-Delta)\n` +
        `• Design codes (IS 800, IS 456, AISC, Eurocode)\n` +
        `• Materials & sections (ISMB, steel grades, concrete)\n` +
        `• Formulas & calculations\n` +
        `• Diagnosis & recommendations\n\n` +
        `Type "help" for full command list, or ask any engineering question!`,
      "software_help",
      0.95,
    );
  }

  private handleAnalysisGuide(): BeamLabAIResponse {
    return this.buildResponse(
      `📊 **How to Run Analysis in BeamLab**\n\n` +
        `**Pre-checks:**\n` +
        `1. Model has nodes and members ✓\n` +
        `2. At least one support defined ✓\n` +
        `3. Loads applied ✓\n` +
        `4. "Check stability" → should be determinate/indeterminate\n\n` +
        `**Steps:**\n` +
        `1. Click **"Analyze"** button in the toolbar (or Ctrl+Enter)\n` +
        `2. Wait for solver (WebWorker or Rust backend)\n` +
        `3. View results:\n` +
        `   • "Show reactions" — support forces\n` +
        `   • "Show BMD" — bending moment diagram\n` +
        `   • "Show SFD" — shear force diagram\n` +
        `   • "Max deflection?" — serviceability check\n` +
        `   • "Check equilibrium" — verify accuracy\n\n` +
        `**If analysis fails:** "Why is analysis failing?" for diagnosis.`,
      "analysis_help",
      0.95,
      ["Check stability", "List supports", "List loads"],
    );
  }

  private handleMaterialComparison(input: string): BeamLabAIResponse {
    return this.buildResponse(
      `📊 **Structural Material Comparison**\n\n` +
        `| Property | Steel | Concrete | Timber |\n|---|---|---|---|\n` +
        `| Density | 7850 kg/m³ | 2400 kg/m³ | 500-700 kg/m³ |\n` +
        `| E (Modulus) | 200,000 MPa | 22,000-35,000 MPa | 8,000-12,000 MPa |\n` +
        `| Yield/Comp Str | 250-550 MPa | 15-60 MPa | 20-50 MPa |\n` +
        `| Tension Str | = Yield | ~3 MPa (weak!) | Variable |\n` +
        `| Ductility | Excellent | Brittle | Moderate |\n` +
        `| Fire resistance | Poor (needs protection) | Good (inherent) | Poor |\n` +
        `| Cost/kg | ₹₹₹ | ₹ | ₹₹ |\n` +
        `| Speed | Fast (prefab) | Slow (curing) | Fast |\n` +
        `| Recyclability | Excellent | Poor | Good |\n\n` +
        `**Typical choice:**\n` +
        `• Steel: Industrial, long spans, multi-story frames\n` +
        `• Concrete: Foundations, slabs, fire-rated buildings\n` +
        `• Timber: Low-rise residential, temporary structures`,
      "engineering_knowledge",
      0.9,
    );
  }

  // ============================================
  // GENERIC QUESTION FALLBACK
  // ============================================

  private handleGenericQuestion(input: string): BeamLabAIResponse {
    const lower = input.toLowerCase();

    // Try keyword matching as last resort
    const keywordTopics: [RegExp, () => BeamLabAIResponse][] = [
      [/beam|girder/, () => this.handleSSBeam()],
      [/column|compression\s+member/, () => this.handleBucklingHelp(input)],
      [/deflect|displace/, () => this.handleDeflectionHelp(input)],
      [/moment|bending/, () => this.handleMomentCapacity(input)],
      [/shear/, () => this.handleShearCapacity(input)],
      [/buckl|slender/, () => this.handleBucklingHelp(input)],
      [/weld|bolt|connect/, () => this.handleConnections()],
      [/found|footing|pile/, () => this.handleFoundations()],
      [/code|standard|is\s+\d/, () => this.handleIS800()],
      [/wind/, () => this.handleWindLoad()],
      [/seism|earth/, () => this.handleSeismicLoad()],
      [/optimiz/, () => this.handleOptimization()],
      [/analyze|analysis/, () => this.handleAnalysisGuide()],
    ];

    for (const [re, handler] of keywordTopics) {
      if (re.test(lower)) {
        const resp = handler();
        resp.confidence = 0.6; // lower confidence for keyword match
        return resp;
      }
    }

    // Check if asking about the model
    const s = this.getStore();
    if (s.nodes.size > 0) {
      return this.buildResponse(
        `I'm not sure about "${input}", but I can tell you about your current model:\n\n` +
          `📋 ${s.nodes.size} nodes, ${s.members.size} members, ${s.loads.length + s.memberLoads.length} loads\n\n` +
          `Try asking:\n` +
          `• "Tell me about my model"\n` +
          `• "Check stability"\n` +
          `• "Recommend a section"\n` +
          `• "Show reactions" (after analysis)\n` +
          `• Or ask about: trusses, beams, buckling, IS codes, deflection, etc.`,
        "general",
        0.3,
        ["Tell me about my model", "Check stability", "Help"],
      );
    }

    return this.buildResponse(
      `I'm your structural engineering assistant! I'm best at:\n\n` +
        `• **Concepts**: "What is a Pratt truss?", "Explain moment of inertia"\n` +
        `• **Formulas**: "Deflection formula", "Euler buckling"\n` +
        `• **Codes**: "IS 800", "AISC 360", "Load combinations"\n` +
        `• **Materials**: "ISMB300 properties", "E250 steel"\n` +
        `• **Your model**: "Check stability", "Show reactions"\n\n` +
        `What would you like to know?`,
      "general",
      0.3,
    );
  }

  // ============================================
  // RESET
  // ============================================

  resetConversation(): void {
    this.conversationHistory = [];
  }
}

// Singleton export
export const beamLabAI = new BeamLabAIEngine();
export default beamLabAI;
