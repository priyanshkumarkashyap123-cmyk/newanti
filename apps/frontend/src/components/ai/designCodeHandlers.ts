/**
 * Design code reference handlers — IS 800, IS 456, IS 875, IS 1893, AISC, EC3.
 * Pure response builders — no store access needed.
 */

import type { AIHandlerContext } from "./aiEngineTypes";
import type { TopicHandler } from "./aiEngineTypes";

export function registerDesignCodeHandlers(ctx: AIHandlerContext): TopicHandler[] {
  const { buildResponse } = ctx;

  function handleIS800() {
    return buildResponse(
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

  function handleIS456() {
    return buildResponse(
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

  function handleIS875() {
    return buildResponse(
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

  function handleIS1893() {
    return buildResponse(
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

  function handleAISC360() {
    return buildResponse(
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

  function handleEC3() {
    return buildResponse(
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

  function handleLoadCombinations() {
    return buildResponse(
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

  return [
    { pattern: /\bis\s*800\b/i, category: "design_code", handler: () => handleIS800() },
    { pattern: /\bis\s*456\b/i, category: "design_code", handler: () => handleIS456() },
    { pattern: /\bis\s*875\b/i, category: "design_code", handler: () => handleIS875() },
    { pattern: /\bis\s*1893\b/i, category: "design_code", handler: () => handleIS1893() },
    { pattern: /\baisc\s*(360)?/i, category: "design_code", handler: () => handleAISC360() },
    { pattern: /\beurocode\s*3|en\s*1993/i, category: "design_code", handler: () => handleEC3() },
    { pattern: /\bload\s+(combination|factor)s?/i, category: "design_code", handler: () => handleLoadCombinations() },
  ];
}
