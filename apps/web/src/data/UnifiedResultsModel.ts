/**
 * UnifiedResultsModel.ts — Aggregated results across analysis, design, and detailing domains
 * 
 * Purpose: Single source of truth for all structural analysis/design/detailing results
 * This model is consumed by:
 * - ResultsHub (UI display)
 * - ReportGenerationService (PDF export)
 * - ModelStore (state caching)
 * 
 * Data flows: Analysis → Design → Detailing → UnifiedReportData → PDF Report
 */

// ============================================================
// ANALYSIS RESULTS
// ============================================================

export interface NodeForces {
  nodeid: string;
  displacements: {
    dx: number;  // m
    dy: number;  // m
    dz: number;  // m
  };
  reactions?: {
    fx: number;  // kN
    fy: number;  // kN
    fz: number;  // kN
    mx: number;  // kN·m
    my: number;  // kN·m
    mz: number;  // kN·m
  };
}

export interface MemberForces {
  memberId: string;
  sectionId?: string;
  length: number;  // m
  forces: {
    x_values: number[];  // position along length (m)
    Fx: number[];        // axial force (kN)
    Fy: number[];        // shear Y (kN)
    Fz: number[];        // shear Z (kN)
    Mx: number[];        // torsion (kN·m)
    My: number[];        // moment Y (kN·m)
    Mz: number[];        // moment Z (kN·m)
  };
  maxValues: {
    axial: number;
    shearY: number;
    shearZ: number;
    momentY: number;
    momentZ: number;
  };
}

export interface ReactionSet {
  reactions: NodeForces[];
  totalReactionFx: number;  // kN
  totalReactionFy: number;  // kN
  totalReactionFz: number;  // kN
  maxReaction: number;      // kN
}

export interface UnifiedAnalysisResult {
  // Metadata
  analysisId: string;
  timestamp: Date;
  loadCase: string;
  analysisType: 'linear' | 'modal' | 'pdelta' | 'buckling' | 'nonlinear';
  status: 'pending' | 'running' | 'complete' | 'error';

  // Results
  nodeResults: Map<string, NodeForces>;
  memberResults: Map<string, MemberForces>;
  reactions: ReactionSet;

  // Summary statistics
  maxDisplacement: {
    value: number;  // m
    nodeId: string;
    direction: 'X' | 'Y' | 'Z';
  };
  maxMemberForce: {
    value: number;  // kN
    memberId: string;
    forceType: 'axial' | 'shear' | 'moment';
  };
  maxStress: {
    value: number;  // MPa
    memberId: string;
  };

  // Error handling
  error?: string;
}

// ============================================================
// DESIGN RESULTS
// ============================================================

export interface DesignCheck {
  memberId: string;
  sectionId: string;
  designCode: 'IS456' | 'IS800' | 'AISC360' | 'EC2' | 'EC3' | 'BS5950';
  
  // Utilization
  utilization: number;  // 0-1 ratio (D/C)
  utilizationPercent: number;  // 0-100%
  status: 'pass' | 'warn' | 'fail';  // pass <80%, warn 80-100%, fail >100%
  
  // Checks
  bendingCheck: { utilization: number; clause: string };
  shearCheck: { utilization: number; clause: string };
  axialCheck: { utilization: number; clause: string };
  deflectionCheck?: { value: number; limit: number; status: 'pass' | 'fail' };
  
  // Recommendations
  recommendations: string[];
  minSectionRequired?: string;  // "ISMB 400" etc
  optimizedSection?: string;
}

export interface UnifiedDesignResult {
  // Metadata
  designId: string;
  timestamp: Date;
  designCode: 'IS456' | 'IS800' | 'AISC360' | 'EC2' | 'EC3' | 'BS5950';
  materialType: 'steel' | 'concrete' | 'timber' | 'composite';
  status: 'not-run' | 'pending' | 'complete' | 'error';

  // Results
  memberDesigns: Map<string, DesignCheck>;

  // Summary
  utilizations: Record<string, number>;  // memberId → utilization ratio
  criticalMembers: string[];  // > 80% utilization
  failedMembers: string[];    // > 100% utilization
  averageUtilization: number;
  maxUtilization: number;
  minUtilization: number;

