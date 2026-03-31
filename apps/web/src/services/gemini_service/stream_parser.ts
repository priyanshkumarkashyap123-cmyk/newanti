import type { AIAction, AIPlan, AITask, AIModelContext } from './types.ts';

export function parseAIPlan(aiResponse: string): AIPlan | null {
  const start = aiResponse.indexOf('{');
  const end = aiResponse.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(aiResponse.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object') return null;

    const data = parsed as {
      goal?: unknown;
      reasoning?: unknown;
      steps?: unknown;
      confidence?: unknown;
      alternatives?: unknown;
    };

    const steps = Array.isArray(data.steps)
      ? data.steps.filter((step): step is AIAction => Boolean(step) && typeof step === 'object')
      : [];

    return {
      goal: String(data.goal || ''),
      reasoning: String(data.reasoning || ''),
      steps,
      confidence: typeof data.confidence === 'number' ? data.confidence : 0,
      alternatives: Array.isArray(data.alternatives) ? data.alternatives.map(String) : undefined,
    };
  } catch {
    return null;
  }
}

export function formatPlanResponse(plan: AIPlan): string {
  const stepsText = plan.steps.map((step: AIAction, index: number) => `${index + 1}. ${step.description}`).join('\n');
  return `**Goal:** ${plan.goal}\n\n**Reasoning:** ${plan.reasoning}\n\n**Steps:**\n${stepsText}\n\n**Confidence:** ${(plan.confidence * 100).toFixed(0)}%`;
}

export function extractTaskPayload(response: string): { plan?: AIPlan; task?: Partial<AITask> } {
  const plan = parseAIPlan(response);
  return plan ? { plan, task: { id: '', type: 'design', description: plan.goal, status: 'complete', progress: 100, result: formatPlanResponse(plan), actions: plan.steps } } : {};
}

export function parseStreamingText(chunks: string[]): string {
  return chunks.join('');
}

export function normalizeRawOutput(output: string): string {
  return output.trim();
}

export function buildStreamingTaskUpdate(existing: Partial<AITask>, chunk: string, context?: AIModelContext): Partial<AITask> {
  return {
    ...existing,
    result: `${existing.result || ''}${chunk}`.trim(),
    description: existing.description || context?.analysisResults ? 'Processing AI response' : 'Processing AI response',
  };
}
