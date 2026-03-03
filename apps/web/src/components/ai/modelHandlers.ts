/**
 * Model-aware handlers — queries about the user's current structural model.
 * All use getStore() to read Zustand state.
 */

import type { AIHandlerContext, TopicHandler, BeamLabAIResponse } from "./aiEngineTypes";
import { STEEL_SECTIONS } from "./aiEngineData";

export function registerModelHandlers(ctx: AIHandlerContext): TopicHandler[] {
  const { buildResponse, getStore } = ctx;

  function handleModelQuery(_input: string): BeamLabAIResponse {
    const s = getStore();
    if (s.nodes.size === 0) {
      return buildResponse(
        "📋 **Your model is currently empty.** No nodes, members, or loads defined.\n\n" +
          "To get started, try:\n" +
          '• **Generate tab**: "Create a simply supported beam 8m span with 20 kN/m UDL"\n' +
          '• **Commands**: "Add node at (0,0,0)", "Add node at (8,0,0)", "Add member from N1 to N2"\n' +
          "• **Templates**: Click an example prompt in the Generate tab",
        "model_query",
        0.95,
        ["Create a simply supported beam", "Add node at (0,0,0)", "List example prompts"],
      );
    }

    const lines: string[] = [`📋 **Model Summary**\n`];
    lines.push(`**Geometry:** ${s.nodes.size} nodes, ${s.members.size} members`);

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    s.nodes.forEach((n) => {
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.y > maxY) maxY = n.y;
    });
    lines.push(`**Extents:** X=[${minX}, ${maxX}]m, Y=[${minY}, ${maxY}]m (${(maxX - minX).toFixed(1)}m x ${(maxY - minY).toFixed(1)}m)`);

    let nFixed = 0, nPinned = 0, nRoller = 0, nFree = 0;
    s.nodes.forEach((n) => {
      if (!n.restraints) { nFree++; return; }
      const r = n.restraints;
      const restrained = [r.fx, r.fy, r.fz, r.mx, r.my, r.mz].filter(Boolean).length;
      if (restrained >= 6) nFixed++;
      else if (restrained >= 3) nPinned++;
      else if (restrained >= 1) nRoller++;
      else nFree++;
    });
    lines.push(`**Supports:** ${nFixed} fixed, ${nPinned} pinned, ${nRoller} roller, ${nFree} free`);

    const sections = new Map<string, number>();
    s.members.forEach((m) =>
      sections.set(m.sectionId || "Default", (sections.get(m.sectionId || "Default") || 0) + 1),
    );
    const secStr = Array.from(sections.entries()).map(([k, v]) => `${k}(${v})`).join(", ");
    lines.push(`**Sections:** ${secStr}`);
    lines.push(`**Loads:** ${s.loads.length} point loads, ${s.memberLoads.length} member loads`);

    let totalLen = 0;
    s.members.forEach((m) => {
      const sn = s.nodes.get(m.startNodeId);
      const en = s.nodes.get(m.endNodeId);
      if (sn && en)
        totalLen += Math.sqrt((en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2);
    });
    lines.push(`**Total member length:** ${totalLen.toFixed(2)}m`);

    if (s.analysisResults) {
      lines.push(`\n**Analysis:** ✅ Results available`);
      if (s.analysisResults.equilibriumCheck) {
        lines.push(
          `**Equilibrium:** ${s.analysisResults.equilibriumCheck.pass ? "✅ PASS" : "❌ FAIL"} (error=${s.analysisResults.equilibriumCheck.error_percent.toFixed(3)}%)`,
        );
      }
    } else {
      lines.push(`\n**Analysis:** ⚠ Not yet run. Click "Analyze" in the toolbar.`);
    }

    const recs: string[] = [];
    if (nFixed + nPinned + nRoller === 0) recs.push('⚠ No supports defined! Add with "Add fixed support at N1"');
    if (s.loads.length === 0 && s.memberLoads.length === 0) recs.push('⚠ No loads applied! Try "Apply 20 kN/m UDL on M1"');
    if (recs.length > 0) lines.push(`\n**Warnings:**\n${recs.join("\n")}`);

    return buildResponse(lines.join("\n"), "model_query", 0.95, [
      "Show reactions", "Check stability", "Max deflection?", "List all loads",
    ]);
  }

  function handleModelCount(_input: string, match: RegExpMatchArray): BeamLabAIResponse {
    const s = getStore();
    const what = match[1]?.toLowerCase() || "";
    if (/node/.test(what))
      return buildResponse(`📊 The model has **${s.nodes.size} nodes**.`, "model_query", 0.95);
    if (/member/.test(what))
      return buildResponse(`📊 The model has **${s.members.size} members**.`, "model_query", 0.95);
    if (/load/.test(what))
      return buildResponse(`📊 The model has **${s.loads.length} point loads** and **${s.memberLoads.length} member loads**.`, "model_query", 0.95);
    if (/support/.test(what)) {
      let cnt = 0;
      s.nodes.forEach((n) => {
        if (n.restraints && Object.values(n.restraints).some(Boolean)) cnt++;
      });
      return buildResponse(`📊 The model has **${cnt} supported nodes**.`, "model_query", 0.95);
    }
    return buildResponse(`📊 Model: ${s.nodes.size} nodes, ${s.members.size} members, ${s.loads.length} loads.`, "model_query", 0.9);
  }

  function handleModelStatus(_input: string): BeamLabAIResponse {
    const s = getStore();
    if (s.nodes.size === 0) return buildResponse("The model is empty. Create a structure first.", "model_query", 0.9);

    let nReactions = 0;
    s.nodes.forEach((n) => {
      if (n.restraints) Object.values(n.restraints).forEach((v) => { if (v) nReactions++; });
    });

    const dof = 3 * s.nodes.size;
    const unknowns = 3 * s.members.size + nReactions;

    let status: string;
    if (nReactions < 3) status = "❌ **UNSTABLE** — fewer than 3 reaction DOFs. Add more supports.";
    else if (unknowns < dof) status = `❌ **UNSTABLE** — ${dof - unknowns} DOFs short. Add members or supports.`;
    else if (unknowns === dof) status = "✅ **Statically determinate** — exactly solvable.";
    else status = `✅ **Statically indeterminate** to degree ${unknowns - dof}. Requires matrix analysis.`;

    const hasAnalysis = s.analysisResults ? "✅ Analysis has been run." : "⚠ Analysis not yet run.";

    return buildResponse(
      `🏗 **Model Status**\n${status}\n${hasAnalysis}\nNodes: ${s.nodes.size}, Members: ${s.members.size}, Reaction DOFs: ${nReactions}`,
      "model_query",
      0.95,
    );
  }

  function handleSectionsQuery(_input: string): BeamLabAIResponse {
    const s = getStore();
    const secs = new Map<string, number>();
    s.members.forEach((m) =>
      secs.set(m.sectionId || "Default", (secs.get(m.sectionId || "Default") || 0) + 1),
    );
    if (secs.size === 0) return buildResponse("No members in the model.", "model_query", 0.9);
    const lines = Array.from(secs.entries()).map(([sec, cnt]) => {
      const props = STEEL_SECTIONS[sec.toUpperCase()];
      if (props) return `• **${sec}** — ${cnt} members (h=${props.h}mm, Ixx=${props.Ixx}cm⁴, wt=${props.weight}kg/m)`;
      return `• **${sec}** — ${cnt} members`;
    });
    return buildResponse(`📋 **Sections in Model:**\n${lines.join("\n")}`, "model_query", 0.95);
  }

  function handleExtremeQuery(_input: string, match: RegExpMatchArray): BeamLabAIResponse {
    const s = getStore();
    const type = match[1]?.toLowerCase();
    if (s.members.size === 0) return buildResponse("No members in the model.", "model_query", 0.9);

    let extremeId = "", extremeVal = type?.startsWith("l") || type?.startsWith("h") ? 0 : Infinity;

    s.members.forEach((m, id) => {
      const sn = s.nodes.get(m.startNodeId);
      const en = s.nodes.get(m.endNodeId);
      if (!sn || !en) return;
      const len = Math.sqrt((en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2);
      if ((type === "longest" || type === "heaviest") && len > extremeVal) { extremeVal = len; extremeId = id; }
      if ((type === "shortest" || type === "lightest") && len < extremeVal) { extremeVal = len; extremeId = id; }
    });

    return buildResponse(
      `📏 The **${type}** member is **${extremeId}** (${extremeVal.toFixed(3)}m).`,
      "model_query",
      0.9,
      [`Info about ${extremeId}`, `Select ${extremeId}`],
    );
  }

  return [
    { pattern: /\b(my|current|this)\s+(model|structure|frame|beam|truss)\b/i, category: "model_query", handler: (i, m) => handleModelQuery(i) },
    { pattern: /\bhow\s+many\s+(nodes?|members?|loads?|supports?)\b/i, category: "model_query", handler: (i, m) => handleModelCount(i, m) },
    { pattern: /\b(is|has)\s+(the\s+)?(model|structure|analysis)\s+(stable|determinate|run|done|complete)/i, category: "model_query", handler: (i) => handleModelStatus(i) },
    { pattern: /\bwhat\s+(section|profile)s?\s+(are|is|do)\b/i, category: "model_query", handler: (i) => handleSectionsQuery(i) },
    { pattern: /\b(longest|shortest|heaviest|lightest)\s+(member|span|beam)\b/i, category: "model_query", handler: (i, m) => handleExtremeQuery(i, m) },
  ];
}
