export const GEMINI_FALLBACK_RESPONSES = {
  engineeringKnowledgeBase: 'Engineering knowledge base',
  greeting: 'Hello!',
  thanks: 'You are welcome.',
  helpGuide: 'Help guide',
  troubleshooting: 'Troubleshooting',
  review: 'Review',
  conversation: 'Conversation',
  localResponse: 'Local response',
  modelOverview: 'Current model overview',
  designCheckReport: 'Design check report',
  noStructureToAnalyze: 'No Structure to Analyze',
  readyForAnalysis: 'Ready for Analysis',
  resultsAvailable: 'Results available',
  noAnalysisResults: 'No analysis results available.',
  generalQueryFallback: 'I understand you are asking about this query.',
} as const;

export const GEMINI_ACTION_TEXT = {
  runStructuralAnalysis: 'Run structural analysis',
  clearCurrentModelAction: 'Clear current model',
  clearCurrentModelResponse:
    "I'll clear the current model for you. Click **Execute** to confirm, or you can say 'cancel' to keep your model.",
} as const;
