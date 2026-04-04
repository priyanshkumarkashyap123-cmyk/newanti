import { SYSTEM_PROMPTS } from '../prompts.js';
import { enforceGenerationSafety, normalizeModel } from '../modelUtils.js';
import type { GenerativeModel } from '@google/generative-ai';
import type { AIResponse, JsonRecord, StructuralModel } from '../types.js';
import { logger } from '../../../../utils/logger.js';

export async function generateStructure(
  model: GenerativeModel | null,
  prompt: string,
  constraints?: JsonRecord
): Promise<AIResponse> {
  const startTime = Date.now();

  try {
    if (model) {
      const result = enforceGenerationSafety(await generateViaGemini(model, prompt, constraints));
      if (result.success || (result.validation?.errors ?? 0) > 0) {
        result.metadata = {
          intent: 'create_structure',
          confidence: 0.9,
          processingTimeMs: Date.now() - startTime,
          provider: 'gemini',
        };
        return result;
      }
    }

    const localResult = enforceGenerationSafety(generateLocally(prompt));
    localResult.metadata = {
      intent: 'create_structure',
      confidence: 0.7,
      processingTimeMs: Date.now() - startTime,
      provider: 'local',
    };
    return localResult;

  } catch (error) {
    logger.error({ err: error }, '[AIArchitectEngine] Generate error');

    const fallback = enforceGenerationSafety(generateLocally(prompt));
    fallback.metadata = {
      intent: 'create_structure',
      confidence: 0.5,
      processingTimeMs: Date.now() - startTime,
      provider: 'local',
    };
    return fallback;
  }
}

async function generateViaGemini(model: GenerativeModel, prompt: string, constraints?: JsonRecord): Promise<AIResponse> {
  const constraintText = constraints ? `\n\nConstraints: ${JSON.stringify(constraints)}` : '';
  const fullPrompt = `${SYSTEM_PROMPTS.generate}\n\nUser request: ${prompt}${constraintText}`;

  const result = await model.generateContent(fullPrompt);
  const text = result.response.text();
  const cleanedText = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  const modelJson = JSON.parse(cleanedText) as StructuralModel;
  const normalized = normalizeModel(modelJson);
  const validation = enforceGenerationSafety({ success: true, response: '', model: normalized }).validation;

  if (!validation?.valid) {
    return {
      success: false,
      response: `❌ Generated model is unsafe and failed validation with ${validation?.errors ?? 0} critical issue(s).`,
      model: normalized,
      validation,
    };
  }

  return {
    success: true,
    response: `✅ Generated a ${normalized.nodes.length}-node, ${normalized.members.length}-member structure based on your description.${
      validation?.warnings && validation.warnings > 0
        ? `\n\n⚠️ Validation warnings:\n${validation.issues.filter(i => i.severity === 'warning').map(i => `- ${i.message}`).join('\n')}`
        : ''
    }`,
    model: normalized,
    validation,
    actions: [{ type: 'applyModel', params: { model: normalized }, description: 'Apply generated model' }],
  };
}

function generateLocally(prompt: string): AIResponse {
  const lp = prompt.toLowerCase();

  const spanMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*span/i) || lp.match(/span\s*(?:of\s*)?([\d.]+)\s*m/i);
  const heightMatch = lp.match(/([\d.]+)\s*(?:m(?:eter)?|metre)\s*(?:height|tall|high)/i) || lp.match(/height\s*(?:of\s*)?([\d.]+)\s*m/i);
  const bayMatch = lp.match(/(\d+)\s*bay/i);

  const span = spanMatch ? parseFloat(spanMatch[1]) : 6;
  const height = heightMatch ? parseFloat(heightMatch[1]) : 4;
  const bays = bayMatch ? parseInt(bayMatch[1]) : 1;

  if (/portal|warehouse|shed|industrial/i.test(lp)) {
    const nodes: StructuralModel['nodes'] = [];
    const members: StructuralModel['members'] = [];

    let nodeId = 1;
    for (let b = 0; b <= bays; b++) {
      const x = b * span;
      nodes.push({ id: `n${nodeId++}`, x, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } });
      nodes.push({ id: `n${nodeId++}`, x, y: height, z: 0 });
    }

    let memberId = 1;
    for (let b = 0; b < bays; b++) {
      const colA = b * 2 + 1;
      const colB = colA + 2;
      members.push({ id: `m${memberId++}`, s: `n${colA}`, e: `n${colA + 1}`, section: 'ISMB300' });
      members.push({ id: `m${memberId++}`, s: `n${colB}`, e: `n${colB + 1}`, section: 'ISMB300' });
      members.push({ id: `m${memberId++}`, s: `n${colA + 1}`, e: `n${colB + 1}`, section: 'ISMB400' });
    }

    const model: StructuralModel = { nodes, members, loads: [] };
    return { success: true, response: 'Local portal frame generated', model };
  }

  if (/truss/i.test(lp)) {
    const nodes: StructuralModel['nodes'] = [];
    const members: StructuralModel['members'] = [];
    const panel = span / bays;
    let nodeId = 1;

    for (let b = 0; b <= bays; b++) {
      const x = b * panel;
      nodes.push({ id: `n${nodeId++}`, x, y: 0, z: 0, isSupport: b === 0 || b === bays, restraints: b === 0 || b === bays ? { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } : undefined });
      if (b < bays) nodes.push({ id: `n${nodeId++}`, x: x + panel / 2, y: height / 2, z: 0 });
    }

    let memberId = 1;
    for (let b = 0; b < bays; b++) {
      const left = b * 2 + 1;
      const right = left + 2;
      const top = left + 1;
      members.push({ id: `m${memberId++}`, s: `n${left}`, e: `n${right}`, section: 'ISA75x75x6' });
      members.push({ id: `m${memberId++}`, s: `n${left}`, e: `n${top}`, section: 'ISA65x65x6' });
      members.push({ id: `m${memberId++}`, s: `n${top}`, e: `n${right}`, section: 'ISA65x65x6' });
    }

    const model: StructuralModel = { nodes, members, loads: [] };
    return { success: true, response: 'Local truss generated', model };
  }

  const nodes: StructuralModel['nodes'] = [
    { id: 'n1', x: 0, y: 0, z: 0, isSupport: true, restraints: { fx: true, fy: true, fz: true, mx: true, my: true, mz: true } },
    { id: 'n2', x: span, y: 0, z: 0, isSupport: true, restraints: { fx: false, fy: true, fz: true } },
  ];
  const members: StructuralModel['members'] = [
    { id: 'm1', s: 'n1', e: 'n2', section: 'ISMB300' },
  ];
  const loads: StructuralModel['loads'] = [
    { type: 'point', nodeId: 'n2', fy: -50 },
  ];

  const model: StructuralModel = { nodes, members, loads };
  return {
    success: true,
    response: 'Local simple beam generated',
    model,
    actions: [{ type: 'applyModel', params: { model }, description: 'Apply generated model' }],
  };
}