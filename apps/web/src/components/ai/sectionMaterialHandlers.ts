/**
 * Section properties & material handlers — ISMB lookup, steel/concrete grades.
 * Some use getStore() for model-aware recommendations.
 */

import type { AIHandlerContext, TopicHandler, BeamLabAIResponse } from "./aiEngineTypes";
import { STEEL_SECTIONS, MATERIALS } from "./aiEngineData";

export function registerSectionMaterialHandlers(ctx: AIHandlerContext): TopicHandler[] {
  const { buildResponse, getStore } = ctx;

  function handleSectionLookup(_input: string, match: RegExpMatchArray): BeamLabAIResponse {
    const prefix = match[1].toUpperCase();
    const size = match[2];
    const key = `${prefix}${size}`;
    const sec = STEEL_SECTIONS[key];

    if (!sec) {
      const available = Object.keys(STEEL_SECTIONS).filter((k) => k.startsWith(prefix)).join(", ");
      return buildResponse(
        `Section **${key}** not found in my database.\n\nAvailable ${prefix} sections: ${available || "None"}`,
        "section_info", 0.6,
      );
    }

    return buildResponse(
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
      "section_info", 0.98,
      [`Change section to ${key}`, `Calculate moment capacity for ${key}`],
    );
  }

  function handleSectionHelp(_input: string): BeamLabAIResponse {
    return buildResponse(
      `📋 **Available Steel Sections in Database:**\n\n` +
        `**ISMB (Medium Beams):** ${Object.keys(STEEL_SECTIONS).filter((k) => k.startsWith("ISMB")).join(", ")}\n\n` +
        `Ask for any section properties, e.g.: "ISMB300 properties"\n\n` +
        `**Quick reference:**\n` +
        `• ISMB200: Light beams, secondary framing (Ixx=2235 cm⁴)\n` +
        `• ISMB300: Medium beams (Ixx=8986 cm⁴)\n` +
        `• ISMB400: Primary beams (Ixx=20458 cm⁴)\n` +
        `• ISMB500: Heavy beams, girders (Ixx=45218 cm⁴)\n` +
        `• ISMB600: Very heavy girders (Ixx=91813 cm⁴)`,
      "section_info", 0.9,
    );
  }

  function handleSectionRecommendation(_input: string): BeamLabAIResponse {
    const s = getStore();
    if (s.members.size === 0) {
      return buildResponse("No members to recommend sections for. Create a model first.", "recommendation", 0.7);
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

    const targetDepth = (maxSpan * 1000) / 20;
    const recommended = Object.entries(STEEL_SECTIONS)
      .filter(([k]) => k.startsWith("ISMB"))
      .sort((a, b) => Math.abs(a[1].h - targetDepth) - Math.abs(b[1].h - targetDepth));

    const best = recommended[0];
    return buildResponse(
      `🎯 **Section Recommendation**\n\n` +
        `Max span: ${maxSpan.toFixed(2)}m\n` +
        `Rule of thumb: Beam depth ≈ Span/20 = ${targetDepth.toFixed(0)}mm\n\n` +
        `**Recommended: ${best[0]}** (h=${best[1].h}mm)\n` +
        `• Ixx = ${best[1].Ixx} cm⁴\n` +
        `• Weight = ${best[1].weight} kg/m\n\n` +
        `Also consider: ${recommended[1]?.[0] || "-"}, ${recommended[2]?.[0] || "-"}\n\n` +
        `_Note: This is a preliminary estimate. Run analysis and check deflection/stress limits._`,
      "recommendation", 0.8,
      [`Change section to ${best[0]}`, "Run analysis", "Check deflection limits"],
    );
  }

  function handleSteelGrade(_input: string, match: RegExpMatchArray): BeamLabAIResponse {
    const gradeRaw = match[1].toUpperCase().replace(/\s+/g, "");
    const gradeMap: Record<string, string> = { FE410: "E250", FE490: "E350", FE540: "E450" };
    const grade = gradeMap[gradeRaw] || gradeRaw;
    const mat = MATERIALS.steel[grade as keyof typeof MATERIALS.steel];

    if (!mat) {
      return buildResponse(
        `Grade "${gradeRaw}" not found. Available: ${Object.keys(MATERIALS.steel).join(", ")}`,
        "material_info", 0.6,
      );
    }

    return buildResponse(
      `🔩 **Steel Grade: ${grade} ${gradeMap[gradeRaw] ? `(${gradeRaw})` : ""}**\n\n` +
        `| Property | Value |\n|---|---|\n` +
        `| Yield Stress (fy) | ${mat.fy} MPa |\n` +
        `| Ultimate Stress (fu) | ${mat.fu} MPa |\n` +
        `| Elastic Modulus (E) | ${mat.E} MPa |\n` +
        `| Density | ${mat.density} kg/m³ |\n` +
        `| Poisson's Ratio (ν) | ${mat.nu} |\n` +
        `| Shear Modulus (G) | ${(mat.E / (2 * (1 + mat.nu))).toFixed(0)} MPa |`,
      "material_info", 0.95,
    );
  }

  function handleConcreteGrade(_input: string, match: RegExpMatchArray): BeamLabAIResponse {
    const grade = match[1].toUpperCase();
    const mat = MATERIALS.concrete[grade as keyof typeof MATERIALS.concrete];
    if (!mat)
      return buildResponse(
        `Concrete grade ${grade} not in database. Available: ${Object.keys(MATERIALS.concrete).join(", ")}`,
        "material_info", 0.6,
      );
    return buildResponse(
      `🧱 **Concrete Grade: ${grade}**\n\n` +
        `| Property | Value |\n|---|---|\n` +
        `| Characteristic strength (fck) | ${mat.fck} MPa |\n` +
        `| Design strength (fcd = fck/1.5) | ${(mat.fck / 1.5).toFixed(1)} MPa |\n` +
        `| Elastic Modulus (Ec = 5000√fck) | ${mat.E} MPa |\n` +
        `| Density | ${mat.density} kg/m³ (plain), ${mat.density + 600} kg/m³ (reinforced) |\n` +
        `| Flexural strength | ${(0.7 * Math.sqrt(mat.fck)).toFixed(2)} MPa |\n\n` +
        `*Per IS 456:2000*`,
      "material_info", 0.95,
    );
  }

  function handleSteelGeneral(): BeamLabAIResponse {
    return buildResponse(
      `🔩 **Structural Steel Properties**\n\n` +
        `| Grade | fy (MPa) | fu (MPa) | Use |\n|---|---|---|---|\n` +
        Object.entries(MATERIALS.steel)
          .map(([g, m]) => `| ${g} | ${m.fy} | ${m.fu} | ${m.fy <= 250 ? "General" : m.fy <= 350 ? "Medium duty" : "Heavy/special"} |`)
          .join("\n") +
        `\n\n**Common properties (all grades):**\n` +
        `• E = 200,000 MPa\n• G ≈ 77,000 MPa\n• ν = 0.3\n• ρ = 7,850 kg/m³\n• α = 12×10⁻⁶ /°C`,
      "material_info", 0.95,
    );
  }

  function handleConcreteGeneral(): BeamLabAIResponse {
    return buildResponse(
      `🧱 **Concrete Grades (IS 456)**\n\n` +
        `| Grade | fck (MPa) | Ec (MPa) | Use |\n|---|---|---|---|\n` +
        Object.entries(MATERIALS.concrete)
          .map(([g, m]) => `| ${g} | ${m.fck} | ${m.E} | ${m.fck <= 20 ? "General/PCC" : m.fck <= 30 ? "RCC" : "Pre-stressed/special"} |`)
          .join("\n") +
        `\n\n• Density: 24 kN/m³ (plain), 25 kN/m³ (reinforced)\n• ν ≈ 0.15–0.20\n• α = 10×10⁻⁶ /°C`,
      "material_info", 0.95,
    );
  }

  return [
    { pattern: /\b(ismb|ismc|isa|isht)\s*(\d{2,4})\b/i, category: "section_info", handler: (i, m) => handleSectionLookup(i, m) },
    { pattern: /\b(section|profile)\s+(properties|data|details|info)\b/i, category: "section_info", handler: (i) => handleSectionHelp(i) },
    { pattern: /\brecommend.*(section|profile|size)\b/i, category: "recommendation", handler: (i) => handleSectionRecommendation(i) },
    { pattern: /\b(e250|e300|e350|e450|e550|fe\s*410|fe\s*490|fe\s*540)\b/i, category: "material_info", handler: (i, m) => handleSteelGrade(i, m) },
    { pattern: /\b(m15|m20|m25|m30|m35|m40|m50)\b.*\b(concrete|grade|strength|properties)\b/i, category: "material_info", handler: (i, m) => handleConcreteGrade(i, m) },
    { pattern: /\bsteel\s+(properties|grade|material|density|modulus)\b/i, category: "material_info", handler: () => handleSteelGeneral() },
    { pattern: /\bconcrete\s+(properties|grade|material|density|modulus|strength)\b/i, category: "material_info", handler: () => handleConcreteGeneral() },
  ];
}
