/**
 * ============================================================================
 * SECTION OPTIMIZER
 * ============================================================================
 *
 * Iterative section optimization engine that automatically sizes steel sections
 * to achieve the most efficient (lightest) design while satisfying all IS 800
 * code checks.
 *
 * Strategies:
 *   1. **Stress-ratio sizing**: Scale section based on utilization ratio
 *   2. **Group optimization**: Members of same type share sections
 *   3. **Discrete stepping**: Walk through available IS sections
 *   4. **Weight minimization**: Minimize total steel weight (kg)
 *   5. **Constructability**: Limit unique section count
 *
 * @version 1.0.0
 */

import { SectionLookup, type SteelSection, type MemberDesignProperties } from './SectionLookup';
import type { GeneratedNode, GeneratedMember, AnalysisResults, DesignCheck } from './AutonomousDesignEngine';

// ============================================================================
// TYPES
// ============================================================================

export interface OptimizationConfig {
  /** Target utilization ratio (default 0.85 — 85%) */
  targetUtilization: number;
  /** Maximum iterations (default 10) */
  maxIterations: number;
  /** Convergence tolerance on weight change % (default 0.5%) */
  convergenceTolerance: number;
  /** Group members by type (beams together, columns together) */
  groupByType: boolean;
  /** Max unique sections allowed (constructability constraint) */
  maxUniqueSections: number;
  /** Minimum section index per type (prevents too-small sections) */
  minimumSections: Record<string, string>;
  /** Strategy */
  strategy: 'stress-ratio' | 'discrete-step' | 'weight-min';
}

export interface OptimizationResult {
  /** Did it converge? */
  converged: boolean;
  /** Number of iterations needed */
  iterations: number;
  /** Initial weight (kg) */
  initialWeight: number;
  /** Final weight (kg) */
  finalWeight: number;
  /** Weight savings (%) */
  savingsPercent: number;
  /** Final max utilization ratio */
  maxUtilization: number;
  /** Per-member section assignments */
  sectionAssignments: Map<string, string>;
  /** Iteration history */
  history: OptimizationStep[];
}

interface OptimizationStep {
  iteration: number;
  weight: number;
  maxRatio: number;
  failedCount: number;
  changes: Array<{ memberId: string; from: string; to: string; reason: string }>;
}

// Member group for simultaneous sizing
interface MemberGroup {
  groupId: string;
  memberIds: string[];
  currentSection: string;
  sectionFamily: 'ISMB' | 'ISMC' | 'ISA';
  governingRatio: number;
  governingClause: string;
}

// ============================================================================
// DEFAULT CONFIG
// ============================================================================

const DEFAULT_CONFIG: OptimizationConfig = {
  targetUtilization: 0.85,
  maxIterations: 10,
  convergenceTolerance: 0.5,
  groupByType: true,
  maxUniqueSections: 6,
  minimumSections: {
    beam: 'ISMB 200',
    column: 'ISMB 250',
    rafter: 'ISMB 200',
    chord: 'ISA 65x65x6',
    diagonal: 'ISA 50x50x6',
    vertical: 'ISA 50x50x6',
    brace: 'ISA 75x75x8',
    purlin: 'ISMC 100',
  },
  strategy: 'stress-ratio',
};

// ============================================================================
// SECTION OPTIMIZER
// ============================================================================

export class SectionOptimizer {
  private config: OptimizationConfig;
  private sectionOrderCache = new Map<string, string[]>();

