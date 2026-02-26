/**
 * Design Learning Module — public API
 */
export { DesignKnowledgeBase } from './DesignKnowledgeBase';
export type { DesignInputKey, CachedDesignResult, UserDesignPrefs } from './DesignKnowledgeBase';

export { optimizeSection, quickEstimate } from './IterativeSectionOptimizer';
export type { OptimizeRequest, OptimizeResult } from './IterativeSectionOptimizer';

export { useSmartDesign } from './SmartDesignSuggester';
export type { UseSmartDesignReturn } from './SmartDesignSuggester';
