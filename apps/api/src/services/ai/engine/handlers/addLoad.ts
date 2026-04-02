import type { GenerativeModel } from '@google/generative-ai';
import type { AIAction, AIResponse, ModelContext } from '../types.js';
import { logger } from '../../../../utils/logger.js';

export async function handleAddLoad(message: string, context: ModelContext | undefined, model: GenerativeModel | null): Promise<AIResponse> {
  if (!context || context.nodes.length === 0) {
    return { success: false, response: 'No model loaded. Create a structure first before adding loads.' };
  }

  const forceMatch = message.match(/([\d.]+)\s*(kn|kN|KN)/i);
  const directionMatch = message.match(/\b(down|up|left|right|horizontal|vertical|x|y|z)\b/i);

  if (forceMatch) {
    const magnitude = parseFloat(forceMatch[1]);
    const direction = directionMatch ? directionMatch[1].toLowerCase() : 'down';

    let fy = 0, fx = 0;
    switch (direction) {
      case 'down': case 'vertical': case 'y': fy = -magnitude; break;
      case 'up': fy = magnitude; break;
      case 'right': case 'horizontal': case 'x': fx = magnitude; break;
      case 'left': fx = -magnitude; break;
      default: fy = -magnitude;
    }

    const targetNodes = context.nodes.filter(n => !n.hasSupport);
    if (targetNodes.length === 0) {
      return { success: false, response: 'All nodes are supports. Add non-support nodes to apply loads to.' };
    }

    const actions: AIAction[] = targetNodes.map(n => ({
      type: 'addLoad' as const,
      params: { nodeId: n.id, fx, fy },
      description: `Add ${magnitude} kN ${direction} load at node ${n.id}`,
    }));

    return {
      success: true,
      response: `✅ Adding ${magnitude} kN ${direction}ward load to ${targetNodes.length} node(s): ${targetNodes.map(n => n.id).join(', ')}.\n\nClick **Execute** to apply.`,
      actions,
    };
  }

  if (model) {
    try {
      const prompt = `The user wants to add loads to a structural model. Parse their request and generate load actions.

User request: "${message}"

Available nodes: ${JSON.stringify(context.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, support: n.hasSupport })))}

Output JSON array of load actions: [{"nodeId": "n1", "fx": 0, "fy": -50, "fz": 0}]`;

      const result = await model.generateContent(prompt);
      const text = result.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const loads = JSON.parse(text);

      const actions: AIAction[] = (Array.isArray(loads) ? loads : [loads]).map((l: { nodeId?: string; fx?: number; fy?: number; fz?: number }) => ({
        type: 'addLoad' as const,
        params: { nodeId: l.nodeId, fx: l.fx || 0, fy: l.fy || 0, fz: l.fz || 0 },
        description: `Add load at ${l.nodeId}: Fx=${l.fx || 0}, Fy=${l.fy || 0} kN`,
      }));

      return {
        success: true,
        response: `✅ Parsed your load request. ${actions.length} load(s) ready to apply.\n\nClick **Execute** to apply.`,
        actions,
      };
    } catch (err) {
      logger.warn({ err }, '[AIArchitectEngine] Gemini load parse failed');
    }
  }

  return {
    success: true,
    response: 'Please specify the load more clearly. Examples:\n- "Add 50 kN downward load"\n- "Apply 10 kN/m UDL on all beams"\n- "Add 25 kN horizontal wind load"',
  };
}
