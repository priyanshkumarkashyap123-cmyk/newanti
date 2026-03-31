import type { AIModelContext, AIAction, AIPlan } from './types.ts';

type ModelNode = AIModelContext['nodes'][number];
type ModelLoad = AIModelContext['loads'][number];

export const SYSTEM_PROMPT = `You are BeamLab AI, a world-class structural engineering assistant powered by comprehensive engineering knowledge.

## STRUCTURAL ENGINEERING KNOWLEDGE BASE

### FUNDAMENTAL CONCEPTS

#### Bending Moment
- Internal moment causing beam to bend under load
- Simply Supported: M_max = wL²/8 (UDL), M_max = PL/4 (point at center)
- Cantilever: M_max = wL²/2 (UDL), M_max = PL (point at end)
- Fixed-Fixed: M_support = wL²/12, M_midspan = wL²/24 (UDL)
- Sign: Positive = sagging (tension bottom), Negative = hogging (tension top)
- Design: M ≤ φMn where φ = 0.9 (AISC), γm0 = 1.1 (IS 800)

#### Shear Force
- Internal force parallel to cross-section
- τ = VQ/(Ib) - Shear stress formula
- For I-beams: τ_avg ≈ V/(d × tw)
- Max shear at supports for simply supported beams
- Design: V ≤ φVn = Av × fy/(√3 × γm0)

#### Moment of Inertia (Second Moment of Area)
- I = ∫y²dA - Resistance to bending
- Rectangle: I = bh³/12
- Circle: I = πd⁴/64
- I-section: Use tables (ISMB, W-shapes)
- Parallel Axis: I = Ic + Ad²
- Higher I = less deflection, more capacity

#### Deflection
- Simply Supported UDL: δ = 5wL⁴/(384EI)
- Simply Supported Point: δ = PL³/(48EI)
- Cantilever UDL: δ = wL⁴/(8EI)
- Cantilever Point: δ = PL³/(3EI)
- Limits: L/360 (floors), L/240 (total), L/180 (cantilevers)

#### Buckling & Stability
- Euler: Pcr = π²EI/(KL)²
- K-factors: Fixed-Fixed=0.5, Fixed-Pinned=0.7, Pinned-Pinned=1.0, Fixed-Free=2.0
- Slenderness: λ = KL/r where r = √(I/A)
- Limits: λ ≤ 180 (compression), λ ≤ 400 (tension)

#### P-Delta Effects
- Second-order effects from axial load on displaced geometry
- B2 = 1/(1 - ΣPu/ΣPe) - Story amplifier
- Required when B2 > 1.1 or drift > 1.5%
- Can increase moments by 10-30% in tall buildings

### STRUCTURAL SYSTEMS

#### Portal Frames
- Single-story industrial buildings, 12-60m spans
- Fixed or pinned bases, moment connections at eaves
- Typical height: 6-12m, roof pitch: 5-10°
- Sections: ISMB 400-600 columns, ISMB 450-600 rafters

#### Trusses
- Warren: No verticals, equilateral triangles, efficient for uniform loads
- Pratt: Verticals in compression, diagonals in tension (good for steel)
- Howe: Verticals in tension, diagonals in compression (good for timber)
- K-Truss: Reduced diagonal buckling length, for long spans
- Depth: Span/8 to Span/10, panels: span/2 to span/3

### SUPPORT CONDITIONS

| Support | Translation | Rotation | Reactions | Use Case |
|---------|-------------|----------|-----------|----------|
| Fixed | No | No | Fx, Fy, M | Strong foundation, cantilevers |
| Pinned | No | Yes | Fx, Fy | Simple connections, truss joints |
| Roller | One direction | Yes | F⊥ | Bridge ends, thermal expansion |

### LOADS (IS 875)

#### Dead Loads
- Concrete: 25 kN/m³
- Steel: 78.5 kN/m³
- Floor finish: 1-1.5 kN/m²
- Partitions: 1.0-1.5 kN/m²

#### Live Loads
- Residential: 2.0 kN/m²
- Office: 2.5 kN/m²
- Retail/Assembly: 4.0 kN/m²
- Industrial: 5-10 kN/m²
- Storage: 12-24 kN/m²

#### Load Combinations (IS 875)
- 1.5 DL + 1.5 LL
- 1.2 DL + 1.2 LL + 1.2 WL/EQ
- 0.9 DL + 1.5 WL/EQ (uplift)

### DESIGN CODES

#### IS 800:2007 (Steel)
- γm0 = 1.10 (yielding), γm1 = 1.25 (ultimate)
- Deflection: L/300 (gravity), L/250 (total)
- fy = 250 MPa (E250), 350 MPa (E350)

#### IS 1893:2016 (Seismic)
- Zone factors: II=0.10, III=0.16, IV=0.24, V=0.36
- R-factors: OMRF=3, SMRF=5, Braced=4
- Base shear: VB = (Z/2)(I/R)(Sa/g)W
- Drift limit: 0.004h

### BEST PRACTICES

1. Always ensure statically stable structures (supports restraining all DOF)
2. Check load path continuity from roof to foundation
3. Verify slenderness limits for all members
4. Consider serviceability (deflection, vibration) not just strength
5. Include bracing for lateral stability
6. Use appropriate connection types (moment vs shear)
7. Consider P-Delta for structures > 4 stories
8. Check natural frequency > 3 Hz for floors (footfall vibration)
`;

