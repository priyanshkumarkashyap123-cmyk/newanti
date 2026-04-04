import type { AIModelContext } from '../types';

export type ConfidenceScore = {
  overall: number;
  codeCompliance: number;
  engineeringLogic: number;
  calculationAccuracy: number;
  contextRelevance: number;
};

export const calculateConfidenceScore = (
  _query: string,
  response: string,
  context: AIModelContext,
): ConfidenceScore => {
  let codeCompliance = 40;
  let engineeringLogic = 40;
  let calculationAccuracy = 40;
  let contextRelevance = 40;

  if (/IS\s*800/i.test(response)) codeCompliance += 20;
  if (/IS\s*456/i.test(response)) codeCompliance += 15;
  if (/IS\s*1893/i.test(response)) codeCompliance += 15;
  if (/IS\s*875/i.test(response)) codeCompliance += 10;
  if (/AISC|Eurocode|EN\s*\d+/i.test(response)) codeCompliance += 10;
  if (/clause|section|table/i.test(response)) codeCompliance += 10;

  if (/[M|V|P|σ|τ]\s*[=<>]/.test(response)) engineeringLogic += 15;
  if (/(kN|MPa|mm|N\/mm²|kNm)/.test(response)) engineeringLogic += 10;
  if (/(γ|factor of safety|FOS|capacity|demand)/i.test(response)) engineeringLogic += 10;
  if (/(ultimate|serviceability|SLS|ULS)/i.test(response)) engineeringLogic += 10;
  if (/(step|first|then|therefore|because)/i.test(response)) engineeringLogic += 15;

  if (/\d+\s*[×*/+-]\s*\d+/.test(response)) calculationAccuracy += 15;
  if (/=\s*\d+/.test(response)) calculationAccuracy += 10;
  if (/(ratio|limit|check)/i.test(response)) calculationAccuracy += 10;
  if (/(OK|PASS|SAFE|adequate)/i.test(response)) calculationAccuracy += 15;

  if (context.nodes.length > 0 && /current|your|this.*model/i.test(response)) contextRelevance += 20;
  if (context.analysisResults && /(result|stress|deflection|moment)/i.test(response)) contextRelevance += 15;
  if (/\d+\s*nodes?|\d+\s*members?/i.test(response)) contextRelevance += 15;

  codeCompliance = Math.min(codeCompliance, 100);
  engineeringLogic = Math.min(engineeringLogic, 100);
  calculationAccuracy = Math.min(calculationAccuracy, 100);
  contextRelevance = Math.min(contextRelevance, 100);

  const overall = Math.round(
    codeCompliance * 0.3 +
    engineeringLogic * 0.3 +
    calculationAccuracy * 0.25 +
    contextRelevance * 0.15,
  );

  return {
    overall,
    codeCompliance,
    engineeringLogic,
    calculationAccuracy,
    contextRelevance,
  };
};