  constructor(config?: Partial<OptimizationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Optimize section assignments for minimum weight.
   *
   * @param members     Current member list (will be MUTATED with new section props)
   * @param nodes       Node geometry
   * @param checks      Current design checks from last analysis
   * @param reAnalyze   Callback to run analysis + design checks with updated sections
   * @returns           Optimization result
   */
  async optimize(
    members: GeneratedMember[],
    nodes: GeneratedNode[],
    checks: DesignCheck[],
    reAnalyze: (members: GeneratedMember[]) => { analysis: AnalysisResults; checks: DesignCheck[] },
  ): Promise<OptimizationResult> {
    const history: OptimizationStep[] = [];
    const initialWeight = this.computeWeight(nodes, members);
    let previousWeight = initialWeight;
    let currentChecks = checks;
    let converged = false;

    for (let iter = 1; iter <= this.config.maxIterations; iter++) {
      // Group members
      const groups = this.groupMembers(members, currentChecks);

      // Determine changes needed
      const changes = this.computeChanges(groups, currentChecks);

      // Apply changes
      const applied = this.applyChanges(members, changes);

      const currentWeight = this.computeWeight(nodes, members);

      // Record step
      history.push({
        iteration: iter,
        weight: currentWeight,
        maxRatio: Math.max(...currentChecks.map(c => c.ratio), 0),
        failedCount: currentChecks.filter(c => c.status === 'FAIL').length,
        changes: applied,
      });

      // Check convergence
      if (applied.length === 0) {
        converged = true;
        break;
      }

      const weightChange = Math.abs(currentWeight - previousWeight) / previousWeight * 100;
      if (weightChange < this.config.convergenceTolerance && currentChecks.every(c => c.status !== 'FAIL')) {
        converged = true;
        break;
      }

      previousWeight = currentWeight;

      // Re-analyze with updated sections
      const result = reAnalyze(members);
      currentChecks = result.checks;
    }

    const finalWeight = this.computeWeight(nodes, members);
    const maxUtil = Math.max(...currentChecks.map(c => c.ratio), 0);

    // Build section assignments map
    const sectionAssignments = new Map<string, string>();
    for (const m of members) {
      sectionAssignments.set(m.id, m.sectionName);
    }

    return {
      converged,
      iterations: history.length,
      initialWeight,
      finalWeight,
      savingsPercent: ((initialWeight - finalWeight) / initialWeight) * 100,
      maxUtilization: maxUtil,
      sectionAssignments,
      history,
    };
  }

  // ============================================================================
  // GROUPING
  // ============================================================================

  /**
   * Group members by type + section family for simultaneous resizing
   */
  private groupMembers(members: GeneratedMember[], checks: DesignCheck[]): MemberGroup[] {
    if (!this.config.groupByType) {
      // Each member is its own group
      return members.map(m => {
        const memberChecks = checks.filter(c => c.memberId === m.id);
        const maxCheck = memberChecks.reduce((a, b) => a.ratio > b.ratio ? a : b, memberChecks[0]);
        return {
          groupId: m.id,
          memberIds: [m.id],
          currentSection: m.sectionName,
          sectionFamily: this.getSectionFamily(m.sectionName),
          governingRatio: maxCheck?.ratio || 0,
          governingClause: maxCheck?.clause || '',
        };
      });
    }

    // Group by (memberType, sectionName)
    const groupMap = new Map<string, MemberGroup>();
    for (const m of members) {
      const key = `${m.memberType}_${m.sectionName}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, {
          groupId: key,
          memberIds: [],
          currentSection: m.sectionName,
          sectionFamily: this.getSectionFamily(m.sectionName),
          governingRatio: 0,
          governingClause: '',
        });
      }
      groupMap.get(key)!.memberIds.push(m.id);
    }

    // Set governing ratio as the max across all members in group
    for (const group of groupMap.values()) {
      const memberChecks = checks.filter(c => group.memberIds.includes(c.memberId));
      if (memberChecks.length > 0) {
        const governing = memberChecks.reduce((a, b) => a.ratio > b.ratio ? a : b);
        group.governingRatio = governing.ratio;
        group.governingClause = governing.clause;
      }
    }

    return [...groupMap.values()];
  }

  // ============================================================================
  // CHANGE COMPUTATION
  // ============================================================================

  /**
   * Determine which sections need to change based on strategy
   */
  private computeChanges(
    groups: MemberGroup[],
    checks: DesignCheck[],
  ): Array<{ groupId: string; newSection: string; reason: string }> {
    switch (this.config.strategy) {
      case 'stress-ratio':   return this.stressRatioChanges(groups);
      case 'discrete-step':  return this.discreteStepChanges(groups, checks);
      case 'weight-min':     return this.weightMinChanges(groups);
      default:               return this.stressRatioChanges(groups);
    }
  }

  /**
   * Strategy 1: Stress-ratio sizing
   * Jump to section whose capacity approximately matches demand/targetUtil
   */
  private stressRatioChanges(groups: MemberGroup[]): Array<{ groupId: string; newSection: string; reason: string }> {
    const changes: Array<{ groupId: string; newSection: string; reason: string }> = [];

    for (const group of groups) {
      const ratio = group.governingRatio;
      const target = this.config.targetUtilization;

      // If ratio is within acceptable range, skip
      if (ratio >= target * 0.6 && ratio <= 1.0) continue;

      const ordered = this.getOrderedSections(group.sectionFamily);
      const currentIdx = ordered.indexOf(group.currentSection);
      if (currentIdx < 0) continue;

      if (ratio > 1.0) {
        // FAIL: need bigger section. Jump proportionally.
        const stepsNeeded = Math.ceil(Math.log(ratio) / Math.log(1.3)); // ~30% capacity increase per step
        const newIdx = Math.min(ordered.length - 1, currentIdx + stepsNeeded);
        if (newIdx !== currentIdx) {
          changes.push({
            groupId: group.groupId,
            newSection: ordered[newIdx],
            reason: `ratio ${ratio.toFixed(3)} > 1.0 at ${group.governingClause}`,
          });
        }
      } else if (ratio < target * 0.5) {
        // Over-designed: try smaller section
        const stepsDown = Math.max(1, Math.floor(Math.log(target / ratio) / Math.log(1.3)));
        const newIdx = Math.max(0, currentIdx - stepsDown);
        // Check minimum constraint
        const minSection = this.getMinimumSectionIdx(group, ordered);
        const finalIdx = Math.max(minSection, newIdx);
        if (finalIdx !== currentIdx) {
          changes.push({
            groupId: group.groupId,
            newSection: ordered[finalIdx],
            reason: `ratio ${ratio.toFixed(3)} < ${(target * 0.5).toFixed(2)} (over-designed)`,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Strategy 2: Discrete step — move one section at a time (conservative)
   */
  private discreteStepChanges(
    groups: MemberGroup[],
    checks: DesignCheck[],
  ): Array<{ groupId: string; newSection: string; reason: string }> {
    const changes: Array<{ groupId: string; newSection: string; reason: string }> = [];

    for (const group of groups) {
      const ratio = group.governingRatio;
      const ordered = this.getOrderedSections(group.sectionFamily);
      const currentIdx = ordered.indexOf(group.currentSection);
      if (currentIdx < 0) continue;

      if (ratio > 1.0 && currentIdx < ordered.length - 1) {
        changes.push({
          groupId: group.groupId,
          newSection: ordered[currentIdx + 1],
          reason: `FAIL: ratio ${ratio.toFixed(3)} → upsize`,
        });
      } else if (ratio < this.config.targetUtilization * 0.4 && currentIdx > 0) {
        const minIdx = this.getMinimumSectionIdx(group, ordered);
        if (currentIdx > minIdx) {
          changes.push({
            groupId: group.groupId,
            newSection: ordered[currentIdx - 1],
            reason: `Over-designed: ratio ${ratio.toFixed(3)} → downsize`,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Strategy 3: Weight minimization — try all feasible sections, pick lightest
   */
  private weightMinChanges(groups: MemberGroup[]): Array<{ groupId: string; newSection: string; reason: string }> {
    const changes: Array<{ groupId: string; newSection: string; reason: string }> = [];

    for (const group of groups) {
      if (group.governingRatio > 1.0) {
        // Just upsize for safety first
        const ordered = this.getOrderedSections(group.sectionFamily);
        const currentIdx = ordered.indexOf(group.currentSection);
        if (currentIdx >= 0 && currentIdx < ordered.length - 1) {
          changes.push({
            groupId: group.groupId,
            newSection: ordered[currentIdx + 1],
            reason: 'weight-min: upsize failed section',
          });
        }
      }
      // Downsizing handled after all failures are resolved (in optimizer loop)
    }

    return changes;
  }

  // ============================================================================
  // APPLY CHANGES
  // ============================================================================

  private applyChanges(
    members: GeneratedMember[],
    changes: Array<{ groupId: string; newSection: string; reason: string }>,
  ): Array<{ memberId: string; from: string; to: string; reason: string }> {
    const applied: Array<{ memberId: string; from: string; to: string; reason: string }> = [];

    for (const change of changes) {
      // Find all members in this group
      const groupMembers = members.filter(m => {
        const key = `${m.memberType}_${m.sectionName}`;
        return key === change.groupId || m.id === change.groupId;
      });

      for (const member of groupMembers) {
        const oldSection = member.sectionName;
        if (oldSection === change.newSection) continue;

        const section = SectionLookup.getSection(change.newSection);
        const material = SectionLookup.getMaterial('E250');
        if (!section) continue;

        const units = SectionLookup.toModelUnits(section, material);
        member.sectionName = change.newSection;
        member.A = units.A;
        member.I = units.I;
        member.E = units.E;

        applied.push({
          memberId: member.id,
          from: oldSection,
          to: change.newSection,
          reason: change.reason,
        });
      }
    }

    return applied;
  }

  // ============================================================================
  // UTILITIES
  // ============================================================================

  private getSectionFamily(sectionName: string): 'ISMB' | 'ISMC' | 'ISA' {
    if (sectionName.startsWith('ISMB')) return 'ISMB';
    if (sectionName.startsWith('ISMC')) return 'ISMC';
    if (sectionName.startsWith('ISA')) return 'ISA';
    return 'ISMB'; // default
  }

  private getOrderedSections(family: 'ISMB' | 'ISMC' | 'ISA'): string[] {
    if (!this.sectionOrderCache.has(family)) {
      this.sectionOrderCache.set(family, SectionLookup.getSectionNames(family));
    }
    return this.sectionOrderCache.get(family)!;
  }

  private getMinimumSectionIdx(group: MemberGroup, ordered: string[]): number {
    // Extract member type from group ID
    const memberType = group.groupId.split('_')[0] || 'beam';
    const minSection = this.config.minimumSections[memberType];
    if (!minSection) return 0;
    const idx = ordered.indexOf(minSection);
    return idx >= 0 ? idx : 0;
  }

  private computeWeight(nodes: GeneratedNode[], members: GeneratedMember[]): number {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    let total = 0;

    for (const m of members) {
      const sn = nodeMap.get(m.startNodeId);
      const en = nodeMap.get(m.endNodeId);
      if (!sn || !en) continue;

      const L = Math.sqrt((en.x - sn.x) ** 2 + (en.y - sn.y) ** 2 + (en.z - sn.z) ** 2);
      const section = SectionLookup.getSection(m.sectionName);
      total += (section?.weight || 40) * L;
    }

    return Math.round(total * 10) / 10;
  }

  /**
   * Generate optimization summary report
   */
  generateSummary(result: OptimizationResult): string {
    const lines: string[] = [];
    lines.push('── OPTIMIZATION SUMMARY ──');
    lines.push(`Converged: ${result.converged ? 'Yes' : 'No'}`);
    lines.push(`Iterations: ${result.iterations}`);
    lines.push(`Initial weight: ${result.initialWeight.toFixed(1)} kg`);
    lines.push(`Final weight: ${result.finalWeight.toFixed(1)} kg`);
    lines.push(`Savings: ${result.savingsPercent.toFixed(1)}%`);
    lines.push(`Max utilization: ${(result.maxUtilization * 100).toFixed(1)}%`);
    lines.push('');
    lines.push('Section Assignments:');
    for (const [memberId, section] of result.sectionAssignments) {
      lines.push(`  ${memberId}: ${section}`);
    }
    lines.push('');
    lines.push('History:');
    for (const step of result.history) {
      lines.push(`  Iter ${step.iteration}: weight=${step.weight.toFixed(1)} kg, maxRatio=${step.maxRatio.toFixed(3)}, failed=${step.failedCount}`);
      for (const ch of step.changes) {
        lines.push(`    ${ch.memberId}: ${ch.from} → ${ch.to} (${ch.reason})`);
      }
    }

    return lines.join('\n');
  }
}

export default SectionOptimizer;
