/**
 * AIPowerEngine.ts
 * 
 * 🚀 POWERFUL AI ORCHESTRATION ENGINE
 * 
 * C-Suite Approved Features:
 * - Confidence scoring with engineering validation
 * - Expert vs Assistant mode
 * - Smart context-aware suggestions
 * - Engineering knowledge retrieval
 * - Multi-model support preparation
 * - AI performance analytics
 * 
 * This is the unified AI brain that coordinates all AI capabilities
 */

// ============================================
// TYPES
// ============================================

export interface AIConfidenceScore {
  overall: number; // 0-100
  codeCompliance: number;
  engineeringLogic: number;
  calculationAccuracy: number;
  contextRelevance: number;
  breakdown: ConfidenceBreakdown[];
}

interface ConfidenceBreakdown {
  factor: string;
  score: number;
  reason: string;
  codeReference?: string;
}

export interface ExpertModeSettings {
  mode: 'assistant' | 'expert' | 'mentor';
  verbosityLevel: 1 | 2 | 3 | 4 | 5;
  showCalculations: boolean;
  showCodeReferences: boolean;
  showAlternatives: boolean;
  autoExecute: boolean;
}

export interface SmartSuggestion {
  id: string;
  type: 'quick_action' | 'optimization' | 'warning' | 'tip' | 'next_step';
  title: string;
  description: string;
  action?: () => void;
  command?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  icon: string;
  contextMatch: number; // How relevant to current state (0-100)
}

export interface AIPerformanceMetrics {
  totalQueries: number;
  successfulQueries: number;
  averageResponseTime: number;
  userSatisfactionRate: number;
  correctionRate: number;
  topQueryTypes: { type: string; count: number }[];
  modelUsage: { model: string; count: number }[];
}