export const ENGINEERING_KNOWLEDGE_CONTEXT = `
## STRUCTURAL ENGINEERING KNOWLEDGE BASE

### BENDING MOMENT
- Internal moment causing beam to bend under load
- Simply Supported: M_max = wL²/8 (UDL), M_max = PL/4 (point at center)
- Cantilever: M_max = wL²/2 (UDL), M_max = PL (point at end)
- Fixed-Fixed: M_support = wL²/12, M_midspan = wL²/24 (UDL)
- Sign: Positive = sagging (tension bottom), Negative = hogging (tension top)

### SHEAR FORCE
- Internal force parallel to cross-section
- τ = VQ/(Ib) - Shear stress formula
- For I-beams: τ_avg ≈ V/(d × tw)

### DEFLECTION
- Simply Supported UDL: δ = 5wL⁴/(384EI)
- Simply Supported Point: δ = PL³/(48EI)
- Cantilever UDL: δ = wL⁴/(8EI)

### BUCKLING
- Euler: Pcr = π²EI/(KL)²
- Slenderness: λ = KL/r

### LOADS (IS 875)
- Dead loads, live loads, wind, seismic
- 1.5 DL + 1.5 LL
- 0.9 DL + 1.5 WL/EQ
`;

export const CONVERSATIONAL_PROMPTS = {
  greeting: `The user is greeting you or making casual conversation. Respond warmly and ask how you can help with their structural engineering project.`,
  unclear: `The user's request is unclear. Ask a friendly clarifying question to better understand what they need help with.`,
  problemSolving: (problem: string, context: AIModelContext) => `
The user is experiencing an issue: "${problem}"

Current model state:
- Nodes: ${context.nodes.length}
- Members: ${context.members.length}
- Loads: ${context.loads.length}
- Has supports: ${context.nodes.filter((n: ModelNode) => n.hasSupport).length > 0}

Analyze this problem and provide:
1. Root cause identification
2. Clear explanation of why this is happening
3. Step-by-step solution
4. Tips to prevent this in the future

Be empathetic and helpful in your response.`,
  modelReview: (context: AIModelContext) => `
Review the user's current structural model for potential issues:

Model:
- Nodes: ${JSON.stringify(context.nodes.slice(0, 10))}${context.nodes.length > 10 ? '...' : ''}
- Members: ${JSON.stringify(context.members.slice(0, 10))}${context.members.length > 10 ? '...' : ''}
- Loads: ${JSON.stringify(context.loads.slice(0, 5))}

Check for:
1. Stability issues (missing supports, mechanism)
2. Load path problems
3. Unrealistic geometry
4. Missing loads
5. Unusual member sizes

If you find issues, explain them clearly and suggest fixes. If the model looks good, say so!`,
};

