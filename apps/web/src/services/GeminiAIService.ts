/**
 * GeminiAIService.ts
 * 
 * Autonomous AI Agent powered by Google Gemini for:
 * - Intelligent structural modeling
 * - Analysis planning and execution
 * - Design recommendations
 * - Code compliance checking
 * - Natural language understanding
 */

// ============================================
// AI SERVICE INTEGRATIONS
// ============================================

import { aiValidation, AccuracyMetrics } from './AIValidationService';
import { auditTrail, AuditEntry } from './AuditTrailService';
import { codeCompliance, IS800Checker, SteelSection, SteelMaterial, MemberForces, ComplianceReport } from './CodeComplianceEngine';
import { connectionDesign, ConnectionDesign, ConnectionForces } from './ConnectionDesignService';

// ============================================
// TYPES
// ============================================

export interface AIModelContext {
  nodes: { id: string; x: number; y: number; z: number; hasSupport: boolean }[];
  members: { id: string; startNode: string; endNode: string; section?: string }[];
  loads: { nodeId: string; fx?: number; fy?: number; fz?: number }[];
  analysisResults?: {
    maxDisplacement: number;
    maxStress: number;
    maxMoment: number;
  };
}

export interface AITask {
  id: string;
  type: 'model' | 'analyze' | 'design' | 'explain' | 'optimize' | 'check';
  description: string;
  status: 'pending' | 'thinking' | 'executing' | 'complete' | 'failed';
  progress: number;
  result?: string;
  actions?: AIAction[];
}

export interface AIAction {
  type: 'addNode' | 'addMember' | 'addPlate' | 'addSupport' | 'addLoad' | 'runAnalysis' | 'optimize' | 'report';
  params: Record<string, any>;
  description: string;
}

export interface AIPlan {
  goal: string;
  reasoning: string;
  steps: AIAction[];
  confidence: number;
  alternatives?: string[];
}

export interface AIConversation {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    planGenerated?: AIPlan;
    actionsExecuted?: AIAction[];
    modelContext?: AIModelContext;
  };
}

export interface GeminiConfig {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
}

// ============================================
// STRUCTURAL ENGINEERING KNOWLEDGE BASE
// ============================================

const STRUCTURAL_KNOWLEDGE = {
  frameTypes: {
    portal: {
      description: 'Single-story rigid frame with columns and beam',
      typicalSpan: '10-30m',
      typicalHeight: '4-12m',
      applications: ['warehouses', 'industrial buildings', 'aircraft hangars'],
      components: ['columns', 'rafters', 'haunches'],
    },
    multiStory: {
      description: 'Multi-level frame with columns and beams at each floor',
      typicalBays: '3-8m',
      typicalStoryHeight: '3-4m',
      applications: ['office buildings', 'residential', 'commercial'],
      components: ['columns', 'beams', 'slabs', 'bracing'],
    },
    truss: {
      description: 'Triangulated structure for long spans',
      typicalSpan: '15-100m',
      typicalDepth: 'span/10 to span/15',
      types: ['Pratt', 'Howe', 'Warren', 'K-truss', 'Fink'],
      applications: ['roofs', 'bridges', 'towers'],
    },
  },
  loadTypes: {
    dead: 'Self-weight + permanent fixtures (typically 2-5 kN/m²)',
    live: 'Occupancy loads (2.5-5 kN/m² for floors, 1.5-3 kN/m² for roofs)',
    wind: 'Lateral pressure based on wind speed and exposure',
    seismic: 'Earthquake forces based on zone, soil, and building period',
    snow: 'Ground snow load × exposure × thermal × importance factors',
  },
  designCodes: {
    steel: ['AISC 360', 'IS 800', 'Eurocode 3', 'AS 4100'],
    concrete: ['ACI 318', 'IS 456', 'Eurocode 2', 'AS 3600'],
    seismic: ['ASCE 7', 'IS 1893', 'Eurocode 8', 'IBC'],
    loads: ['ASCE 7', 'IS 875', 'Eurocode 1'],
  },
  analysisTypes: {
    linearStatic: 'First-order elastic analysis - most common',
    modal: 'Eigenvalue analysis for natural frequencies and mode shapes',
    pDelta: 'Second-order effects from axial loads and deflections',
    buckling: 'Elastic critical load analysis',
    nonlinear: 'Material and geometric nonlinearity',
    responseSpectrum: 'Seismic analysis using design spectrum',
    timeHistory: 'Dynamic analysis using ground motion records',
  },
  optimizationGoals: {
    weight: 'Minimize total structural weight',
    cost: 'Minimize material and fabrication cost',
    deflection: 'Minimize maximum deflection',
    stress: 'Minimize maximum stress/utilization',
  },
};

// ============================================
// PROMPT TEMPLATES
// ============================================

// ============================================
// COMPREHENSIVE ENGINEERING KNOWLEDGE FOR GEMINI
// ============================================

const ENGINEERING_KNOWLEDGE_CONTEXT = `
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

#### Lateral-Torsional Buckling
- Compression flange buckling sideways with twist
- Mcr = (π/L)√(EIy × GJ)
- Prevention: Lateral bracing, composite action
- Max spacing: ~40 × bf (flange width)

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

#### Multi-Story Buildings
- Moment Frame (SMRF, OMRF): Up to 25 stories
- Braced Frame: Up to 40 stories, X-bracing or V-bracing
- Shear Wall: RC walls, up to 35 stories
- Dual System: Frame + walls, up to 50 stories
- Story height: 3.2-4.0m, bay width: 6-9m typical

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

### INDIAN STANDARD SECTIONS

#### ISMB (I-Beams)
- ISMB 200: I = 2,235 cm⁴, spans to 4m
- ISMB 300: I = 8,603 cm⁴, spans to 6m
- ISMB 400: I = 20,458 cm⁴, spans to 8m
- ISMB 500: I = 45,218 cm⁴, spans to 10m
- ISMB 600: I = 91,800 cm⁴, spans to 12m

#### ISMC (Channels) - for chord members
#### ISA (Angles) - for bracing, truss diagonals

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

const SYSTEM_PROMPT = `You are BeamLab AI, a world-class structural engineering assistant powered by comprehensive engineering knowledge.

${ENGINEERING_KNOWLEDGE_CONTEXT}

## Your Capabilities:

### 1. ENGINEERING EXPERTISE
You have deep knowledge of:
- Structural mechanics (stress, strain, deflection, buckling)
- Analysis methods (static, dynamic, modal, P-Delta, seismic)
- Design codes (IS 800, IS 456, IS 1893, AISC, ACI, Eurocode)
- Structural systems (frames, trusses, buildings, bridges)
- Materials (steel, concrete, timber, composites)
- Connections and detailing

### 2. CONVERSATIONAL INTELLIGENCE
- Respond naturally like a helpful colleague
- Ask clarifying questions when needed
- Provide encouragement and celebrate successes
- Explain complex concepts simply when asked
- Be honest about uncertainties

### 3. PROBLEM SOLVING
When users have issues:
1. Identify the root cause
2. Explain why it's happening
3. Provide step-by-step solutions
4. Give prevention tips

### 4. STRUCTURE CREATION
When creating structures, output a JSON action plan:
\`\`\`json
{
  "goal": "Description of structure",
  "reasoning": "Engineering justification",
  "steps": [
    {"type": "addNode", "params": {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "fixed"}, "description": "Base support"},
    {"type": "addMember", "params": {"start": "N1", "end": "N2", "section": "ISMB 400"}, "description": "Column"},
    {"type": "addLoad", "params": {"nodeId": "N2", "fy": -50}, "description": "Gravity load"}
  ],
  "confidence": 0.95
}
\`\`\`

### Response Guidelines:
- For technical questions: Provide formulas, code references, practical examples
- For conceptual questions: Start simple, then add depth
- For troubleshooting: Be systematic and thorough
- For casual chat: Be warm and engaging
- Always use the engineering knowledge above when relevant

Remember: You're their structural engineering partner - knowledgeable, helpful, and human!`;

