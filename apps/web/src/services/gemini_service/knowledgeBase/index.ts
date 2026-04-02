/**
 * Knowledge Base Index - Consolidated design standards
 * Exports all available design code standards
 */

import { IS456_KNOWLEDGE } from './IS456.js';
import { IS800_KNOWLEDGE } from './IS800.js';

export { IS456_KNOWLEDGE, IS800_KNOWLEDGE };
export * from './structuralCatalog';
export * from './loadCalculationCatalog';

// Placeholder exports for other standards (to be implemented)
// These can reference existing implementations or be added gradually
export const IS1893_KNOWLEDGE = `
## IS 1893:2016 (Seismic Code - Placeholder)
[To be extracted from prompt_builder.ts]
`;

export const IS875_KNOWLEDGE = `
## IS 875:2015 (Load Code - Placeholder)
[To be extracted from prompt_builder.ts]
`;

export const ACI318_KNOWLEDGE = `
## ACI 318 (American Concrete - Placeholder)
[To be extracted from prompt_builder.ts]
`;

export const AISC360_KNOWLEDGE = `
## AISC 360 (American Steel - Placeholder)
[To be extracted from prompt_builder.ts]
`;

export const EUROCODE2_KNOWLEDGE = `
## Eurocode 2 (European Concrete - Placeholder)
[To be extracted from prompt_builder.ts]
`;

export const EUROCODE3_KNOWLEDGE = `
## Eurocode 3 (European Steel - Placeholder)
[To be extracted from prompt_builder.ts]
`;

export const NDS2018_KNOWLEDGE = `
## NDS 2018 (American Timber - Placeholder)
[To be extracted from prompt_builder.ts]
`;

/**
 * Get all available standards
 */
export function getAllKnowledgeBases() {
  return {
    IS456: IS456_KNOWLEDGE,
    IS800: IS800_KNOWLEDGE,
    IS1893: IS1893_KNOWLEDGE,
    IS875: IS875_KNOWLEDGE,
    ACI318: ACI318_KNOWLEDGE,
    AISC360: AISC360_KNOWLEDGE,
    Eurocode2: EUROCODE2_KNOWLEDGE,
    Eurocode3: EUROCODE3_KNOWLEDGE,
    NDS2018: NDS2018_KNOWLEDGE,
  };
}

/**
 * Get knowledge base for a specific standard
 */
export function getKnowledgeBaseByStandard(standard: string): string | undefined {
  const bases = getAllKnowledgeBases();
  return bases[standard as keyof typeof bases];
}
