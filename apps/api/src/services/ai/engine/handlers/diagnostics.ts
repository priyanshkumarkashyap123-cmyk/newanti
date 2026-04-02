import { SYSTEM_PROMPTS } from '../prompts.js';
import type { GenerativeModel } from '@google/generative-ai';
import type { DiagnosisIssue, DiagnosisResult, ModelContext } from '../types.js';
import { logger } from '../../../../utils/logger.js';

export async function diagnoseModel(context: ModelContext, model: GenerativeModel | null): Promise<DiagnosisResult> {
  const issues: DiagnosisIssue[] = [];

  if (!context || !context.nodes || context.nodes.length === 0) {
    return {
      success: true,
      issues: [{ severity: 'error', category: 'geometry', message: 'No model loaded. Create or load a structure first.', affectedElements: [] }],
      overallHealth: 'critical',
      suggestions: ['Create a new structure using natural language, e.g., "Create a 6m portal frame"'],
      autoFixAvailable: false,
    };
  }

  const supportNodes = context.nodes.filter(n => n.hasSupport);
  if (supportNodes.length === 0) {
    issues.push({
      severity: 'error',
      category: 'support',
      message: 'No supports defined. Structure will be unstable — add at least 2 supports.',
      affectedElements: [],
      suggestedFix: 'Add fixed or pinned supports at ground-level nodes',
    });
  } else if (supportNodes.length === 1) {
    issues.push({
      severity: 'warning',
      category: 'stability',
      message: 'Only 1 support found. Consider adding another for stability.',
      affectedElements: [supportNodes[0].id],
      suggestedFix: 'Add a roller or pinned support at the other end',
    });
  }

  const connectedNodes = new Set<string>();
  for (const m of context.members) {
    connectedNodes.add(m.startNode);
    connectedNodes.add(m.endNode);
  }
  const orphanNodes = context.nodes.filter(n => !connectedNodes.has(n.id));
  if (orphanNodes.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'connectivity',
      message: `${orphanNodes.length} orphan node(s) not connected to any member.`,
      affectedElements: orphanNodes.map(n => n.id),
      suggestedFix: 'Connect these nodes with members or remove them',
    });
  }

  for (const m of context.members) {
    const startNode = context.nodes.find(n => n.id === m.startNode);
    const endNode = context.nodes.find(n => n.id === m.endNode);
    if (startNode && endNode) {
      const dx = endNode.x - startNode.x;
      const dy = endNode.y - startNode.y;
      const dz = endNode.z - startNode.z || 0;
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length < 0.001) {
        issues.push({
          severity: 'error',
          category: 'geometry',
          message: `Member ${m.id} has zero or near-zero length.`,
          affectedElements: [m.id],
          suggestedFix: 'Remove this member or move one of its nodes',
        });
      }
    }
  }

  if (!context.loads || context.loads.length === 0) {
    issues.push({
      severity: 'info',
      category: 'loading',
      message: 'No loads applied. Add loads before running analysis.',
      affectedElements: [],
      suggestedFix: 'Apply dead loads, live loads, or other load cases',
    });
  }

  const nodeIds = new Set(context.nodes.map(n => n.id));
  for (const m of context.members) {
    if (!nodeIds.has(m.startNode)) {
      issues.push({
        severity: 'error',
        category: 'connectivity',
        message: `Member ${m.id} references non-existent start node ${m.startNode}`,
        affectedElements: [m.id],
      });
    }
    if (!nodeIds.has(m.endNode)) {
      issues.push({
        severity: 'error',
        category: 'connectivity',
        message: `Member ${m.id} references non-existent end node ${m.endNode}`,
        affectedElements: [m.id],
      });
    }
  }

  if (context.analysisResults) {
    if (context.analysisResults.failedMembers && context.analysisResults.failedMembers.length > 0) {
      issues.push({
        severity: 'error',
        category: 'section',
        message: `${context.analysisResults.failedMembers.length} member(s) failed strength check.`,
        affectedElements: context.analysisResults.failedMembers,
        suggestedFix: 'Increase section sizes for failed members',
      });
    }
    if (context.analysisResults.maxStress && context.analysisResults.maxStress > 250) {
      issues.push({
        severity: 'warning',
        category: 'section',
        message: `Maximum stress (${context.analysisResults.maxStress.toFixed(1)} MPa) exceeds typical Fe410 yield stress (250 MPa).`,
        affectedElements: [],
        suggestedFix: 'Use larger sections or higher-grade steel (Fe500)',
      });
    }
  }

  if (model && context.members.length > 0) {
    try {
      const aiDiagnosis = await geminiDiagnose(model, context);
      if (aiDiagnosis) issues.push(...aiDiagnosis);
    } catch (err) {
      logger.warn({ err }, '[AIArchitectEngine] Gemini diagnosis failed, using local only');
    }
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  return {
    success: true,
    issues,
    overallHealth: errorCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'good',
    suggestions: issues.filter(i => i.suggestedFix).map(i => i.suggestedFix!),
    autoFixAvailable: issues.some(i => i.suggestedFix && (i.category === 'connectivity' || i.category === 'support')),
  };
}

async function geminiDiagnose(model: GenerativeModel, context: ModelContext): Promise<DiagnosisIssue[]> {
  const prompt = `${SYSTEM_PROMPTS.diagnose}

Model:
- Nodes: ${JSON.stringify(context.nodes)}
- Members: ${JSON.stringify(context.members)}
- Loads: ${JSON.stringify(context.loads || [])}
${context.analysisResults ? `- Analysis Results: ${JSON.stringify(context.analysisResults)}` : ''}

Provide diagnosis as JSON array of issues.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

  const parsed = JSON.parse(text);
  return (parsed.issues || parsed || []).filter((i: { severity?: string; category?: string; message?: string }) =>
    i.severity && i.category && i.message
  ) as DiagnosisIssue[];
}