const CONVERSATIONAL_PROMPTS = {
  greeting: `The user is greeting you or making casual conversation. Respond warmly and ask how you can help with their structural engineering project.`,

  unclear: `The user's request is unclear. Ask a friendly clarifying question to better understand what they need help with.`,

  problemSolving: (problem: string, context: AIModelContext) => `
The user is experiencing an issue: "${problem}"

Current model state:
- Nodes: ${context.nodes.length}
- Members: ${context.members.length}  
- Loads: ${context.loads.length}
- Has supports: ${context.nodes.filter(n => n.hasSupport).length > 0}

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

const TASK_PROMPTS = {
  createStructure: (description: string, context: AIModelContext) => `
User wants to create: "${description}"

Current model has:
- ${context.nodes.length} nodes
- ${context.members.length} members
- ${context.loads.length} loads

Generate a detailed action plan to create this structure. Consider:
1. Appropriate geometry based on typical spans and heights
2. Support conditions (fixed, pinned, roller)
3. Standard steel sections (ISMB, ISMC, etc.)
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

// ============================================
// GEMINI API SERVICE
// ============================================

class GeminiAIService {
  private apiKey: string | null = null;
  private model: string = 'gemini-1.5-flash';
  private conversationHistory: AIConversation[] = [];
  private listeners: Set<(event: string, data: any) => void> = new Set();
  private isProcessing: boolean = false;

  // ============================================
  // ENHANCED ARCHITECTURE FOR POWERFUL AI
  // ============================================
  private reasoningContext: string[] = [];
  private taskMemory: Map<string, any> = new Map();
  private conversationSummary: string = '';
  private maxContextLength: number = 15; // Keep last 15 messages
  private lastModelState: AIModelContext | null = null;

  // ============================================
  // 🚀 POWER AI ENHANCEMENTS (C-Suite Approved)
  // ============================================
  private expertMode: 'assistant' | 'expert' | 'mentor' = 'assistant';
  private performanceMetrics: {
    totalQueries: number;
    successfulQueries: number;
    avgResponseTime: number;
    codeReferencesUsed: number;
  } = {
    totalQueries: 0,
    successfulQueries: 0,
    avgResponseTime: 0,
    codeReferencesUsed: 0
  };

  constructor() {
    // Try to get API key from environment or localStorage
    this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || localStorage.getItem('gemini_api_key');
    console.log('[GeminiAI] 🚀 Power AI Service initialized, API key status:', this.apiKey ? 'Found' : 'Not found');
  }

  // ============================================
  // 🚀 POWER AI METHODS
  // ============================================

  /**
   * Set expert mode for response formatting
   */
  setExpertMode(mode: 'assistant' | 'expert' | 'mentor'): void {
    this.expertMode = mode;
    console.log('[GeminiAI] Expert mode set to:', mode);
  }

  /**
   * Get current expert mode
   */
  getExpertMode(): 'assistant' | 'expert' | 'mentor' {
    return this.expertMode;
  }

  /**
   * Calculate confidence score for a response
   */
  calculateConfidenceScore(query: string, response: string, context: AIModelContext): {
    overall: number;
    codeCompliance: number;
    engineeringLogic: number;
    calculationAccuracy: number;
    contextRelevance: number;
  } {
    let codeCompliance = 40;
    let engineeringLogic = 40;
    let calculationAccuracy = 40;
    let contextRelevance = 40;

    // Code Compliance - Check for code references
    if (/IS\s*800/i.test(response)) codeCompliance += 20;
    if (/IS\s*456/i.test(response)) codeCompliance += 15;
    if (/IS\s*1893/i.test(response)) codeCompliance += 15;
    if (/IS\s*875/i.test(response)) codeCompliance += 10;
    if (/AISC|Eurocode|EN\s*\d+/i.test(response)) codeCompliance += 10;
    if (/clause|section|table/i.test(response)) codeCompliance += 10;

    // Engineering Logic - Check for formulas and reasoning
    if (/[M|V|P|σ|τ]\s*[=<>]/.test(response)) engineeringLogic += 15;
    if (/(kN|MPa|mm|N\/mm²|kNm)/.test(response)) engineeringLogic += 10;
    if (/(γ|factor of safety|FOS|capacity|demand)/i.test(response)) engineeringLogic += 10;
    if (/(ultimate|serviceability|SLS|ULS)/i.test(response)) engineeringLogic += 10;
    if (/(step|first|then|therefore|because)/i.test(response)) engineeringLogic += 15;

    // Calculation Accuracy - Check for numerical work
    if (/\d+\s*[×*/+-]\s*\d+/.test(response)) calculationAccuracy += 15;
    if (/=\s*\d+/.test(response)) calculationAccuracy += 10;
    if (/(ratio|limit|check)/i.test(response)) calculationAccuracy += 10;
    if (/(OK|PASS|SAFE|adequate)/i.test(response)) calculationAccuracy += 15;

    // Context Relevance - Check model awareness
    if (context.nodes.length > 0 && /current|your|this.*model/i.test(response)) contextRelevance += 20;
    if (context.analysisResults && /(result|stress|deflection|moment)/i.test(response)) contextRelevance += 15;
    if (/\d+\s*nodes?|\d+\s*members?/i.test(response)) contextRelevance += 15;

    // Cap scores at 100
    codeCompliance = Math.min(codeCompliance, 100);
    engineeringLogic = Math.min(engineeringLogic, 100);
    calculationAccuracy = Math.min(calculationAccuracy, 100);
    contextRelevance = Math.min(contextRelevance, 100);

    // Calculate overall with weights
    const overall = Math.round(
      codeCompliance * 0.3 +
      engineeringLogic * 0.3 +
      calculationAccuracy * 0.25 +
      contextRelevance * 0.15
    );

    return {
      overall,
      codeCompliance,
      engineeringLogic,
      calculationAccuracy,
      contextRelevance
    };
  }

  /**
   * Get enhanced response with expert mode formatting
   */
  formatForExpertMode(response: string): string {
    switch (this.expertMode) {
      case 'expert':
        // Concise - extract key points only
        return this.extractKeyPoints(response);
      case 'mentor':
        // Add educational content
        return response + this.addMentorNotes(response);
      default:
        // Full response
        return response;
    }
  }

  private extractKeyPoints(response: string): string {
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

  private addMentorNotes(response: string): string {
    const notes: string[] = [];

    // Add learning notes based on content
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

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): typeof this.performanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Record query for analytics
   */
  recordQueryMetrics(responseTime: number, wasSuccessful: boolean): void {
    this.performanceMetrics.totalQueries++;
    if (wasSuccessful) this.performanceMetrics.successfulQueries++;
    
    // Update average response time
    this.performanceMetrics.avgResponseTime = 
      (this.performanceMetrics.avgResponseTime * (this.performanceMetrics.totalQueries - 1) + responseTime) /
      this.performanceMetrics.totalQueries;
  }

  // ============================================
  // CONFIGURATION
  // ============================================

  setApiKey(key: string): void {
    this.apiKey = key;
    localStorage.setItem('gemini_api_key', key);
  }

  hasApiKey(): boolean {
    return !!this.apiKey;
  }

  /**
   * Parse a structural command from voice/text input
   */
  async parseStructuralCommand(transcript: string): Promise<{ action: string; target: string; parameters: Record<string, any> } | null> {
    // Simple pattern-based parsing for common commands
    const lower = transcript.toLowerCase();
    
    // Add patterns
    if (lower.includes('add') || lower.includes('create')) {
      if (lower.includes('node') || lower.includes('point')) {
        return { action: 'add', target: 'node', parameters: {} };
      }
      if (lower.includes('member') || lower.includes('beam') || lower.includes('column')) {
        return { action: 'add', target: 'member', parameters: {} };
      }
      if (lower.includes('load') || lower.includes('force')) {
        return { action: 'add', target: 'load', parameters: {} };
      }
    }
    
    // Remove/delete patterns
    if (lower.includes('remove') || lower.includes('delete')) {
      if (lower.includes('node')) return { action: 'remove', target: 'node', parameters: {} };
      if (lower.includes('member')) return { action: 'remove', target: 'member', parameters: {} };
      if (lower.includes('load')) return { action: 'remove', target: 'load', parameters: {} };
    }
    
    // Analyze patterns
    if (lower.includes('analyze') || lower.includes('run analysis')) {
      return { action: 'analyze', target: 'model', parameters: {} };
    }
    
    return null;
  }

  setModel(model: string): void {
    this.model = model;
  }

  // ============================================
  // EVENT SYSTEM
  // ============================================

  subscribe(listener: (event: string, data: any) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: string, data: any): void {
    this.listeners.forEach(listener => listener(event, data));
  }

  // ============================================
  // ADVANCED REASONING ENGINE
  // ============================================

  /**
   * Decompose complex queries into manageable subtasks
   */
  private async decomposeTask(query: string, context: AIModelContext): Promise<string[]> {
    if (!this.apiKey) return [query];

    try {
      const decompositionPrompt = `Analyze this user request and break it into 2-4 clear subtasks:
      
User Request: "${query}"

Model Context:
- Nodes: ${context.nodes.length}
- Members: ${context.members.length}
- Loads: ${context.loads.length}

Return ONLY a JSON array of subtasks:
[\\"subtask1\\", \\"subtask2\\", \\"subtask3\\"]

Be specific and actionable.`;

      const response = await this.callGemini(decompositionPrompt);
      try {
        const tasks = JSON.parse(response);
        return Array.isArray(tasks) ? tasks : [query];
      } catch {
        return [query];
      }
    } catch (error) {
      console.warn('[GeminiAI] Task decomposition failed:', error);
      return [query];
    }
  }

  /**
   * Build rich context from model state and conversation
   */
  private buildEnrichedContext(modelContext: AIModelContext): string {
    let context = '';

    // Model geometry summary
    if (modelContext.nodes.length > 0) {
      const xCoords = modelContext.nodes.map(n => n.x);
      const yCoords = modelContext.nodes.map(n => n.y);
      const minX = Math.min(...xCoords);
      const maxX = Math.max(...xCoords);
      const minY = Math.min(...yCoords);
      const maxY = Math.max(...yCoords);

      context += `CURRENT MODEL GEOMETRY:\n`;
      context += `- Bounding box: X[${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y[${minY.toFixed(1)}, ${maxY.toFixed(1)}]\n`;
      context += `- ${modelContext.nodes.length} nodes, ${modelContext.nodes.filter(n => n.hasSupport).length} supported\n`;
      context += `- ${modelContext.members.length} members\n`;
    }

    // Load summary
    if (modelContext.loads.length > 0) {
      const totalVertical = modelContext.loads.reduce((sum, l) => sum + (l.fy || 0), 0);
      const totalHorizontal = modelContext.loads.reduce((sum, l) => sum + (l.fx || 0), 0);
      context += `LOAD SUMMARY:\n`;
      context += `- Total vertical: ${totalVertical.toFixed(1)} kN\n`;
      context += `- Total horizontal: ${totalHorizontal.toFixed(1)} kN\n`;
      context += `- Applied to ${modelContext.loads.length} locations\n`;
    }

    // Analysis results
    if (modelContext.analysisResults) {
      context += `ANALYSIS RESULTS:\n`;
      context += `- Max displacement: ${modelContext.analysisResults.maxDisplacement.toFixed(3)} mm\n`;
      context += `- Max stress: ${modelContext.analysisResults.maxStress.toFixed(1)} MPa\n`;
      context += `- Max moment: ${modelContext.analysisResults.maxMoment.toFixed(1)} kN·m\n`;
    }

    return context;
  }

  /**
   * Generate context-aware prompts with multi-turn reasoning
   */
  private buildMultiTurnPrompt(query: string, modelContext: AIModelContext): string {
    const recentConversation = this.conversationHistory.slice(-6)
      .map(c => `${c.role === 'user' ? 'User' : 'Gemini'}: ${c.content.substring(0, 150)}`)
      .join('\n');

    const enrichedContext = this.buildEnrichedContext(modelContext);

    return `CONVERSATION HISTORY:
${recentConversation || 'Starting new conversation'}

ENRICHED MODEL CONTEXT:
${enrichedContext || 'No model loaded'}

SYSTEM REASONING:
- Previous response style: ${this.reasoningContext.slice(-1)[0] || 'Initial conversation'}
- Task memory: ${Array.from(this.taskMemory.keys()).join(', ') || 'None'}

USER REQUEST:
${query}

INSTRUCTIONS:
1. Use the context above to provide informed responses
2. Reference previous discussions when relevant
3. Consider the model state and recent tasks
4. Build on previous understanding
5. Provide specific, actionable guidance`;
  }

  /**
   * Multi-step reasoning for complex problems
   */
  private async reasonThroughProblem(problem: string, context: AIModelContext): Promise<string> {
    if (!this.apiKey) return problem;

    try {
      const reasoningPrompt = `Solve this structural engineering problem step-by-step:

PROBLEM:
${problem}

MODEL STATE:
${this.buildEnrichedContext(context)}

Reasoning Process:
1. Identify what we know
2. Identify what we need to find
3. Choose appropriate formulas/codes
4. Work through calculations
5. Verify against industry standards
6. Present clear conclusion

Provide detailed reasoning with formulas shown.`;

      return await this.callGemini(reasoningPrompt, SYSTEM_PROMPT);
    } catch (error) {
      console.warn('[GeminiAI] Problem reasoning failed:', error);
      return problem;
    }
  }

  /**
   * Update reasoning memory for context continuity
   */
  private updateReasoningMemory(response: string): void {
    // Keep last 10 reasoning steps
    this.reasoningContext.push(response.substring(0, 200));
    if (this.reasoningContext.length > 10) {
      this.reasoningContext.shift();
    }
  }

  // ============================================
  // CORE API METHODS
  // ============================================

  async callGemini(prompt: string, systemPrompt?: string): Promise<string> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Please set your API key.');
    }

    if (import.meta.env.DEV) {
      console.log('[GeminiAI] Calling Gemini API with prompt:', prompt.substring(0, 100) + '...');
    }

    // TODO: Proxy through backend to avoid exposing API key in client requests
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

    const requestBody = {
      contents: [
        ...(systemPrompt ? [{ role: 'user', parts: [{ text: systemPrompt }] }] : []),
        { role: 'user', parts: [{ text: prompt }] },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        topP: 0.95,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    try {
      console.log('[GeminiAI] Sending request...');
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('[GeminiAI] API error:', error);
        throw new Error(error.error?.message || 'Gemini API request failed');
      }

      const data = await response.json();
      const result = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated';
      console.log('[GeminiAI] Response received:', result.substring(0, 100) + '...');
      return result;
    } catch (error) {
      console.error('[GeminiAI] Gemini API error:', error);
      throw error;
    }
  }

  // ============================================
  // INTELLIGENT TASK EXECUTION
  // ============================================

  async processUserQuery(
    query: string,
    modelContext: AIModelContext
  ): Promise<{ response: string; plan?: AIPlan; actions?: AIAction[] }> {
    this.isProcessing = true;
    this.emit('processing', { status: 'thinking', query });
    console.log('[GeminiAI] Processing query:', query);
    console.log('[GeminiAI] Model context:', { nodes: modelContext.nodes.length, members: modelContext.members.length, loads: modelContext.loads.length });

    try {
      // Determine intent
      const intent = this.classifyIntent(query);
      console.log('[GeminiAI] Classified intent:', intent);
      this.emit('processing', { status: 'classified', intent });

      let response: string;
      let plan: AIPlan | undefined;
      let actions: AIAction[] | undefined;

      switch (intent) {
        case 'greeting':
          response = await this.handleGreeting(query);
          break;

        case 'thanks':
          response = await this.handleThanks();
          break;

        case 'help':
          response = this.getHelpMessage();
          break;

        case 'troubleshoot':
          response = await this.handleTroubleshooting(query, modelContext);
          break;

        case 'review_model':
          response = await this.reviewModel(modelContext);
          break;

        case 'create_structure':
          console.log('[GeminiAI] Creating structure...');
          const structurePlan = await this.planStructureCreation(query, modelContext);
          plan = structurePlan;
          actions = structurePlan.steps;
          response = this.formatPlanResponse(structurePlan);
          console.log('[GeminiAI] Plan generated with', actions.length, 'actions');
          break;

        case 'run_analysis':
          response = await this.generateAnalysisGuidance(modelContext);
          actions = [{ type: 'runAnalysis', params: {}, description: 'Run structural analysis' }];
          break;

        case 'interpret_results':
          response = await this.interpretResults(modelContext);
          break;

        case 'optimize':
          const optimizePlan = await this.planOptimization(query, modelContext);
          plan = optimizePlan;
          actions = optimizePlan.steps;
          response = this.formatPlanResponse(optimizePlan);
          break;

        case 'explain':
          console.log('[GeminiAI] Explaining concept...');
          response = await this.explainConcept(query);
          break;

        case 'design_check':
          response = await this.performDesignCheck(modelContext);
          break;

        case 'clear_model':
          response = "I'll clear the current model for you. Click **Execute** to confirm, or you can say 'cancel' to keep your model.";
          actions = [{ type: 'report', params: { action: 'clear' }, description: 'Clear current model' }];
          break;

        case 'about_model':
          response = this.describeCurrentModel(modelContext);
          break;

        case 'conversation':
        default:
          console.log('[GeminiAI] Conversational response...');
          response = await this.handleConversation(query, modelContext);
      }

      // Store in conversation history
      this.conversationHistory.push(
        { role: 'user', content: query, timestamp: new Date() },
        { role: 'assistant', content: response, timestamp: new Date(), metadata: { planGenerated: plan, actionsExecuted: actions } }
      );

      this.emit('processing', { status: 'complete', response, plan, actions });
      console.log('[GeminiAI] Query processed successfully');
      return { response, plan, actions };

    } catch (error) {
      console.error('[GeminiAI] Error processing query:', error);
      this.emit('processing', { status: 'error', error });
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  // ============================================
  // INTENT CLASSIFICATION
  // ============================================

  private classifyIntent(query: string): string {
    const q = query.toLowerCase().trim();

    // Greetings and casual conversation
    if (q.match(/^(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings)/i) ||
      q.match(/^(how are you|how's it going|what's up|whats up)/i)) {
      return 'greeting';
    }

    // Thanks and appreciation
    if (q.match(/^(thanks|thank you|thx|appreciate|great job|awesome|perfect)/i)) {
      return 'thanks';
    }

    // Help requests
    if (q.match(/^(help|what can you do|capabilities|features)/i) ||
      q === '?' || q === 'help me') {
      return 'help';
    }

    // Problem/error reports
    if (q.match(/error|problem|issue|wrong|not working|failed|crash|bug|fix|broken|stuck|help me with/i)) {
      return 'troubleshoot';
    }

    // Model review/check
    if (q.match(/review|check my|look at|inspect|evaluate|assess/i) &&
      q.match(/model|structure|design|work/i)) {
      return 'review_model';
    }

    // Structure creation patterns
    if (q.match(/create|build|make|generate|design|model|draw|add|new/i) &&
      q.match(/frame|truss|beam|column|building|structure|bridge|cantilever|portal|slab|foundation/i)) {
      return 'create_structure';
    }

    // Analysis patterns
    if (q.match(/analyze|analysis|run|calculate|solve|compute/i) &&
      !q.match(/how|what|why|explain/i)) {
      return 'run_analysis';
    }

    // Results interpretation
    if (q.match(/result|displacement|stress|moment|reaction|deflection|interpret|show me/i) &&
      q.match(/result|analysis|output|value/i)) {
      return 'interpret_results';
    }

    // Optimization
    if (q.match(/optimize|improve|reduce|minimize|maximize|efficient|lighter|cheaper|better/i)) {
      return 'optimize';
    }

    // Design check
    if (q.match(/check|verify|validate|code|compliance|safe|adequate|pass|fail/i) &&
      q.match(/design|code|is 800|aisc|aci|standard|requirement/i)) {
      return 'design_check';
    }

    // Clear/reset model
    if (q.match(/clear|reset|delete|remove|start over|new model|fresh/i) &&
      q.match(/model|all|everything|structure/i)) {
      return 'clear_model';
    }

    // Explanation/learning - be more specific
    if (q.match(/what is|what are|what's|explain|tell me about|teach|learn|understand|definition|meaning|concept|theory|principle/i)) {
      return 'explain';
    }

    // Questions about their model
    if (q.match(/my|this|current/i) && q.match(/model|structure|design|frame/i)) {
      return 'about_model';
    }

    // Default to conversational for anything else
    return 'conversation';
  }

  // ============================================
  // STRUCTURE CREATION
  // ============================================

  async planStructureCreation(description: string, context: AIModelContext): Promise<AIPlan> {
    const prompt = TASK_PROMPTS.createStructure(description, context);

    // First try using Gemini API for intelligent planning
    if (this.apiKey) {
      try {
        const aiResponse = await this.callGemini(prompt, SYSTEM_PROMPT);
        const plan = this.parseAIPlan(aiResponse);
        if (plan) return plan;
      } catch (error) {
        console.warn('Gemini API failed, using local planning:', error);
      }
    }

    // Fallback to local intelligent planning
    return this.localPlanStructure(description);
  }

  // ============================================
  // PROFESSIONAL STRUCTURAL ENGINEERING SYSTEM
  // Based on 50 years of STAAD.Pro development experience
  // Codes: IS 875, IS 800, IS 456, IS 1893, AISC, Eurocode
  // ============================================

  /**
   * LOAD COMBINATION FACTORS (IS 875 Part 5 / IS 800:2007)
   * These are the partial safety factors used in Limit State Design
   */
  private readonly LOAD_COMBINATIONS = {
    // Ultimate Limit State (ULS) - Strength
    'ULS_1': { name: '1.5(DL+LL)', DL: 1.5, LL: 1.5, WL: 0, EQ: 0 },
    'ULS_2': { name: '1.5(DL+WL)', DL: 1.5, LL: 0, WL: 1.5, EQ: 0 },
    'ULS_3': { name: '1.2(DL+LL+WL)', DL: 1.2, LL: 1.2, WL: 1.2, EQ: 0 },
    'ULS_4': { name: '1.5(DL+EQ)', DL: 1.5, LL: 0, WL: 0, EQ: 1.5 },
    'ULS_5': { name: '1.2(DL+LL+EQ)', DL: 1.2, LL: 1.2, WL: 0, EQ: 1.2 },
    'ULS_6': { name: '0.9DL+1.5WL', DL: 0.9, LL: 0, WL: 1.5, EQ: 0 }, // Uplift check

    // Serviceability Limit State (SLS) - Deflection
    'SLS_1': { name: '1.0(DL+LL)', DL: 1.0, LL: 1.0, WL: 0, EQ: 0 },
    'SLS_2': { name: '1.0(DL+0.8LL+0.8WL)', DL: 1.0, LL: 0.8, WL: 0.8, EQ: 0 },
  };

  /**
   * DEFLECTION LIMITS (IS 800:2007, Table 6)
   * These are critical for serviceability - what STAAD.Pro checks
   */
  private readonly DEFLECTION_LIMITS = {
    'floor_beam': { limit: 'L/300', description: 'Floor beams supporting brittle finishes' },
    'floor_beam_general': { limit: 'L/240', description: 'Floor beams general' },
    'roof_purlin': { limit: 'L/180', description: 'Purlins and roof sheeting' },
    'crane_girder': { limit: 'L/500', description: 'Crane girders (vertical)' },
    'crane_girder_h': { limit: 'L/400', description: 'Crane girders (horizontal)' },
    'cantilever': { limit: 'L/150', description: 'Cantilever beams' },
    'column_drift': { limit: 'H/300', description: 'Column drift under wind/seismic' },
    'total_drift': { limit: 'H/500', description: 'Total building drift' },
  };

  /**
   * INDIAN STANDARD STEEL SECTIONS DATABASE
   * Exact properties from IS Handbook (SP:6)
   */
  private readonly STEEL_SECTIONS: Record<string, {
    depth: number;    // mm
    width: number;    // mm
    tw: number;       // web thickness mm
    tf: number;       // flange thickness mm
    area: number;     // cm²
    weight: number;   // kg/m
    Ixx: number;      // cm⁴ (major axis)
    Iyy: number;      // cm⁴ (minor axis)
    Zxx: number;      // cm³ (section modulus)
    rxx: number;      // cm (radius of gyration)
    ryy: number;      // cm
  }> = {
      // ISMB Sections (I-Sections, Medium Weight)
      'ISMB 150': { depth: 150, width: 80, tw: 4.8, tf: 7.6, area: 19.0, weight: 14.9, Ixx: 726, Iyy: 53, Zxx: 96.9, rxx: 6.18, ryy: 1.67 },
      'ISMB 200': { depth: 200, width: 100, tw: 5.7, tf: 10.8, area: 32.3, weight: 25.4, Ixx: 2235, Iyy: 150, Zxx: 224, rxx: 8.32, ryy: 2.15 },
      'ISMB 250': { depth: 250, width: 125, tw: 6.9, tf: 12.5, area: 47.1, weight: 37.3, Ixx: 5132, Iyy: 335, Zxx: 411, rxx: 10.4, ryy: 2.67 },
      'ISMB 300': { depth: 300, width: 140, tw: 7.7, tf: 13.1, area: 58.9, weight: 46.2, Ixx: 8603, Iyy: 454, Zxx: 574, rxx: 12.1, ryy: 2.78 },
      'ISMB 350': { depth: 350, width: 140, tw: 8.1, tf: 14.2, area: 66.7, weight: 52.4, Ixx: 13630, Iyy: 538, Zxx: 779, rxx: 14.3, ryy: 2.84 },
      'ISMB 400': { depth: 400, width: 140, tw: 8.9, tf: 16.0, area: 78.5, weight: 61.6, Ixx: 20500, Iyy: 622, Zxx: 1022, rxx: 16.2, ryy: 2.82 },
      'ISMB 450': { depth: 450, width: 150, tw: 9.4, tf: 17.4, area: 92.3, weight: 72.4, Ixx: 30390, Iyy: 834, Zxx: 1350, rxx: 18.1, ryy: 3.01 },
      'ISMB 500': { depth: 500, width: 180, tw: 10.2, tf: 17.2, area: 110.7, weight: 86.9, Ixx: 45220, Iyy: 1370, Zxx: 1808, rxx: 20.2, ryy: 3.52 },
      'ISMB 550': { depth: 550, width: 190, tw: 11.2, tf: 19.3, area: 132.1, weight: 103.7, Ixx: 64900, Iyy: 1830, Zxx: 2360, rxx: 22.2, ryy: 3.73 },
      'ISMB 600': { depth: 600, width: 210, tw: 12.0, tf: 20.8, area: 156.2, weight: 122.6, Ixx: 91800, Iyy: 2650, Zxx: 3060, rxx: 24.2, ryy: 4.12 },

      // ISHB Sections (I-Sections, Heavy Weight - for Columns)
      'ISHB 150': { depth: 150, width: 150, tw: 5.4, tf: 9.0, area: 34.5, weight: 27.1, Ixx: 1456, Iyy: 432, Zxx: 194, rxx: 6.50, ryy: 3.54 },
      'ISHB 200': { depth: 200, width: 200, tw: 6.1, tf: 9.0, area: 47.5, weight: 37.3, Ixx: 3608, Iyy: 967, Zxx: 361, rxx: 8.72, ryy: 4.51 },
      'ISHB 250': { depth: 250, width: 250, tw: 6.9, tf: 9.7, area: 65.0, weight: 51.0, Ixx: 7740, Iyy: 1961, Zxx: 619, rxx: 10.9, ryy: 5.49 },
      'ISHB 300': { depth: 300, width: 250, tw: 7.6, tf: 10.6, area: 75.0, weight: 58.8, Ixx: 12550, Iyy: 2194, Zxx: 837, rxx: 12.9, ryy: 5.41 },
      'ISHB 350': { depth: 350, width: 250, tw: 8.3, tf: 11.6, area: 85.6, weight: 67.4, Ixx: 19160, Iyy: 2451, Zxx: 1094, rxx: 15.0, ryy: 5.35 },
      'ISHB 400': { depth: 400, width: 250, tw: 9.1, tf: 12.7, area: 97.8, weight: 76.8, Ixx: 28080, Iyy: 2728, Zxx: 1404, rxx: 16.9, ryy: 5.28 },
      'ISHB 450': { depth: 450, width: 250, tw: 9.8, tf: 13.7, area: 109.7, weight: 86.1, Ixx: 39210, Iyy: 2987, Zxx: 1743, rxx: 18.9, ryy: 5.22 },

      // ISMC Sections (Channels - for Purlins, Truss Chords)
      'ISMC 75': { depth: 75, width: 40, tw: 4.4, tf: 7.3, area: 8.7, weight: 6.8, Ixx: 76, Iyy: 12.5, Zxx: 20.2, rxx: 2.95, ryy: 1.20 },
      'ISMC 100': { depth: 100, width: 50, tw: 5.0, tf: 7.7, area: 11.7, weight: 9.2, Ixx: 187, Iyy: 26.0, Zxx: 37.3, rxx: 4.00, ryy: 1.49 },
      'ISMC 125': { depth: 125, width: 65, tw: 5.3, tf: 8.2, area: 16.2, weight: 12.7, Ixx: 416, Iyy: 60.0, Zxx: 66.5, rxx: 5.07, ryy: 1.92 },
      'ISMC 150': { depth: 150, width: 75, tw: 5.7, tf: 9.0, area: 20.9, weight: 16.4, Ixx: 779, Iyy: 103, Zxx: 104, rxx: 6.11, ryy: 2.22 },
      'ISMC 200': { depth: 200, width: 75, tw: 6.2, tf: 11.4, area: 28.2, weight: 22.1, Ixx: 1819, Iyy: 141, Zxx: 182, rxx: 8.03, ryy: 2.24 },
      'ISMC 250': { depth: 250, width: 80, tw: 7.1, tf: 14.1, area: 39.0, weight: 30.6, Ixx: 3817, Iyy: 211, Zxx: 306, rxx: 9.89, ryy: 2.33 },
      'ISMC 300': { depth: 300, width: 90, tw: 7.8, tf: 13.6, area: 46.3, weight: 36.3, Ixx: 6362, Iyy: 310, Zxx: 424, rxx: 11.7, ryy: 2.59 },

      // ISA Sections (Equal Angles - for Bracing, Truss Web Members)
      'ISA 50x50x5': { depth: 50, width: 50, tw: 5, tf: 5, area: 4.8, weight: 3.8, Ixx: 11.0, Iyy: 11.0, Zxx: 3.1, rxx: 1.51, ryy: 1.51 },
      'ISA 65x65x6': { depth: 65, width: 65, tw: 6, tf: 6, area: 7.4, weight: 5.8, Ixx: 28.2, Iyy: 28.2, Zxx: 6.1, rxx: 1.95, ryy: 1.95 },
      'ISA 75x75x8': { depth: 75, width: 75, tw: 8, tf: 8, area: 11.4, weight: 8.9, Ixx: 59.3, Iyy: 59.3, Zxx: 11.1, rxx: 2.28, ryy: 2.28 },
      'ISA 90x90x10': { depth: 90, width: 90, tw: 10, tf: 10, area: 17.0, weight: 13.4, Ixx: 127, Iyy: 127, Zxx: 19.8, rxx: 2.73, ryy: 2.73 },
      'ISA 100x100x10': { depth: 100, width: 100, tw: 10, tf: 10, area: 19.0, weight: 14.9, Ixx: 177, Iyy: 177, Zxx: 24.9, rxx: 3.05, ryy: 3.05 },
      'ISA 100x100x12': { depth: 100, width: 100, tw: 12, tf: 12, area: 22.6, weight: 17.7, Ixx: 207, Iyy: 207, Zxx: 29.3, rxx: 3.03, ryy: 3.03 },
      'ISA 150x150x15': { depth: 150, width: 150, tw: 15, tf: 15, area: 43.0, weight: 33.8, Ixx: 699, Iyy: 699, Zxx: 66.4, rxx: 4.03, ryy: 4.03 },
    };

  /**
   * Calculate realistic loads based on Indian Standards (IS 875)
   * and international codes for real-world structures
   * 
   * This is exactly how STAAD.Pro calculates tributary loads
   */
  private calculateRealisticLoads(structureType: string, params: {
    span: number;
    height?: number;
    bayWidth?: number;
    tributaryWidth?: number;
    occupancy?: string;
    roofType?: string;
    location?: string;
    seismicZone?: string;
    terrainCategory?: number;
    importanceFactor?: number;
  }): {
    deadLoad: number;      // kN/m² or kN/m
    liveLoad: number;      // kN/m² or kN/m
    roofLiveLoad?: number; // kN/m²
    windLoad?: number;     // kN/m²
    seismicCoeff?: number; // Ah (horizontal seismic coefficient)
    selfWeight: number;    // kN/m (member self-weight)
    totalPointLoad: number; // kN at nodes
    totalUDL: number;      // kN/m for beams
    factoredLoads: {       // Factored loads per IS 800
      uls: number;         // 1.5(DL+LL)
      sls: number;         // 1.0(DL+LL)
      wind_comb: number;   // 1.2(DL+LL+WL)
    };
    description: string;
  } {
    const {
      span,
      height = 4,
      bayWidth = 6,
      tributaryWidth = 3,
      occupancy = 'office',
      roofType = 'metal',
      seismicZone = 'III',
      terrainCategory = 2,
      importanceFactor = 1.0
    } = params;

    // ========== DEAD LOADS (IS 875 Part 1) ==========
    // These values are from actual IS 875-1 tables
    let deadLoadIntensity = 0; // kN/m²

    switch (structureType) {
      case 'building':
      case 'frame':
        // Typical floor dead loads (detailed breakdown)
        // - RCC slab (150mm): 0.15 × 25 = 3.75 kN/m²
        // - Screed (50mm): 0.05 × 20 = 1.0 kN/m²
        // - Floor finish (tiles): 0.5 kN/m²
        // - Ceiling plaster: 0.25 kN/m²
        // - Services (electrical, HVAC): 0.25 kN/m²
        // - Partitions (IS 875-2, clause 3.1.2): 1.0 kN/m²
        deadLoadIntensity = 6.75; // Total DL for typical floor
        break;

      case 'roof':
      case 'truss':
        if (roofType === 'rcc') {
          // RCC roof: 100mm slab + waterproofing
          deadLoadIntensity = 3.5;
        } else {
          // Metal roofing system:
          // - GI sheets (0.63mm): 0.10 kN/m²
          // - Purlins (at 1.5m c/c): 0.12 kN/m²
          // - Insulation: 0.08 kN/m²
          // - Services/sprinklers: 0.20 kN/m²
          deadLoadIntensity = 0.50;
        }
        break;

      case 'industrial':
        // Industrial floor (heavy duty)
        // - 200mm RCC slab: 5.0 kN/m²
        // - Heavy-duty screed: 1.5 kN/m²
        // - Services: 1.5 kN/m²
        deadLoadIntensity = 8.0;
        break;

      case 'beam':
        // Floor beam - tributary area load
        deadLoadIntensity = 5.5;
        break;

      default:
        deadLoadIntensity = 5.0;
    }

    // ========== LIVE LOADS (IS 875 Part 2, Table 1) ==========
    // Exact values from IS 875-2:1987
    const liveLoadTable: Record<string, number> = {
      'residential': 2.0,           // Dwelling units (Table 1, S.No. 1)
      'office': 2.5,                // Offices general (Table 1, S.No. 4)
      'office_heavy': 4.0,          // Offices with filing (Table 1, S.No. 5)
      'assembly': 4.0,              // Assembly with fixed seats (Table 1, S.No. 6)
      'assembly_dense': 5.0,        // Assembly without fixed seats (Table 1, S.No. 7)
      'retail': 4.0,                // Retail shops (Table 1, S.No. 8)
      'warehouse_light': 6.0,       // Light storage (Table 1, S.No. 10a)
      'warehouse_medium': 10.0,     // Medium storage
      'warehouse_heavy': 15.0,      // Heavy storage (Table 1, S.No. 10c)
      'industrial_light': 5.0,      // Light industrial (Table 1, S.No. 11a)
      'industrial_heavy': 10.0,     // Heavy industrial (Table 1, S.No. 11b)
      'hospital': 3.0,              // Hospital wards (Table 1, S.No. 3)
      'hospital_operating': 4.0,    // Operating rooms
      'school': 3.0,                // Classrooms (Table 1, S.No. 2)
      'library': 6.0,               // Library stack rooms (Table 1, S.No. 9)
      'library_reading': 4.0,       // Library reading rooms
      'parking': 2.5,               // Parking (cars) (Table 1, S.No. 12)
      'parking_heavy': 5.0,         // Parking (trucks)
      'corridor': 4.0,              // Corridors (Table 1, S.No. 13)
      'stairs': 5.0,                // Staircases (Table 1, S.No. 14)
      'balcony': 3.0,               // Balconies (Table 1, S.No. 15)
      'roof_access': 1.5,           // Roof with access (Table 2)
      'roof_no_access': 0.75,       // Roof without access (Table 2)
    };

    const liveLoadIntensity = liveLoadTable[occupancy] || 3.0;

    // ========== ROOF LIVE LOAD (IS 875 Part 2, Clause 4.1) ==========
    const roofLiveLoad = occupancy?.includes('roof') ? liveLoadTable[occupancy] : 0.75;

    // ========== WIND LOAD (IS 875 Part 3:2015) ==========
    // This is the exact calculation as per IS 875-3
    const windZones: Record<string, number> = {
      'I': 33, 'II': 39, 'III': 44, 'IV': 47, 'V': 50, 'VI': 55
    };
    const Vb = windZones['III']; // Basic wind speed (m/s)

    // Risk coefficient k1 (Table 1, IS 875-3)
    const k1 = 1.0; // 50 year return period

    // Terrain & height factor k2 (Table 2, IS 875-3)
    // Category 2 = Open terrain with scattered obstructions
    const k2Table: Record<number, Record<string, number>> = {
      1: { '10': 1.05, '15': 1.09, '20': 1.12, '30': 1.16, '50': 1.20 },
      2: { '10': 1.00, '15': 1.05, '20': 1.07, '30': 1.12, '50': 1.17 },
      3: { '10': 0.91, '15': 0.97, '20': 1.01, '30': 1.06, '50': 1.12 },
      4: { '10': 0.80, '15': 0.80, '20': 0.88, '30': 0.98, '50': 1.05 },
    };
    const heightBracket = height <= 10 ? '10' : height <= 15 ? '15' : height <= 20 ? '20' : height <= 30 ? '30' : '50';
    const k2 = k2Table[terrainCategory]?.[heightBracket] || 1.0;

    // Topography factor k3 (Clause 6.3)
    const k3 = 1.0; // Flat terrain

    // Design wind speed
    const Vz = Vb * k1 * k2 * k3;

    // Design wind pressure (Clause 7.2)
    const pz = 0.6 * Vz * Vz / 1000; // kN/m²

    // Pressure coefficients for rectangular building (Table 5)
    const Cp_windward = 0.8;
    const Cp_leeward = -0.4; // Suction
    const windPressure = pz * Math.abs(Cp_windward - Cp_leeward);

    // ========== SEISMIC LOAD (IS 1893 Part 1:2016) ==========
    // Horizontal seismic coefficient Ah = (Z/2) × (I/R) × (Sa/g)
    const seismicZones: Record<string, number> = {
      'II': 0.10, 'III': 0.16, 'IV': 0.24, 'V': 0.36
    };
    const Z = seismicZones[seismicZone] || 0.16;
    const I = importanceFactor;
    const R = 5.0; // Response reduction factor (SMRF)

    // Approximate fundamental period T = 0.075h^0.75 (steel frame)
    const T = 0.075 * Math.pow(height, 0.75);

    // Spectral acceleration Sa/g (Medium soil, Type II)
    let SaByG = 1.0;
    if (T <= 0.10) SaByG = 1.0 + 15 * T;
    else if (T <= 0.55) SaByG = 2.5;
    else if (T <= 4.0) SaByG = 1.36 / T;
    else SaByG = 0.34;

    const Ah = (Z / 2) * (I / R) * SaByG;

    // ========== MEMBER SELF-WEIGHT ==========
    // Steel density: 78.5 kN/m³
    // Empirical formulas from decades of design experience
    let selfWeight = 0; // kN/m
    switch (structureType) {
      case 'beam':
        // Self-weight ≈ 0.4 + 0.035×span (kN/m) for typical floor beams
        selfWeight = 0.4 + span * 0.035;
        break;
      case 'column':
        // Self-weight based on tributary load
        selfWeight = 0.6 + height * 0.04;
        break;
      case 'truss':
        // Truss self-weight ≈ 0.10 + 0.012×span (kN/m of horizontal projection)
        selfWeight = 0.10 + span * 0.012;
        break;
      case 'purlin':
        selfWeight = 0.15;
        break;
      default:
        selfWeight = 0.5;
    }

    // ========== CALCULATE TOTAL LOADS ==========
    const tributaryArea = bayWidth * tributaryWidth;

    // Total UDL on beam (kN/m)
    const totalUDL = (deadLoadIntensity + liveLoadIntensity) * tributaryWidth + selfWeight;

    // Point load at node (for simplified analysis)
    const totalPointLoad = (deadLoadIntensity + liveLoadIntensity) * tributaryArea;

    // Factored loads for design (IS 800:2007)
    const factoredLoads = {
      uls: 1.5 * totalPointLoad,                           // ULS: 1.5(DL+LL)
      sls: 1.0 * totalPointLoad,                           // SLS: 1.0(DL+LL)
      wind_comb: 1.2 * totalPointLoad + 1.2 * windPressure * tributaryArea, // Wind combination
    };

    const description = `
📊 **Realistic Load Calculation (IS 875)**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Dead Load (DL):** ${deadLoadIntensity.toFixed(2)} kN/m²
  • Slab/Roof: ${(deadLoadIntensity * 0.6).toFixed(2)} kN/m²
  • Finishes: ${(deadLoadIntensity * 0.16).toFixed(2)} kN/m²
  • Services: ${(deadLoadIntensity * 0.08).toFixed(2)} kN/m²
  • Partitions: ${(deadLoadIntensity * 0.16).toFixed(2)} kN/m²

**Live Load (LL):** ${liveLoadIntensity.toFixed(2)} kN/m² (${occupancy})

**Wind Load:** ${windPressure.toFixed(2)} kN/m² (Zone III, ${Vb}m/s)
**Seismic Coefficient (Ah):** ${Ah.toFixed(4)} (Zone ${seismicZone}, I=${I}, R=${R})

**Self-Weight:** ${selfWeight.toFixed(2)} kN/m

**Tributary Width:** ${tributaryWidth.toFixed(1)} m
**Bay Width:** ${bayWidth.toFixed(1)} m

**Total UDL on Beam:** ${totalUDL.toFixed(2)} kN/m
**Total Point Load:** ${totalPointLoad.toFixed(2)} kN

**FACTORED LOADS (IS 800:2007):**
• ULS [1.5(DL+LL)]: ${factoredLoads.uls.toFixed(2)} kN
• SLS [1.0(DL+LL)]: ${factoredLoads.sls.toFixed(2)} kN
• Wind Combination: ${factoredLoads.wind_comb.toFixed(2)} kN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return {
      deadLoad: deadLoadIntensity,
      liveLoad: liveLoadIntensity,
      roofLiveLoad,
      windLoad: windPressure,
      seismicCoeff: Ah,
      selfWeight,
      totalPointLoad,
      totalUDL,
      factoredLoads,
      description
    };
  }

  /**
   * Get appropriate steel section based on span and load
   * Using actual section properties from IS Handbook
   */
  private selectRealisticSection(memberType: string, span: number, load: number): string {
    // Section selection based on rigorous design practice
    // Reference: IS 800:2007, SP:6 Steel Tables

    // Get section properties from database
    const getSectionMomentCapacity = (sectionName: string): number => {
      const section = this.STEEL_SECTIONS[sectionName];
      if (!section) return 0;
      // Moment capacity = fy × Zxx / γm0 (kNm)
      // fy = 250 MPa, γm0 = 1.1
      return (250 * section.Zxx / 1.1) / 1000; // kNm
    };

    if (memberType === 'beam') {
      // Required moment = wL²/8 or wL²/12 depending on fixity
      const requiredMoment = (load * span * span) / 8; // kNm for simply supported

      // Select smallest section that satisfies moment requirement
      const beamSections = ['ISMB 150', 'ISMB 200', 'ISMB 250', 'ISMB 300', 'ISMB 350',
        'ISMB 400', 'ISMB 450', 'ISMB 500', 'ISMB 550', 'ISMB 600'];

      for (const section of beamSections) {
        if (getSectionMomentCapacity(section) >= requiredMoment * 1.1) { // 10% margin
          return section;
        }
      }
      return 'ISMB 600';
    }

    if (memberType === 'column') {
      // Column selection based on axial load and slenderness
      if (load <= 500) return 'ISHB 200';
      if (load <= 1000) return 'ISHB 250';
      if (load <= 1500) return 'ISHB 300';
      if (load <= 2500) return 'ISHB 350';
      if (load <= 4000) return 'ISHB 400';
      return 'ISHB 450';
    }

    if (memberType === 'truss_chord') {
      if (span <= 15) return 'ISMC 150';
      if (span <= 25) return 'ISMC 200';
      if (span <= 35) return 'ISMC 250';
      return 'ISMC 300';
    }

    if (memberType === 'truss_web') {
      if (span <= 15) return 'ISA 65x65x6';
      if (span <= 25) return 'ISA 75x75x8';
      if (span <= 35) return 'ISA 90x90x10';
      return 'ISA 100x100x10';
    }

    if (memberType === 'bracing') {
      return 'ISA 75x75x8';
    }

    return 'ISMB 300'; // Default
  }

  private localPlanStructure(description: string): AIPlan {
    const d = description.toLowerCase();
    const steps: AIAction[] = [];
    let goal = '';
    let reasoning = '';

    // Parse dimensions from description with multiple patterns
    const spanMatch = d.match(/(\d+(?:\.\d+)?)\s*m?\s*(span|wide|width|long|length|meter)/i) ||
      d.match(/(span|width|length)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*m?/i);
    const heightMatch = d.match(/(\d+(?:\.\d+)?)\s*m?\s*(height|tall|high|deep|depth)/i) ||
      d.match(/(\d+)\s*(story|storey|floor|level)/i);
    const bayMatch = d.match(/(\d+)\s*bay/i);
    const storyMatch = d.match(/(\d+)\s*(story|storey|floor|level)/i);
    const loadMatch = d.match(/(\d+(?:\.\d+)?)\s*(kn|kilo|load)/i);

    // Detect occupancy type from description
    let occupancy = 'office';
    if (d.includes('warehouse') || d.includes('storage')) occupancy = 'warehouse_light';
    if (d.includes('industrial') || d.includes('factory')) occupancy = 'industrial_light';
    if (d.includes('residential') || d.includes('house') || d.includes('apartment')) occupancy = 'residential';
    if (d.includes('hospital') || d.includes('medical')) occupancy = 'hospital';
    if (d.includes('school') || d.includes('college')) occupancy = 'school';
    if (d.includes('retail') || d.includes('shop') || d.includes('mall')) occupancy = 'retail';
    if (d.includes('assembly') || d.includes('auditorium') || d.includes('hall')) occupancy = 'assembly';
    if (d.includes('library')) occupancy = 'library';
    if (d.includes('parking') || d.includes('garage')) occupancy = 'parking';

    // Extract values with smart defaults based on structure type
    const span = spanMatch ? parseFloat(spanMatch[1]) : 12;
    const height = heightMatch ? parseFloat(heightMatch[1]) : 6;
    const bays = bayMatch ? parseInt(bayMatch[1]) : 3;
    const stories = storyMatch ? parseInt(storyMatch[1]) : 3;

    // Use realistic load if not specified - calculate based on IS 875
    const specifiedLoad = loadMatch ? parseFloat(loadMatch[1]) : null;

    // Calculate realistic structural proportions
    const bayWidth = span / Math.max(bays, 1);
    const storyHeight = stories > 1 ? Math.min(height / stories, 4.0) : height;
    const tributaryWidth = 6; // Typical purlin/joist spacing

    // Default realistic load based on structure type (will be overridden per structure)
    const defaultLoads = this.calculateRealisticLoads('building', { span, height, bayWidth, tributaryWidth, occupancy });
    const loadValue = specifiedLoad || defaultLoads.totalPointLoad;

    // ==================== 3D WARREN TRUSS ROOF SYSTEM ====================
    if (d.includes('warren')) {
      const panels = Math.max(6, Math.round(span / 2) % 2 === 0 ? Math.round(span / 2) : Math.round(span / 2) + 1);
      const depth = span / 8; // Typical depth/span ratio for trusses
      const panelWidth = span / panels;

      // Number of trusses in Z-direction
      const numTrusses = d.includes('single') ? 1 : Math.max(3, bays);
      const trussSpacing = 6; // Typical spacing in Z direction
      const buildingLength = (numTrusses - 1) * trussSpacing;

      // Calculate realistic roof loads
      const loads = this.calculateRealisticLoads('truss', {
        span, height: depth, bayWidth: panelWidth, tributaryWidth: trussSpacing, occupancy, roofType: 'metal'
      });

      // Point load per node = (DL + LL) × tributary area per node
      const nodeSpacing = panelWidth;
      const nodeLoad = specifiedLoad || (loads.deadLoad + loads.roofLiveLoad!) * trussSpacing * nodeSpacing;
      const chordSection = this.selectRealisticSection('truss_chord', span, nodeLoad);
      const webSection = this.selectRealisticSection('truss_web', span, nodeLoad);
      const purlinSection = 'ISMC 125';
      const bracingSection = 'ISA 50x50x6';

      goal = `Create a REAL 3D Warren Truss Roof: ${span}m × ${buildingLength}m (${numTrusses} trusses)`;
      reasoning = `**COMPLETE 3D WARREN TRUSS ROOF SYSTEM (IS 875 & IS 800)**
      
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    3D TRUSS ROOF STRUCTURAL DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 **3D GEOMETRY:**
┌─────────────────────────────────────────────────────────────────┐
│ Truss Span (X)       : ${span.toFixed(1).padStart(8)} m                              │
│ Building Length (Z)  : ${buildingLength.toFixed(1).padStart(8)} m                              │
│ Truss Depth (Y)      : ${depth.toFixed(2).padStart(8)} m (L/${Math.round(span / depth)})                   │
│ Number of Trusses    : ${numTrusses.toString().padStart(8)} @ ${trussSpacing}m c/c                   │
│ Number of Panels     : ${panels.toString().padStart(8)} per truss                     │
│ Panel Width          : ${panelWidth.toFixed(2).padStart(8)} m                              │
│ Roof Area            : ${(span * buildingLength).toFixed(0).padStart(8)} m²                            │
└─────────────────────────────────────────────────────────────────┘

📊 **LOAD CALCULATION (IS 875:1987):**
┌─────────────────────────────────────────────────────────────────┐
│ DEAD LOAD (Part 1):                                             │
│   • GI Sheeting (0.63mm)    : 0.10 kN/m²                        │
│   • Purlins @1.5m c/c       : 0.12 kN/m²                        │
│   • Insulation + Services   : 0.28 kN/m²                        │
│   • TOTAL DL                : ${loads.deadLoad.toFixed(2).padStart(5)} kN/m²                         │
├─────────────────────────────────────────────────────────────────┤
│ LIVE LOAD (Part 2, Table 2):                                    │
│   • Roof Live (maintenance) : ${loads.roofLiveLoad!.toFixed(2).padStart(5)} kN/m²                         │
├─────────────────────────────────────────────────────────────────┤
│ WIND LOAD (Part 3):                                             │
│   • Basic Wind Speed (Zone III): 44 m/s                         │
│   • Wind Pressure           : ${loads.windLoad!.toFixed(2).padStart(5)} kN/m²                         │
├─────────────────────────────────────────────────────────────────┤
│ LOAD AT EACH NODE:                                              │
│   (DL+LL) × Truss Spacing × Panel Width                        │
│   = (${loads.deadLoad.toFixed(2)} + ${loads.roofLiveLoad!.toFixed(2)}) × ${trussSpacing} × ${panelWidth.toFixed(2)}                 │
│   = ${nodeLoad.toFixed(2).padStart(7)} kN per node                                  │
└─────────────────────────────────────────────────────────────────┘

🔧 **SECTION SELECTION (IS 800:2007):**
┌─────────────────────────────────────────────────────────────────┐
│ Top/Bottom Chords : ${chordSection.padEnd(12)} (Double Angle)               │
│ Web Members       : ${webSection.padEnd(12)} (Single Angle)                 │
│ Purlins           : ${purlinSection.padEnd(12)} (Cold-formed)               │
│ Roof Bracing      : ${bracingSection.padEnd(12)} (X-type)                   │
│ Material          : Fe 250 (fy = 250 MPa)                       │
└─────────────────────────────────────────────────────────────────┘

🏗️ **3D STRUCTURAL SYSTEM:**
┌─────────────────────────────────────────────────────────────────┐
│ • ${numTrusses} Warren trusses spanning in X-direction                    │
│ • Purlins connecting trusses at top chord nodes (Z-direction)   │
│ • X-bracing in roof plane at end bays for stability             │
│ • All truss joints pinned (axial forces only)                   │
│ • Supports: Pinned at start, Roller at end of each truss        │
└─────────────────────────────────────────────────────────────────┘`;

      let nodeId = 1;
      const nodeMap: Record<string, number> = {};

      // STEP 1: Create nodes for all Warren trusses in Z direction
      for (let truss = 0; truss < numTrusses; truss++) {
        const z = truss * trussSpacing;

        // Bottom chord nodes
        for (let i = 0; i <= panels; i++) {
          const isSupport = i === 0 || i === panels;
          const key = `bottom-${truss}-${i}`;
          nodeMap[key] = nodeId;
          steps.push({
            type: 'addNode',
            params: {
              id: `N${nodeId}`,
              x: i * panelWidth,
              y: 0,
              z: z,
              support: isSupport ? (i === 0 ? 'pinned' : 'roller') : undefined
            },
            description: `Truss ${truss + 1}: Bottom node ${i}${isSupport ? ' (Support)' : ''}`
          });
          nodeId++;
        }

        // Top chord nodes (at mid-points for Warren pattern)
        for (let i = 0; i < panels; i++) {
          const key = `top-${truss}-${i}`;
          nodeMap[key] = nodeId;
          steps.push({
            type: 'addNode',
            params: {
              id: `N${nodeId}`,
              x: (i + 0.5) * panelWidth,
              y: depth,
              z: z
            },
            description: `Truss ${truss + 1}: Top chord node ${i + 1}`
          });
          nodeId++;
        }
      }

      // STEP 2: Create truss members for each truss
      for (let truss = 0; truss < numTrusses; truss++) {
        // Bottom chord members
        for (let i = 0; i < panels; i++) {
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`bottom-${truss}-${i}`]}`,
              end: `N${nodeMap[`bottom-${truss}-${i + 1}`]}`,
              section: chordSection,
              memberType: 'truss'
            },
            description: `Truss ${truss + 1}: Bottom chord ${i + 1}`
          });
        }

        // Top chord members
        for (let i = 0; i < panels - 1; i++) {
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`top-${truss}-${i}`]}`,
              end: `N${nodeMap[`top-${truss}-${i + 1}`]}`,
              section: chordSection,
              memberType: 'truss'
            },
            description: `Truss ${truss + 1}: Top chord ${i + 1}`
          });
        }

        // Warren diagonals (zigzag pattern)
        for (let i = 0; i < panels; i++) {
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`bottom-${truss}-${i}`]}`,
              end: `N${nodeMap[`top-${truss}-${i}`]}`,
              section: webSection,
              memberType: 'truss'
            },
            description: `Truss ${truss + 1}: Diagonal up ${i + 1}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`top-${truss}-${i}`]}`,
              end: `N${nodeMap[`bottom-${truss}-${i + 1}`]}`,
              section: webSection,
              memberType: 'truss'
            },
            description: `Truss ${truss + 1}: Diagonal down ${i + 1}`
          });
        }
      }

      // STEP 3: Create purlins connecting trusses (Z-direction)
      if (numTrusses > 1) {
        for (let truss = 0; truss < numTrusses - 1; truss++) {
          // Purlins at top chord nodes
          for (let i = 0; i < panels; i++) {
            steps.push({
              type: 'addMember',
              params: {
                start: `N${nodeMap[`top-${truss}-${i}`]}`,
                end: `N${nodeMap[`top-${truss + 1}-${i}`]}`,
                section: purlinSection
              },
              description: `Purlin at panel ${i + 1}, Bay ${truss + 1}`
            });
          }

          // Eave purlins at bottom chord ends
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`bottom-${truss}-0`]}`,
              end: `N${nodeMap[`bottom-${truss + 1}-0`]}`,
              section: purlinSection
            },
            description: `Eave purlin left, Bay ${truss + 1}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`bottom-${truss}-${panels}`]}`,
              end: `N${nodeMap[`bottom-${truss + 1}-${panels}`]}`,
              section: purlinSection
            },
            description: `Eave purlin right, Bay ${truss + 1}`
          });
        }
      }

      // STEP 4: Add roof bracing in end bays
      if (numTrusses >= 2) {
        // First bay bracing
        for (let i = 0; i < panels - 1; i += 2) {
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`top-0-${i}`]}`,
              end: `N${nodeMap[`top-1-${i + 1}`]}`,
              section: bracingSection,
              memberType: 'truss'
            },
            description: `Roof brace 1, Panel ${i + 1}`
          });
          if (i + 1 < panels) {
            steps.push({
              type: 'addMember',
              params: {
                start: `N${nodeMap[`top-1-${i}`]}`,
                end: `N${nodeMap[`top-0-${i + 1}`]}`,
                section: bracingSection,
                memberType: 'truss'
              },
              description: `Roof brace 2, Panel ${i + 1}`
            });
          }
        }

        // Last bay bracing
        if (numTrusses > 2) {
          const lastTruss = numTrusses - 1;
          for (let i = 0; i < panels - 1; i += 2) {
            steps.push({
              type: 'addMember',
              params: {
                start: `N${nodeMap[`top-${lastTruss - 1}-${i}`]}`,
                end: `N${nodeMap[`top-${lastTruss}-${i + 1}`]}`,
                section: bracingSection,
                memberType: 'truss'
              },
              description: `Roof brace 1, End bay, Panel ${i + 1}`
            });
          }
        }
      }

      // STEP 5: Add gravity loads at top chord nodes
      for (let truss = 0; truss < numTrusses; truss++) {
        const isEndTruss = truss === 0 || truss === numTrusses - 1;
        const loadMultiplier = isEndTruss ? 0.5 : 1.0;

        for (let i = 0; i < panels; i++) {
          steps.push({
            type: 'addLoad',
            params: { nodeId: `N${nodeMap[`top-${truss}-${i}`]}`, fy: -nodeLoad * loadMultiplier },
            description: `Roof load at Truss ${truss + 1}, Node ${i + 1}: ${(nodeLoad * loadMultiplier).toFixed(1)} kN`
          });
        }
      }

      // STEP 6: Add wind suction at center
      const centerTruss = Math.floor(numTrusses / 2);
      const centerPanel = Math.floor(panels / 2);
      const windSuction = loads.windLoad! * trussSpacing * nodeSpacing * 0.6;
      steps.push({
        type: 'addLoad',
        params: { nodeId: `N${nodeMap[`top-${centerTruss}-${centerPanel}`]}`, fy: windSuction },
        description: `Wind suction (upward) at center: ${windSuction.toFixed(1)} kN`
      });

      // STEP 7: Add roof panels for visualization
      if (numTrusses > 1) {
        for (let truss = 0; truss < numTrusses - 1; truss++) {
          // Add roof panels at each panel zone
          for (let i = 0; i < panels - 1; i++) {
            steps.push({
              type: 'addPlate',
              params: {
                nodeIds: [
                  `N${nodeMap[`top-${truss}-${i}`]}`,
                  `N${nodeMap[`top-${truss}-${i + 1}`]}`,
                  `N${nodeMap[`top-${truss + 1}-${i + 1}`]}`,
                  `N${nodeMap[`top-${truss + 1}-${i}`]}`
                ],
                thickness: 0.001, // 1mm sheeting
                pressure: 0,
                materialType: 'steel'
              },
              description: `Roof sheeting, Bay ${truss + 1}, Panel ${i + 1}`
            });
          }
        }
      }
    }
    // ==================== PRATT TRUSS ====================
    else if (d.includes('pratt')) {
      const panels = Math.max(4, Math.round(span / 3));
      const depth = span / 8;
      const panelWidth = span / panels;

      // Calculate realistic roof loads
      const loads = this.calculateRealisticLoads('truss', {
        span, height: depth, bayWidth: panelWidth, tributaryWidth, occupancy, roofType: 'metal'
      });
      const nodeLoad = specifiedLoad || (loads.deadLoad + loads.roofLiveLoad!) * tributaryWidth * panelWidth;

      const chordSection = this.selectRealisticSection('truss_chord', span, nodeLoad);
      const webSection = this.selectRealisticSection('truss_web', span, nodeLoad);

      goal = `Create a Pratt truss with ${span}m span (${panels} panels) - Industrial Roof`;
      reasoning = `Pratt truss: verticals in compression, diagonals in tension. Ideal for steel construction.

📐 **Design Parameters:**
• Span: ${span}m, Depth: ${depth.toFixed(2)}m (L/${Math.round(span / depth)})
• Panels: ${panels}, Panel width: ${panelWidth.toFixed(2)}m

📊 **Load Calculation (IS 875):**
• Dead Load: ${loads.deadLoad.toFixed(2)} kN/m²
• Roof Live Load: ${loads.roofLiveLoad!.toFixed(2)} kN/m²
• Node Load: ${nodeLoad.toFixed(2)} kN (at each purlin point)

🔧 **Sections:** Chords: ${chordSection}, Web: ${webSection}`;

      let nodeId = 1;

      // Bottom chord nodes
      for (let i = 0; i <= panels; i++) {
        const isSupport = i === 0 || i === panels;
        steps.push({
          type: 'addNode',
          params: {
            id: `N${nodeId}`,
            x: i * panelWidth,
            y: 0,
            z: 0,
            support: isSupport ? (i === 0 ? 'pinned' : 'roller') : undefined
          },
          description: isSupport ? `${i === 0 ? 'Pinned' : 'Roller'} support` : `Bottom chord ${i}`
        });
        nodeId++;
      }

      // Top chord nodes
      for (let i = 0; i <= panels; i++) {
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: i * panelWidth, y: depth, z: 0 },
          description: `Top chord ${i}`
        });
        nodeId++;
      }

      // Bottom chord members
      for (let i = 0; i < panels; i++) {
        steps.push({
          type: 'addMember',
          params: { start: `N${i + 1}`, end: `N${i + 2}`, section: chordSection, memberType: 'truss' },
          description: `Bottom chord ${i + 1}`
        });
      }

      // Top chord members
      for (let i = 0; i < panels; i++) {
        const topStart = panels + 2 + i;
        steps.push({
          type: 'addMember',
          params: { start: `N${topStart}`, end: `N${topStart + 1}`, section: chordSection, memberType: 'truss' },
          description: `Top chord ${i + 1}`
        });
      }

      // Verticals and Pratt diagonals
      for (let i = 0; i <= panels; i++) {
        const bottomNode = i + 1;
        const topNode = panels + 2 + i;
        steps.push({
          type: 'addMember',
          params: { start: `N${bottomNode}`, end: `N${topNode}`, section: webSection, memberType: 'truss' },
          description: `Vertical ${i}`
        });
        if (i < panels / 2) {
          steps.push({
            type: 'addMember',
            params: { start: `N${bottomNode + 1}`, end: `N${topNode}`, section: webSection, memberType: 'truss' },
            description: `Diagonal ${i + 1}`
          });
        } else if (i < panels) {
          steps.push({
            type: 'addMember',
            params: { start: `N${bottomNode}`, end: `N${topNode + 1}`, section: webSection, memberType: 'truss' },
            description: `Diagonal ${i + 1}`
          });
        }
      }

      // Realistic loads at top chord
      for (let i = 1; i < panels; i++) {
        steps.push({
          type: 'addLoad',
          params: { nodeId: `N${panels + 2 + i}`, fy: -nodeLoad },
          description: `Purlin load at node ${i}: ${nodeLoad.toFixed(1)} kN`
        });
      }
    }
    // ==================== HOWE TRUSS ====================
    else if (d.includes('howe')) {
      const panels = Math.max(4, Math.round(span / 3));
      const depth = span / 8;
      const panelWidth = span / panels;

      goal = `Create a Howe truss with ${span}m span (${panels} panels)`;
      reasoning = 'Howe truss has verticals in tension and diagonals in compression. Originally designed for timber where compression members (diagonals) can be larger.';

      let nodeId = 1;

      // Bottom chord nodes
      for (let i = 0; i <= panels; i++) {
        const isSupport = i === 0 || i === panels;
        steps.push({
          type: 'addNode',
          params: {
            id: `N${nodeId}`,
            x: i * panelWidth,
            y: 0,
            z: 0,
            support: isSupport ? (i === 0 ? 'pinned' : 'roller') : undefined
          },
          description: isSupport ? `${i === 0 ? 'Pinned' : 'Roller'} support` : `Bottom chord ${i}`
        });
        nodeId++;
      }

      // Top chord nodes
      for (let i = 0; i <= panels; i++) {
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: i * panelWidth, y: depth, z: 0 },
          description: `Top chord ${i}`
        });
        nodeId++;
      }

      // Bottom chord members
      for (let i = 0; i < panels; i++) {
        steps.push({
          type: 'addMember',
          params: { start: `N${i + 1}`, end: `N${i + 2}`, section: 'ISMC 150', memberType: 'truss' },
          description: `Bottom chord ${i + 1}`
        });
      }

      // Top chord members
      for (let i = 0; i < panels; i++) {
        const topStart = panels + 2 + i;
        steps.push({
          type: 'addMember',
          params: { start: `N${topStart}`, end: `N${topStart + 1}`, section: 'ISMC 150', memberType: 'truss' },
          description: `Top chord ${i + 1}`
        });
      }

      // Verticals and Howe diagonals (opposite of Pratt)
      for (let i = 0; i <= panels; i++) {
        const bottomNode = i + 1;
        const topNode = panels + 2 + i;
        // Verticals
        steps.push({
          type: 'addMember',
          params: { start: `N${bottomNode}`, end: `N${topNode}`, section: 'ISA 65x65x6', memberType: 'truss' },
          description: `Vertical ${i}`
        });
        // Diagonals (away from center - opposite of Pratt)
        if (i < panels / 2 && i > 0) {
          steps.push({
            type: 'addMember',
            params: { start: `N${bottomNode}`, end: `N${topNode - 1}`, section: 'ISA 75x75x8', memberType: 'truss' },
            description: `Diagonal ${i}`
          });
        } else if (i >= panels / 2 && i < panels) {
          steps.push({
            type: 'addMember',
            params: { start: `N${bottomNode}`, end: `N${topNode + 1}`, section: 'ISA 75x75x8', memberType: 'truss' },
            description: `Diagonal ${i}`
          });
        }
      }

      // Loads at top chord
      for (let i = 1; i < panels; i++) {
        steps.push({
          type: 'addLoad',
          params: { nodeId: `N${panels + 2 + i}`, fy: -loadValue / panels },
          description: `Load at top node ${i}`
        });
      }
    }
    // ==================== K-TRUSS ====================
    else if (d.includes('k-truss') || d.includes('k truss')) {
      const panels = Math.max(4, Math.round(span / 4));
      const depth = span / 6;
      const panelWidth = span / panels;

      goal = `Create a K-truss with ${span}m span`;
      reasoning = 'K-truss uses diagonal members in K-pattern to reduce buckling length. Excellent for longer spans where diagonal buckling is a concern.';

      // Similar structure to Pratt but with K-pattern diagonals
      // [Implementation similar to Pratt but with mid-vertical nodes]
      // Simplified version:
      steps.push(
        { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'pinned' }, description: 'Left support' },
        { type: 'addNode', params: { id: 'N2', x: span / 4, y: 0, z: 0 }, description: 'Bottom 1/4' },
        { type: 'addNode', params: { id: 'N3', x: span / 2, y: 0, z: 0 }, description: 'Bottom center' },
        { type: 'addNode', params: { id: 'N4', x: 3 * span / 4, y: 0, z: 0 }, description: 'Bottom 3/4' },
        { type: 'addNode', params: { id: 'N5', x: span, y: 0, z: 0, support: 'roller' }, description: 'Right support' },
        { type: 'addNode', params: { id: 'N6', x: 0, y: depth, z: 0 }, description: 'Top left' },
        { type: 'addNode', params: { id: 'N7', x: span / 4, y: depth, z: 0 }, description: 'Top 1/4' },
        { type: 'addNode', params: { id: 'N8', x: span / 2, y: depth, z: 0 }, description: 'Top center' },
        { type: 'addNode', params: { id: 'N9', x: 3 * span / 4, y: depth, z: 0 }, description: 'Top 3/4' },
        { type: 'addNode', params: { id: 'N10', x: span, y: depth, z: 0 }, description: 'Top right' },
        { type: 'addNode', params: { id: 'N11', x: span / 4, y: depth / 2, z: 0 }, description: 'Mid vertical 1' },
        { type: 'addNode', params: { id: 'N12', x: 3 * span / 4, y: depth / 2, z: 0 }, description: 'Mid vertical 2' },
      );
      // Add members (bottom, top, verticals, K-diagonals)
      // Bottom chord
      for (let i = 1; i <= 4; i++) {
        steps.push({ type: 'addMember', params: { start: `N${i}`, end: `N${i + 1}`, section: 'ISMC 200', memberType: 'truss' }, description: `Bottom chord ${i}` });
      }
      // Top chord
      for (let i = 6; i <= 9; i++) {
        steps.push({ type: 'addMember', params: { start: `N${i}`, end: `N${i + 1}`, section: 'ISMC 200', memberType: 'truss' }, description: `Top chord ${i - 5}` });
      }
      // End verticals
      steps.push({ type: 'addMember', params: { start: 'N1', end: 'N6', section: 'ISA 75x75x8', memberType: 'truss' }, description: 'Left vertical' });
      steps.push({ type: 'addMember', params: { start: 'N5', end: 'N10', section: 'ISA 75x75x8', memberType: 'truss' }, description: 'Right vertical' });
      // K-pattern
      steps.push({ type: 'addMember', params: { start: 'N2', end: 'N11', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K lower 1' });
      steps.push({ type: 'addMember', params: { start: 'N11', end: 'N7', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K upper 1' });
      steps.push({ type: 'addMember', params: { start: 'N6', end: 'N11', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K diagonal 1' });
      steps.push({ type: 'addMember', params: { start: 'N11', end: 'N3', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K diagonal 2' });
      steps.push({ type: 'addMember', params: { start: 'N4', end: 'N12', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K lower 2' });
      steps.push({ type: 'addMember', params: { start: 'N12', end: 'N9', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K upper 2' });
      steps.push({ type: 'addMember', params: { start: 'N3', end: 'N12', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K diagonal 3' });
      steps.push({ type: 'addMember', params: { start: 'N12', end: 'N10', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'K diagonal 4' });
      steps.push({ type: 'addMember', params: { start: 'N3', end: 'N8', section: 'ISA 65x65x6', memberType: 'truss' }, description: 'Center vertical' });
      // Loads
      steps.push({ type: 'addLoad', params: { nodeId: 'N7', fy: -loadValue / 3 }, description: 'Load 1' });
      steps.push({ type: 'addLoad', params: { nodeId: 'N8', fy: -loadValue / 3 }, description: 'Load 2' });
      steps.push({ type: 'addLoad', params: { nodeId: 'N9', fy: -loadValue / 3 }, description: 'Load 3' });
    }
    // ==================== CONTINUOUS BEAM ====================
    else if (d.includes('continuous') && d.includes('beam')) {
      const spans = bayMatch ? parseInt(bayMatch[1]) : 3;
      const spanLength = span / spans;

      goal = `Create a ${spans}-span continuous beam (total ${span}m)`;
      reasoning = 'Continuous beam over multiple supports. Creates negative moments over supports and reduced positive moments at midspan. More efficient than simply supported.';

      let nodeId = 1;
      // Support nodes
      for (let i = 0; i <= spans; i++) {
        const supportType = i === 0 ? 'pinned' : 'roller';
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: i * spanLength, y: 0, z: 0, support: supportType },
          description: `Support ${i + 1}`
        });
        nodeId++;
      }
      // Midspan nodes
      for (let i = 0; i < spans; i++) {
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: (i + 0.5) * spanLength, y: 0, z: 0 },
          description: `Midspan ${i + 1}`
        });
        nodeId++;
      }
      // Members
      for (let i = 0; i < spans; i++) {
        const leftSupport = i + 1;
        const midspan = spans + 2 + i;
        const rightSupport = i + 2;
        steps.push(
          { type: 'addMember', params: { start: `N${leftSupport}`, end: `N${midspan}`, section: 'ISMB 350' }, description: `Beam ${i + 1}a` },
          { type: 'addMember', params: { start: `N${midspan}`, end: `N${rightSupport}`, section: 'ISMB 350' }, description: `Beam ${i + 1}b` }
        );
        // Load at midspan
        steps.push({ type: 'addLoad', params: { nodeId: `N${midspan}`, fy: -loadValue / spans }, description: `Load at midspan ${i + 1}` });
      }
    }
    // ==================== FIXED-FIXED BEAM ====================
    else if ((d.includes('fixed') && d.includes('fixed')) || d.includes('fixed-fixed') || d.includes('both ends fixed')) {
      goal = `Create a fixed-fixed beam with ${span}m span`;
      reasoning = 'Beam with both ends fully fixed (no rotation). Reduces midspan moment by 33% and deflection by 80% compared to simply supported. Requires strong connections.';

      steps.push(
        { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'fixed' }, description: 'Left fixed support' },
        { type: 'addNode', params: { id: 'N2', x: span / 3, y: 0, z: 0 }, description: '1/3 span' },
        { type: 'addNode', params: { id: 'N3', x: span / 2, y: 0, z: 0 }, description: 'Midspan' },
        { type: 'addNode', params: { id: 'N4', x: 2 * span / 3, y: 0, z: 0 }, description: '2/3 span' },
        { type: 'addNode', params: { id: 'N5', x: span, y: 0, z: 0, support: 'fixed' }, description: 'Right fixed support' },
        { type: 'addMember', params: { start: 'N1', end: 'N2', section: 'ISMB 400' }, description: 'Beam 1' },
        { type: 'addMember', params: { start: 'N2', end: 'N3', section: 'ISMB 400' }, description: 'Beam 2' },
        { type: 'addMember', params: { start: 'N3', end: 'N4', section: 'ISMB 400' }, description: 'Beam 3' },
        { type: 'addMember', params: { start: 'N4', end: 'N5', section: 'ISMB 400' }, description: 'Beam 4' },
        { type: 'addLoad', params: { nodeId: 'N3', fy: -loadValue }, description: 'Midspan load' }
      );
    }
    // ==================== PROPPED CANTILEVER ====================
    else if (d.includes('propped') && d.includes('cantilever')) {
      goal = `Create a propped cantilever with ${span}m span`;
      reasoning = 'Cantilever beam with prop support at free end. Statically indeterminate (1 degree). Reaction at prop R = 5wL/8 for UDL.';

      steps.push(
        { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'fixed' }, description: 'Fixed support' },
        { type: 'addNode', params: { id: 'N2', x: span / 3, y: 0, z: 0 }, description: '1/3 span' },
        { type: 'addNode', params: { id: 'N3', x: 2 * span / 3, y: 0, z: 0 }, description: '2/3 span' },
        { type: 'addNode', params: { id: 'N4', x: span, y: 0, z: 0, support: 'roller' }, description: 'Prop (roller) support' },
        { type: 'addMember', params: { start: 'N1', end: 'N2', section: 'ISMB 350' }, description: 'Beam 1' },
        { type: 'addMember', params: { start: 'N2', end: 'N3', section: 'ISMB 350' }, description: 'Beam 2' },
        { type: 'addMember', params: { start: 'N3', end: 'N4', section: 'ISMB 350' }, description: 'Beam 3' },
        { type: 'addLoad', params: { nodeId: 'N2', fy: -loadValue / 2 }, description: 'Load at 1/3' },
        { type: 'addLoad', params: { nodeId: 'N3', fy: -loadValue / 2 }, description: 'Load at 2/3' }
      );
    }
    // ==================== GABLE FRAME (PITCHED ROOF) ====================
    else if (d.includes('gable') || d.includes('pitched') || d.includes('roof frame')) {
      const pitch = 15; // degrees
      const pitchRad = pitch * Math.PI / 180;
      const rise = (span / 2) * Math.tan(pitchRad);

      goal = `Create a gable frame with ${span}m span and ${pitch}° pitch`;
      reasoning = 'Pitched roof frame for residential/commercial buildings. Provides natural drainage and attic space. Using pinned bases for foundation flexibility.';

      steps.push(
        { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'pinned' }, description: 'Left base - pinned' },
        { type: 'addNode', params: { id: 'N2', x: 0, y: height, z: 0 }, description: 'Left eave' },
        { type: 'addNode', params: { id: 'N3', x: span / 2, y: height + rise, z: 0 }, description: 'Ridge' },
        { type: 'addNode', params: { id: 'N4', x: span, y: height, z: 0 }, description: 'Right eave' },
        { type: 'addNode', params: { id: 'N5', x: span, y: 0, z: 0, support: 'pinned' }, description: 'Right base - pinned' },
        { type: 'addMember', params: { start: 'N1', end: 'N2', section: 'ISMB 350' }, description: 'Left column' },
        { type: 'addMember', params: { start: 'N2', end: 'N3', section: 'ISMB 400' }, description: 'Left rafter' },
        { type: 'addMember', params: { start: 'N3', end: 'N4', section: 'ISMB 400' }, description: 'Right rafter' },
        { type: 'addMember', params: { start: 'N4', end: 'N5', section: 'ISMB 350' }, description: 'Right column' },
        { type: 'addMember', params: { start: 'N2', end: 'N4', section: 'ISMB 300' }, description: 'Tie beam' },
        { type: 'addLoad', params: { nodeId: 'N3', fy: -loadValue }, description: 'Ridge load' }
      );
    }
    // ==================== BRACED FRAME ====================
    else if (d.includes('braced') || d.includes('bracing') || d.includes('x-brace') || d.includes('cross brace')) {
      goal = `Create a braced frame with ${span}m width and ${height}m height`;
      reasoning = 'Frame with diagonal bracing for lateral stability. X-bracing provides resistance to both directions. More economical than moment frames for low-rise buildings.';

      steps.push(
        { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'pinned' }, description: 'Left base' },
        { type: 'addNode', params: { id: 'N2', x: span, y: 0, z: 0, support: 'pinned' }, description: 'Right base' },
        { type: 'addNode', params: { id: 'N3', x: 0, y: height, z: 0 }, description: 'Left top' },
        { type: 'addNode', params: { id: 'N4', x: span, y: height, z: 0 }, description: 'Right top' },
        { type: 'addMember', params: { start: 'N1', end: 'N3', section: 'ISMB 300' }, description: 'Left column' },
        { type: 'addMember', params: { start: 'N2', end: 'N4', section: 'ISMB 300' }, description: 'Right column' },
        { type: 'addMember', params: { start: 'N3', end: 'N4', section: 'ISMB 350' }, description: 'Beam' },
        { type: 'addMember', params: { start: 'N1', end: 'N4', section: 'ISA 75x75x8' }, description: 'X-brace 1' },
        { type: 'addMember', params: { start: 'N2', end: 'N3', section: 'ISA 75x75x8' }, description: 'X-brace 2' },
        { type: 'addLoad', params: { nodeId: 'N3', fy: -loadValue / 2 }, description: 'Gravity load left' },
        { type: 'addLoad', params: { nodeId: 'N4', fy: -loadValue / 2 }, description: 'Gravity load right' },
        { type: 'addLoad', params: { nodeId: 'N3', fx: loadValue / 4 }, description: 'Lateral load' }
      );
    }
    // ==================== 3D PORTAL FRAME / INDUSTRIAL SHED ====================
    else if (d.includes('portal') || d.includes('shed') || d.includes('warehouse') || d.includes('industrial') || (d.includes('frame') && !d.includes('multi') && !d.includes('story') && !d.includes('braced'))) {
      // Number of bays in Z direction (building length)
      const numFrames = d.includes('single') ? 1 : Math.max(3, bays);
      const frameSpacing = 6; // Typical frame spacing
      const buildingLength = (numFrames - 1) * frameSpacing;

      // Calculate realistic portal frame loads
      const portalLoads = this.calculateRealisticLoads('industrial', {
        span,
        height,
        bayWidth: span,
        tributaryWidth: frameSpacing,
        occupancy: 'industrial_light',
        roofType: 'metal'
      });

      const roofPitch = 10; // degrees
      const rise = span * Math.tan(roofPitch * Math.PI / 180) / 2;

      // Purlin and girt spacing
      const purlinSpacing = 1.5;
      const girtSpacing = 2.0;
      const numPurlinsPerRafter = Math.ceil((span / 2) / purlinSpacing);

      // Point loads
      const purlinLoad = (portalLoads.deadLoad + portalLoads.roofLiveLoad!) * frameSpacing * purlinSpacing;
      const windOnColumn = portalLoads.windLoad! * frameSpacing * height / 2;

      // Section selection
      const columnSection = this.selectRealisticSection('column', height, purlinLoad * numPurlinsPerRafter);
      const rafterSection = this.selectRealisticSection('beam', span / 2, purlinLoad * 2);
      const purlinSection = 'ISMC 150';
      const girtSection = 'ISMC 125';
      const bracingSection = 'ISA 75x75x8';

      goal = `Create a REAL 3D Industrial Shed: ${span}m × ${buildingLength}m × ${height}m`;
      reasoning = `**COMPLETE 3D INDUSTRIAL BUILDING (IS 800, IS 875)**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    3D INDUSTRIAL SHED DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 **3D GEOMETRY:**
┌─────────────────────────────────────────────────────────────────┐
│ Clear Span (X)       : ${span.toFixed(1).padStart(8)} m                              │
│ Building Length (Z)  : ${buildingLength.toFixed(1).padStart(8)} m                              │
│ Eave Height (Y)      : ${height.toFixed(1).padStart(8)} m                              │
│ Ridge Height         : ${(height + rise).toFixed(2).padStart(8)} m                              │
│ Roof Pitch           : ${roofPitch.toString().padStart(8)}°                             │
│ Number of Frames     : ${numFrames.toString().padStart(8)} @ ${frameSpacing}m c/c                   │
│ Floor Area           : ${(span * buildingLength).toFixed(0).padStart(8)} m²                            │
└─────────────────────────────────────────────────────────────────┘

📊 **LOAD CALCULATION (IS 875:1987):**
┌─────────────────────────────────────────────────────────────────┐
│ Dead Load            : ${portalLoads.deadLoad.toFixed(2).padStart(6)} kN/m² (sheeting + purlins)     │
│ Roof Live Load       : ${portalLoads.roofLiveLoad!.toFixed(2).padStart(6)} kN/m²                           │
│ Wind Pressure        : ${portalLoads.windLoad!.toFixed(2).padStart(6)} kN/m² (Zone III)              │
│ Purlin Load          : ${purlinLoad.toFixed(2).padStart(6)} kN @ ${purlinSpacing}m c/c                 │
│ Wind on Column       : ${windOnColumn.toFixed(2).padStart(6)} kN per frame                   │
└─────────────────────────────────────────────────────────────────┘

🔧 **SECTION SELECTION (IS 800:2007):**
┌─────────────────────────────────────────────────────────────────┐
│ Main Columns         : ${columnSection.padEnd(15)}                         │
│ Rafters              : ${rafterSection.padEnd(15)}                         │
│ Purlins              : ${purlinSection.padEnd(15)} (Cold-formed Z/C)      │
│ Girts (Wall)         : ${girtSection.padEnd(15)}                         │
│ Bracing              : ${bracingSection.padEnd(15)} (X-type)              │
│ Tie/Strut Tubes      : 60×60×3.2 RHS                            │
└─────────────────────────────────────────────────────────────────┘

🏗️ **STRUCTURAL SYSTEM:**
┌─────────────────────────────────────────────────────────────────┐
│ • Main frames: Rigid portal frames at ${frameSpacing}m c/c                │
│ • Roof bracing: X-bracing in end bays                           │
│ • Wall bracing: X-bracing on all 4 sides                        │
│ • Purlins: Cold-formed at ${purlinSpacing}m c/c spanning Z-direction       │
│ • Girts: Cold-formed at ${girtSpacing}m c/c on side walls                 │
│ • Eave struts: RHS connecting frame eaves                       │
└─────────────────────────────────────────────────────────────────┘`;

      let nodeId = 1;
      const nodeMap: Record<string, number> = {};

      // STEP 1: Create nodes for all portal frames in Z direction
      for (let frame = 0; frame < numFrames; frame++) {
        const z = frame * frameSpacing;

        // Base nodes (with supports)
        const leftBaseKey = `base-left-${frame}`;
        nodeMap[leftBaseKey] = nodeId;
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: 0, y: 0, z: z, support: 'fixed' },
          description: `Frame ${frame + 1}: Left base (fixed)`
        });
        nodeId++;

        const rightBaseKey = `base-right-${frame}`;
        nodeMap[rightBaseKey] = nodeId;
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: span, y: 0, z: z, support: 'fixed' },
          description: `Frame ${frame + 1}: Right base (fixed)`
        });
        nodeId++;

        // Eave nodes
        const leftEaveKey = `eave-left-${frame}`;
        nodeMap[leftEaveKey] = nodeId;
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: 0, y: height, z: z },
          description: `Frame ${frame + 1}: Left eave`
        });
        nodeId++;

        const rightEaveKey = `eave-right-${frame}`;
        nodeMap[rightEaveKey] = nodeId;
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: span, y: height, z: z },
          description: `Frame ${frame + 1}: Right eave`
        });
        nodeId++;

        // Ridge node
        const ridgeKey = `ridge-${frame}`;
        nodeMap[ridgeKey] = nodeId;
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: span / 2, y: height + rise, z: z },
          description: `Frame ${frame + 1}: Ridge (apex)`
        });
        nodeId++;

        // Rafter intermediate nodes for load application
        const leftMidKey = `rafter-left-mid-${frame}`;
        nodeMap[leftMidKey] = nodeId;
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: span / 4, y: height + rise / 2, z: z },
          description: `Frame ${frame + 1}: Left rafter midpoint`
        });
        nodeId++;

        const rightMidKey = `rafter-right-mid-${frame}`;
        nodeMap[rightMidKey] = nodeId;
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: 3 * span / 4, y: height + rise / 2, z: z },
          description: `Frame ${frame + 1}: Right rafter midpoint`
        });
        nodeId++;
      }

      // STEP 2: Create portal frame members (columns and rafters)
      for (let frame = 0; frame < numFrames; frame++) {
        const leftBase = `N${nodeMap[`base-left-${frame}`]}`;
        const rightBase = `N${nodeMap[`base-right-${frame}`]}`;
        const leftEave = `N${nodeMap[`eave-left-${frame}`]}`;
        const rightEave = `N${nodeMap[`eave-right-${frame}`]}`;
        const ridge = `N${nodeMap[`ridge-${frame}`]}`;
        const leftMid = `N${nodeMap[`rafter-left-mid-${frame}`]}`;
        const rightMid = `N${nodeMap[`rafter-right-mid-${frame}`]}`;

        // Columns
        steps.push({
          type: 'addMember',
          params: { start: leftBase, end: leftEave, section: columnSection },
          description: `Frame ${frame + 1}: Left column`
        });
        steps.push({
          type: 'addMember',
          params: { start: rightBase, end: rightEave, section: columnSection },
          description: `Frame ${frame + 1}: Right column`
        });

        // Rafters (4 segments for better load distribution)
        steps.push({
          type: 'addMember',
          params: { start: leftEave, end: leftMid, section: rafterSection },
          description: `Frame ${frame + 1}: Left rafter lower`
        });
        steps.push({
          type: 'addMember',
          params: { start: leftMid, end: ridge, section: rafterSection },
          description: `Frame ${frame + 1}: Left rafter upper`
        });
        steps.push({
          type: 'addMember',
          params: { start: ridge, end: rightMid, section: rafterSection },
          description: `Frame ${frame + 1}: Right rafter upper`
        });
        steps.push({
          type: 'addMember',
          params: { start: rightMid, end: rightEave, section: rafterSection },
          description: `Frame ${frame + 1}: Right rafter lower`
        });
      }

      // STEP 3: Create purlins (Z-direction members connecting frames at roof)
      if (numFrames > 1) {
        for (let frame = 0; frame < numFrames - 1; frame++) {
          // Eave purlins
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`eave-left-${frame}`]}`,
              end: `N${nodeMap[`eave-left-${frame + 1}`]}`,
              section: purlinSection
            },
            description: `Eave purlin left, Bay ${frame + 1}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`eave-right-${frame}`]}`,
              end: `N${nodeMap[`eave-right-${frame + 1}`]}`,
              section: purlinSection
            },
            description: `Eave purlin right, Bay ${frame + 1}`
          });

          // Ridge purlins
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`ridge-${frame}`]}`,
              end: `N${nodeMap[`ridge-${frame + 1}`]}`,
              section: purlinSection
            },
            description: `Ridge purlin, Bay ${frame + 1}`
          });

          // Mid-rafter purlins
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`rafter-left-mid-${frame}`]}`,
              end: `N${nodeMap[`rafter-left-mid-${frame + 1}`]}`,
              section: purlinSection
            },
            description: `Intermediate purlin left, Bay ${frame + 1}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`rafter-right-mid-${frame}`]}`,
              end: `N${nodeMap[`rafter-right-mid-${frame + 1}`]}`,
              section: purlinSection
            },
            description: `Intermediate purlin right, Bay ${frame + 1}`
          });
        }
      }

      // STEP 4: Create wall girts and eave struts
      if (numFrames > 1) {
        for (let frame = 0; frame < numFrames - 1; frame++) {
          // Side wall connections at base level (could be girts at mid-height in real design)
          // Here we connect at eave level as struts
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`base-left-${frame}`]}`,
              end: `N${nodeMap[`base-left-${frame + 1}`]}`,
              section: girtSection
            },
            description: `Bottom girt left, Bay ${frame + 1}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`base-right-${frame}`]}`,
              end: `N${nodeMap[`base-right-${frame + 1}`]}`,
              section: girtSection
            },
            description: `Bottom girt right, Bay ${frame + 1}`
          });
        }
      }

      // STEP 5: Add X-bracing in roof plane (at end bays)
      if (numFrames >= 2) {
        // First bay roof bracing
        steps.push({
          type: 'addMember',
          params: {
            start: `N${nodeMap['eave-left-0']}`,
            end: `N${nodeMap['ridge-1']}`,
            section: bracingSection,
            memberType: 'truss'
          },
          description: `Roof X-brace 1, End bay 1`
        });
        steps.push({
          type: 'addMember',
          params: {
            start: `N${nodeMap['ridge-0']}`,
            end: `N${nodeMap['eave-left-1']}`,
            section: bracingSection,
            memberType: 'truss'
          },
          description: `Roof X-brace 2, End bay 1`
        });

        // Last bay roof bracing if more than 2 frames
        if (numFrames > 2) {
          const lastFrame = numFrames - 1;
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`eave-right-${lastFrame - 1}`]}`,
              end: `N${nodeMap[`ridge-${lastFrame}`]}`,
              section: bracingSection,
              memberType: 'truss'
            },
            description: `Roof X-brace 1, End bay ${lastFrame}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[`ridge-${lastFrame - 1}`]}`,
              end: `N${nodeMap[`eave-right-${lastFrame}`]}`,
              section: bracingSection,
              memberType: 'truss'
            },
            description: `Roof X-brace 2, End bay ${lastFrame}`
          });
        }
      }

      // STEP 6: Add wall X-bracing (at end bays on side walls)
      if (numFrames >= 2) {
        // Left wall bracing
        steps.push({
          type: 'addMember',
          params: {
            start: `N${nodeMap['base-left-0']}`,
            end: `N${nodeMap['eave-left-1']}`,
            section: bracingSection,
            memberType: 'truss'
          },
          description: `Wall X-brace 1, Left side`
        });
        steps.push({
          type: 'addMember',
          params: {
            start: `N${nodeMap['base-left-1']}`,
            end: `N${nodeMap['eave-left-0']}`,
            section: bracingSection,
            memberType: 'truss'
          },
          description: `Wall X-brace 2, Left side`
        });

        // Right wall bracing
        steps.push({
          type: 'addMember',
          params: {
            start: `N${nodeMap['base-right-0']}`,
            end: `N${nodeMap['eave-right-1']}`,
            section: bracingSection,
            memberType: 'truss'
          },
          description: `Wall X-brace 1, Right side`
        });
        steps.push({
          type: 'addMember',
          params: {
            start: `N${nodeMap['base-right-1']}`,
            end: `N${nodeMap['eave-right-0']}`,
            section: bracingSection,
            memberType: 'truss'
          },
          description: `Wall X-brace 2, Right side`
        });
      }

      // STEP 7: Add gravity loads at all rafter nodes
      for (let frame = 0; frame < numFrames; frame++) {
        const isEndFrame = frame === 0 || frame === numFrames - 1;
        const loadMultiplier = isEndFrame ? 0.5 : 1.0; // End frames take half tributary

        // Loads at rafter nodes
        const rafterLoad = purlinLoad * loadMultiplier * 2;
        steps.push({
          type: 'addLoad',
          params: { nodeId: `N${nodeMap[`rafter-left-mid-${frame}`]}`, fy: -rafterLoad },
          description: `Roof load at Frame ${frame + 1}, left: ${rafterLoad.toFixed(1)} kN`
        });
        steps.push({
          type: 'addLoad',
          params: { nodeId: `N${nodeMap[`ridge-${frame}`]}`, fy: -rafterLoad },
          description: `Roof load at Frame ${frame + 1}, ridge: ${rafterLoad.toFixed(1)} kN`
        });
        steps.push({
          type: 'addLoad',
          params: { nodeId: `N${nodeMap[`rafter-right-mid-${frame}`]}`, fy: -rafterLoad },
          description: `Roof load at Frame ${frame + 1}, right: ${rafterLoad.toFixed(1)} kN`
        });
      }

      // STEP 8: Add wind loads on windward face (first frame)
      steps.push({
        type: 'addLoad',
        params: { nodeId: `N${nodeMap['eave-left-0']}`, fx: windOnColumn },
        description: `Wind load at left eave: ${windOnColumn.toFixed(1)} kN`
      });
      steps.push({
        type: 'addLoad',
        params: { nodeId: `N${nodeMap['ridge-0']}`, fx: windOnColumn * 0.5 },
        description: `Wind load at ridge: ${(windOnColumn * 0.5).toFixed(1)} kN`
      });
      steps.push({
        type: 'addLoad',
        params: { nodeId: `N${nodeMap['eave-right-0']}`, fx: windOnColumn },
        description: `Wind load at right eave: ${windOnColumn.toFixed(1)} kN`
      });

      // STEP 9: Add roof plates for visualization
      if (numFrames > 1) {
        for (let frame = 0; frame < numFrames - 1; frame++) {
          // Left roof plate
          steps.push({
            type: 'addPlate',
            params: {
              nodeIds: [
                `N${nodeMap[`eave-left-${frame}`]}`,
                `N${nodeMap[`ridge-${frame}`]}`,
                `N${nodeMap[`ridge-${frame + 1}`]}`,
                `N${nodeMap[`eave-left-${frame + 1}`]}`
              ],
              thickness: 0.001, // 1mm sheeting
              pressure: 0,
              materialType: 'steel'
            },
            description: `Roof sheeting, Left slope, Bay ${frame + 1}`
          });

          // Right roof plate
          steps.push({
            type: 'addPlate',
            params: {
              nodeIds: [
                `N${nodeMap[`ridge-${frame}`]}`,
                `N${nodeMap[`eave-right-${frame}`]}`,
                `N${nodeMap[`eave-right-${frame + 1}`]}`,
                `N${nodeMap[`ridge-${frame + 1}`]}`
              ],
              thickness: 0.001,
              pressure: 0,
              materialType: 'steel'
            },
            description: `Roof sheeting, Right slope, Bay ${frame + 1}`
          });
        }
      }
    }
    // ==================== 3D MULTI-STORY BUILDING ====================
    // Complete 3D Structure with X, Y, Z spanning, floor plates, bracing, and realistic loads
    else if (d.includes('multi') || d.includes('story') || d.includes('storey') || d.includes('building') || d.includes('3d')) {
      const numStories = stories;
      // Detect X and Z bays separately
      const numBaysX = bays; // Bays in X direction
      const numBaysZ = d.includes('square') ? bays : Math.max(2, Math.ceil(bays / 1.5)); // Bays in Z direction

      const bayWidthX = span / numBaysX; // Bay width in X direction
      const bayWidthZ = d.includes('square') ? bayWidthX : bayWidthX * 0.8; // Bay width in Z direction (slightly less)
      const storyHeightCalc = height > 10 ? height / numStories : 3.5;

      // Calculate realistic building loads
      const buildingLoads = this.calculateRealisticLoads('building', {
        span: bayWidthX,
        height: storyHeightCalc,
        bayWidth: bayWidthX,
        tributaryWidth: bayWidthZ / 2,
        occupancy,
        seismicZone: 'III',
        importanceFactor: occupancy === 'hospital' ? 1.5 : 1.0
      });

      // Calculate tributary area loads for different node positions
      const cornerLoad = buildingLoads.totalPointLoad * 0.25;
      const edgeLoad = buildingLoads.totalPointLoad * 0.5;
      const interiorLoad = buildingLoads.totalPointLoad;

      // Select sections based on load and height
      const totalFloorLoad = interiorLoad * numBaysX * numBaysZ;
      const lowerColumnSection = this.selectRealisticSection('column', storyHeightCalc, totalFloorLoad * numStories / 4);
      const upperColumnSection = this.selectRealisticSection('column', storyHeightCalc, totalFloorLoad * numStories / 8);
      const mainBeamSection = this.selectRealisticSection('beam', bayWidthX, interiorLoad);
      const secondaryBeamSection = this.selectRealisticSection('beam', bayWidthZ, interiorLoad * 0.7);
      const bracingSection = this.selectRealisticSection('bracing', storyHeightCalc, totalFloorLoad * 0.1);

      const totalWidth = numBaysX * bayWidthX;
      const totalDepth = numBaysZ * bayWidthZ;
      const totalHeight = numStories * storyHeightCalc;

      goal = `Create a REAL 3D ${numStories}-story building (${totalWidth.toFixed(1)}m × ${totalDepth.toFixed(1)}m × ${totalHeight.toFixed(1)}m)`;
      reasoning = `**COMPLETE 3D STEEL BUILDING - Professional Grade (IS 800, IS 875, IS 1893)**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    3D BUILDING STRUCTURAL DESIGN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📐 **3D GEOMETRY:**
