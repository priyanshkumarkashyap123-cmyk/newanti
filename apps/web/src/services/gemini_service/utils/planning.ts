// Exported via knowledgeBase; keep one authoritative export there to avoid conflicts
export const DEFAULT_OCCUPANCY = 'office';

export const PLANNING_DEFAULTS = {
  span: 12,
  height: 6,
  bays: 3,
  stories: 3,
  tributaryWidth: 6,
  trussSpacing: 6,
  minTrussPanels: 6,
  maxStoryHeight: 4.0,
} as const;

export const WARREN_SECTION_DEFAULTS = {
  purlinSection: 'ISMC 125',
  bracingSection: 'ISA 50x50x6',
} as const;

export const WARREN_PLANNING_HEURISTICS = {
  panelDivisor: 2,
  depthSpanRatio: 8,
  singleTrussCount: 1,
  minMultiTrusses: 3,
  defaultConfidence: 0.9,
} as const;

export const OPTIMIZATION_PLANNING_DEFAULTS = {
  reasoning: 'Optimization plan.',
  actionDescription: 'Optimize structure',
  confidence: 0.85,
} as const;

export const WARREN_TEXT_DEFAULTS = {
  goalPrefix: 'Create a REAL 3D Warren Truss Roof',
  reasoning: 'Warren truss roof system.',
  bottomNodeLabel: 'Bottom node',
  topChordNodeLabel: 'Top chord node',
  supportSuffix: ' (Support)',
  nodeIdPrefix: 'N',
  bottomNodeKeyPrefix: 'bottom',
  topNodeKeyPrefix: 'top',
} as const;

const SPAN_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*m?\s*(span|wide|width|long|length|meter)/i,
  /(span|width|length)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*m?/i,
] as const;

const HEIGHT_PATTERNS = [
  /(\d+(?:\.\d+)?)\s*m?\s*(height|tall|high|deep|depth)/i,
  /(\d+)\s*(story|storey|floor|level)/i,
] as const;

const BAY_PATTERN = /(\d+)\s*bay/i;
const STORY_PATTERN = /(\d+)\s*(story|storey|floor|level)/i;
const LOAD_PATTERN = /(\d+(?:\.\d+)?)\s*(kn|kilo|load)/i;

const OCCUPANCY_KEYWORD_RULES: Array<{ keywords: string[]; occupancy: string }> = [
  { keywords: ['warehouse', 'storage'], occupancy: 'warehouse_light' },
  { keywords: ['industrial', 'factory'], occupancy: 'industrial_light' },
  { keywords: ['residential', 'house', 'apartment'], occupancy: 'residential' },
  { keywords: ['hospital', 'medical'], occupancy: 'hospital' },
  { keywords: ['school', 'college'], occupancy: 'school' },
  { keywords: ['retail', 'shop', 'mall'], occupancy: 'retail' },
  { keywords: ['assembly', 'auditorium', 'hall'], occupancy: 'assembly' },
  { keywords: ['library'], occupancy: 'library' },
  { keywords: ['parking', 'garage'], occupancy: 'parking' },
];

export function inferOccupancyFromDescription(descriptionLower: string): string {
  for (const rule of OCCUPANCY_KEYWORD_RULES) {
    if (rule.keywords.some(keyword => descriptionLower.includes(keyword))) {
      return rule.occupancy;
    }
  }
  return DEFAULT_OCCUPANCY;
}

export function parsePlanningInputs(descriptionLower: string): {
  span: number;
  height: number;
  bays: number;
  stories: number;
  specifiedLoad: number | null;
} {
  const spanMatch = descriptionLower.match(SPAN_PATTERNS[0]) || descriptionLower.match(SPAN_PATTERNS[1]);
  const heightMatch = descriptionLower.match(HEIGHT_PATTERNS[0]) || descriptionLower.match(HEIGHT_PATTERNS[1]);
  const bayMatch = descriptionLower.match(BAY_PATTERN);
  const storyMatch = descriptionLower.match(STORY_PATTERN);
  const loadMatch = descriptionLower.match(LOAD_PATTERN);

  return {
    span: spanMatch ? parseFloat(spanMatch[1]) : PLANNING_DEFAULTS.span,
    height: heightMatch ? parseFloat(heightMatch[1]) : PLANNING_DEFAULTS.height,
    bays: bayMatch ? parseInt(bayMatch[1]) : PLANNING_DEFAULTS.bays,
    stories: storyMatch ? parseInt(storyMatch[1]) : PLANNING_DEFAULTS.stories,
    specifiedLoad: loadMatch ? parseFloat(loadMatch[1]) : null,
  };
}

export function computeWarrenPanelCount(span: number): number {
  const estimatedPanels = Math.round(span / WARREN_PLANNING_HEURISTICS.panelDivisor);
  const evenPanels = estimatedPanels % 2 === 0 ? estimatedPanels : estimatedPanels + 1;
  return Math.max(PLANNING_DEFAULTS.minTrussPanels, evenPanels);
}

export function computeWarrenTrussDepth(span: number): number {
  return span / WARREN_PLANNING_HEURISTICS.depthSpanRatio;
}

export function computeWarrenTrussCount(isSingle: boolean, bays: number): number {
  return isSingle
    ? WARREN_PLANNING_HEURISTICS.singleTrussCount
    : Math.max(WARREN_PLANNING_HEURISTICS.minMultiTrusses, bays);
}

export function buildWarrenGoal(span: number, buildingLength: number, numTrusses: number): string {
  return `${WARREN_TEXT_DEFAULTS.goalPrefix}: ${span}m x ${buildingLength}m (${numTrusses} trusses)`;
}

export function getWarrenSupportType(
  index: number,
  panelCount: number,
): 'pinned' | 'roller' | undefined {
  if (index === 0) {
    return 'pinned';
  }
  if (index === panelCount) {
    return 'roller';
  }
  return undefined;
}

export function buildWarrenBottomNodeDescription(
  trussNumber: number,
  nodeIndex: number,
  isSupport: boolean,
): string {
  return `Truss ${trussNumber}: ${WARREN_TEXT_DEFAULTS.bottomNodeLabel} ${nodeIndex}${
    isSupport ? WARREN_TEXT_DEFAULTS.supportSuffix : ''
  }`;
}

export function buildWarrenTopNodeDescription(trussNumber: number, nodeIndex: number): string {
  return `Truss ${trussNumber}: ${WARREN_TEXT_DEFAULTS.topChordNodeLabel} ${nodeIndex}`;
}

export function buildWarrenBottomNodeKey(trussIndex: number, nodeIndex: number): string {
  return `${WARREN_TEXT_DEFAULTS.bottomNodeKeyPrefix}-${trussIndex}-${nodeIndex}`;
}

export function buildWarrenTopNodeKey(trussIndex: number, nodeIndex: number): string {
  return `${WARREN_TEXT_DEFAULTS.topNodeKeyPrefix}-${trussIndex}-${nodeIndex}`;
}

export function buildWarrenNodeId(nodeNumber: number): string {
  return `${WARREN_TEXT_DEFAULTS.nodeIdPrefix}${nodeNumber}`;
}