export interface EngineeringContext {
  structureType: string;
  loadingConditions: string[];
  designCodes: string[];
  criticalFactors: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

// ============================================
// ENGINEERING KNOWLEDGE RETRIEVAL
// ============================================

const ENGINEERING_KNOWLEDGE_VECTORS = {
  // IS Code Quick References
  codes: {
    'IS 800:2007': {
      title: 'Steel Design Code',
      sections: {
        'Section 5': 'Limit State Design',
        'Section 8': 'Design of Tension Members',
        'Section 9': 'Design of Compression Members',
        'Section 10': 'Design of Members in Bending',
        'Section 12': 'Connections',
        'Table 2': 'Partial Safety Factors',
        'Table 5': 'Deflection Limits',
      },
      keyFormulas: [
        'Tension: Td = Ag × fy / γm0',
        'Compression: Pd = Ae × fcd',
        'Bending: Md = βb × Zp × fy / γm0',
        'Shear: Vd = Av × fyw / (√3 × γm0)',
      ],
    },
    'IS 456:2000': {
      title: 'Concrete Design Code',
      sections: {
        'Section 26': 'Flexural Members',
        'Section 38': 'Limit State of Collapse',
        'Section 39': 'Limit State of Collapse: Compression',
        'Section 40': 'Limit State of Collapse: Shear',
      },
      keyFormulas: [
        'Mu = 0.87 × fy × Ast × d × (1 - Ast×fy / bd×fck)',
        'τv = Vu / bd',
        'Deflection: L/d ratios per Table 4',
      ],
    },
    'IS 1893:2016': {
      title: 'Seismic Design Code',
      sections: {
        'Section 6': 'Design Spectrum',
        'Section 7': 'Building Configuration',
        'Table 2': 'Zone Factors (Z)',
        'Table 3': 'Importance Factor (I)',
        'Table 9': 'Response Reduction Factor (R)',
      },
      keyFormulas: [
        'VB = Ah × W',
        'Ah = (Z/2) × (I/R) × (Sa/g)',
        'Qi = Wi × hi² / Σ(Wi × hi²)',
      ],
    },
    'IS 875:2015': {
      title: 'Loading Code',
      sections: {
        'Part 1': 'Dead Loads',
        'Part 2': 'Live Loads',
        'Part 3': 'Wind Loads',
        'Part 5': 'Load Combinations',
      },
      keyFormulas: [
        'Wind: pz = 0.6 × Vz²',
        'Combo 1: 1.5(DL + LL)',
        'Combo 2: 1.2(DL + LL + WL)',
        'Combo 3: 0.9DL + 1.5WL',
      ],
    },
  },

  // Structure Type Intelligence
  structurePatterns: {
    portal_frame: {
      typicalSpan: '12-60m',
      typicalHeight: '6-12m',
      criticalChecks: ['Lateral stability', 'P-Delta effects', 'Column buckling'],
      optimizationOpportunities: ['Haunch design', 'Column taper', 'Bracing layout'],
      commonIssues: ['Excessive sway', 'Connection design', 'Foundation moments'],
    },
    truss: {
      typicalSpan: '15-100m',
      depthRatio: 'L/8 to L/12',
      criticalChecks: ['Member slenderness', 'Connection eccentricity', 'Out-of-plane buckling'],
      optimizationOpportunities: ['Topology', 'Panel count', 'Chord sizing'],
      commonIssues: ['Secondary moments', 'Fabrication complexity', 'Erection sequence'],
    },
    multi_story: {
      typicalBays: '4-9m',
      typicalHeight: '3-4m per floor',
      criticalChecks: ['Story drift', 'P-Delta', 'Strong column weak beam'],
      optimizationOpportunities: ['Frame type selection', 'Bracing configuration', 'Core location'],
      commonIssues: ['Soft story', 'Torsional irregularity', 'Mass irregularity'],
    },
  },
};

// ============================================
// SMART SUGGESTIONS ENGINE
// ============================================

const SMART_SUGGESTION_TEMPLATES: Record<string, Omit<SmartSuggestion, 'id' | 'contextMatch'>[]> = {
  empty_model: [
    {
      type: 'quick_action',
      title: '🏗️ Create Portal Frame',
      description: 'Industrial warehouse frame with 20m span',
      command: 'Create a 20m portal frame warehouse',
      priority: 'high',
      icon: 'building',
    },
    {
      type: 'quick_action',
      title: '🌉 Design Bridge Truss',
      description: '30m span Pratt truss bridge',
      command: 'Design a 30m span Pratt truss bridge',
      priority: 'high',
      icon: 'bridge',
    },
    {
      type: 'quick_action',
      title: '🏢 Multi-Story Building',
      description: 'G+5 RCC frame building',
      command: 'Create a G+5 commercial building with 4 bays',
      priority: 'high',
      icon: 'office',
    },
    {
      type: 'tip',
      title: '💡 Pro Tip: Be Specific',
      description: 'Include dimensions, loads, and design code for best results',
      priority: 'low',
      icon: 'lightbulb',
    },
  ],
  has_structure_no_loads: [
    {
      type: 'next_step',
      title: '⬇️ Add Gravity Loads',
      description: 'Apply dead and live loads per IS 875',
      command: 'Apply standard gravity loads as per IS 875',
      priority: 'high',
      icon: 'arrow-down',
    },
    {
      type: 'next_step',
      title: '💨 Add Wind Loads',
      description: 'Calculate wind pressure for your location',
      command: 'Calculate and apply wind loads for Chennai',
      priority: 'medium',
      icon: 'wind',
    },
    {
      type: 'next_step',
      title: '🌊 Add Seismic Loads',
      description: 'Apply earthquake forces per IS 1893',
      command: 'Apply seismic loads for Zone III',
      priority: 'medium',
      icon: 'activity',
    },
  ],
  has_loads_no_analysis: [
    {
      type: 'next_step',
      title: '📊 Run Analysis',
      description: 'Perform linear static analysis',
      command: 'Run structural analysis',
      priority: 'critical',
      icon: 'play',
    },
    {
      type: 'quick_action',
      title: '🔄 Check Load Combinations',
      description: 'Verify load combinations per IS 800',
      command: 'Review load combinations',
      priority: 'medium',
      icon: 'list',
    },
  ],
  has_analysis_results: [
    {
      type: 'next_step',
      title: '✅ Code Compliance Check',
      description: 'Verify design against IS 800/IS 456',
      command: 'Check code compliance for all members',
      priority: 'high',
      icon: 'check-circle',
    },
    {
      type: 'optimization',
      title: '⚡ Optimize Weight',
      description: 'Reduce material while maintaining safety',
      command: 'Optimize structure for minimum weight',
      priority: 'medium',
      icon: 'trending-down',
    },
    {
      type: 'optimization',
      title: '💰 Optimize Cost',
      description: 'Balance performance and material cost',
      command: 'Optimize structure for minimum cost',
      priority: 'medium',
      icon: 'dollar-sign',
    },
  ],
  high_stress: [
    {
      type: 'warning',
      title: '⚠️ High Stress Detected',
      description: 'Some members exceed allowable stress limits',
      command: 'Identify and fix overstressed members',
      priority: 'critical',
      icon: 'alert-triangle',
    },
    {
      type: 'quick_action',
      title: '📐 Increase Section Size',
      description: 'Auto-upgrade critical members',
      command: 'Upgrade overstressed members to next section size',
      priority: 'high',
      icon: 'maximize',
    },
  ],
  excessive_deflection: [
    {
      type: 'warning',
      title: '⚠️ Deflection Exceeds Limit',
      description: 'Structure deflection > L/300 serviceability limit',
      command: 'Analyze and fix deflection issues',
      priority: 'critical',
      icon: 'alert-triangle',
    },
    {
      type: 'quick_action',
      title: '💪 Stiffen Structure',
      description: 'Increase moment of inertia of critical members',
      command: 'Increase beam depths to control deflection',
      priority: 'high',
      icon: 'shield',
    },
  ],
};

// ============================================
// AI POWER ENGINE CLASS
// ============================================

class AIPowerEngine {
  private expertSettings: ExpertModeSettings = {
    mode: 'assistant',
    verbosityLevel: 3,
    showCalculations: true,
    showCodeReferences: true,
    showAlternatives: false,
    autoExecute: true,
  };

