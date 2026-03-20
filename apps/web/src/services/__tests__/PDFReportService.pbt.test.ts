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
// HOISTED MOCKS
// ============================================

const { mockAutoTable, mockTextCalls, mockDoc } = vi.hoisted(() => {
    const mockTextCalls: string[] = [];
    const mockAutoTable = vi.fn();
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
        text: vi.fn((...args: unknown[]) => { mockTextCalls.push(String(args[0])); }),
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
    return { mockAutoTable, mockTextCalls, mockDoc };
});

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

function callGenerateQualityChecks(
    service: ComprehensiveReportService,
    analysisResults: unknown,
    designResults: unknown,
) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (service as any).generateQualityChecks(analysisResults, designResults);
}

function resetMocks() {
    mockAutoTable.mockClear();
    mockTextCalls.length = 0;
    mockDoc.lastAutoTable = { finalY: 50 };
    mockDoc.text.mockImplementation((...args: unknown[]) => {
        mockTextCalls.push(String(args[0]));
    });
    // Reset all other mock fns
    mockDoc.setFillColor.mockClear();
    mockDoc.rect.mockClear();
    mockDoc.addPage.mockClear();
    mockDoc.save.mockClear();
    mockDoc.setPage.mockClear();
}

// ============================================
// P7: Report Uses Actual Project Data
// **Validates: Requirements 9.1, 9.6**
// ============================================

describe('P7 — Report Uses Actual Project Data', () => {
    beforeEach(resetMocks);

    it('cover page uses provided projectName, not hardcoded "BeamLab Project"', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 2, maxLength: 40 }).filter(
                    (s) => s.trim().length > 1 && s.trim() === s && /[A-Za-z0-9]/.test(s) && s !== 'BeamLab Project',
                ),
                async (projectName) => {
                    resetMocks();

                    await generateBasicPDFReport(
                        makeProject(projectName, 'Test Engineer'),
                        [],
                        [],
                        null,
                        new Map(),
                    );

                    const hasProjectName = mockTextCalls.some((t) => t.includes(projectName));
                    const hasHardcoded = mockTextCalls.some((t) => t === 'BeamLab Project');

                    return hasProjectName && !hasHardcoded;
                },
            ),
            { numRuns: 15 },
        );
    });

    it('engineer name appears in document control table', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.string({ minLength: 2, maxLength: 40 }).filter(
                    (s) => s.trim().length > 1 && s.trim() === s && /[A-Za-z0-9]/.test(s) && s !== 'Engineer',
                ),
                async (engineerName) => {
                    resetMocks();

                    await generateBasicPDFReport(
                        makeProject('Test Project', engineerName),
                        [],
                        [],
                        null,
                        new Map(),
                    );

                    const expectedEngineer = engineerName
                        .replace(/[\u0000-\u001F\u007F]/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    const tableCells = mockAutoTable.mock.calls
                        .map((call) => (call[1] as { body?: unknown[][] })?.body ?? [])
                        .flat()
                        .flatMap((row) => row.map((cell) => String(cell)));
                    return tableCells.some((cell) => cell === expectedEngineer);
                },
            ),
            { numRuns: 15 },
        );
    });
});

// ============================================
// P8: Displacement Unit Conversion
// **Validates: Requirement 9.2**
// ============================================

describe('P8 — Displacement Unit Conversion', () => {
    beforeEach(resetMocks);

    it('max displacement in summary row equals max(|dx|,|dy|,|dz|)*1000 with error < 0.01 mm', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
                fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
                fc.float({ min: Math.fround(0.001), max: Math.fround(0.5), noNaN: true }),
                async (dx, dy, dz) => {
                    resetMocks();

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

                    const allCalls = mockAutoTable.mock.calls;
                    const dispCall = allCalls.find((call) => {
                        const body = (call[1] as { body?: unknown[][] })?.body;
                        return body?.some((row) => JSON.stringify(row).toLowerCase().includes('maximum displacement'));
                    });

                    if (!dispCall) return false;
                    const body = (dispCall[1] as { body: unknown[][] }).body;
                    const dispRow = body.find((row) => JSON.stringify(row).toLowerCase().includes('maximum displacement'));
                    if (!dispRow) return false;

                    const actualMm = parseFloat(String(dispRow[1]));
                    const unitLabel = String(dispRow[2]);

                    // Tolerance of 0.01 mm accounts for formatNumber(4 decimal places) rounding
                    return Math.abs(actualMm - expectedMm) < 0.01 && unitLabel === 'mm';
                },
            ),
            { numRuns: 20 },
        );
    });
});

// ============================================
// P9: Quality Checks Reflect Actual Results
// **Validates: Requirement 9.7**
// ============================================

describe('P9 — Quality Checks Reflect Actual Results', () => {
    it('driftCheck.actual reflects analysisResults.maxDrift and status is correct', () => {
        fc.assert(
            fc.property(
                fc.float({ min: Math.fround(0.001), max: Math.fround(0.02), noNaN: true }),
                (maxDrift) => {
                    const service = new ComprehensiveReportService();
                    const analysisResults = { maxDrift: { value: maxDrift } };
                    const checks = callGenerateQualityChecks(service, analysisResults, null);

                    const driftCheck = (checks as Array<{ category: string; actual: string; status: string }>)
                        .find((c) => c.category === 'Drift');

                    if (!driftCheck) return false;
                    const actualPct = parseFloat(driftCheck.actual);
                    if (Math.abs(actualPct - maxDrift * 100) >= 0.001) return false;

                    if (maxDrift > 0.004) {
                        return driftCheck.status === 'FAIL';
                    }
                    return driftCheck.status === 'PASS';
                },
            ),
            { numRuns: 50 },
        );
    });

    it('memberCheck.status is FAIL when max utilization > 1.0', () => {
        fc.assert(
            fc.property(
                fc.float({ min: Math.fround(1.001), max: Math.fround(2.0), noNaN: true }),
                (utilization) => {
                    const service = new ComprehensiveReportService();
                    const designResults = { members: [{ utilization }] };
                    const checks = callGenerateQualityChecks(service, null, designResults);

                    const memberCheck = (checks as Array<{ category: string; status: string }>)
                        .find((c) => c.category === 'Design');

                    return memberCheck?.status === 'FAIL';
                },
            ),
            { numRuns: 30 },
        );
    });

    it('memberCheck.status is PASS when max utilization <= 1.0', () => {
        fc.assert(
            fc.property(
                fc.float({ min: Math.fround(0.0), max: Math.fround(1.0), noNaN: true }),
                (utilization) => {
                    const service = new ComprehensiveReportService();
                    const designResults = { members: [{ utilization }] };
                    const checks = callGenerateQualityChecks(service, null, designResults);

                    const memberCheck = (checks as Array<{ category: string; status: string }>)
                        .find((c) => c.category === 'Design');

                    return memberCheck?.status === 'PASS';
                },
            ),
            { numRuns: 30 },
        );
    });
});
