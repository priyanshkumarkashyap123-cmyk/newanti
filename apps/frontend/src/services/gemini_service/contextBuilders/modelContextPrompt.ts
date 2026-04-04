import type { AIConversation, AIModelContext } from '../types';

export const buildEnrichedModelContext = (modelContext: AIModelContext): string => {
  let context = '';

  if (modelContext.nodes.length > 0) {
    const xCoords = modelContext.nodes.map((n) => n.x);
    const yCoords = modelContext.nodes.map((n) => n.y);
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    context += 'CURRENT MODEL GEOMETRY:\n';
    context += `- Bounding box: X[${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y[${minY.toFixed(1)}, ${maxY.toFixed(1)}]\n`;
    context += `- ${modelContext.nodes.length} nodes, ${modelContext.nodes.filter((n) => n.hasSupport).length} supported\n`;
    context += `- ${modelContext.members.length} members\n`;
  }

  if (modelContext.loads.length > 0) {
    const totalVertical = modelContext.loads.reduce((sum: number, l) => sum + (l.fy || 0), 0);
    const totalHorizontal = modelContext.loads.reduce((sum: number, l) => sum + (l.fx || 0), 0);

    context += 'LOAD SUMMARY:\n';
    context += `- Total vertical: ${totalVertical.toFixed(1)} kN\n`;
    context += `- Total horizontal: ${totalHorizontal.toFixed(1)} kN\n`;
    context += `- Applied to ${modelContext.loads.length} locations\n`;
  }

  if (modelContext.analysisResults) {
    context += 'ANALYSIS RESULTS:\n';
    context += `- Max displacement: ${modelContext.analysisResults.maxDisplacement.toFixed(3)} mm\n`;
    context += `- Max stress: ${modelContext.analysisResults.maxStress.toFixed(1)} MPa\n`;
    context += `- Max moment: ${modelContext.analysisResults.maxMoment.toFixed(1)} kN·m\n`;
  }

  return context;
};

export const buildConversationPrompt = (
  query: string,
  modelContext: AIModelContext,
  conversationHistory: AIConversation[],
  reasoningContext: string[],
  taskMemoryKeys: string[],
): string => {
  const recentConversation = conversationHistory
    .slice(-6)
    .map((c) => `${c.role === 'user' ? 'User' : 'Gemini'}: ${c.content.substring(0, 150)}`)
    .join('\n');

  const enrichedContext = buildEnrichedModelContext(modelContext);

  return `CONVERSATION HISTORY:\n${recentConversation || 'Starting new conversation'}\n\nENRICHED MODEL CONTEXT:\n${enrichedContext || 'No model loaded'}\n\nSYSTEM REASONING:\n- Previous response style: ${reasoningContext.slice(-1)[0] || 'Initial conversation'}\n- Task memory: ${taskMemoryKeys.join(', ') || 'None'}\n\nUSER REQUEST:\n${query}\n\nINSTRUCTIONS:\n1. Use the context above to provide informed responses\n2. Reference previous discussions when relevant\n3. Consider the model state and recent tasks\n4. Build on previous understanding\n5. Provide specific, actionable guidance`;
};
