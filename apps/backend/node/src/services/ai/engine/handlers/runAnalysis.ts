import type { AIAction, AIResponse, ModelContext } from '../types.js';

export function handleRunAnalysis(context: ModelContext | undefined): AIResponse {
  if (!context || context.nodes.length === 0) {
    return { success: false, response: 'No model to analyze. Create a structure first.' };
  }

  if (context.nodes.filter(n => n.hasSupport).length === 0) {
    return { success: false, response: '⚠️ No supports defined! The analysis will fail. Add supports first (say "add fixed supports").' };
  }

  return {
    success: true,
    response: `Ready to analyze: ${context.nodes.length} nodes, ${context.members.length} members, ${context.loads?.length || 0} loads.\n\nClick **Execute** to run linear static analysis.`,
    actions: [{ type: 'runAnalysis' as const, params: { type: 'linear_static' }, description: 'Run linear static analysis' } satisfies AIAction],
  };
}
