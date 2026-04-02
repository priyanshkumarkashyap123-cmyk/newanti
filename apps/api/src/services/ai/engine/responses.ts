import type { Intent } from './intents.js';
import type { SectionContent, SectionKey } from './sections.js';

export interface AIResponse {
  intent: Intent;
  sections: SectionContent;
  order: SectionKey[];
  rawText?: string;
  model?: string;
}

export function formatResponse(res: AIResponse): string {
  const { order, sections } = res;
  return order
    .map((key) => {
      const body = sections[key];
      if (!body || !body.trim()) return '';
      const title = key.replace(/_/g, ' ');
      const header = title.charAt(0).toUpperCase() + title.slice(1);
      return `## ${header}\n${body.trim()}`;
    })
    .filter(Boolean)
    .join('\n\n');
}