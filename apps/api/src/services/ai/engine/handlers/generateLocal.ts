import type { AIAction, AIResponse, StructuralMember, StructuralModel, StructuralNode } from '../types.js';
import { validateModel } from '../modelUtils.js';

export function generateLocally(prompt: string): AIResponse {
  const lp = prompt.toLowerCase();

  const spanMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*span/i) || lp.match(/span\s*(?:of\s*)?([\d.]+)\s*m/i);
  const heightMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*(?:height|tall|high)/i) || lp.match(/height\s*(?:of\s*)?([\d.]+)\s*m/i);
  const storyMatch = lp.match(/(\d+)\s*(?:stor(?:y|ey|ies)|floor)/i);
  const bayMatch = lp.match(/(\d+)\s*bay/i);

  const span = spanMatch ? parseFloat(spanMatch[1]) : 6;
  const height = heightMatch ? parseFloat(heightMatch[1]) : 3;
  const stories = storyMatch ? parseInt(storyMatch[1], 10) : 1;
  const bays = bayMatch ? parseInt(bayMatch[1], 10) : 1;

  const nodes: StructuralNode[] = [];
  const members: StructuralMember[] = [];
  let nodeId = 1;
  let memberId = 1;

  for (let s = 0; s <= stories; s++) {
    for (let b = 0; b <= bays; b++) {
      nodes.push({ id: `n${nodeId}`, x: b * span, y: s * height, z: 0, isSupport: s === 0 });
      if (s > 0) {
        members.push({ id: `m${memberId++}`, s: `n${nodeId - (bays + 1)}`, e: `n${nodeId}`, section: 'ISMB300' });
      }
      if (b > 0) {
        members.push({ id: `m${memberId++}`, s: `n${nodeId - 1}`, e: `n${nodeId}`, section: 'ISMB300' });
      }
      nodeId++;
    }
  }

  const model: StructuralModel = { nodes, members, loads: [], materials: [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }] };
  const validation = validateModel(model);
  const responseLines = [`✅ Generated a ${stories + 1}-storey, ${bays}-bay frame with span ${span}m and storey height ${height}m.`];
  if (!validation.valid) responseLines.push(`⚠️ Validation issues: ${validation.errors} errors, ${validation.warnings} warnings.`);

  return {
    success: true,
    response: responseLines.join('\n'),
    model,
    validation,
    actions: [{ type: 'applyModel', params: { model }, description: 'Apply generated model' } satisfies AIAction],
  };
}
