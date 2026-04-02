import { SYSTEM_PROMPTS } from '../prompts.js';
import type { GenerativeModel } from '@google/generative-ai';
import type { AIAction, AIResponse, ModelContext, StructuralModel } from '../types.js';
import { normalizeModel } from '../modelUtils.js';
import { logger } from '../../../../utils/logger.js';

export async function handleModifyModel(message: string, context: ModelContext | undefined, model: GenerativeModel | null): Promise<AIResponse> {
  if (!context || context.nodes.length === 0) {
    return { success: false, response: "There's no model to modify. Please create a structure first, then I can modify it." };
  }

  if (model) {
    try {
      const prompt = `${SYSTEM_PROMPTS.modify}\n\nCurrent model:\n${JSON.stringify({ nodes: context.nodes, members: context.members }, null, 2)}\n\nModification request: "${message}"\n\nOutput the complete modified model as JSON.`;
      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const modified = JSON.parse(text) as StructuralModel;
      const normalized = normalizeModel(modified);
      return {
        success: true,
        response: `✅ Model modified successfully. Now has ${normalized.nodes.length} nodes and ${normalized.members.length} members.`,
        model: normalized,
        actions: [{ type: 'applyModel', params: { model: normalized }, description: 'Apply modified model' } satisfies AIAction],
        metadata: { intent: 'modify_model', confidence: 0.85, processingTimeMs: 0, provider: 'gemini' },
      };
    } catch (err) {
      logger.warn({ err }, '[AIArchitectEngine] Gemini modify failed');
    }
  }

  return {
    success: true,
    response: 'I understand you want to modify the model. Could you be more specific? For example:\n- "Add a bay of 6m to the right"\n- "Add a floor of 3.5m height"\n- "Move node n3 to x=8, y=4"',
  };
}
