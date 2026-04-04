/**
 * Structural concept handlers — trusses, beams, diagrams, loads, buckling, etc.
 * Pure response builders — no store access needed.
 */

import type { AIHandlerContext, TopicHandler } from "./aiEngineTypes";

export function registerConceptHandlers(ctx: AIHandlerContext): TopicHandler[] {
  const { buildResponse } = ctx;

  function handleTrussTopic(type: string) {
    const topics: Record<string, string> = {
      pratt: `🏗 **Pratt Truss**\n\nDiagonals slope towards center. Under gravity loads, diagonals are in **tension** (efficient for steel), verticals in compression.\n\n• Span: 6–30m\n• Use: Bridges, roofs, industrial\n• Advantage: Lighter diagonals (tension), heavier but shorter verticals\n• Developed: 1844 by Thomas Pratt\n\n**In BeamLab:** "Create a 12m span Pratt truss with 6 panels"`,
      warren: `🏗 **Warren Truss**\n\nEquilateral triangles, no vertical members. Diagonals alternate tension/compression.\n\n• Span: 12–60m\n• Use: Bridges, long roofs\n• Advantage: Fewer members, even distribution\n• Variation: With verticals for distributed loads\n\n**In BeamLab:** "Create a 20m Warren truss"`,
      howe: `🏗 **Howe Truss**\n\nDiagonals slope away from center. Verticals in **tension**, diagonals in **compression** — opposite of Pratt.\n\n• Span: 6–30m\n• Use: Timber bridges/roofs (originally)\n• Less common in steel than Pratt`,
      general: `🏗 **Truss Types — Overview**\n\nTrusses are triangulated frames with NO bending — members carry only axial forces.\n\n| Type | Diagonal direction | Diagonal force |\n|---|---|---|\n| Pratt | → center | Tension |\n| Howe | → supports | Compression |\n| Warren | Alternating | Alternating |\n| Vierendeel | No diagonals | Bending |\n| K-Truss | Meet at midpoint | Mixed |\n| Fink | W-shaped | Mixed |\n\n**Static determinacy:** m + r = 2j\n\n**Methods:** Method of Joints, Method of Sections, Matrix Analysis\n\n**In BeamLab:** "Create a 12m Pratt truss with 6 panels"`,
    };
    return buildResponse(topics[type] || topics["general"], "engineering_knowledge", 0.95);
  }

  function handlePortalFrame() {
    return buildResponse(
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

  function handleMomentOfInertia() {
    return buildResponse(
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

  function handlePDelta() {
    return buildResponse(
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

  function handleSSBeam() {
    return buildResponse(
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

  function handleCantilever() {
    return buildResponse(
      `📐 **Cantilever Beam**\n\nFixed at one end, free at the other.\n\n` +
        `**UDL (w kN/m):**\n• Reaction: R = wL, Moment: M = wL²/2\n• δmax (tip) = wL⁴/(8EI)\n\n` +
        `**Point load P (tip):**\n• R = P, M = PL\n• δmax = PL³/(3EI)\n\n` +
        `**Deflection limit:** L/150 to L/180\n\n` +
        `**In BeamLab:** "Create a cantilever beam 5m with 10 kN point load"`,
      "engineering_knowledge",
      0.95,
    );
  }

  function handleFixedBeam() {
    return buildResponse(
      `📐 **Fixed (Encastré) Beam**\n\nBoth ends fully restrained (no rotation/translation).\n\n` +
        `**UDL (w kN/m):**\n• Support moment: M = wL²/12\n• Mid-span moment: M = wL²/24\n• δmax = wL⁴/(384EI)\n\n` +
        `Fixed beams have much less deflection and mid-span moment than SS beams.\n\n` +
        `**In BeamLab:** Add fixed supports at both ends of a member.`,
      "engineering_knowledge",
      0.95,
    );
  }

  function handleContinuousBeam() {
    return buildResponse(
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

  function handleBMD() {
    return buildResponse(
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

  function handleSFD() {
    return buildResponse(
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

  function handleAFD() {
    return buildResponse(
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

  function handleUDL() {
    return buildResponse(
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

  function handlePointLoad() {
    return buildResponse(
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

  function handleUDLvsPointLoad() {
    return buildResponse(
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

  function handleLTB() {
    return buildResponse(
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

  function handleConnections() {
    return buildResponse(
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

  function handleFoundations() {
    return buildResponse(
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

  function handlePlateTheory() {
    return buildResponse(
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

  function handleFEM() {
    return buildResponse(
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

  function handleModalAnalysis() {
    return buildResponse(
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

  function handleWindLoad() {
    return buildResponse(
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

  function handleSeismicLoad() {
    return buildResponse(
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

  function handleDesignChecks() {
    return buildResponse(
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

  function handleReduceDeflection() {
    return buildResponse(
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

  function handleOptimization() {
    return buildResponse(
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

  function handleStressStrain() {
    return buildResponse(
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

  return [
    { pattern: /\bpratt\s*truss/i, category: "engineering_knowledge", handler: () => handleTrussTopic("pratt") },
    { pattern: /\bwarren\s*truss/i, category: "engineering_knowledge", handler: () => handleTrussTopic("warren") },
    { pattern: /\bhowe\s*truss/i, category: "engineering_knowledge", handler: () => handleTrussTopic("howe") },
    { pattern: /\b(truss|trusses)\b(?!.*(pratt|warren|howe))/i, category: "engineering_knowledge", handler: () => handleTrussTopic("general") },
    { pattern: /\bportal\s*frame/i, category: "engineering_knowledge", handler: () => handlePortalFrame() },
    { pattern: /\bmoment\s+(of\s+)?inertia|second\s+moment/i, category: "engineering_knowledge", handler: () => handleMomentOfInertia() },
    { pattern: /\bp[\s-]?delta|second\s*order|geometric\s*non/i, category: "engineering_knowledge", handler: () => handlePDelta() },
    { pattern: /\b(simply\s+supported|ss)\s+(beam)/i, category: "engineering_knowledge", handler: () => handleSSBeam() },
    { pattern: /\bcantilever\b/i, category: "engineering_knowledge", handler: () => handleCantilever() },
    { pattern: /\b(fixed|encastre)\s+(beam|end|support)/i, category: "engineering_knowledge", handler: () => handleFixedBeam() },
    { pattern: /\bcontinuous\s+beam/i, category: "engineering_knowledge", handler: () => handleContinuousBeam() },
    { pattern: /\b(bmd|bending\s+moment\s+diagram)/i, category: "engineering_knowledge", handler: () => handleBMD() },
    { pattern: /\b(sfd|shear\s+force\s+diagram)/i, category: "engineering_knowledge", handler: () => handleSFD() },
    { pattern: /\b(afd|axial\s+force\s+diagram)/i, category: "engineering_knowledge", handler: () => handleAFD() },
    { pattern: /\budl|uniform(ly)?\s+distributed/i, category: "engineering_knowledge", handler: () => handleUDL() },
    { pattern: /\bpoint\s+load|concentrated\s+load/i, category: "engineering_knowledge", handler: () => handlePointLoad() },
    { pattern: /\b(udl|distributed).*(point|concentrated)|(point|concentrated).*(udl|distributed)/i, category: "engineering_knowledge", handler: () => handleUDLvsPointLoad() },
    { pattern: /\b(ltb|lateral[\s-]*torsional)/i, category: "engineering_knowledge", handler: () => handleLTB() },
    { pattern: /\b(connection|joint)\s+(design|type|bolt|weld)/i, category: "engineering_knowledge", handler: () => handleConnections() },
    { pattern: /\bfoundation|footing|pile/i, category: "engineering_knowledge", handler: () => handleFoundations() },
    { pattern: /\b(plate|shell|slab)\s+(element|theory|analysis)/i, category: "engineering_knowledge", handler: () => handlePlateTheory() },
    { pattern: /\bfem|finite\s+element|stiffness\s+method/i, category: "engineering_knowledge", handler: () => handleFEM() },
    { pattern: /\bmodal\s+analysis|natural\s+frequency|eigen/i, category: "engineering_knowledge", handler: () => handleModalAnalysis() },
    { pattern: /\bwind\s+load|wind\s+analysis/i, category: "engineering_knowledge", handler: () => handleWindLoad() },
    { pattern: /\bseismic|earthquake|base\s+shear/i, category: "engineering_knowledge", handler: () => handleSeismicLoad() },
    { pattern: /\b(design|check)\s+(beam|column|member)/i, category: "engineering_knowledge", handler: () => handleDesignChecks() },
    { pattern: /\b(reduce|decrease|minimize)\s+(deflection|displacement)/i, category: "recommendation", handler: () => handleReduceDeflection() },
    { pattern: /\b(optimize|optimise|improve)\s+(model|structure|design|weight)/i, category: "recommendation", handler: () => handleOptimization() },
    { pattern: /\b(what\s+is|define|explain)\s+(stress|strain)/i, category: "engineering_knowledge", handler: () => handleStressStrain() },
  ];
}
