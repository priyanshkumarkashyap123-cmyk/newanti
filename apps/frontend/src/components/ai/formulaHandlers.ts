/**
 * Formula & calculation handlers — structural formulas, quick calculations.
 * handleFormulaQuery uses FORMULAS, handleCalculation uses getStore().
 */

import type { AIHandlerContext, TopicHandler, BeamLabAIResponse } from "./aiEngineTypes";
import { FORMULAS } from "./aiEngineData";

export function registerFormulaHandlers(ctx: AIHandlerContext): TopicHandler[] {
  const { buildResponse, getStore } = ctx;

  function handleFormulaQuery(_input: string, match: RegExpMatchArray): BeamLabAIResponse {
    const topic = match[3]?.toLowerCase() || "";
    const matches = Object.entries(FORMULAS).filter(
      ([key, val]) =>
        key.includes(topic.replace(/\s+/g, "_")) ||
        val.description.toLowerCase().includes(topic),
    );

    if (matches.length === 0) {
      const all = Object.entries(FORMULAS)
        .map(([, v]) => `• ${v.description}: **${v.formula}**`)
        .join("\n");
      return buildResponse(
        `I don't have a specific formula for "${topic}", but here are all available:\n\n${all}`,
        "calculation", 0.5,
      );
    }

    const lines = matches.map(
      ([, v]) => `**${v.description}:**\n  ${v.formula}\n  _Where: ${v.variables}_`,
    );
    return buildResponse(`📐 **Formulas:**\n\n${lines.join("\n\n")}`, "calculation", 0.9);
  }

  function handleCalculation(_input: string, _match: RegExpMatchArray): BeamLabAIResponse {
    const s = getStore();
    if (s.members.size === 0) {
      return buildResponse(
        'No model data to calculate with. Create a structure first, or ask for a formula: "Formula for deflection".',
        "calculation", 0.5,
      );
    }

    let maxSpan = 0;
    s.members.forEach((m) => {
      const sn = s.nodes.get(m.startNodeId);
      const en = s.nodes.get(m.endNodeId);
      if (sn && en) {
        const len = Math.sqrt((en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2);
        if (len > maxSpan) maxSpan = len;
      }
    });

    let totalUDL = 0;
    s.memberLoads.forEach((l) => { if (l.w1) totalUDL += Math.abs(l.w1); });
    const avgUDL = s.memberLoads.length > 0 ? totalUDL / s.memberLoads.length : 10;

    const moment = (avgUDL * maxSpan * maxSpan) / 8;
    const shear = (avgUDL * maxSpan) / 2;

    return buildResponse(
      `📐 **Quick Calculations (for longest span = ${maxSpan.toFixed(2)}m, avg UDL ≈ ${avgUDL.toFixed(1)} kN/m):**\n\n` +
        `**Simply Supported Beam:**\n` +
        `• Max Moment = wL²/8 = ${avgUDL.toFixed(1)} × ${maxSpan.toFixed(2)}² / 8 = **${moment.toFixed(2)} kN·m**\n` +
        `• Max Shear = wL/2 = ${avgUDL.toFixed(1)} × ${maxSpan.toFixed(2)} / 2 = **${shear.toFixed(2)} kN**\n` +
        `• Deflection = 5wL⁴/(384EI) — assign a section and run analysis for exact values\n\n` +
        `_For precise results, run the analysis (click Analyze in toolbar)._`,
      "calculation", 0.8,
      ["Run analysis", "Show reactions", "Max deflection?"],
    );
  }

  function handleDeflectionHelp(_input: string): BeamLabAIResponse {
    return buildResponse(
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
      "calculation", 0.95,
      ["Max deflection?", "How to reduce deflection?"],
    );
  }

  function handleMomentCapacity(_input: string): BeamLabAIResponse {
    return buildResponse(
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
      "calculation", 0.95,
    );
  }

  function handleShearCapacity(_input: string): BeamLabAIResponse {
    return buildResponse(
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
      "calculation", 0.95,
    );
  }

  function handleBucklingHelp(_input: string): BeamLabAIResponse {
    return buildResponse(
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
      "calculation", 0.95,
    );
  }

  return [
    { pattern: /\b(formula|equation)\s+(for|of)\s+(.+)/i, category: "calculation", handler: (i, m) => handleFormulaQuery(i, m) },
    { pattern: /\bcalculate\s+(.+)/i, category: "calculation", handler: (i, m) => handleCalculation(i, m) },
    { pattern: /\bdeflection\s+(formula|limit|check|of|for)/i, category: "calculation", handler: (i) => handleDeflectionHelp(i) },
    { pattern: /\b(moment|bending)\s+(capacity|resistance|strength|formula)/i, category: "calculation", handler: (i) => handleMomentCapacity(i) },
    { pattern: /\bshear\s+(capacity|resistance|strength|formula|check)/i, category: "calculation", handler: (i) => handleShearCapacity(i) },
    { pattern: /\bbuckling|euler|critical\s+load|slenderness/i, category: "calculation", handler: (i) => handleBucklingHelp(i) },
  ];
}
