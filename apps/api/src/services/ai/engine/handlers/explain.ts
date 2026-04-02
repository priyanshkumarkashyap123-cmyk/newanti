import { SYSTEM_PROMPTS } from '../prompts.js';
import type { AIResponse } from '../types.js';
import type { GenerativeModel } from '@google/generative-ai';
import { logger } from '../../../../utils/logger.js';

export async function handleExplain(model: GenerativeModel | null, message: string): Promise<AIResponse> {
  if (model) {
    try {
      const prompt = `${SYSTEM_PROMPTS.chat}

The user is asking for an explanation. Be clear, concise, and technically accurate. Use proper structural engineering terminology. Include relevant Indian Standards references where applicable.

User question: "${message}"`;

      const result = await model.generateContent(prompt);
      return {
        success: true,
        response: result.response.text(),
        metadata: { intent: 'explain', confidence: 0.85, processingTimeMs: 0, provider: 'gemini' },
      };
    } catch (err) {
      logger.warn({ err }, '[AIArchitectEngine] Gemini explain failed');
    }
  }

  return {
    success: true,
    response: "I'd be happy to explain that, but my AI service is currently offline. Please check your Gemini API key configuration, or try asking about specific structural topics like beam design, truss analysis, or IS code provisions.",
    metadata: { intent: 'explain', confidence: 0.5, processingTimeMs: 0, provider: 'local' },
  };
}