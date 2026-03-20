/**
 * Property-Based Tests for PDFReportService — Task 12
 *
 * P7: Report Uses Actual Project Data — Validates: Requirements 9.1, 9.6
 * P8: Displacement Unit Conversion — Validates: Requirement 9.2
 * P9: Quality Checks Reflect Actual Results — Validates: Requirement 9.7
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fc from 'fast-check';

// ============================================
// MOCK jsPDF and jspdf-autotable
// ============================================

const capturedAutoTableCalls: Array<[unknown, { head?: unknown[][]; body?: unknown[][] }]> = [];

const mockAutoTable = vi.fn((...args: unknown[]) => {
    capturedAutoTableCalls.push(args as [unknown, { head?: unknown[][]; body?: unknown[][] }]);
});

const mockDoc = {
    internal: {
        pageSize: { width: 210, height: 297 },
        getNumberOfPages: vi.fn(() => 1),
    },
    setFillColor: vi.fn(),
    rect: vi.fn(),
    setTextColor: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    text: vi.fn(),
    addPage: vi.fn(),
    setDrawColor: vi.fn(),
    setLineWidth: vi.fn(),
    line: vi.fn(),
    save: vi.fn(),
    output: vi.fn(() => new Uint8Array()),
    getNumberOfPages: vi.fn(() => 1),
    setPage: vi.fn(),
    lastAutoTable: { finalY: 50 },
};

vi.mock('jspdf', () => ({
    default: function MockJsPDF() { return mockDoc; },
}));

vi.mock('jspdf-autotable', () => ({
    default: mockAutoTable,
}));

vi.mock('../../config/env', () => ({
    API_CONFIG: { pythonUrl: 'http://localhost:8000' },
}));

vi.mock('../../constants/BrandingConstants', () => ({
    BEAMLAB_COMPANY: { name: 'BeamLab Ultimate', website: 'beamlab.io', email: 'hi@beamlab.io', disclaimer: '' },
    BEAMLAB_COLORS_RGB: {},
}));

import { generateBasicPDFReport } from '../PDFReportService';
import { ComprehensiveReportService } from '../ComprehensiveReportService';

// ============================================
// HELPERS
// ============================================

function makeProject(name: string, engineer: string) {
    return { name, engineer, date: '2026-01-01', description: 'Test' };
}

function makeAnalysisResults(displacements: Map<string, { dx: number; dy: number; dz: number }>) {
    return {
        displacements,
        memberForces: new Map(),
        reactions: new Map(),
        loadCases: [],
    };
}

// Access private method via type cast
function callGenerateQualityChecks(
    service: ComprehensiveReportService,
    analysisResults: unknown,
    designResults: unknown,
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (service as any).generateQualityChecks(analysisResults, designResults);
}

// ============================================
// P7: Report Uses Actual Project Data
// **Validates: Requirements 9.1, 9.6**
// ============================================

describe('P7 — Report Uses Actual Project Data', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedAutoTableCalls.length = 0;
        mockDoc.lastAutoTable = { finalY: 50 };
    });

    it('cover page uses provided projectName and engineerName, not hardcoded fallbacks', () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
                fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
                async (projectName, engineerName) => {
                    vi.clearAllMocks();
                    capturedAutoTableCalls.length = 0;
                    mockDoc.lastAutoTable = { finalY: 50 };

                    await generateBasicPDFReport(
                        makeProject(projectName, engineerName),
                        [],
                        [],
                        null,
                        new Map(),
                    );

                    // Collect all text calls
                    const textCalls = mockDoc.text.mock.calls.map((c) => String(c[0]));

                    // The project name must appear in the PDF text
                    const hasProjectName = textCalls.some((t) => t.includes(projectName));
                    expect(hasProjectName).toBe(true);

                    // The engineer name must appear in the document control table
                    const allTableBodies = capturedAutoTableCalls
                        .map((c) => c[1]?.body ?? [])
                        .flat()
                        .map((row) => JSON.stringify(row));
                    const hasEngineerName = allTableBodies.some((row) => row.includes(engineerName));
                    expect(hasEngineerName).toBe(true);

                    // Must NOT contain hardcoded fallback strings
                    const hasHardcodedProject = textCalls.some((t) => t === 'BeamLab Project');
                    expect(hasHardcodedProject).toBe(false);
                },
            ),
            { numRuns: 20 },
        );
    });
});

// ============================================
// P8: Displacement Unit Conversion
// **Validates: Requirement 9.2**
// ============================================

describe('P8 — Displacement Unit Conversion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedAutoTableCalls.length = 0;
        mockDoc.lastAutoTable = { finalY: 50 };
    });

    it('max displacement in summary row equals max(|dx|,|dy|,|dz|)*1000 with error < 0.001 mm', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 0.0001, max: 0.1, noNaN: true }),
                fc.float({ min: 0.0001, max: 0.1, noNaN: true }),
                fc.float({ min: 0.0001, max: 0.1, noNaN: true }),
                async (dx, dy, dz) => {
                    vi.clearAllMocks();
                    capturedAutoTableCalls.length = 0;
                    mockDoc.lastAutoTable = { finalY: 50 };

                    const displacements = new Map([['N1', { dx, dy, dz }]]);
                    const analysisResults = makeAnalysisResults(displacements);

                    await generateBasicPDFReport(
                        makeProject('Test', 'Eng'),
                        [],
                        [],
                        analysisResults as never,
                        new Map(),
                    );

                    const expectedMm = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) * 1000;

                    // Find the summary table with displacement row
                    const allCalls = mockAutoTable.mock.calls;
                    const dispCall = allCalls.find((call) => {
                        const body = (call[1] as { body?: unknown[][] })?.body;
                        return body?.some((row) => JSON.stringify(row).toLowerCase().includes('displacement'));
                    });

                    expect(dispCall).toBeDefined();
                    const body = (dispCall![1] as { body: unknown[][] }).body;
                    const dispRow = body.find((row) => JSON.stringify(row).toLowerCase().includes('displacement'));
                    expect(dispRow).toBeDefined();

                    const actualMm = parseFloat(String(dispRow![1]));
                    expect(Math.abs(actualMm - expectedMm)).toBeLessThan(0.001);

                    // Unit label must be "mm"
                    expect(String(dispRow![2])).toBe('mm');
                },
            ),
            { numRuns: 30 },
        );
    });
});

// ============================================
// P9: Quality Checks Reflect Actual Results
// **Validates: Requirement 9.7**
// ============================================

describe('P9 — Quality Checks Reflect Actual Results', () => {
    it('driftCheck.actual reflects analysisResults.maxDrift when both are non-null', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 0.001, max: 0.02, noNaN: true }),
                (maxDrift) => {
                    const service = new ComprehensiveReportService();
                    const analysisResults = { maxDrift: { value: maxDrift } };
                    const checks = callGenerateQualityChecks(service, analysisResults, null);

                    const driftCheck = (checks as Array<{ category: string; actual: string; status: string }>)
                        .find((c) => c.category === 'Drift');

                    expect(driftCheck).toBeDefined();
                    // actual should encode the real drift value (as percentage string)
                    const actualPct = parseFloat(driftCheck!.actual);
                    expect(Math.abs(actualPct - maxDrift * 100)).toBeLessThan(0.001);

                    // status must be FAIL when drift > 0.004
                    if (maxDrift > 0.004) {
                        expect(driftCheck!.status).toBe('FAIL');
                    } else {
                        expect(driftCheck!.status).toBe('PASS');
                    }
                },
            ),
            { numRuns: 50 },
        );
    });

    it('memberCheck.status is FAIL when max utilization > 1.0', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 1.001, max: 2.0, noNaN: true }),
                (utilization) => {
                    const service = new ComprehensiveReportService();
                    const designResults = { members: [{ utilization }] };
                    const checks = callGenerateQualityChecks(service, null, designResults);

                    const memberCheck = (checks as Array<{ category: string; status: string }>)
                        .find((c) => c.category === 'Design');

                    expect(memberCheck).toBeDefined();
                    expect(memberCheck!.status).toBe('FAIL');
                },
            ),
            { numRuns: 30 },
        );
    });

    it('memberCheck.status is PASS when max utilization <= 1.0', () => {
        fc.assert(
            fc.property(
                fc.float({ min: 0.0, max: 1.0, noNaN: true }),
                (utilization) => {
                    const service = new ComprehensiveReportService();
                    const designResults = { members: [{ utilization }] };
                    const checks = callGenerateQualityChecks(service, null, designResults);

                    const memberCheck = (checks as Array<{ category: string; status: string }>)
                        .find((c) => c.category === 'Design');

                    expect(memberCheck).toBeDefined();
                    expect(memberCheck!.status).toBe('PASS');
                },
            ),
            { numRuns: 30 },
        );
    });
});