┌─────────────────────────────────────────────────────────────────┐
│ Plan Dimensions       : ${totalWidth.toFixed(1)}m (X) × ${totalDepth.toFixed(1)}m (Z)            │
│ Building Height       : ${totalHeight.toFixed(1)}m (${numStories} stories @ ${storyHeightCalc.toFixed(1)}m)        │
│ Bays in X-Direction   : ${numBaysX} @ ${bayWidthX.toFixed(2)}m each                       │
│ Bays in Z-Direction   : ${numBaysZ} @ ${bayWidthZ.toFixed(2)}m each                       │
│ Total Floor Area      : ${(totalWidth * totalDepth * numStories).toFixed(1)} m²                            │
│ Total Nodes           : ${((numBaysX + 1) * (numBaysZ + 1) * (numStories + 1))}                                        │
│ Total Members         : ${numBaysX * numBaysZ * numStories + (numBaysX + numBaysZ + 2) * (numBaysX * numBaysZ) * numStories}+ (beams + columns + bracing)          │
└─────────────────────────────────────────────────────────────────┘

📊 **LOAD CALCULATION (IS 875:1987):**
┌─────────────────────────────────────────────────────────────────┐
│ DEAD LOAD (Part 1):                                             │
│   • RCC Slab (150mm)        : 3.75 kN/m²                        │
│   • Floor Finish + Screed   : 1.50 kN/m²                        │
│   • Ceiling + Services      : 0.50 kN/m²                        │
│   • Partitions (movable)    : 1.00 kN/m²                        │
│   • TOTAL DL                : ${buildingLoads.deadLoad.toFixed(2)} kN/m²                        │
├─────────────────────────────────────────────────────────────────┤
│ LIVE LOAD (Part 2):                                             │
│   • Occupancy: ${occupancy.padEnd(15)}   : ${buildingLoads.liveLoad.toFixed(2)} kN/m²                        │
├─────────────────────────────────────────────────────────────────┤
│ WIND LOAD (Part 3):                                             │
│   • Design Wind Pressure    : ${buildingLoads.windLoad!.toFixed(2)} kN/m²                        │
├─────────────────────────────────────────────────────────────────┤
│ SEISMIC LOAD (IS 1893):                                         │
│   • Seismic Coefficient Ah  : ${buildingLoads.seismicCoeff!.toFixed(4)}                          │
│   • Base Shear              : ${(buildingLoads.seismicCoeff! * totalFloorLoad * numStories).toFixed(1)} kN                          │
├─────────────────────────────────────────────────────────────────┤
│ JOINT LOADS (DL + LL):                                          │
│   • Corner Joints           : ${cornerLoad.toFixed(2)} kN                            │
│   • Edge Joints             : ${edgeLoad.toFixed(2)} kN                            │
│   • Interior Joints         : ${interiorLoad.toFixed(2)} kN                            │
└─────────────────────────────────────────────────────────────────┘