export const TASK_PROMPTS = {
  createStructure: (description: string, context: AIModelContext) => `
User wants to create: "${description}"

Current model has:
- ${context.nodes.length} nodes
- ${context.members.length} members
- ${context.loads.length} loads

Generate a detailed action plan to create this structure. Consider:
1. Appropriate geometry based on typical spans and heights
2. Support conditions (fixed, pinned, roller)
3. Standard steel sections (ISMB, ISMC, ISA)
4. Self-weight and typical live loads

First, briefly explain what you'll create and why this design is appropriate.
Then provide a JSON action plan.`,
  analyzeResults: (context: AIModelContext) => `
Analyze the current structural model and its results:

Model summary:
- Nodes: ${context.nodes.length}
- Members: ${context.members.length}
- Loads applied: ${context.loads.length}

${context.analysisResults ? `
Analysis results:
- Max displacement: ${context.analysisResults.maxDisplacement.toFixed(3)} mm
- Max stress: ${context.analysisResults.maxStress.toFixed(1)} MPa
- Max moment: ${context.analysisResults.maxMoment.toFixed(1)} kN·m
` : 'No analysis results available yet.'}

Provide:
1. Assessment of structural adequacy
2. Potential concerns or warnings
3. Recommendations for improvement`,
  optimizeDesign: (goal: string, context: AIModelContext) => `
Optimize the current structure for: "${goal}"

Current model:
- Nodes: ${context.nodes.length}
- Members: ${context.members.length}

Suggest optimization steps:
1. Member sizing adjustments
2. Geometry modifications
3. Support condition changes

Provide specific recommendations with reasoning.`,
  explainConcept: (topic: string) => `
You are a structural engineering expert. Explain the following concept: "${topic}"

Use the ENGINEERING_KNOWLEDGE_CONTEXT provided in your system prompt to give accurate, code-referenced explanations.

Provide a comprehensive explanation that includes:

1. **Definition**: Clear, simple explanation that even a student can understand
2. **Physical Understanding**: What's actually happening physically/mechanically
3. **Key Formulas**: Include the mathematical formulas with variable definitions
4. **Code References**: Relevant IS, AISC, or Eurocode provisions
5. **Practical Example**: A real-world application with numbers
6. **Design Implications**: How this affects design decisions
7. **Common Mistakes**: Errors to avoid in practice

Format your response with clear headings and bullet points.
Be conversational but technically accurate.
Include specific values from Indian Standards (IS codes) when applicable.`,
  troubleshoot: (issue: string, context: AIModelContext) => `
The user is experiencing an issue: "${issue}"

Current model state:
- Nodes: ${context.nodes.length}
- Members: ${context.members.length}
- Loads: ${context.loads.length}
- Has been analyzed: ${context.analysisResults ? 'Yes' : 'No'}

Common structural engineering problems to check:
1. Unstable structure (not enough supports)
2. Missing load path
3. Overstressed members
4. Excessive deflection
5. Buckling concerns
6. Improper load combinations

Diagnose the problem and provide:
1. **Root Cause**: What's causing the issue
2. **Technical Explanation**: Why this happens
3. **Step-by-Step Solution**: How to fix it
4. **Prevention**: How to avoid this in future`,
  createSpecificStructure: (structureType: string, params: string) => `
Create a ${structureType} structure with these specifications: ${params}

Use the ENGINEERING_KNOWLEDGE_CONTEXT to determine appropriate:
- Member sections (ISMB, ISMC, ISA)
- Support conditions
- Node spacing and geometry
- Load magnitudes

Output a detailed JSON action plan:
\`\`\`json
{
  "goal": "Create ${structureType}",
  "specifications": {...},
  "reasoning": "Engineering justification using code provisions",
  "steps": [
    {"type": "addNode", "params": {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "fixed"}, "description": "..."},
    {"type": "addMember", "params": {"start": "N1", "end": "N2", "section": "ISMB 400"}, "description": "..."},
    {"type": "addLoad", "params": {...}, "description": "..."}
  ],
  "designChecks": ["List of checks to perform after creation"],
  "confidence": 0.95
}
\`\`\``,
};

export function formatForExpertMode(response: string, mode: 'assistant' | 'expert' | 'mentor'): string {
  switch (mode) {
    case 'expert':
      return extractKeyPoints(response);
    case 'mentor':
      return response + addMentorNotes(response);
    default:
      return response;
  }
}

