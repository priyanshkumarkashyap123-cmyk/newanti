/**
 * C2 & C3 — ReportsPage bug condition exploration tests
 *
 * These tests MUST FAIL on unfixed code — failure confirms the bugs exist.
 * DO NOT fix the source code or the tests when they fail.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ── Mock heavy / side-effectful dependencies ──────────────────────────────

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement('a', { href: to }, children),
}));

vi.mock('../../store/model', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../store/model')>();
  return {
    ...actual,
    useModelStore: vi.fn((selector: (s: any) => any) => {
      const state = {
        nodes: new Map(),
        members: new Map(),
        analysisResults: null,
        loads: [],
        memberLoads: [],
        loadCases: [],
        loadCombinations: [],
        modalResults: null,
        projectInfo: { name: 'Tower A' },
      };
      return selector(state);
    }),
  };
});

vi.mock('../../providers/AuthProvider', () => ({
  useAuth: () => ({ user: { firstName: 'Test Engineer' }, isLoaded: true, isSignedIn: true }),
}));

vi.mock('../../components/branding/Logo', () => ({
  Logo: () => null,
}));

vi.mock('../../components/reports/UnifiedReportTemplate', () => ({
  ReportStatusPill: () => null,
}));

vi.mock('../../services/DXFExportService', () => ({
  generateDXF: vi.fn(),
  downloadDXF: vi.fn(),
}));

vi.mock('../../services/IFCExportService', () => ({
  generateIFC: vi.fn(() => ''),
  downloadIFC: vi.fn(),
}));

vi.mock('../../services/ExcelExportService', () => ({
  exportProjectData: vi.fn(),
}));

vi.mock('../../data/SectionDatabase', () => ({
  STEEL_SECTIONS: [],
}));

// PDFReportService mock — vi.fn() inline so hoisting works
vi.mock('../../services/PDFReportService', () => ({
  generateProfessionalReport: vi.fn().mockResolvedValue(undefined),
  generateDesignReport: vi.fn(),
}));

// ── Import component and mocked module AFTER mocks are set up ─────────────

import ReportsPage from '../ReportsPage';
import * as PDFReportService from '../../services/PDFReportService';

// ── Tests ─────────────────────────────────────────────────────────────────

describe('C2 — ReportsPage cover page title bug condition exploration', () => {
  it('cover <h2> should display "Tower A" from store (will FAIL on unfixed code — shows "BeamLab Project")', () => {
    render(<ReportsPage />);

    // The cover page h2 should show the project name from the store
    // On unfixed code it shows the hardcoded literal "BeamLab Project"
    const heading = screen.getByRole('heading', { level: 2, name: 'Tower A' });
    expect(heading).toBeTruthy();
    expect(heading.textContent).toBe('Tower A');
  });
});

describe('C3 — ReportsPage PDF export handler bug condition exploration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PDFReportService.generateProfessionalReport).mockResolvedValue(undefined);
  });

  it('handleExportPDF should pass name "Tower A" to generateProfessionalReport (will FAIL on unfixed code — passes "BeamLab Project")', async () => {
    render(<ReportsPage />);

    const downloadBtn = screen.getByRole('button', { name: /Download PDF/i });
    fireEvent.click(downloadBtn);

    await waitFor(() => {
      expect(PDFReportService.generateProfessionalReport).toHaveBeenCalled();
    });

    const callArg = vi.mocked(PDFReportService.generateProfessionalReport).mock.calls[0][0];
    expect(callArg.name).toBe('Tower A');
  });
});