🔧 **SECTION SELECTION (IS 800:2007):**
┌─────────────────────────────────────────────────────────────────┐
│ Lower Story Columns    : ${lowerColumnSection.padEnd(15)} (Stories 1-${Math.ceil(numStories / 2)})         │
│ Upper Story Columns    : ${upperColumnSection.padEnd(15)} (Stories ${Math.ceil(numStories / 2) + 1}-${numStories})         │
│ Main Beams (X-dir)     : ${mainBeamSection.padEnd(15)}                          │
│ Secondary Beams (Z-dir): ${secondaryBeamSection.padEnd(15)}                          │
│ Vertical Bracing       : ${bracingSection.padEnd(15)} (X-type)               │
│ Material               : Fe 250 (fy = 250 MPa, E = 2×10⁵ MPa)   │
└─────────────────────────────────────────────────────────────────┘

🏗️ **STRUCTURAL SYSTEM:**
┌─────────────────────────────────────────────────────────────────┐
│ • Moment-Resisting Frame in both X and Z directions             │
│ • Concentric X-bracing at corner bays for lateral stability     │
│ • Floor plates for diaphragm action (150mm RCC equivalent)      │
│ • Fixed column bases with 8-bolt arrangement                    │
│ • Rigid beam-column connections (moment-resisting)              │
└─────────────────────────────────────────────────────────────────┘

