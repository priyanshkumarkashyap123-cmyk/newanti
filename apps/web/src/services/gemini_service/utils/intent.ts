export const GEMINI_INTENTS = {
  greeting: 'greeting',
  thanks: 'thanks',
  help: 'help',
  troubleshoot: 'troubleshoot',
  reviewModel: 'review_model',
  createStructure: 'create_structure',
  runAnalysis: 'run_analysis',
  interpretResults: 'interpret_results',
  optimize: 'optimize',
  designCheck: 'design_check',
  clearModel: 'clear_model',
  explain: 'explain',
  aboutModel: 'about_model',
  conversation: 'conversation',
} as const;

export type GeminiIntent = (typeof GEMINI_INTENTS)[keyof typeof GEMINI_INTENTS];

const INTENT_PATTERNS = {
  greetingPrimary: /^(hi|hello|hey|good morning|good afternoon|good evening|howdy|greetings)/i,
  greetingSecondary: /^(how are you|how's it going|what's up|whats up)/i,
  thanks: /^(thanks|thank you|thx|appreciate|great job|awesome|perfect)/i,
  helpPrimary: /^(help|what can you do|capabilities|features)/i,
  troubleshoot: /error|problem|issue|wrong|not working|failed|crash|bug|fix|broken|stuck|help me with/i,
  reviewPrimary: /review|check my|look at|inspect|evaluate|assess/i,
  reviewSecondary: /model|structure|design|work/i,
  createPrimary: /create|build|make|generate|design|model|draw|add|new/i,
  createSecondary: /frame|truss|beam|column|building|structure|bridge|cantilever|portal|slab|foundation/i,
  runAnalysisPrimary: /analyze|analysis|run|calculate|solve|compute/i,
  runAnalysisExclude: /how|what|why|explain/i,
  interpretPrimary: /result|displacement|stress|moment|reaction|deflection|interpret|show me/i,
  interpretSecondary: /result|analysis|output|value/i,
  optimize: /optimize|improve|reduce|minimize|maximize|efficient|lighter|cheaper|better/i,
  designCheckPrimary: /check|verify|validate|code|compliance|safe|adequate|pass|fail/i,
  designCheckSecondary: /design|code|is 800|aisc|aci|standard|requirement/i,
  clearPrimary: /clear|reset|delete|remove|start over|new model|fresh/i,
  clearSecondary: /model|all|everything|structure/i,
  explain: /what is|what are|what's|explain|tell me about|teach|learn|understand|definition|meaning|concept|theory|principle/i,
  aboutPrimary: /my|this|current/i,
  aboutSecondary: /model|structure|design|frame/i,
} as const;

const HELP_EXACT_TOKENS = ['?', 'help me'] as const;

export const classifyGeminiIntent = (query: string): GeminiIntent => {
  const q = query.toLowerCase().trim();
  if (q.match(INTENT_PATTERNS.greetingPrimary) || q.match(INTENT_PATTERNS.greetingSecondary)) return GEMINI_INTENTS.greeting;
  if (q.match(INTENT_PATTERNS.thanks)) return GEMINI_INTENTS.thanks;
  if (q.match(INTENT_PATTERNS.helpPrimary) || HELP_EXACT_TOKENS.includes(q as (typeof HELP_EXACT_TOKENS)[number])) return GEMINI_INTENTS.help;
  if (q.match(INTENT_PATTERNS.troubleshoot)) return GEMINI_INTENTS.troubleshoot;
  if (q.match(INTENT_PATTERNS.reviewPrimary) && q.match(INTENT_PATTERNS.reviewSecondary)) return GEMINI_INTENTS.reviewModel;
  if (q.match(INTENT_PATTERNS.createPrimary) && q.match(INTENT_PATTERNS.createSecondary)) return GEMINI_INTENTS.createStructure;
  if (q.match(INTENT_PATTERNS.runAnalysisPrimary) && !q.match(INTENT_PATTERNS.runAnalysisExclude)) return GEMINI_INTENTS.runAnalysis;
  if (q.match(INTENT_PATTERNS.interpretPrimary) && q.match(INTENT_PATTERNS.interpretSecondary)) return GEMINI_INTENTS.interpretResults;
  if (q.match(INTENT_PATTERNS.optimize)) return GEMINI_INTENTS.optimize;
  if (q.match(INTENT_PATTERNS.designCheckPrimary) && q.match(INTENT_PATTERNS.designCheckSecondary)) return GEMINI_INTENTS.designCheck;
  if (q.match(INTENT_PATTERNS.clearPrimary) && q.match(INTENT_PATTERNS.clearSecondary)) return GEMINI_INTENTS.clearModel;
  if (q.match(INTENT_PATTERNS.explain)) return GEMINI_INTENTS.explain;
  if (q.match(INTENT_PATTERNS.aboutPrimary) && q.match(INTENT_PATTERNS.aboutSecondary)) return GEMINI_INTENTS.aboutModel;
  return GEMINI_INTENTS.conversation;
};