  // Narrative
  designSummary: string;  // "18 members analyzed per IS 800. 3 critical: M012, M045, M067"
  codeCompliance: boolean;
  overallStatus: 'pass' | 'warn' | 'fail';

  // Error
  error?: string;
}

// ============================================================
// DETAILING RESULTS
// ============================================================

export interface ReinforcementDetail {
  memberId: string;
  type: 'beam' | 'column' | 'slab';
  
  // Main reinforcement
  mainBars: {
    diameter: number;    // mm
    count: number;
    strength: number;    // MPa (fy)
    location: 'top' | 'bottom' | 'all';
  };

  // Shear reinforcement (stirrups)
  stirrups: {
    diameter: number;    // mm
    spacing: number;     // mm (c/c)
    legsPerHoop: number;
    type: 'open' | 'close';
  };

  // Anchorage
  anchorageLength: number;  // mm
  anchorageType: 'straight' | 'hook' | 'mechanical';
}

export interface ConnectionDetail {
  memberId: string;
  connectionType: 'bolted' | 'welded' | 'base-plate' | 'moment';
  
  // Bolts
  bolts?: {
    grade: string;  // "8.8", "10.9"
    diameter: number;  // mm
    count: number;
    arrangement: string;  // "2 rows × 3 cols"
    preload?: number;  // kN
  };

  // Welds
  welds?: {
    type: string;  // "fillet", "groove"
    size: number;  // mm
    length: number;  // mm
    process: string;  // "GMAW", "SMAW"
  };

  // Base plate
  basePlate?: {
    thickness: number;  // mm
    sizeX: number;      // mm
    sizeY: number;      // mm
    anchor?: {
      count: number;
      diameter: number;  // mm
      embedDepth: number;  // mm
    };
  };
}

export interface UnifiedDetailingResult {
  // Metadata
  detailingId: string;
  timestamp: Date;
  materialType: 'steel' | 'concrete' | 'composite';
  status: 'not-run' | 'pending' | 'complete';

  // RC detailing
  rcReinforcement?: Map<string, ReinforcementDetail>;

  // Steel detailing
  steelConnections?: Map<string, ConnectionDetail>;

  // Schedules
  schedules: {
    reinforcement?: {
      barType: string;    // "Fe415", "Fe500"
      totalWeight: number;  // tonnes
      barsPerMember: Record<string, { diameter: number; count: number; totalLength: number }>;
    };
    connections?: {
      totalBolts: number;
      boltGrades: Record<string, number>;  // "8.8": 48
      totalWeldLength: number;  // mm
      totalBasePlateArea: number;  // m²
    };
  };

  // Error
  error?: string;
}

// ============================================================
// UNIFIED REPORT DATA
// ============================================================

export interface ProjectMetadata {
  projectName: string;
  clientName?: string;
  engineerName?: string;
  location?: string;
  date: Date;
  revision: string;  // "Rev A", etc
  logo?: string;  // base64 or URL
}

export interface UnifiedReportData {
  // Project info
  project: ProjectMetadata;

  // All results
  analysis: UnifiedAnalysisResult;
  design: UnifiedDesignResult;
  detailing: UnifiedDetailingResult;

  // Report metadata
  generatedAt: Date;
  reportFormat: 'pdf' | 'html' | 'docx';
  
  // Derived summary
  summary: {
    totalMembers: number;
    analyzedMembers: number;
    designedMembers: number;
    criticalCount: number;
    failedCount: number;
    recommendedAction: string;  // "Passed all checks" or "Resize M012, M045, M067"
  };
}

// ============================================================
// FACTORY FUNCTIONS & UTILITIES
// ============================================================

/**
 * Create empty analysis result (for initialization)
 */
export const createEmptyAnalysisResult = (analysisId: string): UnifiedAnalysisResult => ({
  analysisId,
  timestamp: new Date(),
  loadCase: 'Static',
  analysisType: 'linear',
  status: 'pending',
  nodeResults: new Map(),
  memberResults: new Map(),
  reactions: {
    reactions: [],
    totalReactionFx: 0,
    totalReactionFy: 0,
    totalReactionFz: 0,
    maxReaction: 0,
  },
  maxDisplacement: { value: 0, nodeId: '', direction: 'Y' },
  maxMemberForce: { value: 0, memberId: '', forceType: 'shear' },
  maxStress: { value: 0, memberId: '' },
});

