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

export type ExpertMode = 'assistant' | 'expert' | 'mentor';

export interface PerformanceMetrics {
  totalQueries: number;
  successfulQueries: number;
  avgResponseTime: number;
  codeReferencesUsed: number;
}

export interface GeminiProxyResponse {
  success: boolean;
  response?: string;
  error?: string;
}

export interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}