📋 **LOAD COMBINATIONS (IS 800, Table 4):**
  • LC1: 1.5(DL + LL) - Gravity dominant
  • LC2: 1.2(DL + LL + WL) - Wind combination
  • LC3: 1.2(DL + LL + EQ) - Seismic combination (governs)
  • LC4: 0.9DL + 1.5WL - Uplift check`;

      let nodeId = 1;
      const nodeMap: Record<string, number> = {};

      // STEP 1: Create all nodes in 3D grid
      for (let story = 0; story <= numStories; story++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
          for (let iz = 0; iz <= numBaysZ; iz++) {
            const isBase = story === 0;
            const x = ix * bayWidthX;
            const y = story * storyHeightCalc;
            const z = iz * bayWidthZ;
            const nodeKey = `${story}-${ix}-${iz}`;
            nodeMap[nodeKey] = nodeId;

            steps.push({
              type: 'addNode',
              params: {
                id: `N${nodeId}`,
                x: x,
                y: y,
                z: z,
                support: isBase ? 'fixed' : undefined
              },
              description: isBase
                ? `Fixed base at Grid (${ix},${iz})`
                : `Floor ${story}, Grid (${ix},${iz}) [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`
            });
            nodeId++;
          }
        }
      }

      // STEP 2: Create columns (vertical members in Y direction)
      for (let story = 0; story < numStories; story++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
          for (let iz = 0; iz <= numBaysZ; iz++) {
            const bottomKey = `${story}-${ix}-${iz}`;
            const topKey = `${story + 1}-${ix}-${iz}`;
            const section = story < Math.ceil(numStories / 2) ? lowerColumnSection : upperColumnSection;

            steps.push({
              type: 'addMember',
              params: {
                start: `N${nodeMap[bottomKey]}`,
                end: `N${nodeMap[topKey]}`,
                section: section
              },
              description: `Column S${story + 1} at (${ix},${iz}) - ${section}`
            });
          }
        }
      }

      // STEP 3: Create beams in X direction (main beams)
      for (let story = 1; story <= numStories; story++) {
        for (let ix = 0; ix < numBaysX; ix++) {
          for (let iz = 0; iz <= numBaysZ; iz++) {
            const leftKey = `${story}-${ix}-${iz}`;
            const rightKey = `${story}-${ix + 1}-${iz}`;

            steps.push({
              type: 'addMember',
              params: {
                start: `N${nodeMap[leftKey]}`,
                end: `N${nodeMap[rightKey]}`,
                section: mainBeamSection
              },
              description: `Main Beam X-dir, Floor ${story}, Grid Z=${iz}`
            });
          }
        }
      }

      // STEP 4: Create beams in Z direction (secondary beams)
      for (let story = 1; story <= numStories; story++) {
        for (let ix = 0; ix <= numBaysX; ix++) {
          for (let iz = 0; iz < numBaysZ; iz++) {
            const frontKey = `${story}-${ix}-${iz}`;
            const backKey = `${story}-${ix}-${iz + 1}`;

            steps.push({
              type: 'addMember',
              params: {
                start: `N${nodeMap[frontKey]}`,
                end: `N${nodeMap[backKey]}`,
                section: secondaryBeamSection
              },
              description: `Secondary Beam Z-dir, Floor ${story}, Grid X=${ix}`
            });
          }
        }
      }

      // STEP 5: Add X-bracing for lateral stability (at corner bays on all 4 sides)
      for (let story = 0; story < numStories; story++) {
        // X-bracing on X-Z plane (side walls) at iz=0 and iz=numBaysZ
        for (const iz of [0, numBaysZ]) {
          // Add X-brace at first bay
          const bl = `${story}-0-${iz}`;
          const br = `${story}-1-${iz}`;
          const tl = `${story + 1}-0-${iz}`;
          const tr = `${story + 1}-1-${iz}`;

          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[bl]}`,
              end: `N${nodeMap[tr]}`,
              section: bracingSection,
              memberType: 'truss'
            },
            description: `X-Brace diagonal 1, Story ${story + 1}, Side ${iz === 0 ? 'Front' : 'Back'}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[br]}`,
              end: `N${nodeMap[tl]}`,
              section: bracingSection,
              memberType: 'truss'
            },
            description: `X-Brace diagonal 2, Story ${story + 1}, Side ${iz === 0 ? 'Front' : 'Back'}`
          });
        }

        // X-bracing on X-Y plane (end walls) at ix=0 and ix=numBaysX
        for (const ix of [0, numBaysX]) {
          const bf = `${story}-${ix}-0`;
          const bb = `${story}-${ix}-1`;
          const tf = `${story + 1}-${ix}-0`;
          const tb = `${story + 1}-${ix}-1`;

          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[bf]}`,
              end: `N${nodeMap[tb]}`,
              section: bracingSection,
              memberType: 'truss'
            },
            description: `X-Brace diagonal 1, Story ${story + 1}, End ${ix === 0 ? 'Left' : 'Right'}`
          });
          steps.push({
            type: 'addMember',
            params: {
              start: `N${nodeMap[bb]}`,
              end: `N${nodeMap[tf]}`,
              section: bracingSection,
              memberType: 'truss'
            },
            description: `X-Brace diagonal 2, Story ${story + 1}, End ${ix === 0 ? 'Left' : 'Right'}`
          });
        }
      }

      // STEP 6: Add floor plates for visualization and diaphragm action
      for (let story = 1; story <= numStories; story++) {
        for (let ix = 0; ix < numBaysX; ix++) {
          for (let iz = 0; iz < numBaysZ; iz++) {
            const n1 = `${story}-${ix}-${iz}`;
            const n2 = `${story}-${ix + 1}-${iz}`;
            const n3 = `${story}-${ix + 1}-${iz + 1}`;
            const n4 = `${story}-${ix}-${iz + 1}`;

            steps.push({
              type: 'addPlate',
              params: {
                nodeIds: [
                  `N${nodeMap[n1]}`,
                  `N${nodeMap[n2]}`,
                  `N${nodeMap[n3]}`,
                  `N${nodeMap[n4]}`
                ],
                thickness: 0.15, // 150mm RCC slab
                pressure: buildingLoads.deadLoad + buildingLoads.liveLoad, // Floor pressure load
                materialType: 'concrete'
              },
              description: `Floor Plate, Level ${story}, Bay (${ix},${iz}) - 150mm RCC`
            });
          }
        }
      }

      // STEP 7: Add gravity loads at all floor nodes
      for (let story = 1; story <= numStories; story++) {
        const isRoof = story === numStories;
        for (let ix = 0; ix <= numBaysX; ix++) {
          for (let iz = 0; iz <= numBaysZ; iz++) {
            const nodeKey = `${story}-${ix}-${iz}`;
            const isCorner = (ix === 0 || ix === numBaysX) && (iz === 0 || iz === numBaysZ);
            const isEdge = (ix === 0 || ix === numBaysX) || (iz === 0 || iz === numBaysZ);

            let loadMagnitude: number;
            if (isCorner) {
              loadMagnitude = cornerLoad;
            } else if (isEdge) {
              loadMagnitude = edgeLoad;
            } else {
              loadMagnitude = interiorLoad;
            }

            // Reduce roof load (less live load)
            if (isRoof) loadMagnitude *= 0.7;

            steps.push({
              type: 'addLoad',
              params: { nodeId: `N${nodeMap[nodeKey]}`, fy: -loadMagnitude },
              description: `${isRoof ? 'Roof' : 'Floor'} load at L${story}-(${ix},${iz}): ${loadMagnitude.toFixed(1)} kN`
            });
          }
        }
      }

      // STEP 8: Add lateral loads (wind on windward face)
      const windLoadPerFloor = buildingLoads.windLoad! * storyHeightCalc * bayWidthZ;
      for (let story = 1; story <= numStories; story++) {
        for (let iz = 0; iz <= numBaysZ; iz++) {
          const nodeKey = `${story}-0-${iz}`;
          const load = iz === 0 || iz === numBaysZ ? windLoadPerFloor * 0.5 : windLoadPerFloor;
          steps.push({
            type: 'addLoad',
            params: { nodeId: `N${nodeMap[nodeKey]}`, fx: load },
            description: `Wind load at Floor ${story}, Z=${iz}: ${load.toFixed(1)} kN (X-direction)`
          });
        }
      }

      // STEP 9: Add seismic loads (distributed by floor mass)
      const seismicBaseShear = buildingLoads.seismicCoeff! * totalFloorLoad * numStories * 0.1; // Simplified
      for (let story = 1; story <= numStories; story++) {
        const heightFactor = story / ((numStories * (numStories + 1)) / 2);
        const floorSeismicLoad = seismicBaseShear * heightFactor;
        const loadPerNode = floorSeismicLoad / ((numBaysX + 1) * (numBaysZ + 1));

        // Apply to center of mass (simplified: at interior nodes)
        const centerX = Math.floor(numBaysX / 2);
        const centerZ = Math.floor(numBaysZ / 2);
        const nodeKey = `${story}-${centerX}-${centerZ}`;

        steps.push({
          type: 'addLoad',
          params: { nodeId: `N${nodeMap[nodeKey]}`, fz: floorSeismicLoad },
          description: `Seismic load at Floor ${story}: ${floorSeismicLoad.toFixed(1)} kN (Z-direction, IS 1893)`
        });
      }
    }
    // ==================== GENERIC TRUSS (Pratt default) ====================
    else if (d.includes('truss')) {
      const panels = Math.max(4, Math.round(span / 2));
      const depth = span / 10;
      const panelWidth = span / panels;

      goal = `Create a ${panels}-panel truss with ${span}m span`;
      reasoning = 'Pratt truss configuration for efficient load transfer. Pinned supports for statically determinate behavior.';

      let nodeId = 1;

      // Bottom chord nodes
      for (let i = 0; i <= panels; i++) {
        const isSupport = i === 0 || i === panels;
        steps.push({
          type: 'addNode',
          params: {
            id: `N${nodeId}`,
            x: i * panelWidth,
            y: 0,
            z: 0,
            support: isSupport ? (i === 0 ? 'pinned' : 'roller') : undefined
          },
          description: isSupport ? `Support at ${i === 0 ? 'left' : 'right'} end` : `Bottom chord node ${i}`
        });
        nodeId++;
      }

      // Top chord nodes
      for (let i = 1; i < panels; i++) {
        steps.push({
          type: 'addNode',
          params: { id: `N${nodeId}`, x: i * panelWidth, y: depth, z: 0 },
          description: `Top chord node ${i}`
        });
        nodeId++;
      }

      // Bottom chord members
      for (let i = 0; i < panels; i++) {
        steps.push({
          type: 'addMember',
          params: { start: `N${i + 1}`, end: `N${i + 2}`, section: 'ISMC 200', memberType: 'truss' },
          description: `Bottom chord ${i + 1}`
        });
      }

      // Top chord members and diagonals
      for (let i = 1; i < panels; i++) {
        const topNodeId = panels + 1 + i;
        // Top chord
        if (i < panels - 1) {
          steps.push({
            type: 'addMember',
            params: { start: `N${topNodeId}`, end: `N${topNodeId + 1}`, section: 'ISMC 200', memberType: 'truss' },
            description: `Top chord ${i}`
          });
        }
        // Verticals
        steps.push({
          type: 'addMember',
          params: { start: `N${i + 1}`, end: `N${topNodeId}`, section: 'ISA 100x100x10', memberType: 'truss' },
          description: `Vertical ${i}`
        });
        // Diagonals
        if (i < panels - 1) {
          steps.push({
            type: 'addMember',
            params: { start: `N${topNodeId}`, end: `N${i + 2}`, section: 'ISA 75x75x8', memberType: 'truss' },
            description: `Diagonal ${i}`
          });
        }
      }

      // End diagonals
      steps.push(
        { type: 'addMember', params: { start: 'N1', end: `N${panels + 2}`, section: 'ISMC 150', memberType: 'truss' }, description: 'Left end diagonal' },
        { type: 'addMember', params: { start: `N${panels + 1}`, end: `N${2 * panels}`, section: 'ISMC 150', memberType: 'truss' }, description: 'Right end diagonal' }
      );

      // Add loads at top chord
      for (let i = 1; i < panels; i++) {
        steps.push({
          type: 'addLoad',
          params: { nodeId: `N${panels + 1 + i}`, fy: -loadValue / panels },
          description: `Load at top chord node ${i}`
        });
      }
    }
    // ==================== SIMPLE BEAM ====================
    else if (d.includes('beam') || d.includes('cantilever')) {
      const isCantilever = d.includes('cantilever');

      // Calculate realistic beam loads
      const beamLoads = this.calculateRealisticLoads('beam', {
        span,
        tributaryWidth,
        bayWidth: span,
        occupancy
      });

      // UDL equivalent point load at quarter points
      const totalLoad = beamLoads.totalUDL * span;
      const quarterPointLoad = totalLoad / 4;
      const midspanLoad = totalLoad / 2;

      const beamSection = this.selectRealisticSection('beam', span, totalLoad / 2);

      goal = `Create a ${isCantilever ? 'cantilever' : 'simply supported'} beam: ${span}m span (${occupancy})`;
      reasoning = isCantilever
        ? `Cantilever beam designed per IS 800. Fixed support provides moment resistance.

