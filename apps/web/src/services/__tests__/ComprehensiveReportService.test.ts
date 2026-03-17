/**
 * ComprehensiveReportService verification tests
 *
 * C4 exploration (re-run): confirms generateQualityChecks derives from actual results.
 * Preservation P8: generateQualityChecks(null, null) returns [] without throwing.
 */

import { describe, it, expect, vi } from 'vitest';

// ============================================
// MOCK DEPENDENCIES
// ============================================

vi.mock('../../modules/reporting/DetailedReportEngine', () => ({
    DetailedReportEngine: vi.fn().mockImplementation(() => ({
        generate: vi.fn().mockResolvedValue(new Blob()),
    })),
    createDetailedReport: vi.fn().mockResolvedValue(new Blob()),
}));

vi.mock('../../modules/reporting/CalculationSheetGenerator', () => ({
    CalculationSheetGenerator: vi.fn().mockImplementation(() => ({
        generate: vi.fn().mockResolvedValue(new Blob()),
    })),
    createCalculationSheet: vi.fn().mockResolvedValue(new Blob()),
}));

vi.mock('../../modules/reporting/CodeComplianceReportGenerator', () => ({
    CodeComplianceReportGenerator: vi.fn().mockImplementation(() => ({
        generate: vi.fn().mockResolvedValue(new Blob()),
    })),
    createCodeComplianceReport: vi.fn().mockResolvedValue(new Blob()),
}));

import { ComprehensiveReportService } from '../ComprehensiveReportService';

// Helper to access private method via type cast
function callGenerateQualityChecks(
    service: ComprehensiveReportService,
    analysisResults: unknown,
    designResults: unknown,
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (service as any).generateQualityChecks(analysisResults, designResults);
}

// ============================================
// C4 EXPLORATION RE-RUN: drift check FAIL
// ============================================

describe('C4 — generateQualityChecks: derives from actual results', () => {
    it('drift check status is FAIL when maxDrift=0.006 (> 0.004 limit)', () => {
        const service = new ComprehensiveReportService();
        const analysisResults = {
            maxDrift: { value: 0.006 },
        };

        const checks = callGenerateQualityChecks(service, analysisResults, null);

        const driftCheck = checks.find((c: { category: string }) => c.category === 'Drift');
        expect(driftCheck).toBeDefined();
        expect(driftCheck.status).toBe('FAIL');
    });

    it('drift check status is PASS when maxDrift=0.002 (< 0.004 limit)', () => {
        const service = new ComprehensiveReportService();
        const analysisResults = {
            maxDrift: { value: 0.002 },
        };

        const checks = callGenerateQualityChecks(service, analysisResults, null);

        const driftCheck = checks.find((c: { category: string }) => c.category === 'Drift');
        expect(driftCheck).toBeDefined();
        expect(driftCheck.status).toBe('PASS');
    });

    it('drift check actual value reflects the input maxDrift', () => {
        const service = new ComprehensiveReportService();
        const analysisResults = {
            maxDrift: { value: 0.006 },
        };

        const checks = callGenerateQualityChecks(service, analysisResults, null);

        const driftCheck = checks.find((c: { category: string }) => c.category === 'Drift');
        // actual should contain "0.600%" (0.006 * 100)
        expect(driftCheck.actual).toContain('0.600');
    });

    it('member check is FAIL when max utilization > 1.0', () => {
        const service = new ComprehensiveReportService();
        const designResults = {
            members: [
                { utilization: 0.8 },
                { utilization: 1.2 },
            ],
        };

        const checks = callGenerateQualityChecks(service, null, designResults);

        const memberCheck = checks.find((c: { category: string }) => c.category === 'Design');
        expect(memberCheck).toBeDefined();
        expect(memberCheck.status).toBe('FAIL');
    });

    it('member check is PASS when all utilizations <= 1.0', () => {
        const service = new ComprehensiveReportService();
        const designResults = {
            members: [
                { utilization: 0.7 },
                { utilization: 0.95 },
            ],
        };

        const checks = callGenerateQualityChecks(service, null, designResults);

        const memberCheck = checks.find((c: { category: string }) => c.category === 'Design');
        expect(memberCheck).toBeDefined();
        expect(memberCheck.status).toBe('PASS');
    });
});

// ============================================
// PRESERVATION P8: null/null returns []
// ============================================

describe('P8 — generateQualityChecks: null inputs return empty array', () => {
    it('returns [] without throwing when both params are null', () => {
        const service = new ComprehensiveReportService();
        expect(() => {
            const result = callGenerateQualityChecks(service, null, null);
            expect(result).toEqual([]);
        }).not.toThrow();
    });

    it('returns [] without throwing when both params are undefined', () => {
        const service = new ComprehensiveReportService();
        expect(() => {
            const result = callGenerateQualityChecks(service, undefined, undefined);
            expect(result).toEqual([]);
        }).not.toThrow();
    });
});
