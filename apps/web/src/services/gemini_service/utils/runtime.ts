export const GEMINI_RUNTIME_DEFAULTS = {
  model: 'gemini-2.0-flash',
  maxContextLength: 15,
  defaultConversationSummary: '',
  defaultExpertMode: 'assistant',
  reasoningSnippetLength: 200,
  reasoningHistoryLimit: 10,
  logPreviewLength: 100,
  generation: {
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
  noResponseGenerated: 'No response generated',
  http: {
    postMethod: 'POST',
  },
  processingStatus: {
    thinking: 'thinking',
    complete: 'complete',
    error: 'error',
  },
  messages: {
    decompositionFailed: 'Task decomposition failed',
    reasoningFailed: 'Problem reasoning failed',
    apiKeyMissing: 'Gemini API key not configured. Please set your API key.',
    callingApi: 'Calling Gemini API',
    responseReceived: 'Response received',
    sendingRequest: 'Sending request',
    apiError: 'API error',
    requestFailed: 'Gemini API request failed',
    geminiApiError: 'Gemini API error',
    apiFallbackToLocalPlanning: 'Gemini API failed, using local planning',
  },
} as const;

export const GEMINI_INITIAL_PERFORMANCE_METRICS = {
  totalQueries: 0,
  successfulQueries: 0,
  avgResponseTime: 0,
  codeReferencesUsed: 0,
} as const;
