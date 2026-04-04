import { SYSTEM_PROMPTS } from '../prompts.js';
import type { AIResponse, ChatMessage, ModelContext } from '../types.js';
import type { GenerativeModel } from '@google/generative-ai';
import { logger } from '../../../../utils/logger.js';

export async function handleConversation(
  model: GenerativeModel | null,
  message: string,
  context?: ModelContext,
  history?: ChatMessage[]
): Promise<AIResponse> {
  if (model) {
    try {
      let contextStr = SYSTEM_PROMPTS.chat;
      if (context && context.nodes.length > 0) {
        contextStr += `\n\nCurrent model: ${context.nodes.length} nodes, ${context.members.length} members, ${context.nodes.filter(n => n.hasSupport).length} supports, ${context.loads?.length || 0} loads.`;
      }

      const recentHistory = (history || []).slice(-10);
      const historyStr = recentHistory.length > 0
        ? '\n\nRecent conversation:\n' + recentHistory.map(h => `${h.role}: ${h.content}`).join('\n')
        : '';

      const prompt = `${contextStr}${historyStr}\n\nUser: ${message}\n\nAssistant:`;

      const result = await model.generateContent(prompt);
      return {
        success: true,
        response: result.response.text(),
        metadata: { intent: 'conversation', confidence: 0.7, processingTimeMs: 0, provider: 'gemini' },
      };
    } catch (err) {
      logger.warn({ err }, '[AIArchitectEngine] Gemini conversation failed');
    }
  }

  return {
    success: true,
    response: "I'm your AI Architect assistant. I can help with:\n\n" +
      "🏗️ **Create structures** — \"Create a 10m portal frame\"\n" +
      "🔧 **Modify models** — \"Add another story\"\n" +
      "📊 **Analyze** — \"Run analysis\"\n" +
      "🔍 **Diagnose** — \"Check for issues\"\n" +
      "📋 **Code check** — \"Check IS 800 compliance\"\n" +
      "💡 **Explain** — \"What is P-Delta?\"\n\n" +
      "Please configure your Gemini API key for full AI capabilities.",
    metadata: { intent: 'conversation', confidence: 0.5, processingTimeMs: 0, provider: 'local' },
  };
}