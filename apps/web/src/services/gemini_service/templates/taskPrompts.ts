import type { AIModelContext } from '../types';

export function buildTaskDecompositionPrompt(query: string, context: AIModelContext): string {
  return `Analyze this user request and break it into 2-4 clear subtasks:\n      \nUser Request: "${query}"\n\nModel Context:\n- Nodes: ${context.nodes.length}\n- Members: ${context.members.length}\n- Loads: ${context.loads.length}\n\nReturn ONLY a JSON array of subtasks:\n[\\"subtask1\\", \\"subtask2\\", \\"subtask3\\"]\n\nBe specific and actionable.`;
}

export function buildReasoningPrompt(problem: string, enrichedContext: string): string {
  return `Solve this structural engineering problem step-by-step:\n\nPROBLEM:\n${problem}\n\nMODEL STATE:\n${enrichedContext}\n\nReasoning Process:\n1. Identify what we know\n2. Identify what we need to find\n3. Choose appropriate formulas/codes\n4. Work through calculations\n5. Verify against industry standards\n6. Present clear conclusion\n\nProvide detailed reasoning with formulas shown.`;
}