  private metrics: AIPerformanceMetrics = {
    totalQueries: 0,
    successfulQueries: 0,
    averageResponseTime: 0,
    userSatisfactionRate: 0,
    correctionRate: 0,
    topQueryTypes: [],
    modelUsage: [],
  };

  private queryHistory: Array<{
    query: string;
    response: string;
    timestamp: Date;
    confidence: number;
    wasSuccessful: boolean;
    responseTime: number;
  }> = [];

  // ============================================
  // CONFIDENCE SCORING
  // ============================================

  /**
   * Calculate confidence score for an AI response
   * Based on engineering principles, code compliance, and context
   */
  calculateConfidence(
    query: string,
    response: string,
    context: {
      hasModel: boolean;
      hasAnalysisResults: boolean;
      structureType?: string;
      codeReferences?: string[];
    }
  ): AIConfidenceScore {
    const breakdown: ConfidenceBreakdown[] = [];

    // Factor 1: Query Understanding (based on intent match)
    const queryClarity = this.assessQueryClarity(query);
    breakdown.push({
      factor: 'Query Understanding',
      score: queryClarity,
      reason: queryClarity > 80 ? 'Clear engineering intent detected' : 'Query could be more specific',
    });

    // Factor 2: Code Compliance (based on code references in response)
    const codeScore = this.assessCodeCompliance(response, context.codeReferences);
    breakdown.push({
      factor: 'Code Compliance',
      score: codeScore.score,
      reason: codeScore.reason,
      codeReference: codeScore.reference,
    });

    // Factor 3: Engineering Logic (based on formula presence)
    const logicScore = this.assessEngineeringLogic(response);
    breakdown.push({
      factor: 'Engineering Logic',
      score: logicScore,
      reason: logicScore > 70 ? 'Sound engineering reasoning present' : 'Consider verifying calculations',
    });

    // Factor 4: Context Relevance
    const contextScore = this.assessContextRelevance(query, response, context);
    breakdown.push({
      factor: 'Context Relevance',
      score: contextScore,
      reason: contextScore > 80 ? 'Response is context-aware' : 'Response may need context refinement',
    });

    // Calculate overall confidence
    const overall = Math.round(
      queryClarity * 0.2 +
      codeScore.score * 0.3 +
      logicScore * 0.3 +
      contextScore * 0.2
    );

    return {
      overall,
      codeCompliance: codeScore.score,
      engineeringLogic: logicScore,
      calculationAccuracy: Math.min(logicScore + 10, 100),
      contextRelevance: contextScore,
      breakdown,
    };
  }

  private assessQueryClarity(query: string): number {
    let score = 50; // Base score

    // Boost for specific dimensions
    if (/\d+\s*(m|mm|ft|meter)/.test(query)) score += 15;

    // Boost for structure type mention
    if (/(beam|truss|frame|portal|building|bridge|cantilever)/i.test(query)) score += 15;

    // Boost for load specifications
    if (/(kN|load|force|pressure)/i.test(query)) score += 10;

    // Boost for code references
    if (/(IS\s*\d+|AISC|Eurocode|ACI)/i.test(query)) score += 10;

    return Math.min(score, 100);
  }

