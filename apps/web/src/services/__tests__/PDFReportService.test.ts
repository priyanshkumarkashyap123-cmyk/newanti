/**
 * PDFReportService verification tests
 *
 * C2 exploration (re-run): confirms maxDisp is in mm after fix.
 * Preservation P5: individual dispDict entries are unchanged.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK jsPDF and jspdf-autotable
// ============================================

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

// Mock API_CONFIG
vi.mock('../../config/env', () => ({
    API_CONFIG: { pythonUrl: 'http://localhost:8000' },
}));

vi.mock('../../constants/BrandingConstants', () => ({
    BEAMLAB_COMPANY: { name: 'BeamLab', website: 'beamlab.io', email: 'hi@beamlab.io', disclaimer: '' },
    BEAMLAB_COLORS_RGB: {},
}));

import { generateBasicPDFReport } from '../PDFReportService';

// ============================================
// HELPERS
// ============================================

function makeProject(name = 'Tower A') {
    return { name, engineer: 'Test Engineer', date: '2026-01-01', description: 'Test' };
}

function makeAnalysisResults(displacements: Map<string, { dx: number; dy: number; dz: number }>) {
    return {
        displacements,
        memberForces: new Map(),
        reactions: new Map(),
        loadCases: [],
    };
}

// ============================================
// C2 EXPLORATION RE-RUN: maxDisp in mm
// ============================================

describe('C2 — generateBasicPDFReport: displacement unit conversion', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDoc.lastAutoTable = { finalY: 50 };
    });

    it('reports maxDisp as 5.000 mm when dx=0.005 m (not 0.005)', async () => {
        const displacements = new Map([
            ['N1', { dx: 0.005, dy: 0.0, dz: 0.0 }],
        ]);
        const analysisResults = makeAnalysisResults(displacements);

        await generateBasicPDFReport(
            makeProject(),
            [],
            [],
            analysisResults as any,
            new Map(),
        );

        // Find the autoTable call that contains the displacement summary row
        const allCalls = mockAutoTable.mock.calls;
        const dispCall = allCalls.find((call) => {
            const body = call[1]?.body as unknown[][];
            return body?.some((row) => {
                const rowStr = JSON.stringify(row);
                return rowStr.includes('Displacement') || rowStr.includes('displacement');
            });
        });

        expect(dispCall).toBeDefined();
        const body = dispCall![1].body as unknown[][];
        const dispRow = body.find((row) => JSON.stringify(row).toLowerCase().includes('displacement'));
        expect(dispRow).toBeDefined();

        // The value should be ~5.000 (mm), not 0.005 (raw meters)
        const valueStr = String(dispRow![1]);
        const value = parseFloat(valueStr);
        expect(value).toBeGreaterThan(1); // definitely not 0.005
        expect(value).toBeCloseTo(5.0, 1);
    });

    it('reports maxDisp as 10.000 mm when dy=0.010 m', async () => {
        const displacements = new Map([
            ['N1', { dx: 0.0, dy: 0.010, dz: 0.0 }],
        ]);
        const analysisResults = makeAnalysisResults(displacements);

        await generateBasicPDFReport(
            makeProject(),
            [],
            [],
            analysisResults as any,
            new Map(),
        );

        const allCalls = mockAutoTable.mock.calls;
        const dispCall = allCalls.find((call) => {
            const body = call[1]?.body as unknown[][];
            return body?.some((row) => JSON.stringify(row).toLowerCase().includes('displacement'));
        });

        expect(dispCall).toBeDefined();
        const body = dispCall![1].body as unknown[][];
        const dispRow = body.find((row) => JSON.stringify(row).toLowerCase().includes('displacement'));
        const value = parseFloat(String(dispRow![1]));
        expect(value).toBeCloseTo(10.0, 1);
    });
});

// ============================================
// PRESERVATION P5: unit label is "mm"
// ============================================

describe('P5 — generateBasicPDFReport: displacement unit label', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDoc.lastAutoTable = { finalY: 50 };
    });

    it('displacement row unit is "mm"', async () => {
        const displacements = new Map([
            ['N1', { dx: 0.003, dy: 0.0, dz: 0.0 }],
        ]);
        const analysisResults = makeAnalysisResults(displacements);

        await generateBasicPDFReport(
            makeProject(),
            [],
            [],
            analysisResults as any,
            new Map(),
        );

        const allCalls = mockAutoTable.mock.calls;
        const dispCall = allCalls.find((call) => {
            const body = call[1]?.body as unknown[][];
            return body?.some((row) => JSON.stringify(row).toLowerCase().includes('displacement'));
        });

        expect(dispCall).toBeDefined();
        const body = dispCall![1].body as unknown[][];
        const dispRow = body.find((row) => JSON.stringify(row).toLowerCase().includes('displacement'));
        // Unit column (index 2) should be "mm"
        expect(String(dispRow![2])).toBe('mm');
    });
});
