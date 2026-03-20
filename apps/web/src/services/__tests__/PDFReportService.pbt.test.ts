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
// HOISTED MOCKS (must be before vi.mock calls)
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
