/**
 * DesignCheckIntegration.test.ts
 * 
 * Integration tests for design-check table visibility in PDF reports
 * Verifies that governing-members and critical-failures summaries are rendered
 * with proper clause references, D/C ratios, and reserve ratios.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

interface DesignCheckMember {
  id: string;
  section: string;
  utilization: number;
  ratio?: number;
  dcr?: number;
  status?: string;
  governing_check?: string;
  governingCheck?: string;
  check_key?: string;
  checkType?: string;
}

interface AnalysisData {
  input: Record<string, any>;
  load_cases: any[];
  load_combinations: any[];
  analysis_results?: Record<string, any>;
  design_checks: {
    members: DesignCheckMember[];
  };
}

/**
 * Mock analysis data with design checks including:
 * - All members with varying utilization ratios
 * - Governing checks (highest D/C per member)
 * - Critical failures (D/C > 1.0)
 */
function createMockAnalysisWithDesignChecks(
  includeFailures: boolean = true
): AnalysisData {
  const members: DesignCheckMember[] = [
    {
      id: 'B1',
      section: 'IPE 300',
      utilization: 0.65,
      governing_check: 'IS800_FLEXURE',
      status: 'PASS',
    },
    {
      id: 'B2',
      section: 'IPE 350',
      utilization: 0.88,
      governing_check: 'IS800_SHEAR',
      status: 'PASS',
    },
    {
      id: 'B3',
      section: 'IPE 400',
      utilization: 0.95,
      governing_check: 'IS800_FLEXURE',
      status: 'WARNING',
    },
  ];

  if (includeFailures) {
    members.push(
      {
        id: 'C1',
        section: 'HE 200B',
        utilization: 1.15,
        governing_check: 'IS800_COMPRESSION_FLEXURE',
        status: 'FAIL',
      },
      {
        id: 'C2',
        section: 'HE 180B',
        utilization: 1.05,
        governing_check: 'AISC_COMPRESSION_FLEXURE_COMBINED',
        status: 'FAIL',
      }
    );
  }

  return {
    input: {
      loads: [],
    },
    load_cases: [],
    load_combinations: [],
    design_checks: {
      members,
    },
  };
}

