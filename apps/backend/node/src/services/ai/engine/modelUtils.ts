import { IS_SECTIONS } from './sectionsDb.js';
import type {
  AIResponse,
  ModelValidation,
  ModelValidationIssue,
  StructuralModel,
} from './types.js';

export function normalizeModel(model: StructuralModel): StructuralModel {
  return {
    nodes: (model.nodes || []).map(node => ({
      id: node.id,
      x: Number(node.x) || 0,
      y: Number(node.y) || 0,
      z: Number(node.z) || 0,
      isSupport: node.isSupport || Math.abs(Number(node.y)) < 0.01,
      restraints: node.restraints || (
        node.isSupport || Math.abs(Number(node.y)) < 0.01
          ? { fx: true, fy: true, fz: true, mx: true, my: true, mz: true }
          : undefined
      ),
    })),
    members: (model.members || []).map(member => ({
      id: member.id,
      s: member.s,
      e: member.e,
      section: (member.section || 'ISMB300').toUpperCase(),
      material: member.material || 'Fe410',
    })),
    loads: model.loads || [],
    materials: model.materials || [{ id: 'mat1', name: 'Fe410', E: 200000, density: 78.5, fy: 250 }],
    sections: model.sections,
  };
}

export function validateModel(model: StructuralModel): ModelValidation {
  const issues: ModelValidationIssue[] = [];
  const checks: ModelValidation['checks'] = {
    nodesExist: false,
    membersExist: false,
    uniqueNodeIds: false,
    uniqueMemberIds: false,
    validMemberReferences: false,
    validNodePairs: false,
    zeroLengthMembers: false,
    supportsExist: false,
    knownSections: false,
    spanSectionSanity: false,
  };

  if (Array.isArray(model.nodes) && model.nodes.length > 0) {
    checks.nodesExist = true;
  } else {
    issues.push({ severity: 'error', type: 'structure', message: 'Missing or empty nodes array', fixable: false });
  }

  if (Array.isArray(model.members) && model.members.length > 0) {
    checks.membersExist = true;
  } else {
    issues.push({ severity: 'error', type: 'structure', message: 'Missing or empty members array', fixable: false });
  }

  if (!checks.nodesExist || !checks.membersExist) {
    const errors = issues.filter(i => i.severity === 'error').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    return { valid: false, totalIssues: issues.length, errors, warnings, issues, checks };
  }

  const nodeIds = model.nodes.map(n => n.id);
  const uniqueNodeIds = new Set(nodeIds);
  if (uniqueNodeIds.size === nodeIds.length) {
    checks.uniqueNodeIds = true;
  } else {
    issues.push({ severity: 'error', type: 'structure', message: 'Duplicate node IDs found', fixable: true });
  }

  const memberIds = model.members.map(m => m.id);
  const uniqueMemberIds = new Set(memberIds);
  if (uniqueMemberIds.size === memberIds.length) {
    checks.uniqueMemberIds = true;
  } else {
    issues.push({ severity: 'error', type: 'structure', message: 'Duplicate member IDs found', fixable: true });
  }

  const existingNodes = new Set(model.nodes.map(n => n.id));
  const invalidRefs: string[] = [];
  const sameNodeMembers: string[] = [];
  const zeroLengthMembers: string[] = [];
  const unknownSections: string[] = [];
  const spanSectionWarnings: string[] = [];

  for (const member of model.members) {
    if (!existingNodes.has(member.s)) invalidRefs.push(`${member.id}: start node ${member.s}`);
    if (!existingNodes.has(member.e)) invalidRefs.push(`${member.id}: end node ${member.e}`);
    if (member.s === member.e) sameNodeMembers.push(member.id);

    const startNode = model.nodes.find(n => n.id === member.s);
    const endNode = model.nodes.find(n => n.id === member.e);

    if (startNode && endNode) {
      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const dz = endNode.z - startNode.z;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length < 0.001) zeroLengthMembers.push(member.id);

      const isBeamLike = Math.abs(dy) <= 0.6 * (length || 1);
      const secDepthM = estimateSectionDepthMeters(member.section || '');
      if (isBeamLike && secDepthM) {
        const ratio = length / secDepthM;
        if (ratio > 35 || ratio < 8) {
          spanSectionWarnings.push(`${member.id} (span/depth≈${ratio.toFixed(1)})`);
        }
      }
    }

    const sectionName = (member.section || '').toUpperCase();
    if (sectionName && !IS_SECTIONS[sectionName]) {
      unknownSections.push(`${member.id}:${sectionName}`);
    }
  }

  if (invalidRefs.length === 0) {
    checks.validMemberReferences = true;
  } else {
    issues.push({
      severity: 'error',
      type: 'connectivity',
      message: `Invalid member node references found: ${invalidRefs.slice(0, 5).join(', ')}${invalidRefs.length > 5 ? '…' : ''}`,
      fixable: true,
    });
  }

  if (sameNodeMembers.length === 0) {
    checks.validNodePairs = true;
  } else {
    issues.push({
      severity: 'error',
      type: 'geometry',
      message: `Members with same start/end node: ${sameNodeMembers.join(', ')}`,
      fixable: true,
      affectedElements: sameNodeMembers,
    });
  }

  if (zeroLengthMembers.length === 0) {
    checks.zeroLengthMembers = true;
  } else {
    issues.push({
      severity: 'error',
      type: 'geometry',
      message: `Zero-length members detected: ${zeroLengthMembers.join(', ')}`,
      fixable: true,
      affectedElements: zeroLengthMembers,
    });
  }

  const hasSupport = model.nodes.some(n => n.isSupport || !!(n.restraints?.fx || n.restraints?.fy || n.restraints?.fz));
  if (hasSupport) {
    checks.supportsExist = true;
  } else {
    issues.push({ severity: 'error', type: 'support', message: 'No supports defined — structure is unstable', fixable: true });
  }

  if (unknownSections.length === 0) {
    checks.knownSections = true;
  } else {
    issues.push({
      severity: 'warning',
      type: 'section',
      message: `Unknown sections detected: ${unknownSections.slice(0, 5).join(', ')}${unknownSections.length > 5 ? '…' : ''}`,
      fixable: true,
    });
  }

  if (spanSectionWarnings.length === 0) {
    checks.spanSectionSanity = true;
  } else {
    issues.push({
      severity: 'warning',
      type: 'section',
      message: `Potential span/section mismatches: ${spanSectionWarnings.slice(0, 4).join(', ')}${spanSectionWarnings.length > 4 ? '…' : ''}`,
      fixable: true,
    });
  }

  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  return {
    valid: errors === 0,
    totalIssues: issues.length,
    errors,
    warnings,
    issues,
    checks,
  };
}

export function estimateSectionDepthMeters(section: string): number | undefined {
  const normalized = section.toUpperCase();
  const match = normalized.match(/(?:ISMB|ISHB|ISMC)(\d{2,3})/);
  if (!match) return undefined;
  const depthMm = Number(match[1]);
  if (!Number.isFinite(depthMm) || depthMm <= 0) return undefined;
  return depthMm / 1000;
}

export function enforceGenerationSafety(result: AIResponse): AIResponse {
  if (!result.model) return result;

  const normalized = normalizeModel(result.model);
  const validation = result.validation || validateModel(normalized);
  const response = { ...result, model: normalized, validation };

  if (validation.errors > 0) {
    return {
      ...response,
      success: false,
      response: `❌ Generated model failed safety validation (${validation.errors} error(s), ${validation.warnings} warning(s)). ${response.response}`,
    };
  }

  if (validation.warnings > 0) {
    return {
      ...response,
      response: `${response.response}\n\n⚠️ Validation warnings: ${validation.warnings}`,
    };
  }

  return response;
}

export function validateStructuralModel(model: StructuralModel): { model: StructuralModel; validation: ModelValidation } {
  const normalized = normalizeModel(model);
  const validation = validateModel(normalized);
  return { model: normalized, validation };
}