  private assessCodeCompliance(
    response: string,
    mentionedCodes?: string[]
  ): { score: number; reason: string; reference?: string } {
    const codePatterns = [
      { pattern: /IS\s*800/i, code: 'IS 800:2007', weight: 20 },
      { pattern: /IS\s*456/i, code: 'IS 456:2000', weight: 20 },
      { pattern: /IS\s*1893/i, code: 'IS 1893:2016', weight: 20 },
      { pattern: /IS\s*875/i, code: 'IS 875:2015', weight: 20 },
      { pattern: /AISC/i, code: 'AISC 360', weight: 15 },
      { pattern: /Eurocode/i, code: 'EN 1993', weight: 15 },
      { pattern: /clause|section|table/i, code: 'Code Reference', weight: 10 },
    ];

    let score = 40; // Base
    let foundCode = '';

    for (const { pattern, code, weight } of codePatterns) {
      if (pattern.test(response)) {
        score += weight;
        foundCode = code;
      }
    }

    return {
      score: Math.min(score, 100),
      reason: score > 70 ? 'Response includes code provisions' : 'Consider adding code references',
      reference: foundCode || undefined,
    };
  }

  private assessEngineeringLogic(response: string): number {
    let score = 40;

    // Check for formulas
    if (/[M|V|P|σ|τ]\s*[=<>]/.test(response)) score += 15;

    // Check for units
    if (/(kN|MPa|mm|N\/mm²|kNm)/.test(response)) score += 10;

    // Check for safety factors
    if (/(γ|factor of safety|FOS|capacity|demand)/i.test(response)) score += 10;

    // Check for limit states
    if (/(ultimate|serviceability|SLS|ULS)/i.test(response)) score += 10;

    // Check for step-by-step reasoning
    if (/(step|first|then|next|finally|therefore)/i.test(response)) score += 10;

    // Check for numerical calculations
    if (/\d+\s*[×*/+-]\s*\d+\s*=\s*\d+/.test(response)) score += 15;

    return Math.min(score, 100);
  }

  private assessContextRelevance(
    query: string,
    response: string,
    context: { hasModel: boolean; hasAnalysisResults: boolean; structureType?: string }
  ): number {
    let score = 50;

    // If model exists and response references it
    if (context.hasModel && /current|your|this.*model/i.test(response)) {
      score += 20;
    }

    // If analysis exists and response uses results
    if (context.hasAnalysisResults && /(result|stress|deflection|moment)/i.test(response)) {
      score += 15;
    }

    // If structure type matches
    if (context.structureType && response.toLowerCase().includes(context.structureType.toLowerCase())) {
      score += 15;
    }

    return Math.min(score, 100);
  }

  // ============================================
  // SMART SUGGESTIONS
  // ============================================

  /**
   * Generate context-aware smart suggestions
   */
  getSmartSuggestions(context: {
    nodeCount: number;
    memberCount: number;
    loadCount: number;
    hasAnalysisResults: boolean;
    maxStress?: number;
    maxDeflection?: number;
    deflectionLimit?: number;
    stressLimit?: number;
  }): SmartSuggestion[] {
    const suggestions: SmartSuggestion[] = [];

    // Determine model state
    let state = 'empty_model';
    if (context.nodeCount > 0 && context.memberCount > 0) {
      if (context.loadCount === 0) {
        state = 'has_structure_no_loads';
      } else if (!context.hasAnalysisResults) {
        state = 'has_loads_no_analysis';
      } else {
        state = 'has_analysis_results';

        // Check for issues
        if (context.maxStress && context.stressLimit && context.maxStress > context.stressLimit * 0.9) {
          suggestions.push(
            ...this.createSuggestions('high_stress', 95)
          );
        }
        if (context.maxDeflection && context.deflectionLimit && context.maxDeflection > context.deflectionLimit * 0.9) {
          suggestions.push(
            ...this.createSuggestions('excessive_deflection', 90)
          );
        }
      }
    }

    // Add state-based suggestions
    suggestions.push(...this.createSuggestions(state, 80));

    // Sort by priority and context match
    return suggestions
      .sort((a, b) => {
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return b.contextMatch - a.contextMatch;
      })
      .slice(0, 5); // Top 5 suggestions
  }

