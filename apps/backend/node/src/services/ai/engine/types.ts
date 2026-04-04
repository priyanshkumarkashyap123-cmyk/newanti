import type { Intent } from './intents.js';

export type JsonRecord = Record<string, unknown>;

export interface StructuralNode {
  id: string;
  x: number;
  y: number;
  z: number;
  isSupport?: boolean;
  restraints?: {
    fx?: boolean;
    fy?: boolean;
    fz?: boolean;
    mx?: boolean;
    my?: boolean;
    mz?: boolean;
  };
}

export interface StructuralMember {
  id: string;
  s: string;       // startNodeId
  e: string;       // endNodeId
  section: string;
  material?: string;
}

export interface StructuralLoad {
  nodeId?: string;
  memberId?: string;
  type: 'point' | 'UDL' | 'moment' | 'self_weight';
  fx?: number;
  fy?: number;
  fz?: number;
  w1?: number;
  direction?: string;
}

export interface StructuralModel {
  nodes: StructuralNode[];
  members: StructuralMember[];
  loads?: StructuralLoad[];
  materials?: Array<{ id: string; name: string; E: number; density: number; fy: number }>;
  sections?: Array<{ id: string; name: string; type: string; A: number; Ix: number; Iy: number }>;
}

export interface ModelContext {
  nodes: Array<{ id: string; x: number; y: number; z: number; hasSupport: boolean }>;
  members: Array<{ id: string; startNode: string; endNode: string; section?: string }>;
  loads: Array<{ nodeId: string; fx?: number; fy?: number; fz?: number }>;
  analysisResults?: {
    maxDisplacement?: number;
    maxStress?: number;
    maxMoment?: number;
    maxShear?: number;
    failedMembers?: string[];
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIResponse {
  success: boolean;
  response: string;
  actions?: AIAction[];
  model?: StructuralModel;
  plan?: AIPlan;
  validation?: ModelValidation;
  metadata?: {
    intent: Intent;
    confidence: number;
    processingTimeMs: number;
    provider: 'gemini' | 'local' | 'python';
    tokensUsed?: number;
  };
  error?: string;
}

export interface AIAction {
  type: 'addNode' | 'addMember' | 'addSupport' | 'addLoad' | 'removeMember' |
        'removeNode' | 'changeSection' | 'runAnalysis' | 'optimize' | 'applyModel' |
        'clearModel' | 'report';
  params: Record<string, unknown>;
  description: string;
}

export interface AIPlan {
  goal: string;
  reasoning: string;
  steps: AIAction[];
  confidence: number;
  alternatives?: string[];
}

export interface DiagnosisResult {
  success: boolean;
  issues: DiagnosisIssue[];
  overallHealth: 'good' | 'warning' | 'critical';
  suggestions: string[];
  autoFixAvailable: boolean;
}

export interface DiagnosisIssue {
  severity: 'error' | 'warning' | 'info';
  category: 'stability' | 'connectivity' | 'loading' | 'section' | 'geometry' | 'support';
  message: string;
  affectedElements: string[];
  suggestedFix?: string;
}

export interface ModelValidationIssue {
  severity: 'error' | 'warning';
  type: 'structure' | 'connectivity' | 'support' | 'section' | 'geometry';
  message: string;
  fixable: boolean;
  affectedElements?: string[];
}

export interface ModelValidation {
  valid: boolean;
  totalIssues: number;
  errors: number;
  warnings: number;
  issues: ModelValidationIssue[];
  checks: {
    nodesExist: boolean;
    membersExist: boolean;
    uniqueNodeIds: boolean;
    uniqueMemberIds: boolean;
    validMemberReferences: boolean;
    validNodePairs: boolean;
    zeroLengthMembers: boolean;
    supportsExist: boolean;
    knownSections: boolean;
    spanSectionSanity: boolean;
  };
}

export interface OptimizationResult {
  success: boolean;
  originalWeight: number;
  optimizedWeight: number;
  savingsPercent: number;
  changes: Array<{
    memberId: string;
    oldSection: string;
    newSection: string;
    reason: string;
  }>;
  model?: StructuralModel;
}

export interface CodeCheckResult {
  success: boolean;
  code: string;
  overallStatus: 'pass' | 'fail' | 'warning';
  checks: Array<{
    clause: string;
    description: string;
    status: 'pass' | 'fail' | 'warning';
    ratio?: number;
    limit?: number;
    actual?: number;
    details?: string;
  }>;
  summary: string;
}