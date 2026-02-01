/**
 * Machine Learning Services Index
 */

export {
    vertexAI,
    default as VertexAIService,
    type FineTuningDataset,
    type TrainingExample as VertexTrainingExample,
    type TrainingJob,
    type ModelVersion,
    type RetrainingTrigger
} from './VertexAIService';

// Type aliases for backward compatibility
export type FineTuningJob = import('./VertexAIService').TrainingJob;
export type ModelMetrics = import('./VertexAIService').ModelVersion['metrics'];
export interface ABTest {
    id: string;
    name: string;
    variants: Array<{ name: string; trafficPercent: number }>;
    status: 'running' | 'completed';
}

export {
    selfImprovement,
    default as SelfImprovementEngine,
    type PerformanceMetrics,
    type OptimizationAction,
    type PromptTemplate,
    type ImprovementReport
} from './SelfImprovementEngine';

// Type aliases for backward compatibility
export type ImprovementCandidate = import('./SelfImprovementEngine').OptimizationAction;
export type ImprovementResult = import('./SelfImprovementEngine').ImprovementReport;
export type SelfImprovementConfig = { enabled: boolean; threshold: number };

export {
    knowledgeGraph,
    default as KnowledgeGraphService,
    type KnowledgeNode,
    type KnowledgeEdge,
    type QueryResult
} from './KnowledgeGraphService';

// Type alias for backward compatibility
export interface ReasoningChain {
    steps: Array<{ from: string; to: string; relation: string }>;
    confidence: number;
}

export {
    enhancedLearning,
    default as EnhancedLearningPipeline,
    type TrainingExample as EnhancedTrainingExample,
    type LearningMetrics,
    type ModelCheckpoint,
    type LearningTrigger
} from './EnhancedLearningPipeline';
