/**
 * Utility handlers — diagnosis, how-to, capabilities, analysis guide, material comparison, generic fallback.
 * handleDiagnosis and handleGenericQuestion use getStore().
 */

import type { AIHandlerContext, TopicHandler, BeamLabAIResponse } from "./aiEngineTypes";

/** Extra context for the generic fallback handler */
export interface UtilityHandlerDeps {
  handleSSBeam: () => BeamLabAIResponse;
  handleBucklingHelp: (input: string) => BeamLabAIResponse;
  handleDeflectionHelp: (input: string) => BeamLabAIResponse;
  handleMomentCapacity: (input: string) => BeamLabAIResponse;
  handleShearCapacity: (input: string) => BeamLabAIResponse;
  handleConnections: () => BeamLabAIResponse;
  handleFoundations: () => BeamLabAIResponse;
  handleIS800: () => BeamLabAIResponse;
  handleWindLoad: () => BeamLabAIResponse;
  handleSeismicLoad: () => BeamLabAIResponse;
  handleOptimization: () => BeamLabAIResponse;
  handleAnalysisGuide: () => BeamLabAIResponse;
}

export function registerUtilityHandlers(
  ctx: AIHandlerContext,
  deps: UtilityHandlerDeps,
): { handlers: TopicHandler[]; handleGenericQuestion: (input: string) => BeamLabAIResponse } {
  const { buildResponse, getStore } = ctx;

  function handleDiagnosis(_input: string): BeamLabAIResponse {
    const s = getStore();
    const issues: string[] = [];

    if (s.nodes.size === 0)
      return buildResponse("Model is empty. Nothing to diagnose.", "diagnosis", 0.9);

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
      issues.push('❌ **No supports!** Add at least one fixed or pinned support: "Add fixed support at N1"');
    if (nRestrainedDOFs < 3)
      issues.push("❌ **Insufficient restraints** — need at least 3 DOFs restrained for 2D stability");

    if (s.members.size === 0 && s.nodes.size > 0)
      issues.push("⚠ Nodes exist but no members — structure has no stiffness");

    if (s.loads.length === 0 && s.memberLoads.length === 0)
      issues.push("⚠ No loads applied — analysis will produce zero displacements");

    const connectedNodes = new Set<string>();
    s.members.forEach((m) => { connectedNodes.add(m.startNodeId); connectedNodes.add(m.endNodeId); });
    const floating: string[] = [];
    s.nodes.forEach((_, id) => { if (!connectedNodes.has(id)) floating.push(id); });
    if (floating.length > 0)
      issues.push(
        `⚠ **Floating nodes** (not connected to any member): ${floating.slice(0, 5).join(", ")}${floating.length > 5 ? ` +${floating.length - 5} more` : ""}`,
      );

    if (issues.length === 0) {
      return buildResponse(
        `✅ **Model looks healthy!**\n\n` +
          `• ${s.nodes.size} nodes, ${s.members.size} members\n` +
          `• ${nRestrainedDOFs} restrained DOFs\n` +
          `• ${s.loads.length + s.memberLoads.length} loads applied\n\n` +
          `You should be able to run analysis successfully. Click "Analyze" in the toolbar.`,
        "diagnosis", 0.9,
        ["Run analysis", "Check stability", "Show model info"],
      );
    }

    return buildResponse(
      `🔍 **Model Diagnosis — ${issues.length} issue${issues.length > 1 ? "s" : ""} found:**\n\n${issues.join("\n\n")}`,
      "diagnosis", 0.95,
      ["Add fixed support at N1", "Show model info"],
    );
  }

  function handleSingularMatrix(_input: string): BeamLabAIResponse {
    return buildResponse(
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
      "diagnosis", 0.95,
      ["Check stability", "List supports", "Add fixed support at N1"],
    );
  }

  function handleHowTo(input: string): BeamLabAIResponse {
    const lower = input.toLowerCase();

    if (/add.*(node|point)/i.test(lower))
      return buildResponse('**Add a node:** Type "Add node at (5, 3, 0)" in the Modify or Chat tab.\nOr click the Point tool in the toolbar.', "software_help", 0.95);
    if (/add.*(member|beam|column)/i.test(lower))
      return buildResponse('**Add a member:** Type "Add member from N1 to N2" in Modify/Chat.\nOr use the Member tool in the toolbar to click two nodes.', "software_help", 0.95);
    if (/add.*(load|force)/i.test(lower))
      return buildResponse('**Add loads:**\n• Point load: "Add 50 kN load at N3"\n• UDL: "Apply 20 kN/m UDL on M1"\n\nOr use the Loads panel in the sidebar.', "software_help", 0.95);
    if (/add.*(support|restraint|fix|pin|roller)/i.test(lower))
      return buildResponse('**Add supports:**\n• "Add fixed support at N1" (all DOFs)\n• "Add pinned support at N2" (translations)\n• "Add roller support at N3" (vertical only)\n\nOr use the Support tool in the toolbar.', "software_help", 0.95);
    if (/select/i.test(lower))
      return buildResponse('**Selection commands:**\n• "Select N1" or "Select M1"\n• "Select all" / "Clear selection"\n• "Select all beams" / "Select all columns"\n• "Select all ISMB300 members"\n• Click elements, or box-select in the viewport.', "software_help", 0.95);
    if (/delet|remov/i.test(lower))
      return buildResponse('**Delete:** Type "Delete M5" or "Delete selected" in Modify/Chat.\nOr select elements and press Delete/Backspace.', "software_help", 0.95);
    if (/change.*(section|profile)/i.test(lower))
      return buildResponse('**Change section:** First select members, then "Change section to ISMB400".\nOr: "Select all" → "Change section to ISMB300"', "software_help", 0.95);

    return buildResponse(
      `**BeamLab Quick Reference:**\n\n` +
        `• **Add**: "Add node at (x,y,z)", "Add member from N1 to N2"\n` +
        `• **Load**: "Apply 20 kN/m UDL on M1", "Add 50 kN load at N3"\n` +
        `• **Support**: "Add fixed/pinned/roller support at N1"\n` +
        `• **Select**: "Select N1", "Select all beams"\n` +
        `• **Modify**: "Move N2 to (10,0,0)", "Change section to ISMB400"\n` +
        `• **Query**: "Show reactions", "Max deflection?", "Check stability"\n` +
        `• **Display**: "Show BMD", "Show SFD", "Show AFD"\n\n` +
        `Type "help" for the complete command list.`,
      "software_help", 0.9,
    );
  }

  function handleCapabilities(): BeamLabAIResponse {
    return buildResponse(
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
      "software_help", 0.95,
    );
  }

  function handleAnalysisGuide(): BeamLabAIResponse {
    return buildResponse(
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
      "analysis_help", 0.95,
      ["Check stability", "List supports", "List loads"],
    );
  }

  function handleMaterialComparison(_input: string): BeamLabAIResponse {
    return buildResponse(
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
      "engineering_knowledge", 0.9,
    );
  }

  function handleGenericQuestion(input: string): BeamLabAIResponse {
    const lower = input.toLowerCase();

    const keywordTopics: [RegExp, () => BeamLabAIResponse][] = [
      [/beam|girder/, () => deps.handleSSBeam()],
      [/column|compression\s+member/, () => deps.handleBucklingHelp(input)],
      [/deflect|displace/, () => deps.handleDeflectionHelp(input)],
      [/moment|bending/, () => deps.handleMomentCapacity(input)],
      [/shear/, () => deps.handleShearCapacity(input)],
      [/buckl|slender/, () => deps.handleBucklingHelp(input)],
      [/weld|bolt|connect/, () => deps.handleConnections()],
      [/found|footing|pile/, () => deps.handleFoundations()],
      [/code|standard|is\s+\d/, () => deps.handleIS800()],
      [/wind/, () => deps.handleWindLoad()],
      [/seism|earth/, () => deps.handleSeismicLoad()],
      [/optimiz/, () => deps.handleOptimization()],
      [/analyze|analysis/, () => deps.handleAnalysisGuide()],
    ];

    for (const [re, handler] of keywordTopics) {
      if (re.test(lower)) {
        const resp = handler();
        resp.confidence = 0.6;
        return resp;
      }
    }

    const s = getStore();
    if (s.nodes.size > 0) {
      return buildResponse(
        `I'm not sure about "${input}", but I can tell you about your current model:\n\n` +
          `📋 ${s.nodes.size} nodes, ${s.members.size} members, ${s.loads.length + s.memberLoads.length} loads\n\n` +
          `Try asking:\n` +
          `• "Tell me about my model"\n` +
          `• "Check stability"\n` +
          `• "Recommend a section"\n` +
          `• "Show reactions" (after analysis)\n` +
          `• Or ask about: trusses, beams, buckling, IS codes, deflection, etc.`,
        "general", 0.3,
        ["Tell me about my model", "Check stability", "Help"],
      );
    }

    return buildResponse(
      `I'm your structural engineering assistant! I'm best at:\n\n` +
        `• **Concepts**: "What is a Pratt truss?", "Explain moment of inertia"\n` +
        `• **Formulas**: "Deflection formula", "Euler buckling"\n` +
        `• **Codes**: "IS 800", "AISC 360", "Load combinations"\n` +
        `• **Materials**: "ISMB300 properties", "E250 steel"\n` +
        `• **Your model**: "Check stability", "Show reactions"\n\n` +
        `What would you like to know?`,
      "general", 0.3,
    );
  }

  const handlers: TopicHandler[] = [
    { pattern: /\b(why|problem|issue|wrong|error|fix)\b.*(analysis|model|result|fail|unstable)/i, category: "diagnosis", handler: (i) => handleDiagnosis(i) },
    { pattern: /\bsingular\s+matrix|ill[\s-]*condition|mechanism/i, category: "diagnosis", handler: (i) => handleSingularMatrix(i) },
    { pattern: /\b(how\s+to|how\s+do\s+i)\s+(use|add|create|apply|remove|delete|select|move|change)/i, category: "software_help", handler: (i) => handleHowTo(i) },
    { pattern: /\bwhat\s+can\s+you|your\s+capabilit|features|help\b/i, category: "software_help", handler: () => handleCapabilities() },
    { pattern: /\bhow\s+to\s+analy[sz]e|run\s+analysis|analysis\s+steps/i, category: "analysis_help", handler: () => handleAnalysisGuide() },
    { pattern: /\b(comparison|compare|vs|versus|differ)\b.*(steel|concrete|timber|wood|aluminum)/i, category: "engineering_knowledge", handler: (i) => handleMaterialComparison(i) },
  ];

  return { handlers, handleGenericQuestion };
}