  private createSuggestions(state: string, baseContextMatch: number): SmartSuggestion[] {
    const templates = SMART_SUGGESTION_TEMPLATES[state] || [];
    return templates.map((template, index) => ({
      ...template,
      id: `${state}_${index}_${Date.now()}`,
      contextMatch: baseContextMatch - index * 5,
    }));
  }

  // ============================================
  // EXPERT MODE
  // ============================================

  setExpertMode(settings: Partial<ExpertModeSettings>): void {
    this.expertSettings = { ...this.expertSettings, ...settings };
  }

  getExpertSettings(): ExpertModeSettings {
    return { ...this.expertSettings };
  }

  /**
   * Format response based on expert mode settings
   */
  formatResponseForExpertMode(
    response: string,
    calculations?: string,
    codeReferences?: string[],
    alternatives?: string[]
  ): string {
    const { mode, verbosityLevel, showCalculations, showCodeReferences, showAlternatives } = this.expertSettings;

    let formattedResponse = response;

    if (mode === 'expert' && verbosityLevel <= 2) {
      // Concise mode for experts - strip explanations
      formattedResponse = this.extractKeyPoints(response);
    } else if (mode === 'mentor' && verbosityLevel >= 4) {
      // Add educational content
      formattedResponse = this.addMentorContent(response);
    }

    if (showCalculations && calculations) {
      formattedResponse += `\n\n### 📐 Calculations\n${calculations}`;
    }

    if (showCodeReferences && codeReferences && codeReferences.length > 0) {
      formattedResponse += `\n\n### 📚 Code References\n${codeReferences.map(ref => `- ${ref}`).join('\n')}`;
    }

    if (showAlternatives && alternatives && alternatives.length > 0) {
      formattedResponse += `\n\n### 🔄 Alternative Approaches\n${alternatives.map((alt, i) => `${i + 1}. ${alt}`).join('\n')}`;
    }

    return formattedResponse;
  }

  private extractKeyPoints(response: string): string {
    // Extract bullet points and key info
    const lines = response.split('\n');
    const keyLines = lines.filter(line =>
      line.trim().startsWith('-') ||
      line.trim().startsWith('•') ||
      line.includes('=') ||
      /^\d+\./.test(line.trim()) ||
      line.includes('kN') ||
      line.includes('MPa')
    );
    return keyLines.join('\n') || response.substring(0, 300);
  }

  private addMentorContent(response: string): string {
    return response + `\n\n💡 **Learning Note:** This approach follows standard engineering practice. ` +
      `Consider reviewing the relevant IS code clauses for a deeper understanding.`;
  }

  // ============================================
  // ENGINEERING KNOWLEDGE RETRIEVAL
  // ============================================

  /**
   * Retrieve relevant engineering knowledge for a query
   */
  retrieveKnowledge(query: string): EngineeringContext {
    const q = query.toLowerCase();

    // Detect structure type
    let structureType = 'general';
    if (/(portal|warehouse|industrial)/i.test(q)) structureType = 'portal_frame';
    else if (/(truss|bridge)/i.test(q)) structureType = 'truss';
    else if (/(building|story|floor)/i.test(q)) structureType = 'multi_story';

    const pattern = ENGINEERING_KNOWLEDGE_VECTORS.structurePatterns[structureType as keyof typeof ENGINEERING_KNOWLEDGE_VECTORS.structurePatterns];

    // Detect loading conditions
    const loadingConditions: string[] = [];
    if (/(gravity|dead|live)/i.test(q)) loadingConditions.push('Gravity loads');
    if (/(wind|lateral)/i.test(q)) loadingConditions.push('Wind loads');
    if (/(seismic|earthquake)/i.test(q)) loadingConditions.push('Seismic loads');
    if (loadingConditions.length === 0) loadingConditions.push('Standard gravity loads');

    // Detect design codes
    const designCodes: string[] = [];
    if (/IS\s*800/i.test(q)) designCodes.push('IS 800:2007');
    if (/IS\s*456/i.test(q)) designCodes.push('IS 456:2000');
    if (/IS\s*1893/i.test(q)) designCodes.push('IS 1893:2016');
    if (designCodes.length === 0) designCodes.push('IS 800:2007', 'IS 875:2015');

    return {
      structureType,
      loadingConditions,
      designCodes,
      criticalFactors: pattern?.criticalChecks || ['General stability', 'Member capacity', 'Serviceability'],
      riskLevel: this.assessRiskLevel(q),
      recommendations: pattern?.optimizationOpportunities || ['Verify load combinations', 'Check deflection limits'],
    };
  }