/**
 * Create empty design result (for initialization)
 */
export const createEmptyDesignResult = (
  designId: string,
  designCode: UnifiedDesignResult['designCode'] = 'IS800'
): UnifiedDesignResult => ({
  designId,
  timestamp: new Date(),
  designCode,
  materialType: 'steel',
  status: 'not-run',
  memberDesigns: new Map(),
  utilizations: {},
  criticalMembers: [],
  failedMembers: [],
  averageUtilization: 0,
  maxUtilization: 0,
  minUtilization: 0,
  designSummary: 'Design not yet run',
  codeCompliance: false,
  overallStatus: 'fail',
});

/**
 * Create empty detailing result (for initialization)
 */
export const createEmptyDetailingResult = (
  detailingId: string,
  materialType: 'steel' | 'concrete' = 'steel'
): UnifiedDetailingResult => ({
  detailingId,
  timestamp: new Date(),
  materialType,
  status: 'not-run',
  rcReinforcement: materialType === 'concrete' ? new Map() : undefined,
  steelConnections: materialType === 'steel' ? new Map() : undefined,
  schedules: {},
});

/**
 * Aggregate all results into unified report data
 */
export const aggregateToReportData = (
  project: ProjectMetadata,
  analysis: UnifiedAnalysisResult,
  design: UnifiedDesignResult,
  detailing: UnifiedDetailingResult
): UnifiedReportData => {
  const totalMembers = analysis.memberResults.size;
  const designedMembers = design.memberDesigns.size;
  const criticalCount = design.criticalMembers.length;
  const failedCount = design.failedMembers.length;

  let recommendedAction = 'Passed all structural checks';
  if (failedCount > 0) {
    recommendedAction = `FAILED: Resize ${failedCount} member(s): ${design.failedMembers.join(', ')}`;
  } else if (criticalCount > 0) {
    recommendedAction = `CRITICAL: ${criticalCount} member(s) at ${(design.maxUtilization * 100).toFixed(0)}% utilization — consider optimization`;
  }

  return {
    project,
    analysis,
    design,
    detailing,
    generatedAt: new Date(),
    reportFormat: 'pdf',
    summary: {
      totalMembers,
      analyzedMembers: totalMembers,
      designedMembers,
      criticalCount,
      failedCount,
      recommendedAction,
    },
  };
};

/**
 * Get human-readable analysis summary
 */
export const getAnalysisSummaryText = (result: UnifiedAnalysisResult): string => {
  if (result.status !== 'complete') {
    return 'Analysis not yet run';
  }

  return `
Linear Static Analysis — ${result.loadCase}
• ${result.nodeResults.size} nodes analyzed
• ${result.memberResults.size} members analyzed
• Max displacement: ${result.maxDisplacement.value.toFixed(4)} m (Node ${result.maxDisplacement.nodeId})
• Max member force: ${result.maxMemberForce.value.toFixed(2)} kN (${result.maxMemberForce.memberId})
• Max stress: ${result.maxStress.value.toFixed(2)} MPa
• Max support reaction: ${result.reactions.maxReaction.toFixed(2)} kN
  `.trim();
};

/**
 * Get human-readable design summary
 */
export const getDesignSummaryText = (result: UnifiedDesignResult): string => {
  if (result.status === 'not-run') {
    return 'Design checks not yet run';
  }

  const statusText =
    result.failedMembers.length > 0
      ? `FAILED (${result.failedMembers.length} members)`
      : result.criticalMembers.length > 0
        ? `CRITICAL (${result.criticalMembers.length} members at ${(result.maxUtilization * 100).toFixed(0)}%)`
        : 'PASSED';

  return `
${result.designCode} Design Check — ${statusText}
• ${result.memberDesigns.size} members designed
• Average utilization: ${(result.averageUtilization * 100).toFixed(1)}%
• Max utilization: ${(result.maxUtilization * 100).toFixed(1)}%
• Critical members (>80%): ${result.criticalMembers.length}
• Failed members (>100%): ${result.failedMembers.length}
  `.trim();
};

export default {
  createEmptyAnalysisResult,
  createEmptyDesignResult,
  createEmptyDetailingResult,
  aggregateToReportData,
  getAnalysisSummaryText,
  getDesignSummaryText,
};
