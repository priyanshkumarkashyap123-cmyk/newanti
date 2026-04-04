import { diagnoseModel } from './diagnostics.js';
import type { AIAction, AIResponse, ModelContext } from '../types.js';

export async function handleTroubleshoot(message: string, context: ModelContext | undefined): Promise<AIResponse> {
  if (!context || context.nodes.length === 0) {
    return { success: true, response: 'No model loaded to troubleshoot.' };
  }

  const diagnosis = await diagnoseModel(context, null);

  if (diagnosis.issues.length === 0) {
    return { success: true, response: '✅ No issues found! The model looks healthy.' };
  }

  const actions: AIAction[] = [];
  for (const issue of diagnosis.issues) {
    if (issue.category === 'support' && issue.severity === 'error') {
      const groundNodesWithoutSupport = context.nodes.filter(n => Math.abs(n.y) < 0.1 && !n.hasSupport);
      for (const n of groundNodesWithoutSupport) {
        actions.push({
          type: 'addSupport' as const,
          params: { nodeId: n.id, type: 'fixed', restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
          description: `Add fixed support at node ${n.id}`,
        });
      }
    }
  }

  let response = `## 🔧 Troubleshoot Results\n\n`;
  response += `Found **${diagnosis.issues.length}** issue(s):\n\n`;
  for (const issue of diagnosis.issues) {
    const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
    response += `${icon} ${issue.message}\n`;
  }

  if (actions.length > 0) {
    response += `\n✨ **Auto-fix available**: ${actions.length} action(s) ready. Click **Execute** to apply.`;
  }

  return { success: true, response, actions: actions.length > 0 ? actions : undefined };
}