export function buildEnrichedContext(modelContext: AIModelContext): string {
  let context = '';

  if (modelContext.nodes.length > 0) {
    const xCoords = modelContext.nodes.map((n: ModelNode) => n.x);
    const yCoords = modelContext.nodes.map((n: ModelNode) => n.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    context += `CURRENT MODEL GEOMETRY:\n`;
    context += `- Bounding box: X[${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y[${minY.toFixed(1)}, ${maxY.toFixed(1)}]\n`;
    context += `- ${modelContext.nodes.length} nodes, ${modelContext.nodes.filter((n: ModelNode) => n.hasSupport).length} supported\n`;
    context += `- ${modelContext.members.length} members\n`;
  }

  if (modelContext.loads.length > 0) {
    const totalVertical = modelContext.loads.reduce((sum: number, l: ModelLoad) => sum + (l.fy || 0), 0);
    const totalHorizontal = modelContext.loads.reduce((sum: number, l: ModelLoad) => sum + (l.fx || 0), 0);
    context += `LOAD SUMMARY:\n`;
    context += `- Total vertical: ${totalVertical.toFixed(1)} kN\n`;
    context += `- Total horizontal: ${totalHorizontal.toFixed(1)} kN\n`;
    context += `- Applied to ${modelContext.loads.length} locations\n`;
  }

  if (modelContext.analysisResults) {
    context += `ANALYSIS RESULTS:\n`;
    context += `- Max displacement: ${modelContext.analysisResults.maxDisplacement.toFixed(3)} mm\n`;
    context += `- Max stress: ${modelContext.analysisResults.maxStress.toFixed(1)} MPa\n`;
    context += `- Max moment: ${modelContext.analysisResults.maxMoment.toFixed(1)} kN·m\n`;
  }

  return context;
}

export function buildMultiTurnPrompt(query: string, modelContext: AIModelContext, conversationHistory: { role: 'user' | 'assistant'; content: string }[], reasoningContext: string[], taskMemory: Map<string, any>): string {
  const recentConversation = conversationHistory.slice(-6)
    .map((c) => `${c.role === 'user' ? 'User' : 'Gemini'}: ${c.content.substring(0, 150)}`)
    .join('\n');

  const enrichedContext = buildEnrichedContext(modelContext);

  return `CONVERSATION HISTORY:\n${recentConversation || 'Starting new conversation'}\n\nENRICHED MODEL CONTEXT:\n${enrichedContext || 'No model loaded'}\n\nSYSTEM REASONING:\n- Previous response style: ${reasoningContext.slice(-1)[0] || 'Initial conversation'}\n- Task memory: ${Array.from(taskMemory.keys()).join(', ') || 'None'}\n\nUSER REQUEST:\n${query}\n\nINSTRUCTIONS:\n1. Use the context above to provide informed responses\n2. Reference previous discussions when relevant\n3. Consider the model state and recent tasks\n4. Build on previous understanding\n5. Provide specific, actionable guidance`;
}

export function parseAIPlan(aiResponse: string): AIPlan | null {
  const start = aiResponse.indexOf('{');
  const end = aiResponse.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed = JSON.parse(aiResponse.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object') return null;

    const steps = Array.isArray(parsed.steps) ? parsed.steps : [];
    return {
      goal: String(parsed.goal || ''),
      reasoning: String(parsed.reasoning || ''),
      steps: steps as AIAction[],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0,
      alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.map(String) : undefined,
    };
  } catch {
    return null;
  }
}

export function formatPlanResponse(plan: AIPlan): string {
  const stepsText = plan.steps.map((step: AIAction, index: number) => `${index + 1}. ${step.description}`).join('\n');
  return `**Goal:** ${plan.goal}\n\n**Reasoning:** ${plan.reasoning}\n\n**Steps:**\n${stepsText}\n\n**Confidence:** ${(plan.confidence * 100).toFixed(0)}%`;
}

export function extractKeyPoints(response: string): string {
  const lines = response.split('\n');
  const keyLines = lines.filter(line =>
    line.trim().startsWith('-') ||
    line.trim().startsWith('•') ||
    line.includes('=') ||
    /^\d+\./.test(line.trim()) ||
    line.includes('kN') ||
    line.includes('MPa') ||
    line.includes('mm')
  );
  return keyLines.length > 0 ? keyLines.join('\n') : response.substring(0, 500);
}

export function addMentorNotes(response: string): string {
  const notes: string[] = [];

  if (/bending|moment/i.test(response)) {
    notes.push('\n\n💡 **Learning Note:** Bending moment is the internal reaction of a beam to an applied load. Study IS 800 Clause 8 for detailed design procedures.');
  }
  if (/buckling/i.test(response)) {
    notes.push('\n\n💡 **Learning Note:** Buckling is a stability failure mode. Review Euler\'s formula and IS 800 Section 9 for compression member design.');
  }
  if (/seismic|earthquake/i.test(response)) {
    notes.push('\n\n💡 **Learning Note:** Seismic design requires understanding IS 1893 response spectrum method. Consider reviewing the zone factors and R values.');
  }

  return notes.join('');
}

export function extractTaskPayload(response: string): { plan?: AIPlan; task?: Partial<{ goal: string; reasoning: string; steps: AIAction[]; confidence: number }> } {
  const plan = parseAIPlan(response);
  return plan ? { plan, task: plan } : {};
}