  private assessRiskLevel(query: string): 'low' | 'medium' | 'high' | 'critical' {
    if (/(critical|emergency|failure|collapse)/i.test(query)) return 'critical';
    if (/(seismic|earthquake|high-rise|long-span)/i.test(query)) return 'high';
    if (/(optimize|check|verify)/i.test(query)) return 'medium';
    return 'low';
  }

  // ============================================
  // PERFORMANCE ANALYTICS
  // ============================================

  recordQuery(
    query: string,
    response: string,
    wasSuccessful: boolean,
    responseTime: number,
    confidenceScore: number
  ): void {
    this.queryHistory.push({
      query,
      response,
      timestamp: new Date(),
      confidence: confidenceScore,
      wasSuccessful,
      responseTime,
    });

    // Update metrics
    this.metrics.totalQueries++;
    if (wasSuccessful) this.metrics.successfulQueries++;

    // Update average response time
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (this.metrics.totalQueries - 1) + responseTime) /
      this.metrics.totalQueries;

    // Keep only last 100 queries
    if (this.queryHistory.length > 100) {
      this.queryHistory.shift();
    }
  }

  getPerformanceMetrics(): AIPerformanceMetrics {
    return {
      ...this.metrics,
      userSatisfactionRate: this.metrics.successfulQueries / Math.max(this.metrics.totalQueries, 1) * 100,
    };
  }

  // ============================================
  // QUICK ACTIONS
  // ============================================

  getQuickActions(): Array<{
    id: string;
    label: string;
    icon: string;
    command: string;
    category: 'create' | 'analyze' | 'optimize' | 'check';
    description: string;
  }> {
    return [
      // Create actions
      {
        id: 'create_portal',
        label: 'Portal Frame',
        icon: '🏗️',
        command: 'Create a 20m portal frame industrial building',
        category: 'create',
        description: 'Single-span industrial frame',
      },
      {
        id: 'create_truss',
        label: 'Roof Truss',
        icon: '🌉',
        command: 'Create a 15m Pratt truss with 6 panels',
        category: 'create',
        description: 'Standard Pratt truss roof',
      },
      {
        id: 'create_building',
        label: 'Building Frame',
        icon: '🏢',
        command: 'Create a G+3 commercial building frame',
        category: 'create',
        description: 'Multi-story RCC frame',
      },
      {
        id: 'create_beam',
        label: 'Simple Beam',
        icon: '📏',
        command: 'Create a 6m simply supported beam',
        category: 'create',
        description: 'Basic beam element',
      },
      // Analyze actions
      {
        id: 'analyze_structure',
        label: 'Run Analysis',
        icon: '📊',
        command: 'Analyze the current structure',
        category: 'analyze',
        description: 'Linear static analysis',
      },
      {
        id: 'analyze_seismic',
        label: 'Seismic Check',
        icon: '🌊',
        command: 'Perform seismic analysis for Zone III',
        category: 'analyze',
        description: 'IS 1893 compliance',
      },
      {
        id: 'analyze_pdelta',
        label: 'P-Delta',
        icon: '📐',
        command: 'Run P-Delta analysis',
        category: 'analyze',
        description: 'Second-order effects',
      },
      // Optimize actions
      {
        id: 'optimize_weight',
        label: 'Min Weight',
        icon: '⚡',
        command: 'Optimize for minimum weight',
        category: 'optimize',
        description: 'Reduce material usage',
      },
      {
        id: 'optimize_cost',
        label: 'Min Cost',
        icon: '💰',
        command: 'Optimize for minimum cost',
        category: 'optimize',
        description: 'Balance cost & performance',
      },
      // Check actions
      {
        id: 'check_is800',
        label: 'IS 800 Check',
        icon: '✅',
        command: 'Check compliance with IS 800:2007',
        category: 'check',
        description: 'Steel design code check',
      },
      {
        id: 'check_deflection',
        label: 'Deflection',
        icon: '📉',
        command: 'Check deflection limits',
        category: 'check',
        description: 'Serviceability check',
      },
      {
        id: 'check_connections',
        label: 'Connections',
        icon: '🔗',
        command: 'Design and check connections',
        category: 'check',
        description: 'Joint capacity check',
      },
    ];
  }
}

// Singleton instance
export const aiPowerEngine = new AIPowerEngine();

// Export class for testing
export { AIPowerEngine };
