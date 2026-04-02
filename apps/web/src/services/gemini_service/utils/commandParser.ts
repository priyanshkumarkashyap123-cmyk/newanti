export type StructuralCommand = {
  action: string;
  target: string;
  parameters: Record<string, any>;
};

const ADD_RULES = [
  { keywords: ['node', 'point'], target: 'node' },
  { keywords: ['member', 'beam', 'column'], target: 'member' },
  { keywords: ['load', 'force'], target: 'load' },
] as const;

const REMOVE_RULES = [
  { keywords: ['node'], target: 'node' },
  { keywords: ['member'], target: 'member' },
  { keywords: ['load'], target: 'load' },
] as const;

export function parseStructuralCommandFromTranscript(transcript: string): StructuralCommand | null {
  const lower = transcript.toLowerCase();

  if (lower.includes('add') || lower.includes('create')) {
    for (const rule of ADD_RULES) {
      if (rule.keywords.some(keyword => lower.includes(keyword))) {
        return { action: 'add', target: rule.target, parameters: {} };
      }
    }
  }

  if (lower.includes('remove') || lower.includes('delete')) {
    for (const rule of REMOVE_RULES) {
      if (rule.keywords.some(keyword => lower.includes(keyword))) {
        return { action: 'remove', target: rule.target, parameters: {} };
      }
    }
  }

  if (lower.includes('analyze') || lower.includes('run analysis')) {
    return { action: 'analyze', target: 'model', parameters: {} };
  }

  return null;
}