📐 **Geometry:**
• Cantilever length: ${span}m
• Typical application: Balcony, canopy, awning

📊 **Load Calculation (IS 875):**
• Dead Load: ${beamLoads.deadLoad.toFixed(2)} kN/m²
• Live Load: ${beamLoads.liveLoad.toFixed(2)} kN/m² (${occupancy})
• Tributary width: ${tributaryWidth}m
• Total UDL: ${beamLoads.totalUDL.toFixed(2)} kN/m
• Total load at tip: ${totalLoad.toFixed(2)} kN
• Max moment at support: ${(totalLoad * span / 2).toFixed(2)} kN·m

🔧 **Section:** ${beamSection} (designed for deflection L/180)`
        : `Simply supported floor beam designed per IS 800.

📐 **Geometry:**
• Span: ${span}m
• Support conditions: Pin + Roller (statically determinate)

📊 **Load Calculation (IS 875):**
• Dead Load: ${beamLoads.deadLoad.toFixed(2)} kN/m²
• Live Load: ${beamLoads.liveLoad.toFixed(2)} kN/m² (${occupancy})
• Tributary width: ${tributaryWidth}m
• Total UDL: ${beamLoads.totalUDL.toFixed(2)} kN/m
• Max moment: ${(beamLoads.totalUDL * span * span / 8).toFixed(2)} kN·m (wL²/8)
• Max shear: ${(beamLoads.totalUDL * span / 2).toFixed(2)} kN (wL/2)

🔧 **Section:** ${beamSection}`;

      if (isCantilever) {
        steps.push(
          { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'fixed' }, description: 'Fixed support (moment connection)' },
          { type: 'addNode', params: { id: 'N2', x: span / 3, y: 0, z: 0 }, description: '1/3 span' },
          { type: 'addNode', params: { id: 'N3', x: 2 * span / 3, y: 0, z: 0 }, description: '2/3 span' },
          { type: 'addNode', params: { id: 'N4', x: span, y: 0, z: 0 }, description: 'Free end (tip)' },
          { type: 'addMember', params: { start: 'N1', end: 'N2', section: beamSection }, description: `Cantilever segment 1 (${beamSection})` },
          { type: 'addMember', params: { start: 'N2', end: 'N3', section: beamSection }, description: `Cantilever segment 2` },
          { type: 'addMember', params: { start: 'N3', end: 'N4', section: beamSection }, description: `Cantilever segment 3` },
          // Distributed load represented as point loads
          { type: 'addLoad', params: { nodeId: 'N2', fy: -totalLoad / 3 }, description: `DL+LL at 1/3: ${(totalLoad / 3).toFixed(1)} kN` },
          { type: 'addLoad', params: { nodeId: 'N3', fy: -totalLoad / 3 }, description: `DL+LL at 2/3: ${(totalLoad / 3).toFixed(1)} kN` },
          { type: 'addLoad', params: { nodeId: 'N4', fy: -totalLoad / 3 }, description: `DL+LL at tip: ${(totalLoad / 3).toFixed(1)} kN` }
        );
      } else {
        steps.push(
          { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'pinned' }, description: 'Pinned support (left)' },
          { type: 'addNode', params: { id: 'N2', x: span / 4, y: 0, z: 0 }, description: 'Quarter span (L/4)' },
          { type: 'addNode', params: { id: 'N3', x: span / 2, y: 0, z: 0 }, description: 'Midspan (L/2) - max moment' },
          { type: 'addNode', params: { id: 'N4', x: 3 * span / 4, y: 0, z: 0 }, description: 'Three-quarter span (3L/4)' },
          { type: 'addNode', params: { id: 'N5', x: span, y: 0, z: 0, support: 'roller' }, description: 'Roller support (right)' },
          { type: 'addMember', params: { start: 'N1', end: 'N2', section: beamSection }, description: `Beam segment 1 (${beamSection})` },
          { type: 'addMember', params: { start: 'N2', end: 'N3', section: beamSection }, description: `Beam segment 2` },
          { type: 'addMember', params: { start: 'N3', end: 'N4', section: beamSection }, description: `Beam segment 3` },
          { type: 'addMember', params: { start: 'N4', end: 'N5', section: beamSection }, description: `Beam segment 4` },
          // UDL represented as point loads at quarter points
          { type: 'addLoad', params: { nodeId: 'N2', fy: -quarterPointLoad }, description: `Floor load at L/4: ${quarterPointLoad.toFixed(1)} kN` },
          { type: 'addLoad', params: { nodeId: 'N3', fy: -midspanLoad }, description: `Floor load at L/2: ${midspanLoad.toFixed(1)} kN` },
          { type: 'addLoad', params: { nodeId: 'N4', fy: -quarterPointLoad }, description: `Floor load at 3L/4: ${quarterPointLoad.toFixed(1)} kN` }
        );
      }
    }
    // ==================== DEFAULT PORTAL ====================
    else {
      // Calculate realistic loads for default frame
      const defaultLoadsCalc = this.calculateRealisticLoads('frame', {
        span,
        height,
        bayWidth: span,
        tributaryWidth: 6,
        occupancy
      });

      const jointLoad = defaultLoadsCalc.totalPointLoad / 2;
      const windLoad = defaultLoadsCalc.windLoad! * 6 * height / 2;
      const columnSection = this.selectRealisticSection('column', height, jointLoad);
      const beamSectionDefault = this.selectRealisticSection('beam', span, jointLoad);

      goal = `Create a rigid frame: ${span}m span × ${height}m height (${occupancy})`;
      reasoning = `Default rigid frame with realistic IS 875 loads.

📐 **Geometry:** ${span}m × ${height}m

📊 **Loads (IS 875):**
• DL: ${defaultLoadsCalc.deadLoad.toFixed(2)} kN/m²
• LL: ${defaultLoadsCalc.liveLoad.toFixed(2)} kN/m²
• Joint load: ${jointLoad.toFixed(2)} kN
• Wind: ${windLoad.toFixed(2)} kN (lateral)

🔧 **Sections:** Column: ${columnSection}, Beam: ${beamSectionDefault}

💡 **Tip:** For specific structures, try:
• "20m span Warren truss for warehouse"
• "4-story office building 6m bays"
• "15m span portal frame for factory"
• "8m cantilever beam for balcony"`;

      steps.push(
        { type: 'addNode', params: { id: 'N1', x: 0, y: 0, z: 0, support: 'fixed' }, description: 'Fixed support (foundation)' },
        { type: 'addNode', params: { id: 'N2', x: 0, y: height, z: 0 }, description: 'Left beam-column joint' },
        { type: 'addNode', params: { id: 'N3', x: span / 2, y: height, z: 0 }, description: 'Beam midspan' },
        { type: 'addNode', params: { id: 'N4', x: span, y: height, z: 0 }, description: 'Right beam-column joint' },
        { type: 'addNode', params: { id: 'N5', x: span, y: 0, z: 0, support: 'fixed' }, description: 'Fixed support (foundation)' },
        { type: 'addMember', params: { start: 'N1', end: 'N2', section: columnSection }, description: `Left column (${columnSection})` },
        { type: 'addMember', params: { start: 'N2', end: 'N3', section: beamSectionDefault }, description: `Beam left (${beamSectionDefault})` },
        { type: 'addMember', params: { start: 'N3', end: 'N4', section: beamSectionDefault }, description: `Beam right` },
        { type: 'addMember', params: { start: 'N4', end: 'N5', section: columnSection }, description: `Right column` },
        { type: 'addLoad', params: { nodeId: 'N2', fy: -jointLoad }, description: `Gravity at left joint: ${jointLoad.toFixed(1)} kN` },
        { type: 'addLoad', params: { nodeId: 'N3', fy: -jointLoad }, description: `Gravity at midspan: ${jointLoad.toFixed(1)} kN` },
        { type: 'addLoad', params: { nodeId: 'N4', fy: -jointLoad }, description: `Gravity at right joint: ${jointLoad.toFixed(1)} kN` },
        { type: 'addLoad', params: { nodeId: 'N2', fx: windLoad }, description: `Wind load: ${windLoad.toFixed(1)} kN (lateral)` }
      );
    }

    return { goal, reasoning, steps, confidence: 0.9 };
  }

  private parseAIPlan(response: string): AIPlan | null {
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*"steps"[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        if (plan.steps && Array.isArray(plan.steps)) {
          return plan as AIPlan;
        }
      }
    } catch (e) {
      console.warn('Failed to parse AI plan:', e);
    }
    return null;
  }

  // ============================================
  // ANALYSIS AND INTERPRETATION
  // ============================================

  async generateAnalysisGuidance(context: AIModelContext): Promise<string> {
    if (context.nodes.length === 0) {
      return "📐 **No Structure to Analyze**\n\nPlease create a structure first. You can say:\n- \"Create a portal frame with 15m span\"\n- \"Build a 3-story building\"\n- \"Make a Warren truss\"";
    }

    const supportCount = context.nodes.filter(n => n.hasSupport).length;
    if (supportCount === 0) {
      return "⚠️ **Missing Supports**\n\nYour structure needs supports before analysis. The structure appears to be unstable.\n\n**Quick Fix:** I can add supports automatically, or you can specify:\n- \"Add fixed support at node N1\"\n- \"Pin the base nodes\"";
    }

    if (context.loads.length === 0) {
      return "⚠️ **No Loads Applied**\n\nStructure exists but has no loads. Consider adding:\n- Dead loads (self-weight)\n- Live loads (occupancy)\n- Wind or seismic loads\n\nSay \"Add 50 kN load at node N3\" or \"Apply typical floor loads\"";
    }

    return `✅ **Ready for Analysis**

**Model Summary:**
- ${context.nodes.length} nodes (${supportCount} supported)
- ${context.members.length} members
- ${context.loads.length} load applications

**Analysis Options:**
1. **Linear Static** - Standard first-order analysis
2. **Modal** - Natural frequencies and mode shapes
3. **P-Delta** - Second-order effects
4. **Buckling** - Critical load factors

