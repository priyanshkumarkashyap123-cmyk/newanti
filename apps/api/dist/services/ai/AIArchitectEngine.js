import { GoogleGenerativeAI } from "@google/generative-ai";
const SYSTEM_PROMPTS = {
  chat: `You are the **AI Architect** for BeamLab Ultimate \u2014 a professional structural engineering analysis platform. 
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
5. Be concise but thorough \u2014 practicing engineers value precision
6. When unsure, say so \u2014 never hallucinate structural design values
7. Units: meters for length, kN for force, MPa for stress, kN\xB7m for moment
8. For section selection, follow IS 800 guidelines for economy and strength`,
  generate: `You are a structural model generator. Convert natural language descriptions into precise structural models in JSON format.

**CRITICAL RULES:**
1. Units: METERS for coordinates, Y-axis is vertical (height)
2. Output ONLY valid JSON \u2014 no markdown, no explanations, no code blocks
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
- isSupport: true for nodes at ground level (y \u2248 0) with restraints

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

Output JSON: { "checks": [{"clause": "...", "status": "pass|fail", "ratio": 0.85, ...}], "overallStatus": "pass|fail" }`
};
const IS_SECTIONS = {
  "ISMB100": { A: 114e-5, Ix: 257e-8, Iy: 41e-8, Zx: 514e-7, weight: 8.9 },
  "ISMB150": { A: 184e-5, Ix: 726e-8, Iy: 72e-8, Zx: 968e-7, weight: 14.4 },
  "ISMB200": { A: 323e-5, Ix: 224e-7, Iy: 15e-7, Zx: 224e-6, weight: 25.4 },
  "ISMB250": { A: 475e-5, Ix: 513e-7, Iy: 334e-8, Zx: 41e-5, weight: 37.3 },
  "ISMB300": { A: 587e-5, Ix: 86e-6, Iy: 454e-8, Zx: 573e-6, weight: 46.1 },
  "ISMB350": { A: 666e-5, Ix: 136e-6, Iy: 538e-8, Zx: 779e-6, weight: 52.4 },
  "ISMB400": { A: 784e-5, Ix: 204e-6, Iy: 622e-8, Zx: 102e-5, weight: 61.6 },
  "ISMB450": { A: 922e-5, Ix: 303e-6, Iy: 834e-8, Zx: 135e-5, weight: 72.4 },
  "ISMB500": { A: 0.011, Ix: 452e-6, Iy: 137e-7, Zx: 181e-5, weight: 86.9 },
  "ISMB550": { A: 0.0132, Ix: 649e-6, Iy: 195e-7, Zx: 236e-5, weight: 104 },
  "ISMB600": { A: 0.0156, Ix: 918e-6, Iy: 265e-7, Zx: 306e-5, weight: 123 },
  "ISA100x100x10": { A: 19e-4, Ix: 159e-8, Iy: 159e-8, Zx: 225e-7, weight: 14.9 },
  "ISA80x80x8": { A: 122e-5, Ix: 64e-8, Iy: 64e-8, Zx: 114e-7, weight: 9.6 },
  "ISA75x75x6": { A: 87e-5, Ix: 39e-8, Iy: 39e-8, Zx: 74e-7, weight: 6.8 },
  "ISA65x65x6": { A: 75e-5, Ix: 25e-8, Iy: 25e-8, Zx: 55e-7, weight: 5.8 },
  "ISA50x50x5": { A: 48e-5, Ix: 1e-7, Iy: 1e-7, Zx: 28e-7, weight: 3.8 },
  "ISMC100": { A: 117e-5, Ix: 187e-8, Iy: 26e-8, Zx: 373e-7, weight: 9.2 },
  "ISMC150": { A: 217e-5, Ix: 779e-8, Iy: 61e-8, Zx: 104e-6, weight: 17 },
  "ISMC200": { A: 285e-5, Ix: 182e-7, Iy: 102e-8, Zx: 182e-6, weight: 22.3 },
  "ISMC250": { A: 388e-5, Ix: 38e-6, Iy: 159e-8, Zx: 305e-6, weight: 30.4 },
  "ISMC300": { A: 464e-5, Ix: 636e-7, Iy: 211e-8, Zx: 424e-6, weight: 36.3 },
  // ISHB (Indian Standard Heavy-Weight Beams)
  "ISHB150": { A: 349e-5, Ix: 146e-7, Iy: 294e-8, Zx: 195e-6, weight: 27.1 },
  "ISHB200": { A: 474e-5, Ix: 362e-7, Iy: 47e-7, Zx: 362e-6, weight: 37.3 },
  "ISHB225": { A: 548e-5, Ix: 528e-7, Iy: 549e-8, Zx: 47e-5, weight: 43.1 },
  "ISHB300": { A: 749e-5, Ix: 125e-6, Iy: 811e-8, Zx: 836e-6, weight: 58.8 },
  "ISHB350": { A: 85e-4, Ix: 191e-6, Iy: 922e-8, Zx: 109e-5, weight: 66.7 },
  "ISHB400": { A: 985e-5, Ix: 28e-5, Iy: 105e-7, Zx: 14e-4, weight: 77.4 },
  "ISHB450": { A: 0.0115, Ix: 392e-6, Iy: 121e-7, Zx: 174e-5, weight: 90.7 }
};
function classifyIntent(query) {
  const q = query.toLowerCase().trim();
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy|greetings|namaste)/i.test(q)) {
    return { intent: "greeting", confidence: 0.95 };
  }
  if (/^(thanks|thank\s*you|thx|appreciate|great\s*job|awesome|perfect)/i.test(q)) {
    return { intent: "thanks", confidence: 0.95 };
  }
  if (/^(help|what can you do|capabilities|features|commands|how to use)/i.test(q)) {
    return { intent: "help", confidence: 0.95 };
  }
  if (/\b(create|build|make|design|generate|draw|model)\b.*\b(beam|frame|truss|bridge|building|tower|shed|structure|warehouse|cantilever|portal|slab|column|foundation)/i.test(q) || /\b(beam|frame|truss|bridge|building|tower|shed|structure|warehouse|cantilever|portal)\b.*\b(of|with|having|span|height|story|storey|floor|bay|meter|metre|m\b|ft\b)/i.test(q)) {
    return { intent: "create_structure", confidence: 0.9 };
  }
  if (/\b(modify|change|update|edit|move|shift|extend|shorten|resize|add\s*(a\s*)?(bay|story|storey|floor|span|column|beam|member|node))\b/i.test(q)) {
    return { intent: "modify_model", confidence: 0.85 };
  }
  if (/\b(add|apply|put)\b.*\b(load|force|moment|pressure|udl|point\s*load|distributed)/i.test(q)) {
    return { intent: "add_load", confidence: 0.9 };
  }
  if (/\b(add|set|make|apply)\b.*\b(support|restraint|fix|pin|roller|fixed|hinge)\b/i.test(q)) {
    return { intent: "add_support", confidence: 0.9 };
  }
  if (/\b(change|set|assign|update)\b.*\b(section|profile|size|ismb|ismc|isa)\b/i.test(q)) {
    return { intent: "change_section", confidence: 0.9 };
  }
  if (/\b(run|perform|execute|do|start)\b.*\b(analysis|analyze|solve|calculate|compute)/i.test(q) || /\b(static|modal|dynamic|buckling|p-delta|pushover|seismic)\b.*\b(analysis)/i.test(q)) {
    return { intent: "run_analysis", confidence: 0.9 };
  }
  if (/\b(diagnose|check|inspect|find\s*issues|find\s*problems|what.*wrong|debug|validate|verify)/i.test(q)) {
    return { intent: "diagnose", confidence: 0.85 };
  }
  if (/\b(optimize|optimise|reduce\s*weight|minimize|minimise|lighten|economize|economise|efficient)/i.test(q)) {
    return { intent: "optimize", confidence: 0.85 };
  }
  if (/\b(code\s*check|is\s*800|is\s*456|aisc|eurocode|design\s*check|compliance|capacity|strength\s*check)/i.test(q)) {
    return { intent: "code_check", confidence: 0.9 };
  }
  if (/\b(explain|what\s*is|define|tell\s*me\s*about|how\s*does|why|difference\s*between|concept|theory)/i.test(q)) {
    return { intent: "explain", confidence: 0.8 };
  }
  if (/\b(review|summary|describe|show|current\s*model|model\s*info|overview|status)\b/i.test(q)) {
    return { intent: "review_model", confidence: 0.8 };
  }
  if (/\b(fix|repair|resolve|troubleshoot|solve|error|fail|crash|not\s*working|broken|unstable)/i.test(q)) {
    return { intent: "troubleshoot", confidence: 0.85 };
  }
  if (/\b(how\s*many|count|list|show\s*all)\b.*\b(node|member|element|support|load)/i.test(q)) {
    return { intent: "about_model", confidence: 0.8 };
  }
  if (/\b(clear|reset|delete\s*all|remove\s*all|start\s*over|new\s*model|fresh)/i.test(q)) {
    return { intent: "clear_model", confidence: 0.85 };
  }
  return { intent: "conversation", confidence: 0.5 };
}
class AIArchitectEngine {
  model = null;
  apiKey;
  pythonApiUrl;
  conversationHistory = [];
  responseCache = /* @__PURE__ */ new Map();
  CACHE_TTL = 5 * 60 * 1e3;
  // 5 min
  constructor() {
    this.apiKey = process.env["GEMINI_API_KEY"] || "";
    this.pythonApiUrl = process.env["PYTHON_API_URL"] || "http://localhost:8081";
    if (this.apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(this.apiKey);
        this.model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        console.log("[AIArchitectEngine] \u2705 Gemini model initialized (gemini-2.0-flash)");
      } catch (err) {
        console.error("[AIArchitectEngine] \u274C Failed to init Gemini:", err);
      }
    } else {
      console.warn("[AIArchitectEngine] \u26A0\uFE0F  No GEMINI_API_KEY \u2014 using local fallback mode");
    }
  }
  // ============================================
  // MAIN CHAT ENDPOINT
  // ============================================
  async chat(message, context, history) {
    const startTime = Date.now();
    const { intent, confidence } = classifyIntent(message);
    console.log(`[AIArchitectEngine] Intent: ${intent} (${(confidence * 100).toFixed(0)}%)`);
    const cacheKey = `${intent}:${message.slice(0, 200)}`;
    const cached = this.responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      console.log("[AIArchitectEngine] Cache hit");
      return { ...cached.response, metadata: { ...cached.response.metadata, processingTimeMs: 0 } };
    }
    let result;
    try {
      switch (intent) {
        case "greeting":
          result = this.handleGreeting();
          break;
        case "thanks":
          result = this.handleThanks();
          break;
        case "help":
          result = this.handleHelp();
          break;
        case "create_structure":
          result = await this.handleCreateStructure(message, context);
          break;
        case "modify_model":
          result = await this.handleModifyModel(message, context);
          break;
        case "add_load":
          result = await this.handleAddLoad(message, context);
          break;
        case "add_support":
          result = await this.handleAddSupport(message, context);
          break;
        case "change_section":
          result = await this.handleChangeSection(message, context);
          break;
        case "run_analysis":
          result = this.handleRunAnalysis(context);
          break;
        case "diagnose":
          result = await this.handleDiagnose(context);
          break;
        case "optimize":
          result = await this.handleOptimize(context);
          break;
        case "code_check":
          result = await this.handleCodeCheck(message, context);
          break;
        case "review_model":
          result = this.handleReviewModel(context);
          break;
        case "about_model":
          result = this.handleAboutModel(context);
          break;
        case "troubleshoot":
          result = await this.handleTroubleshoot(message, context);
          break;
        case "clear_model":
          result = this.handleClearModel();
          break;
        case "explain":
          result = await this.handleExplain(message);
          break;
        case "conversation":
        default:
          result = await this.handleConversation(message, context, history);
      }
      result.metadata = {
        intent,
        confidence,
        processingTimeMs: Date.now() - startTime,
        provider: result.metadata?.provider || (this.model ? "gemini" : "local"),
        tokensUsed: result.metadata?.tokensUsed
      };
      this.conversationHistory.push(
        { role: "user", content: message },
        { role: "assistant", content: result.response }
      );
      if (this.conversationHistory.length > 20) {
        this.conversationHistory = this.conversationHistory.slice(-20);
      }
      this.responseCache.set(cacheKey, { response: result, timestamp: Date.now() });
      for (const [key, value] of this.responseCache.entries()) {
        if (Date.now() - value.timestamp > this.CACHE_TTL) {
          this.responseCache.delete(key);
        }
      }
      return result;
    } catch (error) {
      console.error("[AIArchitectEngine] Error:", error);
      return {
        success: false,
        response: `I encountered an error processing your request. ${error instanceof Error ? error.message : "Please try again."}`,
        error: error instanceof Error ? error.message : "Unknown error",
        metadata: {
          intent,
          confidence,
          processingTimeMs: Date.now() - startTime,
          provider: "local"
        }
      };
    }
  }
  // ============================================
  // STRUCTURE GENERATION
  // ============================================
  async generateStructure(prompt, constraints) {
    const startTime = Date.now();
    try {
      if (this.model) {
        const result = await this.generateViaGemini(prompt, constraints);
        if (result.success) {
          result.metadata = {
            intent: "create_structure",
            confidence: 0.9,
            processingTimeMs: Date.now() - startTime,
            provider: "gemini"
          };
          return result;
        }
      }
      const localResult = this.generateLocally(prompt);
      localResult.metadata = {
        intent: "create_structure",
        confidence: 0.7,
        processingTimeMs: Date.now() - startTime,
        provider: "local"
      };
      return localResult;
    } catch (error) {
      console.error("[AIArchitectEngine] Generate error:", error);
      const fallback = this.generateLocally(prompt);
      fallback.metadata = {
        intent: "create_structure",
        confidence: 0.5,
        processingTimeMs: Date.now() - startTime,
        provider: "local"
      };
      return fallback;
    }
  }
  async generateViaGemini(prompt, constraints) {
    if (!this.model) throw new Error("Gemini not initialized");
    const constraintText = constraints ? `

Constraints: ${JSON.stringify(constraints)}` : "";
    const fullPrompt = `${SYSTEM_PROMPTS.generate}

User request: ${prompt}${constraintText}`;
    const result = await this.model.generateContent(fullPrompt);
    const text = result.response.text();
    const cleanedText = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const model = JSON.parse(cleanedText);
    const validation = this.validateModel(model);
    const normalized = this.normalizeModel(model);
    return {
      success: true,
      response: `\u2705 Generated a ${normalized.nodes.length}-node, ${normalized.members.length}-member structure based on your description.${validation.issues.length > 0 ? `

\u26A0\uFE0F Notes:
${validation.issues.map((i) => `- ${i}`).join("\n")}` : ""}`,
      model: normalized,
      actions: [{ type: "applyModel", params: { model: normalized }, description: "Apply generated model" }]
    };
  }
  // ============================================
  // MODEL DIAGNOSIS
  // ============================================
  async diagnoseModel(context) {
    const issues = [];
    if (!context || !context.nodes || context.nodes.length === 0) {
      return {
        success: true,
        issues: [{ severity: "error", category: "geometry", message: "No model loaded. Create or load a structure first.", affectedElements: [] }],
        overallHealth: "critical",
        suggestions: ['Create a new structure using natural language, e.g., "Create a 6m portal frame"'],
        autoFixAvailable: false
      };
    }
    const supportNodes = context.nodes.filter((n) => n.hasSupport);
    if (supportNodes.length === 0) {
      issues.push({
        severity: "error",
        category: "support",
        message: "No supports defined. Structure will be unstable \u2014 add at least 2 supports.",
        affectedElements: [],
        suggestedFix: "Add fixed or pinned supports at ground-level nodes"
      });
    } else if (supportNodes.length === 1) {
      issues.push({
        severity: "warning",
        category: "stability",
        message: "Only 1 support found. Consider adding another for stability.",
        affectedElements: [supportNodes[0].id],
        suggestedFix: "Add a roller or pinned support at the other end"
      });
    }
    const connectedNodes = /* @__PURE__ */ new Set();
    for (const m of context.members) {
      connectedNodes.add(m.startNode);
      connectedNodes.add(m.endNode);
    }
    const orphanNodes = context.nodes.filter((n) => !connectedNodes.has(n.id));
    if (orphanNodes.length > 0) {
      issues.push({
        severity: "warning",
        category: "connectivity",
        message: `${orphanNodes.length} orphan node(s) not connected to any member.`,
        affectedElements: orphanNodes.map((n) => n.id),
        suggestedFix: "Connect these nodes with members or remove them"
      });
    }
    for (const m of context.members) {
      const startNode = context.nodes.find((n) => n.id === m.startNode);
      const endNode = context.nodes.find((n) => n.id === m.endNode);
      if (startNode && endNode) {
        const dx = endNode.x - startNode.x;
        const dy = endNode.y - startNode.y;
        const dz = endNode.z - startNode.z || 0;
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length < 1e-3) {
          issues.push({
            severity: "error",
            category: "geometry",
            message: `Member ${m.id} has zero or near-zero length.`,
            affectedElements: [m.id],
            suggestedFix: "Remove this member or move one of its nodes"
          });
        }
      }
    }
    if (!context.loads || context.loads.length === 0) {
      issues.push({
        severity: "info",
        category: "loading",
        message: "No loads applied. Add loads before running analysis.",
        affectedElements: [],
        suggestedFix: "Apply dead loads, live loads, or other load cases"
      });
    }
    const nodeIds = new Set(context.nodes.map((n) => n.id));
    for (const m of context.members) {
      if (!nodeIds.has(m.startNode)) {
        issues.push({
          severity: "error",
          category: "connectivity",
          message: `Member ${m.id} references non-existent start node ${m.startNode}`,
          affectedElements: [m.id]
        });
      }
      if (!nodeIds.has(m.endNode)) {
        issues.push({
          severity: "error",
          category: "connectivity",
          message: `Member ${m.id} references non-existent end node ${m.endNode}`,
          affectedElements: [m.id]
        });
      }
    }
    if (context.analysisResults) {
      if (context.analysisResults.failedMembers && context.analysisResults.failedMembers.length > 0) {
        issues.push({
          severity: "error",
          category: "section",
          message: `${context.analysisResults.failedMembers.length} member(s) failed strength check.`,
          affectedElements: context.analysisResults.failedMembers,
          suggestedFix: "Increase section sizes for failed members"
        });
      }
      if (context.analysisResults.maxStress && context.analysisResults.maxStress > 250) {
        issues.push({
          severity: "warning",
          category: "section",
          message: `Maximum stress (${context.analysisResults.maxStress.toFixed(1)} MPa) exceeds typical Fe410 yield stress (250 MPa).`,
          affectedElements: [],
          suggestedFix: "Use larger sections or higher-grade steel (Fe500)"
        });
      }
    }
    if (this.model && context.members.length > 0) {
      try {
        const aiDiagnosis = await this.geminiDiagnose(context);
        if (aiDiagnosis) {
          issues.push(...aiDiagnosis);
        }
      } catch (err) {
        console.warn("[AIArchitectEngine] Gemini diagnosis failed, using local only:", err);
      }
    }
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    return {
      success: true,
      issues,
      overallHealth: errorCount > 0 ? "critical" : warningCount > 0 ? "warning" : "good",
      suggestions: issues.filter((i) => i.suggestedFix).map((i) => i.suggestedFix),
      autoFixAvailable: issues.some((i) => i.suggestedFix && (i.category === "connectivity" || i.category === "support"))
    };
  }
  async geminiDiagnose(context) {
    if (!this.model) return [];
    const prompt = `${SYSTEM_PROMPTS.diagnose}

Model:
- Nodes: ${JSON.stringify(context.nodes)}
- Members: ${JSON.stringify(context.members)}
- Loads: ${JSON.stringify(context.loads || [])}
${context.analysisResults ? `- Analysis Results: ${JSON.stringify(context.analysisResults)}` : ""}

Provide diagnosis as JSON array of issues.`;
    try {
      const result = await this.model.generateContent(prompt);
      const text = result.response.text().replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
      const parsed = JSON.parse(text);
      return (parsed.issues || parsed || []).filter(
        (i) => i.severity && i.category && i.message
      );
    } catch {
      return [];
    }
  }
  // ============================================
  // CODE COMPLIANCE CHECK
  // ============================================
  async checkCodeCompliance(member, forces, code = "IS_800") {
    const checks = [];
    const section = IS_SECTIONS[member.section];
    if (!section) {
      return {
        success: false,
        code,
        overallStatus: "fail",
        checks: [],
        summary: `Unknown section: ${member.section}. Use IS standard sections (ISMB, ISMC, ISA).`
      };
    }
    const fy = 250;
    const E = 2e5;
    if (forces.axial && forces.axial > 0) {
      const tensionCapacity = section.A * fy * 1e-3;
      const ratio = forces.axial / tensionCapacity;
      checks.push({
        clause: "Cl. 6.2 \u2014 Tension yielding",
        description: "Design strength of member in tension",
        status: ratio <= 1 ? "pass" : "fail",
        ratio: parseFloat(ratio.toFixed(3)),
        limit: tensionCapacity,
        actual: forces.axial,
        details: `Td = Ag \xD7 fy / \u03B3m0 = ${tensionCapacity.toFixed(1)} kN`
      });
    }
    if (forces.axial && forces.axial < 0) {
      const axialForce = Math.abs(forces.axial);
      const slenderness = member.length / Math.sqrt(section.Ix / section.A);
      const slendernessRatio = slenderness / (Math.PI * Math.sqrt(E / fy));
      let chi = 1;
      if (slendernessRatio > 0.2) {
        const alpha = 0.49;
        const phi = 0.5 * (1 + alpha * (slendernessRatio - 0.2) + slendernessRatio * slendernessRatio);
        chi = Math.min(1, 1 / (phi + Math.sqrt(phi * phi - slendernessRatio * slendernessRatio)));
      }
      const compressionCapacity = chi * section.A * fy * 1e-3;
      const ratio = axialForce / compressionCapacity;
      checks.push({
        clause: "Cl. 7.1.2 \u2014 Compression buckling",
        description: `Buckling resistance (\u03BB = ${slenderness.toFixed(1)})`,
        status: ratio <= 1 ? "pass" : "fail",
        ratio: parseFloat(ratio.toFixed(3)),
        limit: compressionCapacity,
        actual: axialForce,
        details: `Pd = \u03C7 \xD7 Ag \xD7 fy / \u03B3m0 = ${compressionCapacity.toFixed(1)} kN, \u03BB = ${slenderness.toFixed(1)}`
      });
    }
    if (forces.moment) {
      const momentCapacity = section.Zx * fy * 1e-3;
      const ratio = Math.abs(forces.moment) / momentCapacity;
      checks.push({
        clause: "Cl. 8.2.1 \u2014 Bending strength",
        description: "Design bending strength (elastic)",
        status: ratio <= 1 ? "pass" : "fail",
        ratio: parseFloat(ratio.toFixed(3)),
        limit: momentCapacity,
        actual: Math.abs(forces.moment),
        details: `Md = \u03B2b \xD7 Zp \xD7 fy / \u03B3m0 = ${momentCapacity.toFixed(1)} kN\xB7m`
      });
    }
    if (forces.shear) {
      const Av = section.A * 0.6;
      const shearCapacity = Av * fy / Math.sqrt(3) * 1e-3;
      const ratio = Math.abs(forces.shear) / shearCapacity;
      checks.push({
        clause: "Cl. 8.4 \u2014 Shear strength",
        description: "Design shear strength",
        status: ratio <= 1 ? "pass" : "fail",
        ratio: parseFloat(ratio.toFixed(3)),
        limit: shearCapacity,
        actual: Math.abs(forces.shear),
        details: `Vd = Av \xD7 fy / (\u221A3 \xD7 \u03B3m0) = ${shearCapacity.toFixed(1)} kN`
      });
    }
    if (member.type === "beam" && forces.moment) {
      const deflectionLimit = member.length * 1e3 / 300;
      const estimatedDeflection = 5 * Math.abs(forces.moment) * member.length * member.length / (48 * E * section.Ix) * 1e3;
      const ratio = estimatedDeflection / deflectionLimit;
      checks.push({
        clause: "Table 6 \u2014 Deflection limit",
        description: `Serviceability deflection check (L/300 = ${deflectionLimit.toFixed(1)} mm)`,
        status: ratio <= 1 ? "pass" : "fail",
        ratio: parseFloat(ratio.toFixed(3)),
        limit: deflectionLimit,
        actual: estimatedDeflection,
        details: `\u03B4 = ${estimatedDeflection.toFixed(2)} mm vs limit = ${deflectionLimit.toFixed(1)} mm`
      });
    }
    if (forces.axial && forces.moment) {
      const axialCapacity = section.A * fy * 1e-3;
      const momentCapacity = section.Zx * fy * 1e-3;
      const combinedRatio = Math.abs(forces.axial) / axialCapacity + Math.abs(forces.moment) / momentCapacity;
      checks.push({
        clause: "Cl. 9.3.1 \u2014 Combined axial + bending",
        description: "Interaction ratio for combined forces",
        status: combinedRatio <= 1 ? "pass" : "fail",
        ratio: parseFloat(combinedRatio.toFixed(3)),
        limit: 1,
        actual: combinedRatio,
        details: `N/Nd + M/Md = ${combinedRatio.toFixed(3)} \u2264 1.0`
      });
    }
    const failCount = checks.filter((c) => c.status === "fail").length;
    const overallStatus = failCount > 0 ? "fail" : checks.some((c) => c.ratio && c.ratio > 0.85) ? "warning" : "pass";
    return {
      success: true,
      code,
      overallStatus,
      checks,
      summary: failCount === 0 ? `\u2705 All ${checks.length} checks passed for ${member.section} under ${code}.` : `\u274C ${failCount}/${checks.length} checks failed for ${member.section}. Consider upgrading the section.`
    };
  }
  // ============================================
  // INTENT HANDLERS
  // ============================================
  handleGreeting() {
    const greetings = [
      "Hello! I'm the AI Architect for BeamLab. I can help you create structures, run analyses, optimize designs, and check code compliance. What would you like to build today?",
      "Hi there! Ready to engineer something? I can create frames, trusses, bridges, buildings \u2014 just describe what you need in plain English.",
      "Welcome to BeamLab AI Architect! Tell me what structure you'd like to design and I'll generate it for you. I understand Indian Standards (IS 800, IS 456) and international codes too."
    ];
    return {
      success: true,
      response: greetings[Math.floor(Math.random() * greetings.length)]
    };
  }
  handleThanks() {
    return {
      success: true,
      response: "You're welcome! Let me know if you need anything else \u2014 I'm here to help with your structural design."
    };
  }
  handleHelp() {
    return {
      success: true,
      response: `## \u{1F3D7}\uFE0F AI Architect \u2014 What I Can Do

**Create Structures:**
- "Create a 10m span portal frame with 6m height"
- "Build a 3-story, 2-bay steel frame"
- "Make a 15m Pratt truss with 3m depth"
- "Design an industrial shed 20m \xD7 10m"

**Modify Existing Model:**
- "Add another bay to the right"
- "Increase the height to 8m"
- "Add a third floor"
- "Change all columns to ISMB500"

**Apply Loads:**
- "Add 50 kN downward load at the top"
- "Apply UDL of 10 kN/m on all beams"
- "Add wind load of 1.5 kN/m\xB2 on the left face"

**Analyze & Check:**
- "Run static analysis"
- "Diagnose this model for issues"
- "Check code compliance per IS 800"
- "Optimize the sections"

**Learn & Explain:**
- "What is P-Delta analysis?"
- "Explain IS 800 slenderness limits"
- "What's the difference between ISMB and ISHB?"

\u{1F4A1} **Tip:** Be specific with dimensions and I'll generate more accurate models!`
    };
  }
  async handleCreateStructure(message, context) {
    return this.generateStructure(message);
  }
  async handleModifyModel(message, context) {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "There's no model to modify. Please create a structure first, then I can modify it."
      };
    }
    if (this.model) {
      try {
        const prompt = `${SYSTEM_PROMPTS.modify}

Current model:
${JSON.stringify({ nodes: context.nodes, members: context.members }, null, 2)}

Modification request: "${message}"

Output the complete modified model as JSON.`;
        const result = await this.model.generateContent(prompt);
        const text = result.response.text().replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const modified = JSON.parse(text);
        const normalized = this.normalizeModel(modified);
        return {
          success: true,
          response: `\u2705 Model modified successfully. Now has ${normalized.nodes.length} nodes and ${normalized.members.length} members.`,
          model: normalized,
          actions: [{ type: "applyModel", params: { model: normalized }, description: "Apply modified model" }],
          metadata: { intent: "modify_model", confidence: 0.85, processingTimeMs: 0, provider: "gemini" }
        };
      } catch (err) {
        console.warn("[AIArchitectEngine] Gemini modify failed:", err);
      }
    }
    return {
      success: true,
      response: 'I understand you want to modify the model. Could you be more specific? For example:\n- "Add a bay of 6m to the right"\n- "Add a floor of 3.5m height"\n- "Move node n3 to x=8, y=4"'
    };
  }
  async handleAddLoad(message, context) {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "No model loaded. Create a structure first before adding loads."
      };
    }
    const forceMatch = message.match(/([\d.]+)\s*(kn|kN|KN)/i);
    const directionMatch = message.match(/\b(down|up|left|right|horizontal|vertical|x|y|z)\b/i);
    if (forceMatch) {
      const magnitude = parseFloat(forceMatch[1]);
      const direction = directionMatch ? directionMatch[1].toLowerCase() : "down";
      let fy = 0, fx = 0;
      switch (direction) {
        case "down":
        case "vertical":
        case "y":
          fy = -magnitude;
          break;
        case "up":
          fy = magnitude;
          break;
        case "right":
        case "horizontal":
        case "x":
          fx = magnitude;
          break;
        case "left":
          fx = -magnitude;
          break;
        default:
          fy = -magnitude;
      }
      const targetNodes = context.nodes.filter((n) => !n.hasSupport);
      if (targetNodes.length === 0) {
        return {
          success: false,
          response: "All nodes are supports. Add non-support nodes to apply loads to."
        };
      }
      const actions = targetNodes.map((n) => ({
        type: "addLoad",
        params: { nodeId: n.id, fx, fy },
        description: `Add ${magnitude} kN ${direction} load at node ${n.id}`
      }));
      return {
        success: true,
        response: `\u2705 Adding ${magnitude} kN ${direction}ward load to ${targetNodes.length} node(s): ${targetNodes.map((n) => n.id).join(", ")}.

Click **Execute** to apply.`,
        actions
      };
    }
    if (this.model) {
      try {
        const prompt = `The user wants to add loads to a structural model. Parse their request and generate load actions.

User request: "${message}"

Available nodes: ${JSON.stringify(context.nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, support: n.hasSupport })))}

Output JSON array of load actions: [{"nodeId": "n1", "fx": 0, "fy": -50, "fz": 0}]`;
        const result = await this.model.generateContent(prompt);
        const text = result.response.text().replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const loads = JSON.parse(text);
        const actions = (Array.isArray(loads) ? loads : [loads]).map((l) => ({
          type: "addLoad",
          params: { nodeId: l.nodeId, fx: l.fx || 0, fy: l.fy || 0, fz: l.fz || 0 },
          description: `Add load at ${l.nodeId}: Fx=${l.fx || 0}, Fy=${l.fy || 0} kN`
        }));
        return {
          success: true,
          response: `\u2705 Parsed your load request. ${actions.length} load(s) ready to apply.

Click **Execute** to apply.`,
          actions
        };
      } catch (err) {
        console.warn("[AIArchitectEngine] Gemini load parse failed:", err);
      }
    }
    return {
      success: true,
      response: 'Please specify the load more clearly. Examples:\n- "Add 50 kN downward load"\n- "Apply 10 kN/m UDL on all beams"\n- "Add 25 kN horizontal wind load"'
    };
  }
  async handleAddSupport(message, context) {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "No model loaded. Create a structure first."
      };
    }
    const isFixed = /fixed/i.test(message);
    const isPinned = /pin/i.test(message);
    const isRoller = /roller/i.test(message);
    const supportType = isFixed ? "fixed" : isPinned ? "pinned" : isRoller ? "roller" : "fixed";
    const groundNodes = context.nodes.filter((n) => Math.abs(n.y) < 0.1 && !n.hasSupport);
    if (groundNodes.length === 0) {
      return {
        success: true,
        response: "All ground-level nodes already have supports. Specify a node ID to add support to a different node."
      };
    }
    const restraints = {
      fixed: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true },
      pinned: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false },
      roller: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false }
    };
    const actions = groundNodes.map((n) => ({
      type: "addSupport",
      params: { nodeId: n.id, type: supportType, restraints: restraints[supportType] },
      description: `Add ${supportType} support at node ${n.id}`
    }));
    return {
      success: true,
      response: `\u2705 Adding ${supportType} support to ${groundNodes.length} ground-level node(s): ${groundNodes.map((n) => n.id).join(", ")}.

Click **Execute** to apply.`,
      actions
    };
  }
  async handleChangeSection(message, context) {
    if (!context || context.members.length === 0) {
      return {
        success: false,
        response: "No members in the model. Create a structure first."
      };
    }
    const sectionMatch = message.match(/\b(ISMB\d+|ISMC\d+|ISA\d+x\d+x\d+|ISHB\d+)/i);
    if (sectionMatch) {
      const newSection = sectionMatch[1].toUpperCase();
      const sectionData = IS_SECTIONS[newSection];
      if (!sectionData) {
        return {
          success: true,
          response: `Section "${newSection}" not found. Available sections:
- ISMB: 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600
- ISMC: 100, 150, 200, 250, 300
- ISA: 50x50x5, 65x65x6, 75x75x6, 80x80x8, 100x100x10`
        };
      }
      const isAll = /\ball\b/i.test(message);
      const isColumn = /\bcolumn/i.test(message);
      const isBeam = /\bbeam/i.test(message);
      let targetMembers = context.members;
      if (isColumn) {
        targetMembers = context.members.filter((m) => {
          const sn = context.nodes.find((n) => n.id === m.startNode);
          const en = context.nodes.find((n) => n.id === m.endNode);
          if (sn && en) return Math.abs(sn.x - en.x) < 0.1;
          return false;
        });
      } else if (isBeam) {
        targetMembers = context.members.filter((m) => {
          const sn = context.nodes.find((n) => n.id === m.startNode);
          const en = context.nodes.find((n) => n.id === m.endNode);
          if (sn && en) return Math.abs(sn.y - en.y) < 0.1;
          return false;
        });
      }
      const actions = targetMembers.map((m) => ({
        type: "changeSection",
        params: { memberId: m.id, section: newSection },
        description: `Change ${m.id} from ${m.section || "default"} to ${newSection}`
      }));
      return {
        success: true,
        response: `\u2705 Changing ${targetMembers.length} member(s) to **${newSection}** (weight: ${sectionData.weight} kg/m).

Click **Execute** to apply.`,
        actions
      };
    }
    return {
      success: true,
      response: 'Please specify the section. Example:\n- "Change all columns to ISMB500"\n- "Set beams to ISMB300"\n- "Change all sections to ISMB400"'
    };
  }
  handleRunAnalysis(context) {
    if (!context || context.nodes.length === 0) {
      return {
        success: false,
        response: "No model to analyze. Create a structure first."
      };
    }
    if (context.nodes.filter((n) => n.hasSupport).length === 0) {
      return {
        success: false,
        response: '\u26A0\uFE0F No supports defined! The analysis will fail. Add supports first (say "add fixed supports").'
      };
    }
    return {
      success: true,
      response: `Ready to analyze: ${context.nodes.length} nodes, ${context.members.length} members, ${context.loads?.length || 0} loads.

Click **Execute** to run linear static analysis.`,
      actions: [{ type: "runAnalysis", params: { type: "linear_static" }, description: "Run linear static analysis" }]
    };
  }
  async handleDiagnose(context) {
    if (!context) {
      return {
        success: false,
        response: "No model loaded to diagnose."
      };
    }
    const diagnosis = await this.diagnoseModel(context);
    let response = `## \u{1F50D} Model Diagnosis \u2014 ${diagnosis.overallHealth === "good" ? "\u2705 Healthy" : diagnosis.overallHealth === "warning" ? "\u26A0\uFE0F Warnings" : "\u274C Critical Issues"}

`;
    if (diagnosis.issues.length === 0) {
      response += "No issues found! Your model looks structurally sound.\n";
    } else {
      for (const issue of diagnosis.issues) {
        const icon = issue.severity === "error" ? "\u274C" : issue.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
        response += `${icon} **${issue.category}**: ${issue.message}
`;
        if (issue.suggestedFix) {
          response += `   \u2192 Fix: ${issue.suggestedFix}
`;
        }
        response += "\n";
      }
    }
    if (diagnosis.autoFixAvailable) {
      response += '\n\u{1F4A1} Some issues can be auto-fixed. Say "fix these issues" to apply suggested fixes.';
    }
    return {
      success: true,
      response
    };
  }
  async handleOptimize(context) {
    if (!context || context.members.length === 0) {
      return {
        success: false,
        response: "No model to optimize. Create a structure and run analysis first."
      };
    }
    if (this.model) {
      try {
        const prompt = `${SYSTEM_PROMPTS.optimize}

Model:
- Nodes: ${context.nodes.length}
- Members: ${JSON.stringify(context.members)}
${context.analysisResults ? `- Analysis Results: ${JSON.stringify(context.analysisResults)}` : "- No analysis results available"}

Suggest section optimization as JSON.`;
        const result = await this.model.generateContent(prompt);
        const text = result.response.text().replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
        const optimization = JSON.parse(text);
        const actions = (optimization.changes || []).map((c) => ({
          type: "changeSection",
          params: { memberId: c.memberId, section: c.newSection },
          description: `${c.memberId}: ${c.oldSection} \u2192 ${c.newSection} (${c.reason})`
        }));
        return {
          success: true,
          response: `## \u{1F3AF} Optimization Results

${actions.map((a) => `- ${a.description}`).join("\n")}

**Estimated weight savings: ${optimization.savingsPercent || "unknown"}%**

Click **Execute** to apply changes.`,
          actions,
          metadata: { intent: "optimize", confidence: 0.85, processingTimeMs: 0, provider: "gemini" }
        };
      } catch (err) {
        console.warn("[AIArchitectEngine] Gemini optimization failed:", err);
      }
    }
    if (context.analysisResults) {
      const actions = [];
      const suggestions = [];
      for (const m of context.members) {
        const startNode = context.nodes.find((n) => n.id === m.startNode);
        const endNode = context.nodes.find((n) => n.id === m.endNode);
        let memberLength = 3;
        let memberType = "beam";
        if (startNode && endNode) {
          const dx = Math.abs(endNode.x - startNode.x);
          const dy = Math.abs(endNode.y - startNode.y);
          memberType = dy > dx ? "column" : "beam";
          memberLength = Math.sqrt(dx * dx + dy * dy);
        }
        const currentSection = m.section || "ISMB300";
        const result = await this.checkCodeCompliance(
          { section: currentSection, length: memberLength, type: memberType },
          { moment: context.analysisResults.maxMoment ? context.analysisResults.maxMoment / context.members.length : 10 },
          "IS_800"
        );
        const maxRatio = Math.max(...result.checks.map((c) => c.ratio || 0));
        if (maxRatio < 0.5 && maxRatio > 0) {
          const sectionSizes = Object.keys(IS_SECTIONS).filter((s) => s.startsWith(currentSection.replace(/\d+$/, "")));
          const currentIdx = sectionSizes.indexOf(currentSection);
          if (currentIdx > 0) {
            const smallerSection = sectionSizes[currentIdx - 1];
            actions.push({
              type: "changeSection",
              params: { memberId: m.id, section: smallerSection },
              description: `${m.id}: ${currentSection} \u2192 ${smallerSection} (ratio=${maxRatio.toFixed(2)}, over-designed)`
            });
            suggestions.push(`${m.id}: ${currentSection} \u2192 ${smallerSection}`);
          }
        }
      }
      if (actions.length > 0) {
        return {
          success: true,
          response: `## \u{1F3AF} Local Optimization Results

${suggestions.map((s) => `- ${s}`).join("\n")}

**${actions.length} member(s) can be downsized.** Click **Execute** to apply.`,
          actions
        };
      }
      return {
        success: true,
        response: "\u2705 All members appear reasonably sized based on local analysis. For AI-powered optimization, ensure your Gemini API key is configured."
      };
    }
    return {
      success: true,
      response: 'To optimize sections, please run a structural analysis first. Then I can suggest lighter sections based on utilization ratios.\n\nSay "run analysis" to start.'
    };
  }
  async handleCodeCheck(message, context) {
    if (!context || context.members.length === 0) {
      return {
        success: false,
        response: "No model to check. Create a structure and run analysis first."
      };
    }
    let code = "IS_800";
    if (/aisc/i.test(message)) code = "AISC_360";
    else if (/eurocode/i.test(message)) code = "EN_1993";
    else if (/is\s*456/i.test(message)) code = "IS_456";
    let response = `## \u{1F4CB} Code Compliance Check \u2014 ${code}

`;
    if (!context.analysisResults) {
      response += `\u26A0\uFE0F No analysis results available. Running simplified checks based on member properties only.

`;
    }
    let overallPass = true;
    const memberResults = [];
    for (const m of context.members) {
      const startNode = context.nodes.find((n) => n.id === m.startNode);
      const endNode = context.nodes.find((n) => n.id === m.endNode);
      let memberType = "beam";
      let memberLength = 3;
      if (startNode && endNode) {
        const dx = Math.abs(endNode.x - startNode.x);
        const dy = Math.abs(endNode.y - startNode.y);
        memberType = dy > dx ? "column" : "beam";
        memberLength = Math.sqrt(dx * dx + dy * dy + (endNode.z - startNode.z || 0) ** 2);
      }
      const forces = {};
      if (context.analysisResults) {
        forces.moment = context.analysisResults.maxMoment ? context.analysisResults.maxMoment / context.members.length : void 0;
        forces.shear = context.analysisResults.maxShear ? context.analysisResults.maxShear / context.members.length : void 0;
        if (memberType === "column") forces.axial = -50;
      }
      const result = await this.checkCodeCompliance(
        { section: m.section || "ISMB300", length: memberLength, type: memberType },
        forces,
        code
      );
      const icon = result.overallStatus === "pass" ? "\u2705" : result.overallStatus === "warning" ? "\u26A0\uFE0F" : "\u274C";
      memberResults.push(`${icon} **${m.id}** (${m.section || "ISMB300"}, ${memberType}, L=${memberLength.toFixed(1)}m): ${result.summary}`);
      if (result.overallStatus === "fail") overallPass = false;
      if (result.overallStatus === "fail") {
        for (const check of result.checks.filter((c) => c.status === "fail")) {
          memberResults.push(`   \u2192 ${check.clause}: ratio = ${check.ratio?.toFixed(3)} (${check.details})`);
        }
      }
    }
    response += memberResults.join("\n\n");
    response += `

---
**Overall: ${overallPass ? "\u2705 All members pass" : "\u274C Some members failed \u2014 consider upgrading sections"}**`;
    return {
      success: true,
      response,
      metadata: { intent: "code_check", confidence: 0.9, processingTimeMs: 0, provider: "local" }
    };
  }
  handleReviewModel(context) {
    if (!context || context.nodes.length === 0) {
      return {
        success: true,
        response: '\u{1F4CB} **Current Model: Empty**\n\nNo structure loaded. Try:\n- "Create a portal frame"\n- "Build a 2-story frame"\n- "Make a truss bridge"'
      };
    }
    const supports = context.nodes.filter((n) => n.hasSupport);
    const sections = [...new Set(context.members.map((m) => m.section).filter(Boolean))];
    const xs = context.nodes.map((n) => n.x);
    const ys = context.nodes.map((n) => n.y);
    const width = Math.max(...xs) - Math.min(...xs);
    const height = Math.max(...ys) - Math.min(...ys);
    let response = `## \u{1F4CB} Model Summary

`;
    response += `| Property | Value |
|---|---|
`;
    response += `| Nodes | ${context.nodes.length} |
`;
    response += `| Members | ${context.members.length} |
`;
    response += `| Supports | ${supports.length} |
`;
    response += `| Loads | ${context.loads?.length || 0} |
`;
    response += `| Overall Width | ${width.toFixed(2)} m |
`;
    response += `| Overall Height | ${height.toFixed(2)} m |
`;
    response += `| Sections Used | ${sections.length > 0 ? sections.join(", ") : "Default"} |
`;
    if (context.analysisResults) {
      response += `
### Analysis Results
`;
      if (context.analysisResults.maxDisplacement !== void 0)
        response += `- Max Displacement: ${context.analysisResults.maxDisplacement.toFixed(3)} mm
`;
      if (context.analysisResults.maxStress !== void 0)
        response += `- Max Stress: ${context.analysisResults.maxStress.toFixed(1)} MPa
`;
      if (context.analysisResults.maxMoment !== void 0)
        response += `- Max Moment: ${context.analysisResults.maxMoment.toFixed(1)} kN\xB7m
`;
    }
    return { success: true, response };
  }
  handleAboutModel(context) {
    if (!context || context.nodes.length === 0) {
      return { success: true, response: "No model loaded." };
    }
    return {
      success: true,
      response: `The current model has **${context.nodes.length} nodes**, **${context.members.length} members**, **${context.nodes.filter((n) => n.hasSupport).length} supports**, and **${context.loads?.length || 0} loads**.`
    };
  }
  async handleTroubleshoot(message, context) {
    if (!context || context.nodes.length === 0) {
      return { success: true, response: "No model loaded to troubleshoot." };
    }
    const diagnosis = await this.diagnoseModel(context);
    if (diagnosis.issues.length === 0) {
      return { success: true, response: "\u2705 No issues found! The model looks healthy." };
    }
    const actions = [];
    for (const issue of diagnosis.issues) {
      if (issue.category === "support" && issue.severity === "error") {
        const groundNodesWithoutSupport = context.nodes.filter(
          (n) => Math.abs(n.y) < 0.1 && !n.hasSupport
        );
        for (const n of groundNodesWithoutSupport) {
          actions.push({
            type: "addSupport",
            params: { nodeId: n.id, type: "fixed", restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
            description: `Add fixed support at node ${n.id}`
          });
        }
      }
    }
    let response = `## \u{1F527} Troubleshoot Results

`;
    response += `Found **${diagnosis.issues.length}** issue(s):

`;
    for (const issue of diagnosis.issues) {
      const icon = issue.severity === "error" ? "\u274C" : issue.severity === "warning" ? "\u26A0\uFE0F" : "\u2139\uFE0F";
      response += `${icon} ${issue.message}
`;
    }
    if (actions.length > 0) {
      response += `
\u2728 **Auto-fix available**: ${actions.length} action(s) ready. Click **Execute** to apply.`;
    }
    return { success: true, response, actions: actions.length > 0 ? actions : void 0 };
  }
  handleClearModel() {
    return {
      success: true,
      response: "\u26A0\uFE0F This will clear the entire model. Click **Execute** to confirm.",
      actions: [{ type: "clearModel", params: {}, description: "Clear the entire model" }]
    };
  }
  async handleExplain(message) {
    if (this.model) {
      try {
        const prompt = `${SYSTEM_PROMPTS.chat}

The user is asking for an explanation. Be clear, concise, and technically accurate. Use proper structural engineering terminology. Include relevant Indian Standards references where applicable.

User question: "${message}"`;
        const result = await this.model.generateContent(prompt);
        return {
          success: true,
          response: result.response.text(),
          metadata: { intent: "explain", confidence: 0.85, processingTimeMs: 0, provider: "gemini" }
        };
      } catch (err) {
        console.warn("[AIArchitectEngine] Gemini explain failed:", err);
      }
    }
    return {
      success: true,
      response: "I'd be happy to explain that, but my AI service is currently offline. Please check your Gemini API key configuration, or try asking about specific structural topics like beam design, truss analysis, or IS code provisions.",
      metadata: { intent: "explain", confidence: 0.5, processingTimeMs: 0, provider: "local" }
    };
  }
  async handleConversation(message, context, history) {
    if (this.model) {
      try {
        let contextStr = SYSTEM_PROMPTS.chat;
        if (context && context.nodes.length > 0) {
          contextStr += `

Current model: ${context.nodes.length} nodes, ${context.members.length} members, ${context.nodes.filter((n) => n.hasSupport).length} supports, ${context.loads?.length || 0} loads.`;
        }
        const recentHistory = (history || this.conversationHistory).slice(-10);
        const historyStr = recentHistory.length > 0 ? "\n\nRecent conversation:\n" + recentHistory.map((h) => `${h.role}: ${h.content}`).join("\n") : "";
        const prompt = `${contextStr}${historyStr}

User: ${message}

Assistant:`;
        const result = await this.model.generateContent(prompt);
        return {
          success: true,
          response: result.response.text(),
          metadata: { intent: "conversation", confidence: 0.7, processingTimeMs: 0, provider: "gemini" }
        };
      } catch (err) {
        console.warn("[AIArchitectEngine] Gemini conversation failed:", err);
      }
    }
    return {
      success: true,
      response: `I'm your AI Architect assistant. I can help with:

\u{1F3D7}\uFE0F **Create structures** \u2014 "Create a 10m portal frame"
\u{1F527} **Modify models** \u2014 "Add another story"
\u{1F4CA} **Analyze** \u2014 "Run analysis"
\u{1F50D} **Diagnose** \u2014 "Check for issues"
\u{1F4CB} **Code check** \u2014 "Check IS 800 compliance"
\u{1F4A1} **Explain** \u2014 "What is P-Delta?"

Please configure your Gemini API key for full AI capabilities.`,
      metadata: { intent: "conversation", confidence: 0.5, processingTimeMs: 0, provider: "local" }
    };
  }
  // ============================================
  // PYTHON BACKEND PROXY
  // ============================================
  async proxyToPython(endpoint, body) {
    try {
      const response = await fetch(`${this.pythonApiUrl}/ai/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3e4)
      });
      if (!response.ok) {
        throw new Error(`Python API returned ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`[AIArchitectEngine] Python proxy error (${endpoint}):`, error);
      throw error;
    }
  }
  // ============================================
  // UTILITY METHODS
  // ============================================
  validateModel(model) {
    const issues = [];
    if (!model.nodes || !Array.isArray(model.nodes) || model.nodes.length === 0) {
      issues.push("Missing or empty nodes array");
    }
    if (!model.members || !Array.isArray(model.members) || model.members.length === 0) {
      issues.push("Missing or empty members array");
    }
    if (model.nodes && model.members) {
      const nodeIds = new Set(model.nodes.map((n) => n.id));
      for (const member of model.members) {
        if (!nodeIds.has(member.s)) issues.push(`Member ${member.id}: invalid start node "${member.s}"`);
        if (!nodeIds.has(member.e)) issues.push(`Member ${member.id}: invalid end node "${member.e}"`);
        if (member.s === member.e) issues.push(`Member ${member.id}: start and end node are the same`);
      }
      const hasSupport = model.nodes.some((n) => n.isSupport);
      if (!hasSupport) issues.push("No supports defined \u2014 structure will be unstable");
    }
    return { valid: issues.length === 0, issues };
  }
  normalizeModel(model) {
    return {
      nodes: (model.nodes || []).map((node) => ({
        id: node.id,
        x: Number(node.x) || 0,
        y: Number(node.y) || 0,
        z: Number(node.z) || 0,
        isSupport: node.isSupport || Math.abs(Number(node.y)) < 0.01,
        restraints: node.restraints || (node.isSupport || Math.abs(Number(node.y)) < 0.01 ? { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } : void 0)
      })),
      members: (model.members || []).map((member) => ({
        id: member.id,
        s: member.s,
        e: member.e,
        section: member.section || "ISMB300",
        material: member.material || "Fe410"
      })),
      loads: model.loads || [],
      materials: model.materials || [{ id: "mat1", name: "Fe410", E: 2e5, density: 78.5, fy: 250 }],
      sections: model.sections
    };
  }
  // ============================================
  // LOCAL FALLBACK GENERATION
  // ============================================
  generateLocally(prompt) {
    const lp = prompt.toLowerCase();
    const spanMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*span/i) || lp.match(/span\s*(?:of\s*)?([\d.]+)\s*m/i);
    const heightMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*(?:height|tall|high)/i) || lp.match(/height\s*(?:of\s*)?([\d.]+)\s*m/i);
    const storyMatch = lp.match(/(\d+)\s*(?:stor(?:y|ey|ies)|floor)/i);
    const bayMatch = lp.match(/(\d+)\s*bay/i);
    const span = spanMatch ? parseFloat(spanMatch[1]) : 6;
    const height = heightMatch ? parseFloat(heightMatch[1]) : 4;
    const stories = storyMatch ? parseInt(storyMatch[1]) : 1;
    const bays = bayMatch ? parseInt(bayMatch[1]) : 1;
    if (/portal|warehouse|shed|industrial/i.test(lp)) {
      return this.generatePortalFrame(span, height);
    }
    if (/story|storey|building|multi|floor/i.test(lp)) {
      return this.generateMultiStory(span, height, stories, bays);
    }
    if (/truss/i.test(lp)) {
      const trussType = /warren/i.test(lp) ? "warren" : /howe/i.test(lp) ? "howe" : "pratt";
      return this.generateTruss(span, height, trussType);
    }
    if (/cantilever/i.test(lp)) {
      return this.generateCantilever(span);
    }
    if (/beam|simply.*supported/i.test(lp)) {
      return this.generateSimpleBeam(span);
    }
    return this.generatePortalFrame(span, height);
  }
  generatePortalFrame(span, height) {
    const model = {
      nodes: [
        { id: "n1", x: 0, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: "n2", x: 0, y: height, z: 0 },
        { id: "n3", x: span / 2, y: height + 1.5, z: 0 },
        { id: "n4", x: span, y: height, z: 0 },
        { id: "n5", x: span, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } }
      ],
      members: [
        { id: "m1", s: "n1", e: "n2", section: "ISMB400" },
        { id: "m2", s: "n2", e: "n3", section: "ISMB300" },
        { id: "m3", s: "n3", e: "n4", section: "ISMB300" },
        { id: "m4", s: "n4", e: "n5", section: "ISMB400" }
      ],
      loads: [
        { nodeId: "n3", type: "point", fy: -20 }
      ],
      materials: [{ id: "mat1", name: "Fe410", E: 2e5, density: 78.5, fy: 250 }]
    };
    return {
      success: true,
      response: `\u2705 Portal frame generated: ${span}m span, ${height}m eave height, pitched roof.

- 5 nodes, 4 members
- Columns: ISMB400
- Rafters: ISMB300
- 20 kN point load at ridge`,
      model,
      actions: [{ type: "applyModel", params: { model }, description: "Apply portal frame model" }]
    };
  }
  generateMultiStory(bayWidth, storyHeight, stories, bays) {
    const nodes = [];
    const members = [];
    let nodeId = 1;
    let memberId = 1;
    for (let floor = 0; floor <= stories; floor++) {
      for (let bay = 0; bay <= bays; bay++) {
        const isGround = floor === 0;
        nodes.push({
          id: `n${nodeId}`,
          x: bay * bayWidth,
          y: floor * storyHeight,
          z: 0,
          isSupport: isGround,
          restraints: isGround ? { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } : void 0
        });
        nodeId++;
      }
    }
    const nodesPerFloor = bays + 1;
    for (let floor = 0; floor < stories; floor++) {
      for (let bay = 0; bay <= bays; bay++) {
        const bottomNode = `n${floor * nodesPerFloor + bay + 1}`;
        const topNode = `n${(floor + 1) * nodesPerFloor + bay + 1}`;
        members.push({
          id: `m${memberId}`,
          s: bottomNode,
          e: topNode,
          section: floor < stories / 2 ? "ISMB500" : "ISMB400"
        });
        memberId++;
      }
    }
    for (let floor = 1; floor <= stories; floor++) {
      for (let bay = 0; bay < bays; bay++) {
        const leftNode = `n${floor * nodesPerFloor + bay + 1}`;
        const rightNode = `n${floor * nodesPerFloor + bay + 2}`;
        members.push({
          id: `m${memberId}`,
          s: leftNode,
          e: rightNode,
          section: "ISMB300"
        });
        memberId++;
      }
    }
    const loads = [];
    for (let floor = 1; floor <= stories; floor++) {
      for (let bay = 0; bay <= bays; bay++) {
        const nodeIdx = floor * nodesPerFloor + bay + 1;
        loads.push({ nodeId: `n${nodeIdx}`, type: "point", fy: -25 });
      }
    }
    const model = {
      nodes,
      members,
      loads,
      materials: [{ id: "mat1", name: "Fe410", E: 2e5, density: 78.5, fy: 250 }]
    };
    return {
      success: true,
      response: `\u2705 ${stories}-story, ${bays}-bay frame generated.

- ${nodes.length} nodes, ${members.length} members
- Bay width: ${bayWidth}m, Story height: ${storyHeight}m
- Lower columns: ISMB500, Upper columns: ISMB400
- Beams: ISMB300
- 25 kN floor loads at each joint`,
      model,
      actions: [{ type: "applyModel", params: { model }, description: `Apply ${stories}-story frame` }]
    };
  }
  generateTruss(span, depth, type) {
    const panels = Math.max(4, Math.round(span / 3) * 2);
    const panelWidth = span / panels;
    const nodes = [];
    const members = [];
    let nodeId = 1;
    let memberId = 1;
    for (let i = 0; i <= panels; i++) {
      const isEnd = i === 0 || i === panels;
      nodes.push({
        id: `n${nodeId}`,
        x: i * panelWidth,
        y: 0,
        z: 0,
        isSupport: isEnd,
        restraints: isEnd ? i === 0 ? { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } : { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } : void 0
      });
      nodeId++;
    }
    const topStartId = nodeId;
    for (let i = 1; i < panels; i++) {
      nodes.push({
        id: `n${nodeId}`,
        x: i * panelWidth,
        y: depth,
        z: 0
      });
      nodeId++;
    }
    for (let i = 0; i < panels; i++) {
      members.push({
        id: `m${memberId}`,
        s: `n${i + 1}`,
        e: `n${i + 2}`,
        section: "ISA100x100x10"
      });
      memberId++;
    }
    for (let i = 0; i < panels - 2; i++) {
      members.push({
        id: `m${memberId}`,
        s: `n${topStartId + i}`,
        e: `n${topStartId + i + 1}`,
        section: "ISA100x100x10"
      });
      memberId++;
    }
    members.push({ id: `m${memberId}`, s: "n1", e: `n${topStartId}`, section: "ISA80x80x8" });
    memberId++;
    members.push({ id: `m${memberId}`, s: `n${panels + 1}`, e: `n${topStartId + panels - 2}`, section: "ISA80x80x8" });
    memberId++;
    for (let i = 1; i < panels; i++) {
      const bottomNode = `n${i + 1}`;
      const topNode = `n${topStartId + i - 1}`;
      members.push({ id: `m${memberId}`, s: bottomNode, e: topNode, section: "ISA75x75x6" });
      memberId++;
      if (type === "pratt" && i < panels - 1) {
        if (i < panels / 2) {
          members.push({ id: `m${memberId}`, s: `n${i + 1}`, e: `n${topStartId + i}`, section: "ISA75x75x6" });
        } else {
          members.push({ id: `m${memberId}`, s: `n${i + 2}`, e: `n${topStartId + i - 1}`, section: "ISA75x75x6" });
        }
        memberId++;
      } else if (type === "warren" && i < panels - 1) {
        if (i % 2 === 1) {
          members.push({ id: `m${memberId}`, s: `n${i + 1}`, e: `n${topStartId + i}`, section: "ISA75x75x6" });
        } else {
          members.push({ id: `m${memberId}`, s: `n${i + 2}`, e: `n${topStartId + i - 1}`, section: "ISA75x75x6" });
        }
        memberId++;
      } else if (type === "howe" && i < panels - 1) {
        if (i < panels / 2) {
          members.push({ id: `m${memberId}`, s: `n${i + 2}`, e: `n${topStartId + i - 1}`, section: "ISA75x75x6" });
        } else {
          members.push({ id: `m${memberId}`, s: `n${i + 1}`, e: `n${topStartId + i}`, section: "ISA75x75x6" });
        }
        memberId++;
      }
    }
    const loads = [];
    for (let i = 1; i < panels; i++) {
      loads.push({ nodeId: `n${topStartId + i - 1}`, type: "point", fy: -10 });
    }
    const model = { nodes, members, loads, materials: [{ id: "mat1", name: "Fe410", E: 2e5, density: 78.5, fy: 250 }] };
    return {
      success: true,
      response: `\u2705 ${type.charAt(0).toUpperCase() + type.slice(1)} truss generated: ${span}m span, ${depth}m depth, ${panels} panels.

- ${nodes.length} nodes, ${members.length} members
- Chords: ISA100x100x10
- Diagonals: ISA80x80x8
- Verticals: ISA75x75x6`,
      model,
      actions: [{ type: "applyModel", params: { model }, description: `Apply ${type} truss` }]
    };
  }
  generateSimpleBeam(span) {
    const model = {
      nodes: [
        { id: "n1", x: 0, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: false, my: false, mz: false } },
        { id: "n2", x: span, y: 0, z: 0, isSupport: true, restraints: { fx: false, fy: true, fz: true, mx: false, my: false, mz: false } }
      ],
      members: [{ id: "m1", s: "n1", e: "n2", section: "ISMB300" }],
      loads: [{ nodeId: "n2", type: "point", fy: -1e-3 }],
      materials: [{ id: "mat1", name: "Fe410", E: 2e5, density: 78.5, fy: 250 }]
    };
    return {
      success: true,
      response: `\u2705 Simply supported beam: ${span}m span.

- Pinned support at left, roller at right
- Section: ISMB300
- Add loads using "add 50 kN load at midspan"`,
      model,
      actions: [{ type: "applyModel", params: { model }, description: "Apply simple beam" }]
    };
  }
  generateCantilever(length) {
    const model = {
      nodes: [
        { id: "n1", x: 0, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
        { id: "n2", x: length, y: 0, z: 0 }
      ],
      members: [{ id: "m1", s: "n1", e: "n2", section: "ISMB400" }],
      loads: [{ nodeId: "n2", type: "point", fy: -20 }],
      materials: [{ id: "mat1", name: "Fe410", E: 2e5, density: 78.5, fy: 250 }]
    };
    return {
      success: true,
      response: `\u2705 Cantilever beam: ${length}m length.

- Fixed support at left end
- Section: ISMB400
- 20 kN tip load applied`,
      model,
      actions: [{ type: "applyModel", params: { model }, description: "Apply cantilever beam" }]
    };
  }
  // ============================================
  // STATUS
  // ============================================
  getStatus() {
    return {
      gemini: !!this.model,
      python: !!this.pythonApiUrl,
      local: true,
      model: this.model ? "gemini-2.0-flash" : "local-fallback"
    };
  }
}
const aiArchitectEngine = new AIArchitectEngine();
var AIArchitectEngine_default = aiArchitectEngine;
export {
  AIArchitectEngine,
  aiArchitectEngine,
  AIArchitectEngine_default as default
};
//# sourceMappingURL=AIArchitectEngine.js.map