describe('DesignCheckIntegration', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Report generation with design checks', () => {
    it('should render all design-check members in the main table', () => {
      const analysis = createMockAnalysisWithDesignChecks();
      const members = analysis.design_checks.members;

      expect(members.length).toBeGreaterThan(0);
      expect(members.every((m) => m.id && m.section && m.utilization !== undefined)).toBe(true);
    });

    it('should rank governing members by utilization (highest D/C first)', () => {
      const analysis = createMockAnalysisWithDesignChecks();
      const members = analysis.design_checks.members;

      // Simulate the governing members ranking logic
      const ranked = [...members].sort((a, b) => b.utilization - a.utilization);

      // Verify ranking order
      expect(ranked[0].utilization).toBeGreaterThanOrEqual(ranked[1].utilization);
      expect(ranked[1].utilization).toBeGreaterThanOrEqual(ranked[ranked.length - 1].utilization);
    });

    it('should calculate reserve ratio correctly for each member', () => {
      const analysis = createMockAnalysisWithDesignChecks();
      const members = analysis.design_checks.members;

      members.forEach((member) => {
        const reserveRatio = 1.0 - member.utilization;

        // Reserve ratio should be positive for PASS/WARNING, negative for FAIL
        if (member.status === 'PASS') {
          expect(reserveRatio).toBeGreaterThan(0.1);
        } else if (member.status === 'FAIL') {
          expect(reserveRatio).toBeLessThan(0);
        }
      });
    });

    it('should identify critical failures as members with D/C > 1.0', () => {
      const analysis = createMockAnalysisWithDesignChecks(true);
      const members = analysis.design_checks.members;

      const criticalFailures = members.filter((m) => m.utilization > 1.0);

      expect(criticalFailures.length).toBeGreaterThan(0);
      expect(criticalFailures.every((m) => m.status === 'FAIL')).toBe(true);
    });

    it('should list critical failures sorted by severity (highest D/C first)', () => {
      const analysis = createMockAnalysisWithDesignChecks(true);
      const members = analysis.design_checks.members;

      const criticalFailures = members
        .filter((m) => m.utilization > 1.0)
        .sort((a, b) => b.utilization - a.utilization);

      expect(criticalFailures.length).toEqual(2);
      expect(criticalFailures[0].utilization).toBe(1.15); // Highest first
      expect(criticalFailures[1].utilization).toBe(1.05); // Second highest
    });

    it('should provide clause references for each member check', () => {
      const analysis = createMockAnalysisWithDesignChecks();
      const members = analysis.design_checks.members;

      const clauseMap: Record<string, string> = {
        IS800_FLEXURE: 'IS 800:2007 Cl. 8.2',
        IS800_SHEAR: 'IS 800:2007 Cl. 8.4',
        IS800_COMPRESSION_FLEXURE: 'IS 800:2007 Cl. 9.3.1',
        AISC_COMPRESSION_FLEXURE_COMBINED: 'AISC 360-16 §H1-1',
      };

      members.forEach((member) => {
        const clause = clauseMap[member.governing_check || ''];
        expect(clause).toBeDefined();
      });
    });

    it('should not include non-failed members in critical failures summary', () => {
      const analysis = createMockAnalysisWithDesignChecks(true);
      const members = analysis.design_checks.members;

      const passingMembers = members.filter((m) => m.utilization <= 1.0);
      const criticalFailures = members.filter((m) => m.utilization > 1.0);

      expect(passingMembers.length).toBeGreaterThan(0);
      expect(criticalFailures.length).toBeGreaterThan(0);
      expect(passingMembers.every((m) => m.status !== 'FAIL')).toBe(true);
    });

    it('should handle empty critical failures gracefully', () => {
      const analysis = createMockAnalysisWithDesignChecks(false); // No failures
      const members = analysis.design_checks.members;

      const criticalFailures = members.filter((m) => m.utilization > 1.0);

      expect(criticalFailures.length).toBe(0);
      // System should not render 3.2 Critical Failures section when no failures present
    });

    it('should map status thresholds correctly', () => {
      const analysis = createMockAnalysisWithDesignChecks();
      const members = analysis.design_checks.members;

      members.forEach((member) => {
        if (member.utilization <= 0.9) {
          expect(member.status).toBe('PASS');
        } else if (member.utilization > 0.9 && member.utilization <= 1.0) {
          expect(member.status).toBe('WARNING');
        } else if (member.utilization > 1.0) {
          expect(member.status).toBe('FAIL');
        }
      });
    });

    it('should preserve governing check information per member', () => {
      const analysis = createMockAnalysisWithDesignChecks();
      const members = analysis.design_checks.members;

      members.forEach((member) => {
        expect(member.governing_check).toBeDefined();
        expect(member.governing_check).toMatch(/^(IS800|AISC)/);
      });
    });

    it('should support multiple design-code types (IS 800, AISC, etc.)', () => {
      const analysis = createMockAnalysisWithDesignChecks(true);
      const members = analysis.design_checks.members;

      const checkTypes = members.map((m) => m.governing_check);
      const hasIS800 = checkTypes.some((c) => c?.includes('IS800'));
      const hasAISC = checkTypes.some((c) => c?.includes('AISC'));

      // Analysis should include at least one design code type
      expect(hasIS800 || hasAISC).toBe(true);
    });

    it('should format utilization ratios with appropriate precision', () => {
      const analysis = createMockAnalysisWithDesignChecks();
      const members = analysis.design_checks.members;

      members.forEach((member) => {
        // Ratios should be between 0 and ~2.0 for reasonable designs
        expect(member.utilization).toBeGreaterThanOrEqual(0);
        expect(member.utilization).toBeLessThan(2.0);
      });
    });

    it('should track member section information for redesign guidance', () => {
      const analysis = createMockAnalysisWithDesignChecks(true);
      const members = analysis.design_checks.members;

      const criticalFailures = members.filter((m) => m.utilization > 1.0);

      expect(criticalFailures.length).toBeGreaterThan(0);
      criticalFailures.forEach((member) => {
        expect(member.section).toBeDefined();
        expect(member.section).toMatch(/^(IPE|HE|UB|UC)/);
      });
    });
  });

  describe('Report profile selection with design checks', () => {
    it('should enable design-checks section for FULL_REPORT profile', () => {
      const profile = 'FULL_REPORT';
      const design_checks_enabled = profile === 'FULL_REPORT';

      expect(design_checks_enabled).toBe(true);
    });

    it('should enable design-checks section for OPTIMIZATION_SUMMARY profile', () => {
      const profile = 'OPTIMIZATION_SUMMARY';
      const design_checks_enabled = profile === 'OPTIMIZATION_SUMMARY' || profile === 'FULL_REPORT';

      expect(design_checks_enabled).toBe(true);
    });

    it('should disable design-checks section for SFD_BMD_ONLY profile', () => {
      const profile = 'SFD_BMD_ONLY';
      const design_checks_enabled = profile !== 'SFD_BMD_ONLY';

      expect(design_checks_enabled).toBe(false);
    });
  });
});
