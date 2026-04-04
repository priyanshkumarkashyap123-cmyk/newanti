/**
 * ============================================================================
 * ENHANCED AI GUARDRAILS V2
 * ============================================================================
 * 
 * Production-grade safety, validation, and sanity checking for all AI outputs.
 * Extends the original AIGuardrails with:
 * - Response content validation
 * - Hallucination detection for engineering claims
 * - Output sanitization
 * - Prompt injection detection
 * - Engineering plausibility cross-checks
 * - Confidence calibration
 * 
 * @version 2.0.0
 */

import type {
  NormalizedStructureData,
  NormalizedMember,
  NormalizedNode,
  GuardrailSummary,
  GuardrailWarning,
  GuardrailFailure,
  AIResponse,
} from './types';

// ============================================================================
// ENGINEERING CONSTANTS FOR VALIDATION
// ============================================================================

const ENGINEERING_LIMITS = {
  // Steel sections - depth in mm
  steelSections: {
    minDepth: 75,
    maxDepth: 1200,
    minWidth: 50,
    maxWidth: 500,
    minThickness: 3,
    maxThickness: 50,
  },

  // Concrete dimensions in mm
  concrete: {
    minBeamWidth: 200,
    maxBeamWidth: 1000,
    minBeamDepth: 300,
    maxBeamDepth: 2000,
    minColumnSize: 200,
    maxColumnSize: 1500,
    minSlabThickness: 100,
    maxSlabThickness: 500,
  },

  // Span limits in meters
  spans: {
    minBeamSpan: 0.5,
    maxBeamSpan: 50,
    minColumnHeight: 1.5,
    maxColumnHeight: 30,
    minTrussSpan: 5,
    maxTrussSpan: 120,
  },

  // Load limits in kN or kN/m
  loads: {
    maxPointLoad: 10000,
    maxDistributedLoad: 500,
    maxMoment: 50000,
    minLoadValue: 0,
  },

  // Material properties
  materials: {
    steel: {
      E: { min: 190e9, max: 210e9 },
      fy: { min: 230e6, max: 690e6 },
      density: { min: 7700, max: 8100 },
    },
    concrete: {
      E: { min: 15e9, max: 50e9 },
      fck: { min: 15e6, max: 100e6 },
      density: { min: 2200, max: 2600 },
    },
  },

  // Result sanity
  results: {
    maxDisplacement: 1.0, // meters - absolutely max
    maxStress: 1e10,      // Pa
    minFactorOfSafety: 0.5,
    maxFactorOfSafety: 100,
    maxDCR: 5.0,          // Anything above this is clearly wrong
  },
};

// ============================================================================
// PROMPT INJECTION PATTERNS
// ============================================================================

const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)\s+(instructions?|prompts?|rules?)/i,
  /forget\s+(everything|all|your)\s+(instructions?|training|guidelines)/i,
  /you\s+are\s+now\s+a/i,
  /system\s*:\s*(override|ignore|forget|bypass)/i,
  /\]\s*\[\s*SYSTEM\s*\]/i,
  /pretend\s+(you|that|to\s+be)/i,
  /jailbreak/i,
  /do\s+anything\s+now/i,
  /bypass\s+(safety|security|filters?|restrictions?)/i,
  /reveal\s+(your|the|system)\s+(prompt|instructions?|api\s*key)/i,
  /<\s*script\s*>/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /__import__/i,
];

// ============================================================================
// HALLUCINATION DETECTION PATTERNS
// ============================================================================

const HALLUCINATION_INDICATORS = {
  // Fake IS code clauses that don't exist
  fakeISClauses: [
    /IS\s*800\s*:\s*20[3-9]\d/i,  // IS 800 published in 2007, no 2030+ versions
    /IS\s*456\s*:\s*20[3-9]\d/i,  // Similar
    /clause\s+\d{4,}/i,           // Clause numbers over 3 digits are suspicious
  ],

  // Impossible material properties
  impossibleMaterials: [
    { pattern: /steel.*yield.*strength.*(\d+)\s*(GPa|gpa)/, check: (v: number) => v > 2 },
    { pattern: /concrete.*compressive.*strength.*(\d+)\s*(GPa|gpa)/, check: (v: number) => v > 0.2 },
    { pattern: /modulus.*elasticity.*(\d+)\s*(TPa|tpa)/, check: (v: number) => v > 0.5 },
  ],

  // Suspicious precision
  suspiciousPrecision: /\d+\.\d{8,}/g,  // More than 7 decimal places in engineering

  // Citation formats that might be fabricated
  fakeCitations: [
    /DOI:\s*10\.\d{4}\/\w{30,}/i,  // Unusually long DOI
    /\((?:Smith|John|Author)\s*et\s*al\.\s*,\s*\d{4}\)/i,  // Generic author names
  ],
};

