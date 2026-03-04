const SYSTEM_PROMPTS = {
  is800: `You are a Structural Engineering Expert specializing in IS 800:2007 (Indian Standard for Steel Design).
Your role is to analyze failed steel members and provide practical, code-compliant solutions.

When analyzing a failed member:
1. Identify the root cause of failure based on the failure mode
2. Suggest 3 specific, actionable fixes ranked by effectiveness
3. Explain the trade-offs of each solution (cost, fabrication complexity, weight)
4. Reference relevant IS 800 clauses when applicable
5. Consider constructability and practical constraints

Always be specific with section recommendations (e.g., "Change from ISMB 300 to ISMB 350" not just "increase section").
Format your response in a structured way with clear headings.`,
  aisc360: `You are a Structural Engineering Expert specializing in AISC 360 (American Steel Construction).
Your role is to analyze failed steel members and provide practical, code-compliant solutions.

When analyzing a failed member:
1. Identify the root cause of failure based on the failure mode
2. Suggest 3 specific, actionable fixes ranked by effectiveness
3. Explain the trade-offs of each solution (cost, fabrication complexity, weight)
4. Reference relevant AISC 360 chapters when applicable
5. Consider constructability and practical constraints

Always be specific with section recommendations (e.g., "Change from W12x26 to W14x30" not just "increase section").
Format your response in a structured way with clear headings.`,
  general: `You are a Structural Engineering Expert. You help engineers understand why structural members fail and how to fix them.
Provide practical, implementable solutions with clear trade-off analysis.`
};
class EngineeringCopilotService {
  conversationHistory = [];
  designCode = "is800";
  constructor(designCode) {
    if (designCode) {
      this.designCode = designCode;
    }
  }
  /**
   * Analyze a failed member and generate fix suggestions
   */
  async analyzeFailedMember(memberData) {
    const prompt = this.constructAnalysisPrompt(memberData);
    this.conversationHistory.push({
      id: this.generateId(),
      role: "user",
      content: prompt,
      timestamp: /* @__PURE__ */ new Date(),
      memberContext: memberData
    });
    const response = await this.generateAIResponse(memberData);
    this.conversationHistory.push({
      id: this.generateId(),
      role: "assistant",
      content: JSON.stringify(response),
      timestamp: /* @__PURE__ */ new Date()
    });
    return response;
  }
  /**
   * Construct the analysis prompt for the AI
   */
  constructAnalysisPrompt(data) {
    const failureModeText = this.getFailureModeDescription(data.failureMode);
    return `
Analyze this failed structural member and suggest fixes:

**Member Information:**
- Member ID: ${data.memberId}
- Type: ${data.memberType.toUpperCase()}
- Utilization Ratio: ${data.utilizationRatio.toFixed(2)} (FAILED - > 1.0)
- Failure Mode: ${failureModeText}

**Section Properties:**
- Section: ${data.section.name}
- Area: ${data.section.area.toFixed(0)} mm\xB2
- Moment of Inertia: ${data.section.momentOfInertia.toFixed(0)} mm\u2074
- Radius of Gyration: ${data.section.radiusOfGyration.toFixed(1)} mm
- Flange Width: ${data.section.flangeWidth.toFixed(0)} mm

**Geometry:**
- Length: ${data.geometry.length.toFixed(2)} m
- Effective Length (KL): ${data.geometry.effectiveLength.toFixed(2)} m
- End Conditions: ${data.geometry.endConditions}

**Loading:**
- Axial Force: ${data.loading.axialForce.toFixed(1)} kN
- Shear Force: ${data.loading.shearForce.toFixed(1)} kN
- Bending Moment: ${data.loading.bendingMoment.toFixed(1)} kN-m
- Load Combination: ${data.loading.loadCombination}

Please provide 3 specific fixes with trade-offs for each.
`;
  }
  /**
   * Generate AI response (mock implementation)
   * Replace with actual AI API call (OpenAI, Claude, etc.)
   */
  async generateAIResponse(data) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    const suggestions = this.getFixSuggestions(data);
    const analysis = this.getAnalysisText(data);
    return {
      analysis,
      suggestions,
      additionalNotes: this.getAdditionalNotes(data),
      designCodeReference: this.getCodeReference(data.failureMode)
    };
  }
  /**
   * Get fix suggestions based on failure mode
   */
  getFixSuggestions(data) {
    const { failureMode, section, geometry, utilizationRatio } = data;
    switch (failureMode) {
      case "compression_buckling":
        return [
          {
            id: 1,
            title: "Increase Section Size",
            description: `Replace ${section.name} with a heavier section having larger radius of gyration.`,
            implementation: `Consider ${this.suggestLargerSection(section.name)} which has ~30% higher r_min.`,
            tradeoffs: {
              pros: ["Direct solution", "No additional connections", "Minimal design changes"],
              cons: ["Increased steel weight (~15-20%)", "Higher material cost"]
            },
            estimatedImprovement: `Reduces ratio from ${utilizationRatio.toFixed(2)} to ~${(utilizationRatio * 0.75).toFixed(2)}`,
            priority: "high"
          },
          {
            id: 2,
            title: "Add Intermediate Bracing",
            description: "Install lateral bracing at mid-height to reduce effective length.",
            implementation: `Add horizontal bracing member at L/2 = ${(geometry.length / 2).toFixed(2)}m from base.`,
            tradeoffs: {
              pros: ["Retains current section", "Reduces KL by 50%", "Cost-effective"],
              cons: ["Requires additional connections", "May affect architectural clearances", "More fabrication work"]
            },
            estimatedImprovement: `Reduces ratio from ${utilizationRatio.toFixed(2)} to ~${(utilizationRatio * 0.65).toFixed(2)}`,
            priority: "high"
          },
          {
            id: 3,
            title: "Change End Conditions",
            description: "Increase fixity at column ends to reduce effective length factor K.",
            implementation: "Design moment connections at base plate or add stiffeners to beam-column joint.",
            tradeoffs: {
              pros: ["No section change needed", "May solve foundation issues"],
              cons: ["Complex detailing", "Higher connection costs", "May affect adjacent members"]
            },
            estimatedImprovement: `Reduces ratio from ${utilizationRatio.toFixed(2)} to ~${(utilizationRatio * 0.85).toFixed(2)}`,
            priority: "medium"
          }
        ];
      case "lateral_torsional_buckling":
        return [
          {
            id: 1,
            title: "Reduce Unbraced Length",
            description: "Add lateral bracing to the compression flange.",
            implementation: `Install fly bracing at ${(geometry.unsupportedLength / 2).toFixed(2)}m intervals.`,
            tradeoffs: {
              pros: ["Most effective for LTB", "Minimal weight increase", "Uses existing section"],
              cons: ["Requires secondary members", "Additional connections"]
            },
            estimatedImprovement: `Reduces ratio to ~${(utilizationRatio * 0.6).toFixed(2)}`,
            priority: "high"
          },
          {
            id: 2,
            title: "Use Section with Wider Flanges",
            description: "Replace with W-section having higher lateral stiffness.",
            implementation: `Consider ${this.suggestWiderFlangeSection(section.name)} with ~40% wider flanges.`,
            tradeoffs: {
              pros: ["Improves lateral stability significantly", "No additional members needed"],
              cons: ["May increase weight", "Connection modifications may be needed"]
            },
            estimatedImprovement: `Reduces ratio to ~${(utilizationRatio * 0.7).toFixed(2)}`,
            priority: "medium"
          },
          {
            id: 3,
            title: "Add Cover Plates",
            description: "Weld cover plates to top and bottom flanges.",
            implementation: `Add 200mm x 12mm cover plates to both flanges over critical zone.`,
            tradeoffs: {
              pros: ["Retrofit-friendly", "Targeted strengthening"],
              cons: ["Additional welding", "Appearance impact", "More inspection required"]
            },
            estimatedImprovement: `Reduces ratio to ~${(utilizationRatio * 0.8).toFixed(2)}`,
            priority: "low"
          }
        ];
      case "shear_failure":
        return [
          {
            id: 1,
            title: "Add Web Doubler Plates",
            description: "Strengthen web by welding additional plates.",
            implementation: `Weld ${section.webThickness}mm thick doubler plates over critical shear zones.`,
            tradeoffs: {
              pros: ["Direct shear capacity increase", "Retrofit-friendly"],
              cons: ["Additional welding required", "Inspection access needed"]
            },
            estimatedImprovement: `Doubles shear capacity, ratio ~${(utilizationRatio * 0.5).toFixed(2)}`,
            priority: "high"
          },
          {
            id: 2,
            title: "Change to Deeper Section",
            description: "Use deeper beam with thicker web.",
            implementation: `Consider ${this.suggestDeeperSection(section.name)} with 25% deeper web.`,
            tradeoffs: {
              pros: ["Also improves flexural capacity", "Single solution for multiple issues"],
              cons: ["May require raised floor levels", "Connection modifications"]
            },
            estimatedImprovement: `Reduces ratio to ~${(utilizationRatio * 0.65).toFixed(2)}`,
            priority: "medium"
          },
          {
            id: 3,
            title: "Add Stiffener Plates",
            description: "Install bearing stiffeners at concentrated load points.",
            implementation: "Add full-height stiffeners at support and load application points.",
            tradeoffs: {
              pros: ["Prevents web crippling", "Localized solution"],
              cons: ["Does not increase direct shear capacity", "Fabrication complexity"]
            },
            estimatedImprovement: `Reduces ratio to ~${(utilizationRatio * 0.85).toFixed(2)}`,
            priority: "low"
          }
        ];
      default:
        return [
          {
            id: 1,
            title: "Increase Section Size",
            description: `Replace ${section.name} with a larger section.`,
            implementation: `Consider upgrading to ${this.suggestLargerSection(section.name)}.`,
            tradeoffs: {
              pros: ["Simple solution", "Comprehensive capacity increase"],
              cons: ["Weight increase", "Higher cost"]
            },
            estimatedImprovement: `Reduces ratio by ~25%`,
            priority: "high"
          },
          {
            id: 2,
            title: "Review Load Path",
            description: "Check if loads can be redistributed to adjacent members.",
            implementation: "Add secondary members or modify framing layout.",
            tradeoffs: {
              pros: ["May solve systemic issues", "Reduces concentration"],
              cons: ["Requires analysis review", "May affect multiple members"]
            },
            estimatedImprovement: "Varies based on layout",
            priority: "medium"
          },
          {
            id: 3,
            title: "Optimize Load Combinations",
            description: "Review if load factors are conservative.",
            implementation: "Check load values and verify combination factors per code.",
            tradeoffs: {
              pros: ["No physical changes needed", "May reveal over-conservatism"],
              cons: ["Limited improvement potential", "Requires client approval"]
            },
            estimatedImprovement: "Depends on load review",
            priority: "low"
          }
        ];
    }
  }
  /**
   * Get analysis text based on failure mode
   */
  getAnalysisText(data) {
    const { failureMode, utilizationRatio, section, geometry } = data;
    const slenderness = geometry.effectiveLength * 1e3 / section.radiusOfGyration;
    switch (failureMode) {
      case "compression_buckling":
        return `**Analysis Summary:**
                
The ${data.memberType} ${data.memberId} is failing in **Compression Buckling** with a utilization ratio of ${utilizationRatio.toFixed(2)}.

**Root Cause:** The effective slenderness ratio (KL/r = ${slenderness.toFixed(0)}) exceeds the optimal range for the current section ${section.name}.

**Key Observations:**
- The current section has inadequate radius of gyration for the given unbraced length
- The effective length factor K appears to be ${(geometry.effectiveLength / geometry.length).toFixed(2)} based on end conditions
- Buckling is likely occurring about the weak axis

**Recommendation:** Focus on reducing effective slenderness through bracing or section upgrade.`;
      case "lateral_torsional_buckling":
        return `**Analysis Summary:**

The beam ${data.memberId} is failing in **Lateral Torsional Buckling** with a ratio of ${utilizationRatio.toFixed(2)}.

**Root Cause:** The compression flange is unbraced over ${geometry.unsupportedLength.toFixed(2)}m which exceeds the plastic development length.

**Key Observations:**
- Section ${section.name} has a flange width of ${section.flangeWidth}mm - may be too narrow
- Unbraced length allows lateral movement before full plastic capacity develops
- The beam is likely twisting about its longitudinal axis

**Recommendation:** Provide lateral restraint to the compression flange or use a stockier section.`;
      default:
        return `**Analysis Summary:**

Member ${data.memberId} is overstressed with a utilization ratio of ${utilizationRatio.toFixed(2)}.

The primary failure mode is ${this.getFailureModeDescription(failureMode)} which indicates the capacity is insufficient for the applied loading.

Review the suggestions below for practical fixing options.`;
    }
  }
  /**
   * Get failure mode description
   */
  getFailureModeDescription(mode) {
    const descriptions = {
      compression_buckling: "Compression Buckling (Euler/Inelastic)",
      lateral_torsional_buckling: "Lateral Torsional Buckling (LTB)",
      tension_yielding: "Tension Yielding at Gross Section",
      shear_failure: "Shear Capacity Exceeded",
      combined_stress: "Combined Axial + Bending Interaction",
      deflection_exceeded: "Serviceability - Deflection Limit Exceeded",
      slenderness_exceeded: "Slenderness Ratio Exceeded Code Limit"
    };
    return descriptions[mode] || mode;
  }
  /**
   * Suggest a larger section based on current section
   */
  suggestLargerSection(current) {
    const upgrades = {
      "W12x26": "W14x30 or W12x35",
      "W14x30": "W14x38 or W16x36",
      "W16x36": "W18x40 or W16x45",
      "ISMB 200": "ISMB 250 or ISWB 200",
      "ISMB 250": "ISMB 300 or ISWB 250",
      "ISMB 300": "ISMB 350 or ISWB 300",
      "ISMB 350": "ISMB 400 or ISWB 350"
    };
    return upgrades[current] || `a section ~20% heavier than ${current}`;
  }
  /**
   * Suggest section with wider flanges
   */
  suggestWiderFlangeSection(current) {
    const upgrades = {
      "W12x26": "W10x33 (wider flanges)",
      "W14x30": "W12x40 (wider flanges)",
      "ISMB 300": "ISHB 300 (wider flanges)",
      "ISMB 350": "ISHB 350 (wider flanges)"
    };
    return upgrades[current] || `an equivalent W-shape with wider flanges`;
  }
  /**
   * Suggest deeper section
   */
  suggestDeeperSection(current) {
    const upgrades = {
      "W12x26": "W14x26",
      "W14x30": "W16x31",
      "W16x36": "W18x35",
      "ISMB 250": "ISMB 300",
      "ISMB 300": "ISMB 350"
    };
    return upgrades[current] || `a deeper section in the same weight class`;
  }
  /**
   * Get additional notes
   */
  getAdditionalNotes(data) {
    const notes = [];
    if (data.utilizationRatio > 1.5) {
      notes.push("\u26A0\uFE0F **Critical:** Ratio > 1.5 indicates significant under-design. Consider combining multiple fixes.");
    }
    if (data.geometry.length > 8) {
      notes.push("\u{1F4CF} Long member: Check lateral bracing requirements carefully.");
    }
    if (data.loading.axialForce > 0 && data.loading.bendingMoment > 0) {
      notes.push("\u{1F504} Combined loading: Ensure interaction equation (H1) compliance after fixes.");
    }
    return notes.length > 0 ? notes.join("\n\n") : "No additional concerns identified.";
  }
  /**
   * Get code reference for failure mode
   */
  getCodeReference(mode) {
    const references = {
      compression_buckling: "IS 800:2007 Clause 7.1.2, AISC 360 Chapter E",
      lateral_torsional_buckling: "IS 800:2007 Clause 8.2.2, AISC 360 Chapter F",
      tension_yielding: "IS 800:2007 Clause 6.2, AISC 360 Chapter D",
      shear_failure: "IS 800:2007 Clause 8.4, AISC 360 Chapter G",
      combined_stress: "IS 800:2007 Clause 9.3, AISC 360 Chapter H",
      deflection_exceeded: "IS 800:2007 Clause 5.6, AISC 360 Appendix 3",
      slenderness_exceeded: "IS 800:2007 Clause 3.8, AISC 360 various"
    };
    return references[mode] || "Refer to applicable design code";
  }
  /**
   * Generate unique ID
   */
  generateId() {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  /**
   * Get conversation history
   */
  getHistory() {
    return [...this.conversationHistory];
  }
  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }
  /**
   * Get system prompt for the current design code
   */
  getSystemPrompt() {
    return SYSTEM_PROMPTS[this.designCode];
  }
  /**
   * Set design code
   */
  setDesignCode(code) {
    this.designCode = code;
  }
}
const engineeringCopilot = new EngineeringCopilotService("is800");
var EngineeringCopilotService_default = EngineeringCopilotService;
export {
  EngineeringCopilotService,
  EngineeringCopilotService_default as default,
  engineeringCopilot
};
//# sourceMappingURL=EngineeringCopilotService.js.map