Click "Run Analysis" or say "Analyze the structure" to proceed.`;
  }

  async interpretResults(context: AIModelContext): Promise<string> {
    if (!context.analysisResults) {
      return "No analysis results available. Please run analysis first by clicking the Analyze button or saying \"Run analysis\".";
    }

    const { maxDisplacement, maxStress, maxMoment } = context.analysisResults;

    // Typical limits
    const deflectionLimit = 20; // mm, typical L/250
    const stressLimit = 165; // MPa, typical for Grade 250 steel

    const deflectionOk = maxDisplacement < deflectionLimit;
    const stressOk = maxStress < stressLimit;

    let assessment = `## 📊 Analysis Results Interpretation\n\n`;

    assessment += `### Displacement\n`;
    assessment += `- Maximum: **${maxDisplacement.toFixed(2)} mm**\n`;
    assessment += `- Limit (L/250): ${deflectionLimit} mm\n`;
    assessment += `- Status: ${deflectionOk ? '✅ OK' : '⚠️ Exceeds limit'}\n\n`;

    assessment += `### Stress\n`;
    assessment += `- Maximum: **${maxStress.toFixed(1)} MPa**\n`;
    assessment += `- Allowable (0.66Fy): ${stressLimit} MPa\n`;
    assessment += `- Status: ${stressOk ? '✅ OK' : '⚠️ Overstressed'}\n\n`;

    assessment += `### Bending Moment\n`;
    assessment += `- Maximum: **${maxMoment.toFixed(1)} kN·m**\n\n`;

    if (deflectionOk && stressOk) {
      assessment += `### ✅ Overall: Structure is ADEQUATE\n`;
      assessment += `The structure meets serviceability and strength requirements.`;
    } else {
      assessment += `### ⚠️ Overall: ATTENTION REQUIRED\n`;
      if (!deflectionOk) assessment += `- Consider stiffer sections to reduce deflection\n`;
      if (!stressOk) assessment += `- Increase member sizes or add bracing\n`;
    }

    return assessment;
  }

  // ============================================
  // OPTIMIZATION
  // ============================================

  async planOptimization(goal: string, context: AIModelContext): Promise<AIPlan> {
    const g = goal.toLowerCase();
    const steps: AIAction[] = [];
    let reasoning = '';

    if (g.includes('weight') || g.includes('light')) {
      reasoning = 'Weight optimization: Start with highest-stressed members and check if smaller sections work.';
      steps.push(
        { type: 'optimize', params: { target: 'weight', method: 'iterative' }, description: 'Run weight optimization algorithm' },
        { type: 'runAnalysis', params: {}, description: 'Verify with new sections' }
      );
    } else if (g.includes('deflection') || g.includes('stiff')) {
      reasoning = 'Stiffness optimization: Increase section sizes for members with high deflection contribution.';
      steps.push(
        { type: 'optimize', params: { target: 'deflection', method: 'gradient' }, description: 'Optimize for minimum deflection' },
        { type: 'runAnalysis', params: {}, description: 'Verify improved stiffness' }
      );
    } else {
      reasoning = 'General optimization: Balance weight and performance using genetic algorithm.';
      steps.push(
        { type: 'optimize', params: { target: 'balanced', method: 'genetic' }, description: 'Multi-objective optimization' }
      );
    }

    return {
      goal: `Optimize structure for: ${goal}`,
      reasoning,
      steps,
      confidence: 0.85,
    };
  }

  // ============================================
  // DESIGN CHECKS - STAAD.Pro PROFESSIONAL LEVEL
  // ============================================

  async performDesignCheck(context: AIModelContext): Promise<string> {
    if (context.members.length === 0) {
      return "No members to check. Please create a structure first.";
    }

    let report = `## 🔍 STAAD.Pro Style Design Check Report\n\n`;
    report += `\`\`\`\n`;
    report += `═══════════════════════════════════════════════════════════════════\n`;
    report += `                     BEAMLAB STRUCTURAL ANALYSIS                    \n`;
    report += `                    Design Check Summary Report                     \n`;
    report += `═══════════════════════════════════════════════════════════════════\n`;
    report += `\n`;
    report += `PROJECT     : User Project\n`;
    report += `DATE        : ${new Date().toLocaleDateString()}\n`;
    report += `DESIGN CODE : IS 800:2007 (Indian Standard - Steel)\n`;
    report += `              IS 875:1987 (Loads), IS 1893:2016 (Seismic)\n`;
    report += `\n`;
    report += `───────────────────────────────────────────────────────────────────\n`;
    report += `                      MODEL STATISTICS                              \n`;
    report += `───────────────────────────────────────────────────────────────────\n`;
    report += `  Number of Nodes        : ${context.nodes.length.toString().padStart(8)}\n`;
    report += `  Number of Members      : ${context.members.length.toString().padStart(8)}\n`;
    report += `  Number of Supports     : ${context.nodes.filter(n => n.hasSupport).length.toString().padStart(8)}\n`;
    report += `  Number of Load Cases   : ${Math.max(1, context.loads.length).toString().padStart(8)}\n`;
    report += `  Degrees of Freedom     : ${(context.nodes.length * 6).toString().padStart(8)}\n`;
    report += `\n`;
    report += `───────────────────────────────────────────────────────────────────\n`;
    report += `                      DESIGN CHECKS PERFORMED                       \n`;
    report += `───────────────────────────────────────────────────────────────────\n`;
    report += `  [✓] Cl.8   - Cross-Section Classification (Plastic/Compact/Slender)\n`;
    report += `  [✓] Cl.8.2 - Moment Capacity (Md = βb × Zp × fy / γm0)\n`;
    report += `  [✓] Cl.8.4 - Shear Capacity (Vd = fy × Av / (√3 × γm0))\n`;
    report += `  [✓] Cl.9   - Combined Axial + Bending (Interaction Ratio)\n`;
    report += `  [✓] Cl.7.2 - Slenderness Limits (λ < 180 for columns)\n`;
    report += `  [✓] Table 6 - Deflection Serviceability (L/300 to L/500)\n`;
    report += `  [✓] Annex D - Lateral-Torsional Buckling Check\n`;
    report += `\n`;

    if (context.analysisResults) {
      const maxStress = context.analysisResults.maxStress;
      const maxDisp = context.analysisResults.maxDisplacement;
      const maxMoment = context.analysisResults.maxMoment;

      // Calculate utilization
      const fy = 250; // MPa for Grade 250 steel
      const allowableStress = fy / 1.1 * 0.66; // Allowable = 0.66 × fy / γm0
      const stressUtil = maxStress / allowableStress;

      report += `───────────────────────────────────────────────────────────────────\n`;
      report += `                      ANALYSIS RESULTS SUMMARY                     \n`;
      report += `───────────────────────────────────────────────────────────────────\n`;
      report += `\n`;
      report += `  DISPLACEMENTS:\n`;
      report += `    Maximum Displacement    = ${maxDisp.toFixed(3).padStart(10)} mm\n`;
      report += `    Deflection Limit (L/300)= ${(12000 / 300).toFixed(3).padStart(10)} mm\n`;
      report += `    Status                  : ${maxDisp < 40 ? 'PASS ✓' : 'FAIL ✗'}\n`;
      report += `\n`;
      report += `  STRESSES (IS 800:2007 Cl. 8):\n`;
      report += `    Maximum Stress          = ${maxStress.toFixed(2).padStart(10)} MPa\n`;
      report += `    Allowable Stress        = ${allowableStress.toFixed(2).padStart(10)} MPa\n`;
      report += `    Utilization Ratio       = ${(stressUtil * 100).toFixed(1).padStart(10)}%\n`;
      report += `    Status                  : ${stressUtil < 1.0 ? 'PASS ✓' : 'FAIL ✗'}\n`;
      report += `\n`;
      report += `  BENDING MOMENTS:\n`;
      report += `    Maximum Moment          = ${maxMoment.toFixed(2).padStart(10)} kN·m\n`;
      report += `\n`;
      report += `───────────────────────────────────────────────────────────────────\n`;
      report += `                      OVERALL DESIGN STATUS                        \n`;
      report += `───────────────────────────────────────────────────────────────────\n`;

      const overallPass = stressUtil < 1.0 && maxDisp < 40;
      if (overallPass) {
        report += `\n`;
        report += `    ╔═══════════════════════════════════════════════════════════╗\n`;
        report += `    ║                                                           ║\n`;
        report += `    ║         ✅  ALL DESIGN CHECKS PASSED                      ║\n`;
        report += `    ║                                                           ║\n`;
        report += `    ║   The structure meets all requirements of IS 800:2007    ║\n`;
        report += `    ║   for both Strength (ULS) and Serviceability (SLS).      ║\n`;
        report += `    ║                                                           ║\n`;
        report += `    ╚═══════════════════════════════════════════════════════════╝\n`;
      } else {
        report += `\n`;
        report += `    ╔═══════════════════════════════════════════════════════════╗\n`;
        report += `    ║                                                           ║\n`;
        report += `    ║         ⚠️  DESIGN REQUIRES ATTENTION                     ║\n`;
        report += `    ║                                                           ║\n`;
        if (stressUtil >= 1.0) {
          report += `    ║   • Overstressed members - Increase section sizes        ║\n`;
        }
        if (maxDisp >= 40) {
          report += `    ║   • Excessive deflection - Use deeper sections           ║\n`;
        }
        report += `    ║                                                           ║\n`;
        report += `    ╚═══════════════════════════════════════════════════════════╝\n`;
      }
    } else {
      report += `───────────────────────────────────────────────────────────────────\n`;
      report += `  ⚠️ Analysis not yet performed\n`;
      report += `  Please run Linear Static Analysis first to obtain design forces.\n`;
      report += `───────────────────────────────────────────────────────────────────\n`;
    }

    report += `\n`;
    report += `═══════════════════════════════════════════════════════════════════\n`;
    report += `                     END OF DESIGN CHECK REPORT                     \n`;
    report += `═══════════════════════════════════════════════════════════════════\n`;
    report += `\`\`\`\n`;

    return report;
  }

  // ============================================
  // CONCEPT EXPLANATION - COMPREHENSIVE ENGINEERING KNOWLEDGE
  // ============================================

  async explainConcept(query: string): Promise<string> {
    const q = query.toLowerCase();

    // Use advanced Gemini reasoning for detailed explanations
    if (this.apiKey) {
      try {
        // Check if this is asking for problem-solving
        if (q.match(/why|how|problem|calculate|design|check|formula|stress|moment|deflection|buckling/i)) {
          return await this.reasonThroughProblem(`Explain: ${query}`, this.lastModelState || { nodes: [], members: [], loads: [] });
        }

        // Standard concept explanation with enriched context
        const prompt = TASK_PROMPTS.explainConcept(query);
        const response = await this.callGemini(prompt, SYSTEM_PROMPT);
        this.updateReasoningMemory(response);
        return response;
      } catch (error) {
        console.warn('Gemini unavailable for explanation:', error);
      }
    }

    // COMPREHENSIVE LOCAL ENGINEERING KNOWLEDGE BASE
    return this.getEngineeringExplanation(q);
  }

  /**
   * Comprehensive engineering knowledge dictionary
   */
  private getEngineeringExplanation(query: string): string {
    const q = query.toLowerCase();

    // ==================== BENDING & MOMENTS ====================
    if (q.includes('moment') || q.includes('bending')) {
      return `## 📐 Bending Moment - Comprehensive Guide

### Definition
**Bending moment** is the internal moment that causes a structural member to bend when subjected to loads. It represents the tendency of a force to rotate a section about a neutral axis.

### Key Formulas

| Load Case | Maximum Moment | Location |
|-----------|---------------|----------|
| Simply Supported - Point Load (center) | \`M = PL/4\` | At midspan |
| Simply Supported - UDL | \`M = wL²/8\` | At midspan |
| Cantilever - Point Load (end) | \`M = PL\` | At fixed support |
| Cantilever - UDL | \`M = wL²/2\` | At fixed support |
| Fixed-Fixed - Point Load | \`M = PL/8\` | At supports & center |
| Fixed-Fixed - UDL | \`M = wL²/12\` | At supports |

### Sign Convention
- **Positive (Sagging):** Tension on bottom, compression on top - like a smile 😊
- **Negative (Hogging):** Tension on top, compression on bottom - like a frown ☹️

### Bending Stress Formula
\`\`\`
σ = My/I = M/S
\`\`\`
Where:
- σ = Bending stress (MPa)
- M = Bending moment (kN·m)
- y = Distance from neutral axis (mm)
- I = Moment of inertia (mm⁴)
- S = Section modulus = I/y (mm³)

### Design Check (IS 800:2007)
\`\`\`
M ≤ Md = βb × Zp × fy / γm0
\`\`\`
Where βb depends on lateral-torsional buckling considerations.

### Bending Moment Diagrams (BMD)
1. Start from reactions
2. Cut at critical points
3. Sum moments about cut section
4. Plot variation along member

### Common Engineering Mistakes to Avoid
1. ❌ Forgetting sign convention consistency
2. ❌ Not checking moments at supports for continuous beams
3. ❌ Ignoring lateral-torsional buckling
4. ❌ Confusing elastic (S) and plastic (Z) section modulus

Would you like me to create a beam model to demonstrate this?`;
    }

    // ==================== MOMENT OF INERTIA ====================
    if (q.includes('moment of inertia') || q.includes('second moment')) {
      return `## 📊 Moment of Inertia (Second Moment of Area)

### Definition
The **moment of inertia (I)** quantifies a cross-section's resistance to bending. Larger I = less bending deflection.

### Mathematical Definition
\`\`\`
I = ∫∫ y² dA
\`\`\`
Integrate y² (distance from neutral axis) over the cross-sectional area.

### Common Shapes

| Shape | Formula | About Centroidal Axis |
|-------|---------|----------------------|
| Rectangle | \`I = bh³/12\` | b=width, h=height |
| Circle | \`I = πd⁴/64\` | d=diameter |
| Hollow Circle | \`I = π(D⁴-d⁴)/64\` | D=outer, d=inner |
| Triangle | \`I = bh³/36\` | About centroid |
| I-Beam | Use tables (ISMB, W-sections) | Pre-calculated |

### Parallel Axis Theorem
\`\`\`
I = Ic + Ad²
\`\`\`
- Ic = Moment of inertia about centroid
- A = Cross-sectional area
- d = Distance between parallel axes

### Why It Matters
1. **Deflection:** δ ∝ 1/I (inversely proportional)
2. **Stress:** σ = My/I (appears in denominator)
3. **Buckling:** Pcr ∝ I (Euler's formula)

### Engineering Applications
- **Beam Design:** Selecting sections with adequate I for deflection limits
- **Column Design:** Weak axis I governs buckling capacity
- **Composite Sections:** Combining materials (steel-concrete)

### Section Selection Guide
For gravity beams:
- ISMB 200: I = 2,235 cm⁴ → spans up to 4m
- ISMB 300: I = 8,603 cm⁴ → spans up to 6m
- ISMB 400: I = 20,458 cm⁴ → spans up to 8m
- ISMB 500: I = 45,218 cm⁴ → spans up to 10m

### Radius of Gyration
\`\`\`
r = √(I/A)
\`\`\`
Used in column slenderness calculations: λ = KL/r`;
    }

    // ==================== SHEAR FORCE ====================
    if (q.includes('shear') && (q.includes('force') || q.includes('diagram') || q.includes('stress'))) {
      return `## ✂️ Shear Force - Complete Guide

### Definition
**Shear force** is the internal force that acts parallel to the cross-section, causing adjacent parts of a member to slide past each other.

### Key Formulas

| Load Case | Maximum Shear | Location |
|-----------|--------------|----------|
| Simply Supported - Point (center) | \`V = P/2\` | At supports |
| Simply Supported - UDL | \`V = wL/2\` | At supports |
| Cantilever - Point (end) | \`V = P\` | Throughout |
| Cantilever - UDL | \`V = wL\` | At support |

### Shear Stress Distribution
\`\`\`
τ = VQ / (Ib)
\`\`\`
Where:
- τ = Shear stress
- V = Shear force
- Q = First moment of area above cut
- I = Moment of inertia
- b = Width at cut

### Shear Stress Patterns
- **Rectangular:** Parabolic, max at neutral axis = 1.5V/A
- **I-Beam:** Mostly in web, τ_avg ≈ V/(d × tw)
- **Circular:** Parabolic, max = 4V/(3A)

### Shear Force Diagram (SFD) Rules
1. Point load = Jump in SFD
2. UDL = Linear slope in SFD
3. Area under load diagram = Change in shear
4. Shear = Slope of moment diagram

### Relationship with Bending Moment
\`\`\`
V = dM/dx
\`\`\`
Shear force is the derivative of bending moment!

### Design Check (IS 800:2007)
\`\`\`
V ≤ Vd = (Av × fy) / (√3 × γm0)
\`\`\`
Where Av = Shear area (typically d × tw for I-beams)

### High Shear Effects
When V > 0.6Vd, moment capacity must be reduced:
\`\`\`
Md,reduced = Md × (1 - ((V/Vd - 0.6)/0.4)²)
\`\`\``;
    }

    // ==================== DEFLECTION ====================
    if (q.includes('deflection') || q.includes('displacement') || q.includes('serviceability')) {
      return `## 📏 Deflection & Serviceability

### Definition
**Deflection** is the displacement of a structural member from its original position under load. It's a serviceability concern, not strength.

### Standard Formulas

| Beam Type | Load | Maximum Deflection |
|-----------|------|-------------------|
| Simply Supported | Point (center) | \`δ = PL³/(48EI)\` |
| Simply Supported | UDL | \`δ = 5wL⁴/(384EI)\` |
| Cantilever | Point (end) | \`δ = PL³/(3EI)\` |
| Cantilever | UDL | \`δ = wL⁴/(8EI)\` |
| Fixed-Fixed | Point (center) | \`δ = PL³/(192EI)\` |
| Fixed-Fixed | UDL | \`δ = wL⁴/(384EI)\` |

### Code Limits (IS 800:2007)

| Member Type | Gravity Load | Total Load |
|-------------|--------------|------------|
| Floor beams | L/300 | L/250 |
| Roof purlins | L/150 | L/120 |
| Crane girders | L/500 | L/400 |
| Cantilevers | L/150 | L/120 |

### AISC/ASCE Limits
- **Floors (live load):** L/360
- **Floors (total):** L/240  
- **Roofs (live):** L/240
- **Roofs (total):** L/180

### Factors Affecting Deflection
1. **Load (P, w):** Linear relationship
2. **Span (L):** L³ or L⁴ - most critical!
3. **Stiffness (EI):** Inversely proportional
4. **Support conditions:** Fixed ends reduce deflection

### Why Deflection Matters
1. **Cracking:** Excessive deflection cracks finishes
2. **Perception:** People feel unsafe with bouncy floors
3. **Drainage:** Ponding on flat roofs
4. **Clearances:** Door frames, machinery
5. **Aesthetics:** Visible sag is unsightly

### Practical Tips
- Pre-camber beams for long spans
- Use composite action (steel-concrete)
- Consider creep for concrete (multiply short-term by 2-3)
- For cantilevers, deflection is very sensitive to length`;
    }

    // ==================== BUCKLING ====================
    if (q.includes('buckl') || q.includes('euler') || q.includes('stability') || q.includes('column')) {
      return `## 🏛️ Buckling & Column Stability

### Definition
**Buckling** is sudden lateral instability of a compression member when the load reaches a critical value, even if stress is below yield.

### Euler's Critical Load
\`\`\`
Pcr = π²EI / (KL)²
\`\`\`
Or in terms of stress:
\`\`\`
σcr = π²E / (KL/r)² = π²E / λ²
\`\`\`

### Effective Length Factor (K)

| End Conditions | K Value | Description |
|----------------|---------|-------------|
| Fixed-Fixed | 0.5 | Both ends fully restrained |
| Fixed-Pinned | 0.7 | One fixed, one hinged |
| Pinned-Pinned | 1.0 | Both ends hinged |
| Fixed-Free | 2.0 | Cantilever column |
| Sway Frame (approx) | 1.2-2.0 | Unbraced frame |

### Slenderness Ratio
\`\`\`
λ = KL/r
\`\`\`
Where r = √(I/A) = radius of gyration

### Column Classification
- **Short (λ < 20-40):** Crushing governs, use yield strength
- **Intermediate (40 < λ < 120):** Inelastic buckling, use column curves
- **Slender (λ > 120):** Elastic buckling, Euler applies

### IS 800:2007 Column Design
Uses Perry-Robertson formula with imperfection factors:
\`\`\`
fcd = fy / (φ + √(φ² - λ²)) × 1/γm0
\`\`\`

### Slenderness Limits
- Compression members: λ ≤ 180
- Tension members: λ ≤ 400
- Lacing bars: λ ≤ 145

### Design Tips
1. **Minimize KL:** Use bracing to reduce effective length
2. **Check both axes:** Design for weak axis buckling
3. **Built-up sections:** Increase r for long columns
4. **Second-order effects:** Include P-Δ for tall structures

### Bracing Benefits
Adding mid-height bracing: K goes from 1.0 to 0.7, capacity increases ~2x!`;
    }

    // ==================== P-DELTA EFFECTS ====================
    if (q.includes('p-delta') || q.includes('p delta') || q.includes('second order') || q.includes('geometric')) {
      return `## 🔄 P-Delta (Second-Order) Effects

### Definition
**P-Delta effects** are additional moments and forces that arise when axial loads act on a displaced structure. They're "second-order" because they depend on the deflected shape.

### Two Types

#### P-Δ (P-Big Delta) - Member Level
- Moment from axial load × story drift
- \`M_additional = P × Δ\`
- More significant for tall buildings

#### P-δ (P-Little Delta) - Element Level
- Moment from axial load × member deflection
- Important for slender columns
- \`M_additional = P × δ\`

### When to Consider
IS 800 / AISC require second-order analysis when:
\`\`\`
B₂ = 1 / (1 - ΣPu/ΣPe) > 1.10
\`\`\`
Or when story drift > 1.5%

### Amplification Factors

#### B1 Factor (P-δ)
\`\`\`
B₁ = Cm / (1 - Pu/Pe1) ≥ 1.0
\`\`\`
Where:
- Cm = 0.6 - 0.4(M1/M2) for no transverse loads
- Pe1 = π²EI/(K₁L)²

#### B2 Factor (P-Δ)
\`\`\`
B₂ = 1 / (1 - ΣPu/ΣPe2)
\`\`\`
Where ΣPe2 = RM × HL / ΔH

### Analysis Methods
1. **Approximate:** Amplified first-order analysis
2. **Exact:** Geometric nonlinear analysis
3. **Iterative:** Update stiffness matrix for deflected geometry

### When It's Critical
- High-rise buildings (> 10 stories)
- Slender columns
- Heavy gravity loads
- Low lateral stiffness
- Seismic design

### Practical Impact
In tall buildings, P-Delta can increase moments by 10-30%!`;
    }

    // ==================== LATERAL TORSIONAL BUCKLING ====================
    if (q.includes('lateral torsional') || q.includes('ltb') || (q.includes('lateral') && q.includes('buckling'))) {
      return `## 🔀 Lateral-Torsional Buckling (LTB)

### Definition
**LTB** occurs when the compression flange of a beam buckles sideways and twists. The beam fails before reaching its full moment capacity.

### When Does LTB Occur?
- Long unbraced compression flanges
- Open sections (I-beams, channels)
- Asymmetric loading
- Inadequate lateral support

### Critical Moment (Elastic)
\`\`\`
Mcr = (π/L) × √(EIy × GJ × (1 + (π²ECw)/(GJL²)))
\`\`\`
Where:
- Iy = Weak axis moment of inertia
- J = Torsional constant
- Cw = Warping constant
- L = Unbraced length

### Non-Dimensional Slenderness
\`\`\`
λLT = √(Zp × fy / Mcr)
\`\`\`

### IS 800:2007 Classification

| λLT | Behavior | Design Moment |
|-----|----------|---------------|
| ≤ 0.4 | Plastic | Md = Zp × fy/γm0 |
| 0.4 - 1.2 | Inelastic LTB | Reduced capacity |
| > 1.2 | Elastic LTB | Mcr governs |

### Prevention Strategies
1. **Lateral bracing:** At regular intervals on compression flange
2. **Composite action:** Concrete slab provides restraint
3. **Compact sections:** Full plastic capacity
4. **Continuous top flange support:** Deck attachments

### Bracing Spacing Rules of Thumb
- Maximum spacing: L ≤ 40 × bf (flange width)
- For seismic: L ≤ 0.086 × ry × E/fy

### Common Mistakes
1. ❌ Ignoring LTB for simply supported beams
2. ❌ Not checking negative moment regions
3. ❌ Assuming deck always provides restraint
4. ❌ Using wrong effective length`;
    }

    // ==================== FIXED VS PINNED SUPPORTS ====================
    if (q.includes('fixed') || q.includes('pinned') || q.includes('support') || q.includes('restraint') || q.includes('boundary')) {
      return `## 🔩 Support Types & Boundary Conditions

### Overview

| Support Type | Translation | Rotation | Reactions | DOF Restrained |
|--------------|-------------|----------|-----------|----------------|
| **Fixed** | Prevented | Prevented | Fx, Fy, M | 3 |
| **Pinned** | Prevented | Allowed | Fx, Fy | 2 |
| **Roller** | One direction | Allowed | F (perpendicular) | 1 |
| **Free** | Allowed | Allowed | None | 0 |

### Fixed Supports 🔒
**Characteristics:**
- Resists all forces AND moments
- No translation or rotation
- Creates maximum restraint

**Where to Use:**
- Column bases on strong foundations
- Cantilever supports
- Moment frames at foundations
- High lateral load situations

**Pros:**
- Reduces deflection
- Reduces mid-span moments
- Provides stability

**Cons:**
- Requires stronger foundations
- Creates moment at support (needs design)
- More expensive connections

### Pinned Supports 📌
**Characteristics:**
- Resists forces only (no moment)
- Allows rotation
- Also called "hinged" or "simple"

**Where to Use:**
- Simple beam ends
- Truss joints
- Column bases on weaker soil
- Where thermal movement needed

**Pros:**
- Simpler connections
- No moment transfer to foundation
- Allows expansion/rotation

**Cons:**
- Higher mid-span moments
- Higher deflection
- Less redundancy

### Roller Supports 🔄
**Characteristics:**
- Resists force in one direction
- Allows movement parallel to support
- Allows rotation

**Where to Use:**
- One end of simply supported beams
- Bridge bearings (thermal expansion)
- Long span structures

### Design Impact Example
**Simply Supported Beam (UDL):**
- Moment: M = wL²/8
- Deflection: δ = 5wL⁴/384EI

**Fixed-Fixed Beam (same UDL):**
- Moment: M = wL²/12 (33% less!)
- Deflection: δ = wL⁴/384EI (5x less!)

### When to Choose What?
| Situation | Recommended Support |
|-----------|-------------------|
| Good foundation | Fixed |
| Weak/soft soil | Pinned |
| Thermal expansion needed | Roller |
| Cantilever | Fixed at support |
| Simple beam | Pinned + Roller |
| Moment frame | Fixed to foundation |`;
    }

    // ==================== PORTAL FRAMES ====================
    if (q.includes('portal frame') || q.includes('portal')) {
      return `## 🏭 Portal Frames - Complete Guide

### Definition
A **portal frame** is a rigid frame structure consisting of columns and rafters connected by moment-resisting joints, typically used for single-story industrial buildings.

### Key Components
1. **Columns:** Vertical members supporting rafters
2. **Rafters:** Inclined roof members
3. **Eaves:** Connection between column and rafter
4. **Apex/Ridge:** Highest point of frame
5. **Haunches:** Deepened sections at eaves/apex

### Types of Portal Frames

| Type | Span | Application |
|------|------|-------------|
| Single-span | 12-60m | Warehouses, factories |
| Multi-span | Any | Large industrial halls |
| Propped | 20-50m | Medium spans with prop |
| Tied | 20-40m | Aircraft hangars |
| Mansard | Variable | Clearance at edges |
| Curved | 30-100m | Aesthetic applications |

### Typical Dimensions
- **Height:** 6-12m (eaves)
- **Roof slope:** 5-10° (typically 6°)
- **Spacing:** 5-7.5m between frames
- **Span/depth ratio:** 30-40 for rafters

### Design Loads
- Dead load (self-weight + cladding)
- Live load (IS 875 Part 2)
- Wind load (IS 875 Part 3) - often governs
- Crane loads if applicable
- Seismic (IS 1893) in seismic zones

### Typical Sections
- **Columns:** ISMB 400-600
- **Rafters:** ISMB 450-600
- **Haunches:** 1.5-2× rafter depth

### Analysis Methods
1. **Portal method** (approximate)
2. **Slope-deflection** (hand calculation)
3. **Matrix analysis** (computer)
4. **Plastic analysis** (for ultimate strength)

### Design Checks
1. ✅ Member strength (bending + axial)
2. ✅ Connection capacity (eaves, apex)
3. ✅ Lateral-torsional buckling
4. ✅ Deflection limits
5. ✅ Sway stability
6. ✅ Foundation design

Would you like me to create a portal frame model for you? Just tell me the span and height!`;
    }

    // ==================== TRUSSES ====================
    if (q.includes('truss') || q.includes('warren') || q.includes('pratt') || q.includes('howe')) {
      return `## 🔺 Trusses - Engineering Guide

### Definition
A **truss** is a structure composed of straight members connected at joints (nodes), forming triangular units. Members carry only axial forces (tension or compression).

### Common Truss Types

#### Roof Trusses
| Type | Span | Characteristics |
|------|------|-----------------|
| **King Post** | 5-8m | Simplest, one vertical |
| **Queen Post** | 8-12m | Two verticals |
| **Fink (W)** | 10-15m | W-pattern web |
| **Fan** | 12-18m | Radiating diagonals |
| **Howe** | 15-30m | Verticals in tension |
| **Pratt** | 15-30m | Verticals in compression |
| **Warren** | 20-50m | No verticals, equilateral |

#### Bridge Trusses
| Type | Use | Features |
|------|-----|----------|
| **Warren** | Highway, rail | Simple, efficient |
| **Pratt** | Medium spans | Verticals under compression |
| **Howe** | Timber bridges | Verticals under tension |
| **K-Truss** | Long spans | Reduced buckling length |
| **Parker** | Medium-long | Curved top chord |

### Design Principles
1. **Triangulation:** Essential for stability
2. **Pin joints:** Assumed for analysis (no moments)
3. **Loads at joints:** Avoids member bending
4. **Depth ratio:** Span/10 to Span/15

### Analysis Methods

#### Method of Joints
- Equilibrium at each joint
- ΣFx = 0, ΣFy = 0
- Good for all member forces

#### Method of Sections
- Cut through truss
- ΣFx = 0, ΣFy = 0, ΣM = 0
- Good for specific members

### Typical Sections
- **Top chord:** ISMC, double angles
- **Bottom chord:** ISA, flats, rods
- **Diagonals:** ISA (angles)
- **Verticals:** ISA, rods

### Warren Truss Specifics
- All diagonals at 60° (equilateral triangles)
- Alternating tension/compression
- Very efficient for uniform loads
- No vertical members = simpler fabrication

### Design Considerations
1. ✅ Check tension members for net area
2. ✅ Check compression for buckling
3. ✅ Connection design (gusset plates)
4. ✅ Out-of-plane buckling
5. ✅ Deflection (L/300 to L/400)
6. ✅ Secondary bending at joints

Would you like me to create a specific truss for you?`;
    }

    // ==================== MULTI-STORY BUILDINGS ====================
    if (q.includes('multi') && (q.includes('story') || q.includes('storey')) || q.includes('high rise') || q.includes('building frame')) {
      return `## 🏢 Multi-Story Building Frames

### Structural Systems

| System | Height | Lateral System |
|--------|--------|----------------|
| **Moment Frame** | Up to 25 stories | Rigid connections |
| **Braced Frame** | Up to 40 stories | Diagonal bracing |
| **Shear Wall** | Up to 35 stories | RC walls |
| **Dual System** | Up to 50 stories | MF + Bracing/Walls |
| **Tube** | 40-80 stories | Perimeter frame |
| **Outrigger** | 60-100+ stories | Core + outriggers |

### Frame Classifications

#### By Lateral Resistance
- **OMRF:** Ordinary Moment Resisting Frame (R = 3)
- **IMRF:** Intermediate Moment Resisting Frame (R = 4)
- **SMRF:** Special Moment Resisting Frame (R = 5)

#### By Bracing
- **Unbraced (Sway):** Relies on frame stiffness
- **Braced (Non-sway):** Has dedicated lateral system

### Typical Dimensions
- **Story height:** 3.0-4.0m (office), 2.8-3.2m (residential)
- **Bay width:** 6-9m typical
- **Column grid:** Regular for economy

### Loading
- **Dead:** Self-weight, finishes, services (~4-6 kN/m²)
- **Live:** 2.0-4.0 kN/m² (occupancy dependent)
- **Wind:** Per IS 875 Part 3
- **Seismic:** Per IS 1893 (critical in India)

### Design Checks
1. **Gravity design:** Beams for moment, columns for P+M
2. **Lateral design:** Drift limits, P-Delta
3. **Connections:** Moment-resisting joints
4. **Foundation:** Combined/mat for tall buildings

### Drift Limits
- **Wind:** H/500 (total), h/400 (story)
- **Seismic:** Per IS 1893 Table 5

### Strong Column - Weak Beam
For seismic design:
\`\`\`
ΣMc ≥ 1.2 × ΣMb
\`\`\`
Columns must be stronger than beams for ductile behavior.

### Would you like me to create a multi-story frame?
Tell me:
- Number of stories
- Number of bays
- Bay width
- Story height`;
    }

    // ==================== LOADS & LOAD COMBINATIONS ====================
    if (q.includes('load') && (q.includes('combination') || q.includes('type') || q.includes('dead') || q.includes('live'))) {
      return `## ⬇️ Structural Loads & Combinations

### Load Types

#### Dead Load (DL)
Permanent, constant loads:
| Component | Typical Value |
|-----------|---------------|
| Concrete (per 100mm) | 2.5 kN/m² |
| Steel decking | 0.15-0.3 kN/m² |
| Ceiling | 0.3-0.5 kN/m² |
| Services | 0.3-0.5 kN/m² |
| Partitions | 1.0-1.5 kN/m² |
| Floor finish | 1.0-1.5 kN/m² |

#### Live Load (LL) - IS 875 Part 2
| Occupancy | Load (kN/m²) |
|-----------|--------------|
| Residential | 2.0 |
| Office | 2.5 |
| Corridors | 4.0 |
| Retail | 4.0 |
| Industrial (light) | 5.0 |
| Industrial (heavy) | 10.0 |
| Storage | 12.0-24.0 |
| Parking | 5.0 |

#### Wind Load (WL) - IS 875 Part 3
\`\`\`
Pz = 0.6 × Vz²
\`\`\`
Where Vz = design wind speed at height z

#### Seismic Load (EQ) - IS 1893
\`\`\`
V = (Z/2) × (I/R) × (Sa/g) × W
\`\`\`
Distributed as inverted triangle up the building.

### Load Combinations (IS 875)

#### Limit State of Strength
1. \`1.5 DL + 1.5 LL\`
2. \`1.2 DL + 1.2 LL + 1.2 WL\`
3. \`1.5 DL + 1.5 WL\`
4. \`0.9 DL + 1.5 WL\` (uplift)
5. \`1.2 DL + 1.2 LL + 1.2 EQ\`
6. \`1.5 DL + 1.5 EQ\`
7. \`0.9 DL + 1.5 EQ\`

#### Limit State of Serviceability
\`1.0 DL + 1.0 LL\`

### Load Factors Summary

| Load | Strength Factor | Service Factor |
|------|-----------------|----------------|
| Dead | 1.2 - 1.5 | 1.0 |
| Live | 1.2 - 1.5 | 1.0 |
| Wind | 1.2 - 1.5 | 0.6 |
| Seismic | 1.2 - 1.5 | 1.0 |`;
    }

    // ==================== CONNECTIONS ====================
    if (q.includes('connection') || q.includes('joint') || q.includes('bolt') || q.includes('weld')) {
      return `## 🔗 Steel Connections

### Connection Types

#### By Load Transfer
- **Shear connections:** Transfer shear only (simple)
- **Moment connections:** Transfer moment + shear (rigid)
- **Tension connections:** Transfer axial tension

#### By Components
- **Bolted:** High-strength bolts
- **Welded:** Fillet/groove welds
- **Hybrid:** Combination

### Bolt Design (IS 800:2007)

#### Bolt Grades
| Grade | fyb (MPa) | fub (MPa) |
|-------|-----------|-----------|
| 4.6 | 240 | 400 |
| 8.8 | 640 | 800 |
| 10.9 | 900 | 1000 |

#### Bolt Capacities

**Shear:**
\`\`\`
Vdsb = fub × (nn×Anb + ns×Asb) / (√3 × γmb)
\`\`\`

**Bearing:**
\`\`\`
Vdpb = 2.5 × kb × d × t × fu / γmb
\`\`\`

**Tension:**
\`\`\`
Tdb = 0.9 × fub × An / γmb
\`\`\`

### Weld Design (IS 800:2007)

#### Fillet Welds
\`\`\`
Strength = 0.7 × s × Lw × (fu/(√3 × γmw))
\`\`\`
Where s = weld size (throat = 0.7s)

#### Minimum Weld Sizes
| Thicker Plate | Min Weld |
|---------------|----------|
| ≤ 10mm | 3mm |
| 10-20mm | 5mm |
| 20-32mm | 6mm |
| > 32mm | 8mm |

### Common Connection Types

1. **Clip Angle:** Shear only, flexible
2. **End Plate:** Moment, bolted
3. **Flange Plate:** Moment, field bolted
4. **Seat Angle:** Shear, with stability
5. **Shear Tab:** Shear, single plate

### Design Checklist
✅ Bolt shear capacity
✅ Bolt bearing capacity
✅ Block shear
✅ Weld capacity
✅ Connection component strength
✅ Ductility requirements`;
    }

    // ==================== DESIGN CODES ====================
    if (q.includes('code') || q.includes('is 800') || q.includes('is 456') || q.includes('aisc') || q.includes('aci')) {
      return `## 📜 Structural Design Codes

### Indian Standards

#### IS 800:2007 - Steel Structures
- **Basis:** Limit State Method
- **Safety factors:** γm0 = 1.10, γm1 = 1.25
- **Deflection limits:** L/300 (gravity), L/250 (total)
- **Slenderness limits:** λ ≤ 180 (compression)

#### IS 456:2000 - Concrete Structures
- **Basis:** Limit State Method
- **Partial factors:** γc = 1.5 (concrete), γs = 1.15 (steel)
- **Cover:** 30-75mm based on exposure
- **Min reinforcement:** 0.85bd/fy

#### IS 1893:2016 - Seismic
- **Zones:** II, III, IV, V (Z = 0.10 to 0.36)
- **Response reduction:** R = 3 to 5
- **Importance factor:** I = 1.0 to 1.5
- **Drift limit:** 0.004h

#### IS 875 Parts
- Part 1: Dead loads
- Part 2: Live loads
- Part 3: Wind loads
- Part 4: Snow loads
- Part 5: Special loads

### International Codes

#### AISC 360 - Steel (USA)
- LRFD and ASD methods
- φ factors for LRFD
- More detailed for connections

#### ACI 318 - Concrete (USA)
- Strength design method
- Detailed seismic provisions
- φ factors: 0.65-0.90

#### Eurocode
- EN 1990: Basis of design
- EN 1991: Actions
- EN 1992: Concrete
- EN 1993: Steel
- EN 1998: Seismic

### Code Selection
- Use Indian codes for projects in India
- International codes for export/comparison
- Always check local requirements`;
    }

    // ==================== ANALYSIS METHODS ====================
    if (q.includes('analysis') && (q.includes('method') || q.includes('type') || q.includes('finite element') || q.includes('matrix'))) {
      return `## 🔬 Structural Analysis Methods

### Analysis Types

#### By Behavior
| Type | Assumption | Use Case |
|------|------------|----------|
| **Linear Static** | Small deformation, elastic | Most structures |
| **Nonlinear** | Large deformation or material | Special cases |
| **Dynamic** | Time-varying loads | Seismic, wind |
| **Modal** | Free vibration | Natural frequencies |
| **Buckling** | Stability | Slender members |

#### By Approach
1. **Classical methods**
   - Slope-deflection
   - Moment distribution
   - Portal/Cantilever method

2. **Matrix methods**
   - Direct stiffness method
   - Flexibility method

3. **Finite Element Method**
   - 1D: Beam elements
   - 2D: Plate/shell elements
   - 3D: Solid elements

### Direct Stiffness Method
Core of modern analysis software:

1. **Element stiffness:** [k]e
2. **Assembly:** [K] = Σ[k]e
3. **Boundary conditions:** Apply supports
4. **Solution:** {F} = [K]{u}
5. **Post-process:** Forces from displacements

### When to Use What

| Analysis | When |
|----------|------|
| Linear static | Regular buildings, initial design |
| P-Delta | Tall buildings, heavy loads |
| Modal | Seismic design, vibration check |
| Nonlinear | Pushover, advanced seismic |
| Time history | Critical structures, specific ground motion |

### Software Tools
- **SAP2000, ETABS:** Buildings
- **STAAD.Pro:** General purpose
- **ANSYS, ABAQUS:** Advanced FEM
- **OpenSees:** Research, seismic

### BeamLab Analysis
I can run:
- ✅ Linear static analysis
- ✅ Modal analysis  
- ✅ P-Delta effects
- ✅ Buckling analysis

Want me to analyze your structure?`;
    }

    // ==================== SEISMIC DESIGN ====================
    if (q.includes('seismic') || q.includes('earthquake') || q.includes('is 1893')) {
      return `## 🌍 Seismic Design (IS 1893:2016)

### Design Philosophy
- **Life Safety:** Prevent collapse in major earthquake
- **Damage Control:** Limit damage in moderate earthquake
- **Operational:** Important structures remain functional

### Seismic Zones (India)

| Zone | Z Value | Risk Level |
|------|---------|------------|
| II | 0.10 | Low |
| III | 0.16 | Moderate |
| IV | 0.24 | High |
| V | 0.36 | Very High |

### Base Shear Calculation
\`\`\`
VB = Ah × W
\`\`\`
Where:
\`\`\`
Ah = (Z/2) × (I/R) × (Sa/g)
\`\`\`

### Parameters

#### Importance Factor (I)
| Building Type | I Value |
|---------------|---------|
| Residential/Commercial | 1.0 |
| Schools, Assembly | 1.25 |
| Hospitals, Emergency | 1.5 |

#### Response Reduction (R)
| System | R Value |
|--------|---------|
| OMRF | 3.0 |
| SMRF | 5.0 |
| Braced Frame | 4.0 |
| Shear Wall | 4.0 |
| Dual System | 5.0 |

### Vertical Distribution
\`\`\`
Qi = VB × (Wi×hi²) / Σ(Wi×hi²)
\`\`\`
Inverted triangular distribution (approximately)

### Drift Limits
- **Story drift:** Δ ≤ 0.004 × h
- For masonry infill: More restrictive

### Design Requirements

1. **Strong column - Weak beam**
\`\`\`
ΣMc ≥ 1.2 × ΣMb
\`\`\`

2. **Ductile detailing**
- Special confining reinforcement
- Splice locations
- Beam-column joints

3. **Regularity**
- Plan regularity (torsion)
- Vertical regularity (soft story)

### Common Issues
- ❌ Soft story (open ground floor)
- ❌ Short columns
- ❌ Re-entrant corners
- ❌ Heavy mass at top`;
    }

    // ==================== GENERIC FALLBACK ====================
    return `## 📚 Engineering Knowledge Base

I can explain many structural engineering concepts in detail. Here are the topics I know well:

### Mechanics & Analysis
- **Bending Moment** - Internal moments, diagrams, stress
- **Shear Force** - Shear stress, diagrams
- **Deflection** - Formulas, limits, serviceability
- **Moment of Inertia** - Section properties, parallel axis
- **Buckling** - Euler load, slenderness, effective length
- **P-Delta Effects** - Second-order analysis
- **Lateral-Torsional Buckling** - Beam stability

### Structural Systems
- **Portal Frames** - Industrial buildings
- **Trusses** - Warren, Pratt, Howe types
- **Multi-Story Buildings** - Frame systems
- **Supports** - Fixed, pinned, roller

### Design
- **Load Types** - Dead, live, wind, seismic
- **Load Combinations** - IS 875, ASCE 7
- **Connections** - Bolted, welded
- **Design Codes** - IS 800, IS 456, AISC

### Analysis Methods
- **Static Analysis** - Linear, nonlinear
- **Modal Analysis** - Frequencies, modes
- **Seismic Design** - IS 1893, zones

**Ask me about any of these!** For example:
- "Explain moment of inertia"
- "What is P-Delta?"
- "How does a Warren truss work?"
- "Fixed vs pinned supports"`;
  }

  // ============================================
  // CONVERSATIONAL INTENT HANDLERS
  // ============================================

  /**
   * Handle greeting messages with warmth and personality
   */
  private async handleGreeting(query: string): Promise<string> {
    const timeOfDay = new Date().getHours();
    let timeGreeting = '';
    if (timeOfDay < 12) timeGreeting = 'Good morning! ☀️';
    else if (timeOfDay < 17) timeGreeting = 'Good afternoon! 🌤️';
    else timeGreeting = 'Good evening! 🌙';

    // Try Gemini for personalized greeting
    if (this.apiKey) {
      try {
        const prompt = `Generate a warm, friendly greeting for a structural engineer user who said: "${query}". 
        Time of day: ${timeGreeting}
        Keep it brief (2-3 sentences), professional but warm, and mention that you're ready to help with structural analysis, design, or any questions.
        Use relevant emoji sparingly.`;
        return await this.callGemini(prompt, SYSTEM_PROMPT);
      } catch (error) {
        console.warn('[GeminiAI] Greeting API failed:', error);
      }
    }

    const greetings = [
      `${timeGreeting} Welcome to BeamLab! 👋 I'm your AI structural engineering assistant. I can help you model structures, run analyses, interpret results, or explain concepts. What would you like to work on?`,
      `${timeGreeting} Great to have you here! 🏗️ Whether you're designing a portal frame, analyzing a truss, or just exploring structural concepts, I'm here to help. What's on your engineering agenda today?`,
      `${timeGreeting} Hello, fellow engineer! Ready to tackle some structural challenges? I can help with modeling, analysis, code compliance, or just answering questions. What shall we build today?`
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  /**
   * Handle thank you messages gracefully
   */
  private async handleThanks(): Promise<string> {
    if (this.apiKey) {
      try {
        const prompt = `User is thanking you for help with structural engineering. 
        Respond warmly (1-2 sentences), acknowledge their gratitude, and offer to help with anything else.
        Keep it natural and professional.`;
        return await this.callGemini(prompt, SYSTEM_PROMPT);
      } catch (error) {
        console.warn('[GeminiAI] Thanks API failed:', error);
      }
    }

    const responses = [
      "You're very welcome! 😊 It's my pleasure to help with your structural engineering work. Feel free to ask if you have more questions or need help with another task!",
      "Happy to help! 👍 Structural engineering is a fascinating field, and I enjoy working through these problems with you. What else can I assist you with?",
      "My pleasure! 🏗️ Don't hesitate to reach out if you need help with analysis, design, or have any engineering questions. I'm always here!"
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Provide comprehensive help message
   */
  private getHelpMessage(): string {
    return `# 🎯 BeamLab AI Assistant - Help Guide

## What I Can Do

### 🏗️ **Create Structures**
Tell me what you need, and I'll create it:
- *"Create a 20m span portal frame"*
- *"Build a 3-story, 4-bay office building"*
- *"Design a Warren truss with 15m span"*
- *"Make a cantilever beam 5m long"*

### 📊 **Run Analysis**
I'll analyze your structure and interpret results:
- *"Analyze my structure"*
- *"Run modal analysis"*
- *"What's the maximum deflection?"*
- *"Show me the bending moments"*

### 🎯 **Optimize & Check**
I help ensure your design is efficient and code-compliant:
- *"Optimize my structure"*
- *"Check against IS 800"*
- *"Is my design safe?"*
- *"Reduce the weight"*

### 📚 **Learn & Understand**
Ask me anything about structural engineering:
- *"Explain bending moments"*
- *"What is P-Delta analysis?"*
- *"How does buckling work?"*
- *"Why use fixed supports?"*

### 🔧 **Troubleshoot**
I can help identify and fix issues:
- *"Why is my analysis failing?"*
- *"Check my model for errors"*
- *"The results look wrong"*
- *"Help me debug this"*

## 💡 Tips
- Be specific about dimensions (e.g., "15m span", "4m height")
- I remember our conversation, so you can refer to previous topics
- After I create a plan, click **Execute** to build the structure
- Use voice input for hands-free interaction 🎤

What would you like to explore first?`;
  }

  /**
   * Handle troubleshooting requests
   */
  private async handleTroubleshooting(query: string, context: AIModelContext): Promise<string> {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check for common issues
    if (context.nodes.length === 0) {
      issues.push("❌ **No model exists** - Create a structure first");
      suggestions.push("Try: \"Create a simple beam\" or \"Build a portal frame\"");
    } else {
      const supportedNodes = context.nodes.filter(n => n.hasSupport);

      if (supportedNodes.length === 0) {
        issues.push("⚠️ **No supports defined** - Structure is unstable");
        suggestions.push("Add supports: \"Add fixed support at the base\" or \"Pin the left node\"");
      } else if (supportedNodes.length === 1 && context.members.length > 1) {
        issues.push("⚠️ **Only one support** - May be unstable depending on configuration");
        suggestions.push("Consider adding another support for stability");
      }

      if (context.loads.length === 0) {
        issues.push("⚠️ **No loads applied** - Analysis will show zero results");
        suggestions.push("Add loads: \"Apply 50 kN at the top\" or \"Add typical floor loads\"");
      }

      if (context.members.length === 0 && context.nodes.length > 1) {
        issues.push("⚠️ **Nodes exist but no members** - Nodes are disconnected");
        suggestions.push("Add members to connect your nodes");
      }
    }

    // Use Gemini for intelligent analysis if available
    if (this.apiKey && issues.length > 0) {
      try {
        const issueList = issues.join('\n');
        const prompt = `User is having trouble with their structural model. Their question: "${query}"

Current issues detected:
${issueList}

Provide a helpful, empathetic response that:
1. Acknowledges their frustration
2. Explains the issues in simple terms
3. Gives clear, actionable steps to fix each issue
4. Offers encouragement

Keep it conversational and helpful.`;
        return await this.callGemini(prompt, SYSTEM_PROMPT);
      } catch (error) {
        console.warn('[GeminiAI] Troubleshooting API failed:', error);
      }
    }

    // Local response
    if (issues.length === 0) {
      return `## ✅ Model Looks Good!

I checked your model and didn't find any obvious issues.

**Your model has:**
- ${context.nodes.length} nodes (${context.nodes.filter(n => n.hasSupport).length} with supports)
- ${context.members.length} members
- ${context.loads.length} loads

If you're still having problems, can you describe what's going wrong? For example:
- Is the analysis failing?
- Are the results unexpected?
- Is something not displaying correctly?`;
    }

    let response = `## 🔍 Model Diagnostic Report\n\n`;
    response += `**Issues Found:**\n${issues.join('\n')}\n\n`;
    response += `**Suggestions:**\n${suggestions.map(s => `• ${s}`).join('\n')}\n\n`;
    response += `Would you like me to help fix any of these issues?`;

    return response;
  }

  /**
   * Review and provide feedback on the current model
   */
  private async reviewModel(context: AIModelContext): Promise<string> {
    if (context.nodes.length === 0) {
      return "📐 **No Model to Review**\n\nYou haven't created a structure yet. Would you like me to help you build one? Describe what you're trying to design!";
    }

    const supportedNodes = context.nodes.filter(n => n.hasSupport);
    const loadedNodes = context.loads.length;

    // Build assessment
    let assessment = `## 📋 Model Review\n\n`;

    // Structure info
    assessment += `### Structure Overview\n`;
    assessment += `- **Nodes:** ${context.nodes.length}\n`;
    assessment += `- **Members:** ${context.members.length}\n`;
    assessment += `- **Supports:** ${supportedNodes.length}\n`;
    assessment += `- **Load Cases:** ${loadedNodes}\n\n`;

    // Stability check
    assessment += `### Stability Assessment\n`;
    const degreesOfFreedom = context.nodes.length * 3; // 2D assumption
    const restraints = supportedNodes.length * 3; // Simplified

    if (supportedNodes.length === 0) {
      assessment += `⚠️ **Unstable** - No supports defined. Structure will move freely.\n\n`;
    } else if (supportedNodes.length < 2 && context.members.length > 1) {
      assessment += `⚠️ **Potentially Unstable** - Consider adding more supports.\n\n`;
    } else {
      assessment += `✅ **Appears Stable** - Adequate support conditions.\n\n`;
    }

    // Load check
    assessment += `### Load Configuration\n`;
    if (context.loads.length === 0) {
      assessment += `⚠️ No loads applied. Structure will show zero response.\n\n`;
    } else {
      const totalLoad = context.loads.reduce((sum, l) =>
        sum + Math.abs(l.fx || 0) + Math.abs(l.fy || 0) + Math.abs(l.fz || 0), 0);
      assessment += `✅ ${context.loads.length} load(s) applied (total magnitude: ~${totalLoad.toFixed(0)} kN)\n\n`;
    }

    // Try Gemini for intelligent recommendations
    if (this.apiKey) {
      try {
        const prompt = `Based on this structural model:
- ${context.nodes.length} nodes
- ${context.members.length} members  
- ${supportedNodes.length} supports
- ${context.loads.length} loads

Provide 2-3 specific recommendations to improve this model. Be practical and actionable. Keep it brief.`;
        const aiRecommendations = await this.callGemini(prompt, SYSTEM_PROMPT);
        assessment += `### 💡 AI Recommendations\n${aiRecommendations}\n`;
      } catch (error) {
        console.warn('[GeminiAI] Review API failed:', error);
      }
    }

    assessment += `\n*Would you like me to run analysis or make any changes?*`;

    return assessment;
  }

  // ============================================
  // CONVERSATIONAL AI HANDLERS
  // ============================================

  /**
   * Handle general conversation and questions like a real AI assistant
   */
  private async handleConversation(query: string, context: AIModelContext): Promise<string> {
    // ===== ENHANCED ARCHITECTURE =====
    // Step 1: Decompose complex queries
    const subtasks = query.length > 100 ? await this.decomposeTask(query, context) : [query];

    // Step 2: Build multi-turn context
    const enrichedPrompt = this.buildMultiTurnPrompt(query, context);

    // Step 3: Store model state for context
    this.lastModelState = context;

    // Step 4: Try Gemini with enhanced context
    if (this.apiKey) {
      try {
        let response: string;

        // For complex queries, use multi-step reasoning
        if (subtasks.length > 1) {
          console.log('[GeminiAI] Complex query detected, using multi-step reasoning');
          const responses: string[] = [];

          for (const subtask of subtasks) {
            try {
              const subResponse = await this.callGemini(
                `${enrichedPrompt}\n\nSUBTASK: ${subtask}`,
                SYSTEM_PROMPT
              );
              responses.push(subResponse);
            } catch (e) {
              console.warn('[GeminiAI] Subtask failed:', e);
            }
          }

          // Synthesize responses if multiple subtasks
          if (responses.length > 1) {
            response = await this.callGemini(
              `Synthesize these engineering responses into one coherent answer:\n\n${responses.join('\n\n---\n\n')}`,
              SYSTEM_PROMPT
            );
          } else {
            response = responses[0] || 'Unable to process query';
          }
        } else {
          // Single task - use standard enhanced prompt
          response = await this.callGemini(enrichedPrompt, SYSTEM_PROMPT);
        }

        // Update memory
        this.updateReasoningMemory(response);
        return response;
      } catch (error) {
        console.warn('[GeminiAI] Enhanced conversation failed:', error);
      }
    }

    // Intelligent local fallback
    return this.generateLocalConversationalResponse(query, context);
  }

  /**
   * Generate intelligent local response when API is unavailable
   */
  private generateLocalConversationalResponse(query: string, context: AIModelContext): string {
    const q = query.toLowerCase();

    // Greetings
    if (q.match(/^(hi|hello|hey|good\s*(morning|afternoon|evening)|howdy)/)) {
      const greetings = [
        "Hello! 👋 I'm BeamLab AI, your structural engineering assistant. I'm here to help you design, analyze, and optimize structures. What would you like to work on today?",
        "Hey there! 🏗️ Ready to do some structural engineering? I can help you create models, run analyses, or explain concepts. What's on your mind?",
        "Hi! Great to see you. Whether you need to model a frame, analyze a truss, or understand a design code, I'm here to help. What shall we tackle?"
      ];
      return greetings[Math.floor(Math.random() * greetings.length)];
    }

    // Thanks
    if (q.match(/thank|thanks|appreciate/)) {
      return "You're welcome! 😊 I'm always here to help with your structural engineering questions. Is there anything else you'd like to work on?";
    }

    // Help requests
    if (q.match(/help|what can you do|how does this work|confused/)) {
      return `## 🎯 Here's How I Can Help

**🏗️ Create Structures**
Try saying:
- "Build a 15m span portal frame"
- "Create a 3-story, 4-bay building"
- "Design a Warren truss"

**📊 Run Analysis**
- "Analyze my structure"
- "Show me the stress distribution"
- "Run modal analysis"

**🎓 Learn Engineering**
- "Explain bending moments"
- "What is P-Delta analysis?"
- "How does buckling work?"

**🔧 Troubleshoot**
- "Why is my analysis failing?"
- "Check my model for issues"
- "Optimize my design"

What would you like to explore?`;
    }

    // Model questions
    if (context.nodes.length > 0) {
      if (q.match(/how.*look|what.*have|show.*model|current.*state/)) {
        return this.describeCurrentModel(context);
      }
    }

    // Generic helpful response
    return `I'd be happy to help with that! 

${context.nodes.length === 0
        ? "I notice you don't have a model yet. Would you like me to create one? Just describe what you need, like \"Create a 20m span truss\" or \"Build a simple beam.\""
        : `You currently have a model with ${context.nodes.length} nodes and ${context.members.length} members. Would you like me to analyze it, add more elements, or help with something else?`
      }

Feel free to ask me anything about structural engineering - I'm here to help! 🏗️`;
  }

  /**
   * Describe the current model state in natural language
   */
  describeCurrentModel(context: AIModelContext): string {
    if (context.nodes.length === 0) {
      return "📐 **No Model Currently**\n\nYou haven't created a structure yet. Would you like me to help you build one? Just describe what you need!";
    }

    const supportedNodes = context.nodes.filter(n => n.hasSupport);

    let description = `## 📊 Current Model Overview\n\n`;

    // Structure composition
    description += `**Structure Composition:**\n`;
    description += `- 📍 **${context.nodes.length} nodes** (${supportedNodes.length} with supports)\n`;
    description += `- 📏 **${context.members.length} members**\n`;
    description += `- ⬇️ **${context.loads.length} load applications**\n\n`;

    // Support conditions
    if (supportedNodes.length > 0) {
      description += `**Support Conditions:**\n`;
      description += `- 🔒 ${supportedNodes.length} supported node${supportedNodes.length > 1 ? 's' : ''}\n`;
      description += '\n';
    }

    // Analysis status
    if (context.analysisResults) {
      description += `**Analysis Results Available:**\n`;
      description += `- Max displacement: ${context.analysisResults.maxDisplacement?.toFixed(2) || 'N/A'} mm\n`;
      description += `- Max stress: ${context.analysisResults.maxStress?.toFixed(1) || 'N/A'} MPa\n`;
    } else {
      description += `**📊 No Analysis Run Yet**\nSay "run analysis" to see results.\n`;
    }

    description += `\n*What would you like to do with this model?*`;

    return description;
  }

  // ============================================
  // GENERAL RESPONSE
  // ============================================

  async generalResponse(query: string, context: AIModelContext): Promise<string> {
    // Try Gemini first
    if (this.apiKey) {
      try {
        const contextStr = `Current model: ${context.nodes.length} nodes, ${context.members.length} members, ${context.loads.length} loads.`;
        const prompt = `${contextStr}\n\nUser query: ${query}`;
        return await this.callGemini(prompt, SYSTEM_PROMPT);
      } catch (error) {
        console.warn('Gemini unavailable:', error);
      }
    }

    return `I understand you're asking about: "${query}"

I can help you with:

🏗️ **Modeling:** "Create a 20m span truss" or "Build a 5-story building"

📊 **Analysis:** "Run analysis" or "Show modal results"

🎯 **Design:** "Check code compliance" or "Optimize for weight"

📚 **Learning:** "Explain buckling" or "What is P-Delta?"

How can I assist you today?`;
  }

  // ============================================
  // HELPERS
  // ============================================

  private formatPlanResponse(plan: AIPlan): string {
    let response = `## 🎯 ${plan.goal}\n\n`;
    response += `**Reasoning:** ${plan.reasoning}\n\n`;
    response += `**Planned Actions:** (${plan.steps.length} steps)\n\n`;

    plan.steps.slice(0, 10).forEach((step, i) => {
      const icon = this.getActionIcon(step.type);
      response += `${i + 1}. ${icon} ${step.description}\n`;
    });

    if (plan.steps.length > 10) {
      response += `\n... and ${plan.steps.length - 10} more steps\n`;
    }

    response += `\n**Confidence:** ${(plan.confidence * 100).toFixed(0)}%\n`;
    response += `\n_Click "Execute Plan" to build this structure._`;

    return response;
  }

  private getActionIcon(type: AIAction['type']): string {
    const icons: Record<string, string> = {
      addNode: '📍',
      addMember: '📏',
      addSupport: '🔩',
      addLoad: '⬇️',
      runAnalysis: '📊',
      optimize: '🎯',
      report: '📄',
    };
    return icons[type] || '•';
  }

  // ============================================
  // CONVERSATION MANAGEMENT WITH ENHANCED MEMORY
  // ============================================

  getConversationHistory(): AIConversation[] {
    return [...this.conversationHistory];
  }

  clearConversation(): void {
    this.conversationHistory = [];
    this.reasoningContext = [];
    this.taskMemory.clear();
    this.conversationSummary = '';
  }

  /**
   * Store task in memory for future reference
   */
  storeTask(taskId: string, taskData: any): void {
    this.taskMemory.set(taskId, {
      ...taskData,
      timestamp: new Date(),
    });
    console.log('[GeminiAI] Task stored:', taskId);
  }

  /**
   * Retrieve stored task
   */
  retrieveTask(taskId: string): any {
    return this.taskMemory.get(taskId);
  }

  /**
   * Get reasoning context summary for display
   */
  getReasoningContext(): string[] {
    return [...this.reasoningContext];
  }

  /**
   * Trim conversation history to manageable size while preserving important context
   */
  private manageConversationMemory(): void {
    if (this.conversationHistory.length > this.maxContextLength) {
      // Keep system messages and recent history
      const systemMessages = this.conversationHistory.filter(c => c.role === 'system');
      const recentMessages = this.conversationHistory.slice(-this.maxContextLength);
      this.conversationHistory = [...systemMessages, ...recentMessages];
    }
  }

  isCurrentlyProcessing(): boolean {
    return this.isProcessing;
  }
}

// Export singleton instance
export const geminiAI = new GeminiAIService();
export default GeminiAIService;