// ============================================================================
// ENHANCED GUARDRAILS CLASS
// ============================================================================

export class EnhancedAIGuardrails {

  /**
   * Full validation pipeline for AI-generated structures
   */
  validateStructureOutput(structure: NormalizedStructureData): GuardrailSummary {
    const warnings: GuardrailWarning[] = [];
    const failures: GuardrailFailure[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    // 1. Structural integrity checks
    const integrityResult = this.checkStructuralIntegrity(structure);
    totalChecks += integrityResult.total;
    passedChecks += integrityResult.passed;
    warnings.push(...integrityResult.warnings);
    failures.push(...integrityResult.failures);

    // 2. Engineering plausibility
    const plausibilityResult = this.checkEngineeringPlausibility(structure);
    totalChecks += plausibilityResult.total;
    passedChecks += plausibilityResult.passed;
    warnings.push(...plausibilityResult.warnings);
    failures.push(...plausibilityResult.failures);

    // 3. Stability checks
    const stabilityResult = this.checkStabilityConditions(structure);
    totalChecks += stabilityResult.total;
    passedChecks += stabilityResult.passed;
    warnings.push(...stabilityResult.warnings);
    failures.push(...stabilityResult.failures);

    // 4. Material property validation
    const materialResult = this.checkMaterialProperties(structure);
    totalChecks += materialResult.total;
    passedChecks += materialResult.passed;
    warnings.push(...materialResult.warnings);
    failures.push(...materialResult.failures);

    // Calculate confidence
    const confidence = totalChecks > 0
      ? Math.round((passedChecks / totalChecks) * 100)
      : 50;

    return {
      passed: failures.length === 0,
      confidence: Math.max(0, Math.min(100, confidence - warnings.length * 5)),
      totalChecks,
      passedChecks,
      warnings,
      failures,
    };
  }

  /**
   * Validate AI text response for hallucinations and quality
   */
  validateTextResponse(response: string, context?: string): {
    safe: boolean;
    confidence: number;
    issues: string[];
    sanitized: string;
  } {
    const issues: string[] = [];
    let confidence = 90;

    // Check for hallucination indicators
    for (const pattern of HALLUCINATION_INDICATORS.fakeISClauses) {
      if (pattern.test(response)) {
        issues.push('Potentially fabricated code clause reference detected');
        confidence -= 15;
      }
    }

    // Check suspicious precision
    const precisionMatches = response.match(HALLUCINATION_INDICATORS.suspiciousPrecision);
    if (precisionMatches && precisionMatches.length > 3) {
      issues.push(`Suspiciously precise values found (${precisionMatches.length} instances with 8+ decimal places)`);
      confidence -= 10;
    }

    // Check fake citations
    for (const pattern of HALLUCINATION_INDICATORS.fakeCitations) {
      if (pattern.test(response)) {
        issues.push('Potentially fabricated citation detected');
        confidence -= 15;
      }
    }

    // Check for contradictions in numerical claims
    const numericalIssues = this.checkNumericalConsistency(response);
    issues.push(...numericalIssues);
    confidence -= numericalIssues.length * 5;

    // Sanitize response
    const sanitized = this.sanitizeResponse(response);

    return {
      safe: issues.length === 0 || confidence > 50,
      confidence: Math.max(0, Math.min(100, confidence)),
      issues,
      sanitized,
    };
  }

  /**
   * Check input prompt for injection attacks
   */
  checkPromptSafety(prompt: string): {
    safe: boolean;
    threats: string[];
    sanitizedPrompt: string;
  } {
    const threats: string[] = [];

    for (const pattern of INJECTION_PATTERNS) {
      if (pattern.test(prompt)) {
        threats.push(`Potential prompt injection detected: ${pattern.source.slice(0, 50)}`);
      }
    }

    // Check for encoded injection attempts
    try {
      const decoded = decodeURIComponent(prompt);
      if (decoded !== prompt) {
        for (const pattern of INJECTION_PATTERNS) {
          if (pattern.test(decoded)) {
            threats.push('URL-encoded prompt injection attempt detected');
            break;
          }
        }
      }
    } catch {
      // Invalid URL encoding is fine
    }

    // Check for extremely long prompts that might be buffer overflow attempts
    if (prompt.length > 50000) {
      threats.push('Abnormally long prompt detected (potential abuse)');
    }

    // Check for base64 encoded payloads
    const base64Pattern = /[A-Za-z0-9+/]{100,}={0,2}/g;
    const base64Matches = prompt.match(base64Pattern);
    if (base64Matches && base64Matches.length > 3) {
      threats.push('Multiple base64-encoded payloads detected in prompt');
    }

    // Sanitize
    let sanitizedPrompt = prompt;
    if (threats.length > 0) {
      // Remove potential injection patterns but keep the engineering content
      sanitizedPrompt = prompt
        .replace(/ignore\s+(previous|all|above)\s+(instructions?|prompts?|rules?)/gi, '[filtered]')
        .replace(/<\s*script\s*>.*?<\s*\/\s*script\s*>/gi, '[filtered]')
        .replace(/eval\s*\(.*?\)/gi, '[filtered]');
    }

    return {
      safe: threats.length === 0,
      threats,
      sanitizedPrompt,
    };
  }

  /**
   * Validate analysis results for engineering plausibility
   */
  validateAnalysisResults(results: {
    displacement?: number;
    stress?: number;
    moment?: number;
    shear?: number;
    dcr?: number;
    factorOfSafety?: number;
    naturalFrequency?: number;
  }): GuardrailSummary {
    const warnings: GuardrailWarning[] = [];
    const failures: GuardrailFailure[] = [];
    let totalChecks = 0;
    let passedChecks = 0;

    if (results.displacement !== undefined) {
      totalChecks++;
      if (Math.abs(results.displacement) > ENGINEERING_LIMITS.results.maxDisplacement) {
        failures.push({
          parameter: 'displacement',
          value: results.displacement,
          limit: `±${ENGINEERING_LIMITS.results.maxDisplacement}m`,
          message: `Displacement ${results.displacement}m exceeds physical limits`,
          severity: 'critical',
        });
      } else if (Math.abs(results.displacement) > 0.3) {
        warnings.push({
          parameter: 'displacement',
          value: results.displacement,
          expectedRange: '0 - 0.3m',
          message: `Large displacement ${results.displacement}m - verify model stability`,
        });
      } else {
        passedChecks++;
      }
    }

    if (results.stress !== undefined) {
      totalChecks++;
      if (Math.abs(results.stress) > ENGINEERING_LIMITS.results.maxStress) {
        failures.push({
          parameter: 'stress',
          value: results.stress,
          limit: `${ENGINEERING_LIMITS.results.maxStress} Pa`,
          message: `Stress value ${results.stress} Pa is unrealistic`,
          severity: 'critical',
        });
      } else {
        passedChecks++;
      }
    }

    if (results.dcr !== undefined) {
      totalChecks++;
      if (results.dcr > ENGINEERING_LIMITS.results.maxDCR) {
        failures.push({
          parameter: 'dcr',
          value: results.dcr,
          limit: `${ENGINEERING_LIMITS.results.maxDCR}`,
          message: `DCR ${results.dcr} is unrealistically high - check inputs`,
          severity: 'major',
        });
      } else if (results.dcr > 1.0) {
        warnings.push({
          parameter: 'dcr',
          value: results.dcr,
          expectedRange: '0.0 - 1.0',
          message: `DCR ${results.dcr} > 1.0 indicates member failure`,
        });
        passedChecks++; // It's valid, just a warning
      } else {
        passedChecks++;
      }
    }

    if (results.factorOfSafety !== undefined) {
      totalChecks++;
      if (results.factorOfSafety < ENGINEERING_LIMITS.results.minFactorOfSafety) {
        failures.push({
          parameter: 'factorOfSafety',
          value: results.factorOfSafety,
          limit: `>${ENGINEERING_LIMITS.results.minFactorOfSafety}`,
          message: `Factor of safety ${results.factorOfSafety} is unrealistically low`,
          severity: 'critical',
        });
      } else if (results.factorOfSafety > ENGINEERING_LIMITS.results.maxFactorOfSafety) {
        warnings.push({
          parameter: 'factorOfSafety',
          value: results.factorOfSafety,
          expectedRange: `1.0 - ${ENGINEERING_LIMITS.results.maxFactorOfSafety}`,
          message: `Factor of safety ${results.factorOfSafety} is unusually high - verify`,
        });
        passedChecks++;
      } else {
        passedChecks++;
      }
    }

    if (results.naturalFrequency !== undefined) {
      totalChecks++;
      if (results.naturalFrequency < 0.1) {
        warnings.push({
          parameter: 'naturalFrequency',
          value: results.naturalFrequency,
          expectedRange: '0.5 - 50 Hz',
          message: `Very low natural frequency ${results.naturalFrequency} Hz - check boundary conditions`,
        });
        passedChecks++;
      } else if (results.naturalFrequency > 1000) {
        failures.push({
          parameter: 'naturalFrequency',
          value: results.naturalFrequency,
          limit: '<1000 Hz',
          message: `Natural frequency ${results.naturalFrequency} Hz is unrealistic for structural systems`,
          severity: 'major',
        });
      } else {
        passedChecks++;
      }
    }

    const confidence = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 50;

    return {
      passed: failures.length === 0,
      confidence: Math.max(0, Math.min(100, confidence)),
      totalChecks,
      passedChecks,
      warnings,
      failures,
    };
  }

  // ============================================================================
  // PRIVATE VALIDATION METHODS
  // ============================================================================

  private checkStructuralIntegrity(structure: NormalizedStructureData): {
    total: number; passed: number; warnings: GuardrailWarning[]; failures: GuardrailFailure[];
  } {
    const warnings: GuardrailWarning[] = [];
    const failures: GuardrailFailure[] = [];
    let total = 0;
    let passed = 0;

    // Check node count
    total++;
    if (structure.nodes.length === 0) {
      failures.push({ parameter: 'nodeCount', value: 0, limit: '>0', message: 'Structure has no nodes', severity: 'critical' });
    } else if (structure.nodes.length > 10000) {
      warnings.push({ parameter: 'nodeCount', value: structure.nodes.length, expectedRange: '2-10000', message: 'Very large number of nodes' });
      passed++;
    } else {
      passed++;
    }

    // Check member count
    total++;
    if (structure.members.length === 0) {
      failures.push({ parameter: 'memberCount', value: 0, limit: '>0', message: 'Structure has no members', severity: 'critical' });
    } else {
      passed++;
    }

    // Check connectivity
    total++;
    const nodeIds = new Set(structure.nodes.map(n => n.id));
    const orphanMembers = structure.members.filter(
      m => !nodeIds.has(m.startNodeId) || !nodeIds.has(m.endNodeId)
    );
    if (orphanMembers.length > 0) {
      failures.push({
        parameter: 'connectivity',
        value: orphanMembers.length,
        limit: '0 orphan members',
        message: `${orphanMembers.length} members reference non-existent nodes`,
        severity: 'critical',
      });
    } else {
      passed++;
    }

    // Check for isolated nodes (connected to no members)
    total++;
    const connectedNodeIds = new Set<string>();
    structure.members.forEach(m => {
      connectedNodeIds.add(m.startNodeId);
      connectedNodeIds.add(m.endNodeId);
    });
    const isolatedNodes = structure.nodes.filter(n => !connectedNodeIds.has(n.id));
    if (isolatedNodes.length > 0) {
      warnings.push({
        parameter: 'isolatedNodes',
        value: isolatedNodes.length,
        expectedRange: '0',
        message: `${isolatedNodes.length} nodes are not connected to any member`,
      });
      passed++;
    } else {
      passed++;
    }

    // Check supports
    total++;
    if (structure.supports.length === 0) {
      failures.push({
        parameter: 'supports',
        value: 0,
        limit: '≥1',
        message: 'No supports defined - structure is unstable',
        severity: 'critical',
      });
    } else {
      // Check minimum restraints for stability (2D: 3 restraints minimum)
      const totalRestraints = structure.supports.reduce((sum, s) => {
        return sum + Object.values(s.restraints).filter(Boolean).length;
      }, 0);
      if (totalRestraints < 3) {
        failures.push({
          parameter: 'totalRestraints',
          value: totalRestraints,
          limit: '≥3',
          message: `Only ${totalRestraints} restraint DOFs - insufficient for stability`,
          severity: 'major',
        });
      } else {
        passed++;
      }
    }

    return { total, passed, warnings, failures };
  }

  private checkEngineeringPlausibility(structure: NormalizedStructureData): {
    total: number; passed: number; warnings: GuardrailWarning[]; failures: GuardrailFailure[];
  } {
    const warnings: GuardrailWarning[] = [];
    const failures: GuardrailFailure[] = [];
    let total = 0;
    let passed = 0;

    // Check member lengths
    for (const member of structure.members) {
      const startNode = structure.nodes.find(n => n.id === member.startNodeId);
      const endNode = structure.nodes.find(n => n.id === member.endNodeId);

      if (startNode && endNode) {
        total++;
        const length = Math.sqrt(
          (endNode.x - startNode.x) ** 2 +
          (endNode.y - startNode.y) ** 2 +
          (endNode.z - startNode.z) ** 2
        );

        if (length < 0.01) {
          failures.push({
            parameter: `member_${member.id}_length`,
            value: length,
            limit: '>0.01m',
            message: `Member ${member.id} has near-zero length (${length.toFixed(4)}m)`,
            severity: 'critical',
          });
        } else if (length > ENGINEERING_LIMITS.spans.maxTrussSpan) {
          warnings.push({
            parameter: `member_${member.id}_length`,
            value: length,
            expectedRange: `0.5-${ENGINEERING_LIMITS.spans.maxTrussSpan}m`,
            message: `Member ${member.id} is extremely long (${length.toFixed(1)}m)`,
          });
          passed++;
        } else {
          passed++;
        }
      }
    }

    // Check coordinate ranges
    total++;
    const xs = structure.nodes.map(n => n.x);
    const ys = structure.nodes.map(n => n.y);
    const xRange = Math.max(...xs) - Math.min(...xs);
    const yRange = Math.max(...ys) - Math.min(...ys);

    if (xRange > 1000 || yRange > 1000) {
      warnings.push({
        parameter: 'structureExtent',
        value: Math.max(xRange, yRange),
        expectedRange: '1-500m',
        message: `Structure spans ${Math.max(xRange, yRange).toFixed(0)}m - verify units`,
      });
      passed++;
    } else if (xRange === 0 && yRange === 0 && structure.nodes.length > 1) {
      failures.push({
        parameter: 'structureExtent',
        value: 0,
        limit: '>0',
        message: 'All nodes are at the same position',
        severity: 'critical',
      });
    } else {
      passed++;
    }

    // Check load magnitudes
    for (const load of structure.loads) {
      total++;
      const maxLoadValue = Math.max(...load.values.map(Math.abs));
      if (maxLoadValue > ENGINEERING_LIMITS.loads.maxPointLoad) {
        warnings.push({
          parameter: `load_${load.id}_value`,
          value: maxLoadValue,
          expectedRange: `0-${ENGINEERING_LIMITS.loads.maxPointLoad}kN`,
          message: `Load ${load.id} has very large magnitude: ${maxLoadValue}`,
        });
        passed++;
      } else {
        passed++;
      }
    }

    return { total, passed, warnings, failures };
  }

  private checkStabilityConditions(structure: NormalizedStructureData): {
    total: number; passed: number; warnings: GuardrailWarning[]; failures: GuardrailFailure[];
  } {
    const warnings: GuardrailWarning[] = [];
    const failures: GuardrailFailure[] = [];
    let total = 0;
    let passed = 0;

    // Check for mechanism (more DOFs than equations)
    total++;
    const numNodes = structure.nodes.length;
    const numMembers = structure.members.length;
    const numRestraints = structure.supports.reduce((sum, s) => {
      return sum + Object.values(s.restraints).filter(Boolean).length;
    }, 0);

    // For 2D frame: 3n = 3m + r (statically determinate), stable if 3m + r >= 3n
    const dof = 3 * numNodes;
    const equations = 3 * numMembers + numRestraints;

    if (equations < dof) {
      warnings.push({
        parameter: 'staticDeterminacy',
        value: dof - equations,
        expectedRange: '≤0 (degree of indeterminacy)',
        message: `Structure may be a mechanism: ${dof} DOFs vs ${equations} equations (deficit: ${dof - equations})`,
      });
      passed++;
    } else {
      passed++;
    }

    // Check if supports are all on one side (tip-over risk)
    total++;
    if (structure.supports.length > 0) {
      const supportNodes = structure.supports.map(s =>
        structure.nodes.find(n => n.id === s.nodeId)
      ).filter(Boolean) as NormalizedNode[];

      if (supportNodes.length > 0) {
        const supportXs = supportNodes.map(n => n.x);
        const allNodesXs = structure.nodes.map(n => n.x);
        const supportRangeX = Math.max(...supportXs) - Math.min(...supportXs);
        const structureRangeX = Math.max(...allNodesXs) - Math.min(...allNodesXs);

        if (structureRangeX > 0 && supportRangeX / structureRangeX < 0.1) {
          warnings.push({
            parameter: 'supportDistribution',
            value: supportRangeX / structureRangeX,
            expectedRange: '0.1-1.0',
            message: 'Supports are clustered on one side - structure may be unstable laterally',
          });
          passed++;
        } else {
          passed++;
        }
      } else {
        passed++;
      }
    } else {
      passed++;
    }

    return { total, passed, warnings, failures };
  }

  private checkMaterialProperties(structure: NormalizedStructureData): {
    total: number; passed: number; warnings: GuardrailWarning[]; failures: GuardrailFailure[];
  } {
    const warnings: GuardrailWarning[] = [];
    const failures: GuardrailFailure[] = [];
    let total = 0;
    let passed = 0;

    for (const material of structure.materials) {
      const limits = material.type === 'steel'
        ? ENGINEERING_LIMITS.materials.steel
        : material.type === 'concrete'
          ? ENGINEERING_LIMITS.materials.concrete
          : null;

      if (!limits) continue;

      // Check Young's modulus
      if (material.E) {
        total++;
        if (material.E < limits.E.min || material.E > limits.E.max) {
          failures.push({
            parameter: `material_${material.id}_E`,
            value: material.E,
            limit: `${limits.E.min}-${limits.E.max} Pa`,
            message: `Material ${material.name} has unrealistic elastic modulus: ${material.E} Pa`,
            severity: 'major',
          });
        } else {
          passed++;
        }
      }

      // Check yield strength
      const yieldStrength = material.fy || (material as any).fck;
      if (yieldStrength) {
        total++;
        const yieldLimits = (limits as any).fy || (limits as any).fck;
        if (yieldLimits && (yieldStrength < yieldLimits.min || yieldStrength > yieldLimits.max)) {
          warnings.push({
            parameter: `material_${material.id}_fy`,
            value: yieldStrength,
            expectedRange: `${yieldLimits.min}-${yieldLimits.max} Pa`,
            message: `Material ${material.name} has unusual strength: ${yieldStrength} Pa`,
          });
          passed++;
        } else {
          passed++;
        }
      }
    }

    return { total, passed, warnings, failures };
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  private checkNumericalConsistency(text: string): string[] {
    const issues: string[] = [];

    // Extract all numbers with units
    const measurements = text.match(/(\d+(?:\.\d+)?)\s*(mm|cm|m|km|kN|N|MPa|GPa|Pa|kg|ton)/gi) || [];

    // Look for contradictions (same quantity with very different values)
    const valueMap = new Map<string, number[]>();
    for (const m of measurements) {
      const match = m.match(/(\d+(?:\.\d+)?)\s*(\w+)/);
      if (match) {
        const unit = match[2].toLowerCase();
        const value = parseFloat(match[1]);
        if (!valueMap.has(unit)) valueMap.set(unit, []);
        valueMap.get(unit)!.push(value);
      }
    }

    // Flag if same unit has values differing by >1000x
    for (const [unit, values] of valueMap.entries()) {
      if (values.length >= 2) {
        const max = Math.max(...values);
        const min = Math.min(...values.filter(v => v > 0));
        if (min > 0 && max / min > 1000) {
          issues.push(`Inconsistent ${unit} values found: ${min} to ${max} (${Math.round(max / min)}x difference)`);
        }
      }
    }

    return issues;
  }

  private sanitizeResponse(response: string): string {
    return response
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/data\s*:\s*text\/html/gi, '')
      .trim();
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

export const enhancedGuardrails = new EnhancedAIGuardrails();
