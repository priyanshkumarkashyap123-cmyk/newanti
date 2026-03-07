/**
 * ClauseTracedReportGenerator — PE-ready calculation reports with full
 * equation derivation and clause traceability for municipal submission.
 *
 * What this adds over PEReadyReportGenerator:
 *   1. Live design check results per member (not hardcoded samples)
 *   2. Complete step-by-step equation → substitution → result for EVERY check
 *   3. Clause + sub-clause cross-references in every calculation
 *   4. Markdown + PDF-ready plain-text output
 *   5. Auto-generated "Executive Summary of Checks" table
 *   6. Per-member, per-load-case trace audit trail
 *
 * Compatible with:
 *   - CalculationTraceabilityEngine (equation steps)
 *   - PEReadyReportGenerator (report options, member summary interfaces)
 *   - ReportGeneratorService (report config, section types)
 *   - ReportingService (jsPDF integration)
 *
 * @module services/reports/ClauseTracedReportGenerator
 */

import {
  type DesignCodeId,
  type MaterialInputs,
  type MemberDesignInput,
  type MemberTraceReport,
  type SectionInputs,
  type TracedCalculation,
  type Verdict,
  generateMemberTraceReport,
  formatTraceReportMarkdown,
  formatTraceReportPlainText,
} from './CalculationTraceabilityEngine';

// ─── Types ──────────────────────────────────────────────────────────

export interface TracedReportProject {
  name: string;
  number: string;
  client: string;
  address?: string;
  description?: string;
}

export interface TracedReportEngineer {
  name: string;
  licenseNo?: string;
  company?: string;
  email?: string;
  checker?: string;
  checkerLicenseNo?: string;
}

export interface TracedReportOptions {
  project: TracedReportProject;
  engineer: TracedReportEngineer;
  date: Date;
  designCode: DesignCodeId;
  material: MaterialInputs;
  /** Include governing equations or just summary */
  includeEquations: boolean;
  /** Include step-by-step substitutions */
  includeSubstitutions: boolean;
  /** Include load combination table */
  includeLoadCombinations: boolean;
  /** Embed result in LaTeX math notation */
  latexMath: boolean;
  /** Output format */
  outputFormat: 'markdown' | 'plaintext' | 'latex';
  /** Add page breaks between members */
  pageBreaks: boolean;
  /** Revision ID */
  revision?: string;
  /** Additional notes */
  notes?: string;
}

export interface TracedReportMember {
  input: MemberDesignInput;
  section: SectionInputs;
}

export interface TracedReportResult {
  /** Full report text (Markdown, plain text, or LaTeX) */
  content: string;
  /** All traced calculations (programmatic access) */
  memberReports: MemberTraceReport[];
  /** Summary statistics */
  summary: TracedReportSummary;
  /** Generated at */
  timestamp: number;
  /** Report revision */
  revision: string;
}

export interface TracedReportSummary {
  totalMembers: number;
  totalChecks: number;
  passed: number;
  failed: number;
  warnings: number;
  maxUtilization: number;
  governingMember: string;
  governingCheck: string;
}

// ─── Generator Class ────────────────────────────────────────────────

export class ClauseTracedReportGenerator {
  /**
   * Generate a complete clause-traced PE-ready calculation report.
   */
  generate(
    members: TracedReportMember[],
    loadCases: LoadCaseInfo[],
    options: TracedReportOptions,
  ): TracedReportResult {
    // 1. Run traced calculations for every member
    const memberReports: MemberTraceReport[] = members.map(m =>
      generateMemberTraceReport(m.input, m.section, options.material, options.designCode),
    );

    // 2. Compile summary
    const summary = this.buildSummary(memberReports);

    // 3. Build report
    let content: string;
    switch (options.outputFormat) {
      case 'latex':
        content = this.buildLaTeX(memberReports, loadCases, options, summary);
        break;
      case 'plaintext':
        content = this.buildPlainText(memberReports, loadCases, options, summary);
        break;
      default:
        content = this.buildMarkdown(memberReports, loadCases, options, summary);
    }

    return {
      content,
      memberReports,
      summary,
      timestamp: Date.now(),
      revision: options.revision ?? 'R0',
    };
  }

  // ─── Summary Builder ────────────────────────────────────────────

  private buildSummary(reports: MemberTraceReport[]): TracedReportSummary {
    let totalChecks = 0;
    let passed = 0;
    let failed = 0;
    let warnings = 0;
    let maxUtil = 0;
    let governingMember = '';
    let governingCheck = '';

    for (const r of reports) {
      for (const c of r.checks) {
        totalChecks++;
        if (c.verdict === 'PASS') passed++;
        else if (c.verdict === 'FAIL') failed++;
        else warnings++;

        if (c.utilization > maxUtil) {
          maxUtil = c.utilization;
          governingMember = r.memberId;
          governingCheck = c.title;
        }
      }
    }

    return {
      totalMembers: reports.length,
      totalChecks,
      passed,
      failed,
      warnings,
      maxUtilization: maxUtil,
      governingMember,
      governingCheck,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MARKDOWN Output
  // ═══════════════════════════════════════════════════════════════════

  private buildMarkdown(
    reports: MemberTraceReport[],
    loadCases: LoadCaseInfo[],
    opts: TracedReportOptions,
    summary: TracedReportSummary,
  ): string {
    const lines: string[] = [];

    // ── Cover
    lines.push('# STRUCTURAL CALCULATION REPORT');
    lines.push('');
    lines.push(`**Project:** ${opts.project.name}  `);
    lines.push(`**Project No:** ${opts.project.number}  `);
    lines.push(`**Client:** ${opts.project.client}  `);
    if (opts.project.address) lines.push(`**Address:** ${opts.project.address}  `);
    lines.push(`**Design Code:** ${codeFullName(opts.designCode)}  `);
    lines.push(`**Date:** ${opts.date.toLocaleDateString()}  `);
    lines.push(`**Revision:** ${opts.revision ?? 'R0'}  `);
    lines.push('');
    lines.push(`**Prepared by:** ${opts.engineer.name}${opts.engineer.licenseNo ? `, PE #${opts.engineer.licenseNo}` : ''}  `);
    if (opts.engineer.checker) {
      lines.push(`**Checked by:** ${opts.engineer.checker}${opts.engineer.checkerLicenseNo ? `, PE #${opts.engineer.checkerLicenseNo}` : ''}  `);
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // ── Table of Contents
    lines.push('## Table of Contents');
    lines.push('');
    lines.push('1. [Design Basis](#1-design-basis)');
    lines.push('2. [Load Combinations](#2-load-combinations)');
    lines.push('3. [Executive Summary of Checks](#3-executive-summary)');
    lines.push('4. [Detailed Member Calculations](#4-detailed-calculations)');
    lines.push('5. [Conclusion & Certification](#5-conclusion)');
    lines.push('');
    lines.push('---');
    lines.push('');

    // ── 1. Design Basis
    lines.push('## 1. Design Basis');
    lines.push('');
    lines.push('### 1.1 Applicable Codes');
    for (const ref of codeReferences(opts.designCode)) {
      lines.push(`- ${ref}`);
    }
    lines.push('');
    lines.push('### 1.2 Material Properties');
    lines.push('');
    lines.push('| Property | Value |');
    lines.push('|----------|-------|');
    lines.push(`| Yield Strength ($f_y$) | ${opts.material.fy} MPa |`);
    if (opts.material.fu) lines.push(`| Ultimate Strength ($f_u$) | ${opts.material.fu} MPa |`);
    lines.push(`| Elastic Modulus ($E$) | ${(opts.material.E).toLocaleString()} MPa |`);
    if (opts.material.fck) lines.push(`| Concrete Strength ($f_{ck}$) | ${opts.material.fck} MPa |`);
    lines.push('');
    lines.push('### 1.3 Partial Safety Factors');
    lines.push('');
    lines.push(safetyFactorsMarkdown(opts.designCode, opts.material));
    lines.push('');
    lines.push('---');
    lines.push('');

    // ── 2. Load Combinations
    if (opts.includeLoadCombinations && loadCases.length > 0) {
      lines.push('## 2. Load Combinations');
      lines.push('');
      lines.push('| # | Load Case | Type | Factors |');
      lines.push('|---|-----------|------|---------|');
      loadCases.forEach((lc, i) => {
        lines.push(`| ${i + 1} | ${lc.name} | ${lc.type} | ${lc.factors} |`);
      });
      lines.push('');
      lines.push('---');
      lines.push('');
    }

    // ── 3. Executive Summary of Checks
    lines.push('## 3. Executive Summary of Checks');
    lines.push('');
    lines.push(`Total members: **${summary.totalMembers}** | Total checks: **${summary.totalChecks}**`);
    lines.push(`Passed: **${summary.passed}** | Failed: **${summary.failed}** | Warnings: **${summary.warnings}**`);
    lines.push(`Governing member: **${summary.governingMember}** — ${summary.governingCheck} (${(summary.maxUtilization * 100).toFixed(1)}%)`);
    lines.push('');
    lines.push('| Member | Section | Check | Clause | Demand | Capacity | Util (%) | Verdict |');
    lines.push('|--------|---------|-------|--------|--------|----------|----------|---------|');
    for (const r of reports) {
      for (const c of r.checks) {
        const util = (c.utilization * 100).toFixed(1);
        lines.push(`| ${r.memberId} | ${r.sectionName} | ${c.title} | ${c.governingClause} | ${c.demand.toFixed(1)} | ${c.capacity.toFixed(1)} | ${util} | **${c.verdict}** |`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // ── 4. Detailed Calculations
    lines.push('## 4. Detailed Member Calculations');
    lines.push('');
    if (opts.includeEquations) {
      for (const report of reports) {
        lines.push(this.formatMemberMarkdown(report, opts));
        if (opts.pageBreaks) lines.push('\n---\n');
      }
    } else {
      lines.push('*Detailed equations omitted per report options.*');
      lines.push('');
    }

    // ── 5. Conclusion
    lines.push('## 5. Conclusion & Certification');
    lines.push('');
    if (summary.failed === 0) {
      lines.push('All structural members have been designed in accordance with the applicable');
      lines.push(`design code (${codeFullName(opts.designCode)}) and have **adequate capacity**`);
      lines.push('for the specified factored loads.');
      lines.push('');
      lines.push('The structure as designed is **ADEQUATE** for the intended use.');
    } else {
      lines.push(`**WARNING:** ${summary.failed} design check(s) do not satisfy the code requirements.`);
      lines.push('Redesign of the following members is required before certification can be issued:');
      lines.push('');
      for (const r of reports) {
        for (const c of r.checks) {
          if (c.verdict === 'FAIL') {
            lines.push(`- **${r.memberId}** — ${c.title} (${c.governingClause}): Util = ${(c.utilization * 100).toFixed(1)}%`);
          }
        }
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('### Professional Engineer Certification');
    lines.push('');
    lines.push('I hereby certify that these structural calculations have been prepared by me');
    lines.push('or under my direct supervision and that I am a duly licensed Professional');
    lines.push('Engineer under the laws of the applicable jurisdiction.');
    lines.push('');
    lines.push(`**Engineer:** ${opts.engineer.name}  `);
    if (opts.engineer.licenseNo) lines.push(`**License No:** ${opts.engineer.licenseNo}  `);
    lines.push(`**Date:** ${opts.date.toLocaleDateString()}  `);
    lines.push('');
    lines.push('_________________________________');
    lines.push('Signature & PE Seal');
    lines.push('');

    if (opts.notes) {
      lines.push('---');
      lines.push('');
      lines.push('### Notes');
      lines.push(opts.notes);
    }

    return lines.join('\n');
  }

  private formatMemberMarkdown(report: MemberTraceReport, opts: TracedReportOptions): string {
    if (opts.includeSubstitutions) {
      // Full trace with every substitution step
      return formatTraceReportMarkdown(report);
    }

    // Condensed: equation + result only
    const lines: string[] = [];
    lines.push(`### Member ${report.memberId} — ${report.sectionName}`);
    lines.push(`**Governing:** ${report.governingCheck} | **Util:** ${(report.maxUtilization * 100).toFixed(1)}% — **${report.overallVerdict}**`);
    lines.push('');

    for (const check of report.checks) {
      lines.push(`#### ${check.title} *(${check.governingClause})*`);
      lines.push('');
      for (const s of check.steps) {
        lines.push(`- **${s.description}** *(${s.clauseRef})*: $${s.equation}$ → **${s.result}**`);
      }
      lines.push('');
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PLAIN TEXT Output (for jsPDF)
  // ═══════════════════════════════════════════════════════════════════

  private buildPlainText(
    reports: MemberTraceReport[],
    loadCases: LoadCaseInfo[],
    opts: TracedReportOptions,
    summary: TracedReportSummary,
  ): string {
    const hr = '═'.repeat(80);
    const hrl = '─'.repeat(80);
    const lines: string[] = [];

    lines.push(hr);
    lines.push('                    STRUCTURAL CALCULATION REPORT');
    lines.push(hr);
    lines.push('');
    lines.push(`PROJECT:        ${opts.project.name}`);
    lines.push(`PROJECT NO:     ${opts.project.number}`);
    lines.push(`CLIENT:         ${opts.project.client}`);
    lines.push(`DESIGN CODE:    ${codeFullName(opts.designCode)}`);
    lines.push(`DATE:           ${opts.date.toLocaleDateString()}`);
    lines.push(`REVISION:       ${opts.revision ?? 'R0'}`);
    lines.push('');
    lines.push(`PREPARED BY:    ${opts.engineer.name}`);
    if (opts.engineer.checker) lines.push(`CHECKED BY:     ${opts.engineer.checker}`);
    lines.push('');
    lines.push(hr);
    lines.push('');

    // Summary
    lines.push('EXECUTIVE SUMMARY OF CHECKS');
    lines.push(hrl);
    lines.push(`Total Members: ${summary.totalMembers}    Total Checks: ${summary.totalChecks}`);
    lines.push(`Passed: ${summary.passed}    Failed: ${summary.failed}    Warnings: ${summary.warnings}`);
    lines.push(`Governing: ${summary.governingMember} — ${summary.governingCheck} (${(summary.maxUtilization * 100).toFixed(1)}%)`);
    lines.push('');

    for (const r of reports) {
      for (const c of r.checks) {
        const util = (c.utilization * 100).toFixed(1).padStart(6);
        lines.push(`  ${r.memberId.padEnd(8)} ${c.title.padEnd(35)} ${c.governingClause.padEnd(25)} ${util}%  ${c.verdict}`);
      }
    }
    lines.push('');
    lines.push(hr);
    lines.push('');

    // Detailed calculations
    if (opts.includeEquations) {
      lines.push('DETAILED MEMBER CALCULATIONS');
      lines.push(hr);
      lines.push('');
      for (const report of reports) {
        lines.push(formatTraceReportPlainText(report));
        lines.push('');
      }
    }

    // Conclusion
    lines.push(hr);
    lines.push('CONCLUSION');
    lines.push(hrl);
    if (summary.failed === 0) {
      lines.push('All structural members have been designed in accordance with the applicable');
      lines.push(`design code (${codeFullName(opts.designCode)}) and have adequate capacity`);
      lines.push('for the specified factored loads.');
      lines.push('');
      lines.push('The structure as designed is ADEQUATE for the intended use.');
    } else {
      lines.push(`WARNING: ${summary.failed} design check(s) do not satisfy the code requirements.`);
    }
    lines.push('');
    lines.push(hr);
    lines.push('PROFESSIONAL ENGINEER CERTIFICATION');
    lines.push(hrl);
    lines.push('');
    lines.push('I hereby certify that these structural calculations have been prepared by me');
    lines.push('or under my direct supervision.');
    lines.push('');
    lines.push(`Engineer: ${opts.engineer.name}`);
    if (opts.engineer.licenseNo) lines.push(`License No: ${opts.engineer.licenseNo}`);
    lines.push(`Date: ${opts.date.toLocaleDateString()}`);
    lines.push('');
    lines.push('_________________________________');
    lines.push('Signature & PE Seal');
    lines.push('');

    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  LaTeX Output
  // ═══════════════════════════════════════════════════════════════════

  private buildLaTeX(
    reports: MemberTraceReport[],
    loadCases: LoadCaseInfo[],
    opts: TracedReportOptions,
    summary: TracedReportSummary,
  ): string {
    const lines: string[] = [];

    lines.push('\\documentclass[11pt,a4paper]{article}');
    lines.push('\\usepackage{amsmath,amssymb,booktabs,geometry,fancyhdr,longtable}');
    lines.push('\\geometry{margin=25mm}');
    lines.push('\\pagestyle{fancy}');
    lines.push(`\\lhead{${esc(opts.project.name)} — ${esc(opts.project.number)}}`);
    lines.push(`\\rhead{${esc(codeFullName(opts.designCode))}}`);
    lines.push(`\\lfoot{Prepared by ${esc(opts.engineer.name)}}`);
    lines.push(`\\rfoot{\\thepage}`);
    lines.push('');
    lines.push('\\begin{document}');
    lines.push('');

    // Title
    lines.push('\\begin{center}');
    lines.push('{\\LARGE\\bfseries STRUCTURAL CALCULATION REPORT}\\\\[6pt]');
    lines.push(`{\\large ${esc(opts.project.name)}}\\\\[3pt]`);
    lines.push(`Project No: ${esc(opts.project.number)} \\quad Client: ${esc(opts.project.client)}\\\\[3pt]`);
    lines.push(`Design Code: ${esc(codeFullName(opts.designCode))} \\quad Rev: ${esc(opts.revision ?? 'R0')}\\\\[3pt]`);
    lines.push(`Date: ${opts.date.toLocaleDateString()}`);
    lines.push('\\end{center}');
    lines.push('\\vspace{1cm}');
    lines.push('');

    // Executive Summary Table
    lines.push('\\section{Executive Summary of Checks}');
    lines.push('');
    lines.push('\\begin{longtable}{llllrrrl}');
    lines.push('\\toprule');
    lines.push('Member & Section & Check & Clause & Demand & Capacity & Util (\\%) & Verdict \\\\');
    lines.push('\\midrule');
    lines.push('\\endhead');
    for (const r of reports) {
      for (const c of r.checks) {
        const util = (c.utilization * 100).toFixed(1);
        lines.push(`${esc(r.memberId)} & ${esc(r.sectionName)} & ${esc(c.title)} & ${esc(c.governingClause)} & ${c.demand.toFixed(1)} & ${c.capacity.toFixed(1)} & ${util} & \\textbf{${c.verdict}} \\\\`);
      }
    }
    lines.push('\\bottomrule');
    lines.push('\\end{longtable}');
    lines.push('');

    // Detailed Calculations
    if (opts.includeEquations) {
      lines.push('\\section{Detailed Member Calculations}');
      lines.push('');
      for (const report of reports) {
        lines.push(`\\subsection{Member ${esc(report.memberId)} --- ${esc(report.sectionName)}}`);
        lines.push('');
        for (const check of report.checks) {
          lines.push(`\\subsubsection{${esc(check.title)} \\hfill ${esc(check.governingClause)}}`);
          lines.push('');
          lines.push(`Demand: ${check.demand.toFixed(1)} \\quad Capacity: ${check.capacity.toFixed(1)} \\quad Utilization: ${(check.utilization * 100).toFixed(1)}\\% \\quad \\textbf{${check.verdict}}`);
          lines.push('');

          for (const s of check.steps) {
            lines.push(`\\noindent\\textbf{Step ${s.step}: ${esc(s.description)}} \\hfill \\textit{${esc(s.clauseRef)}}`);
            lines.push('\\begin{equation}');
            lines.push(`  ${s.equation}`);
            lines.push('\\end{equation}');
            if (opts.includeSubstitutions) {
              lines.push(`\\noindent \\textit{Substitution:} ${esc(s.substitution)}`);
              lines.push('');
            }
            lines.push(`\\noindent \\textbf{Result:} ${esc(s.result)}`);
            lines.push('');
          }

          lines.push('\\vspace{6pt}\\hrule\\vspace{6pt}');
          lines.push('');
        }
        if (opts.pageBreaks) lines.push('\\newpage');
      }
    }

    // Conclusion
    lines.push('\\section{Conclusion \\& Certification}');
    lines.push('');
    if (summary.failed === 0) {
      lines.push('All structural members have been designed in accordance with the applicable');
      lines.push(`design code (${esc(codeFullName(opts.designCode))}) and have \\textbf{adequate capacity}`);
      lines.push('for the specified factored loads.');
    } else {
      lines.push(`\\textbf{WARNING:} ${summary.failed} design check(s) do not satisfy the code requirements.`);
    }
    lines.push('');
    lines.push('\\vspace{2cm}');
    lines.push(`Prepared by: ${esc(opts.engineer.name)}`);
    if (opts.engineer.licenseNo) lines.push(` \\quad PE License No: ${esc(opts.engineer.licenseNo)}`);
    lines.push('');
    lines.push('\\vspace{1cm}');
    lines.push('\\rule{6cm}{0.5pt} \\quad Date: \\rule{4cm}{0.5pt}');
    lines.push('');
    lines.push('\\end{document}');

    return lines.join('\n');
  }
}

// ─── Load Case Info ─────────────────────────────────────────────────

export interface LoadCaseInfo {
  name: string;
  type: 'Strength' | 'Service' | 'Seismic' | 'Wind' | 'Factored';
  factors: string;
  description?: string;
}

// ─── Helper Functions ───────────────────────────────────────────────

function codeFullName(code: DesignCodeId): string {
  const names: Record<DesignCodeId, string> = {
    IS800_2007: 'IS 800:2007 — General Construction in Steel',
    IS456_2000: 'IS 456:2000 — Plain and Reinforced Concrete',
    AISC360_22: 'AISC 360-22 — Specification for Structural Steel Buildings',
    ACI318_19: 'ACI 318-19 — Building Code for Structural Concrete',
    EN1993_1_1: 'EN 1993-1-1 — Design of Steel Structures',
    EN1992_1_1: 'EN 1992-1-1 — Design of Concrete Structures',
  };
  return names[code] ?? code;
}

function codeReferences(code: DesignCodeId): string[] {
  const refs: Record<string, string[]> = {
    IS800_2007: [
      'IS 800:2007 — General Construction in Steel',
      'IS 875 (Part 1-5) — Code of Practice for Design Loads',
      'IS 1893:2016 — Earthquake Resistant Design',
      'SP 6(1):1964 — Handbook for Structural Engineers',
    ],
    IS456_2000: [
      'IS 456:2000 — Plain and Reinforced Concrete',
      'IS 875 (Part 1-5) — Code of Practice for Design Loads',
      'SP 16:1980 — Design Aids for Reinforced Concrete',
    ],
    AISC360_22: [
      'ASCE 7-22 — Minimum Design Loads',
      'AISC 360-22 — Specification for Structural Steel Buildings',
      'AISC Steel Construction Manual, 16th Ed.',
      'AISC 341-22 — Seismic Provisions for Structural Steel Buildings',
    ],
    ACI318_19: [
      'ACI 318-19 — Building Code Requirements for Structural Concrete',
      'ASCE 7-22 — Minimum Design Loads',
    ],
    EN1993_1_1: [
      'EN 1990:2002 — Basis of Structural Design',
      'EN 1991-1-1 — Actions on Structures',
      'EN 1993-1-1:2005 — Design of Steel Structures — General Rules',
    ],
    EN1992_1_1: [
      'EN 1990:2002 — Basis of Structural Design',
      'EN 1991-1-1 — Actions on Structures',
      'EN 1992-1-1:2004 — Design of Concrete Structures — General Rules',
    ],
  };
  return refs[code] ?? [];
}

function safetyFactorsMarkdown(code: DesignCodeId, mat: MaterialInputs): string {
  switch (code) {
    case 'IS800_2007':
      return `| Factor | Value | Description |
|--------|-------|-------------|
| $\\gamma_{m0}$ | ${mat.gammaM0 ?? 1.10} | Resistance governed by yield |
| $\\gamma_{m1}$ | ${mat.gammaM1 ?? 1.25} | Resistance governed by ultimate |`;
    case 'IS456_2000':
      return `| Factor | Value | Description |
|--------|-------|-------------|
| $\\gamma_c$ | ${mat.gammaC ?? 1.50} | Partial safety — concrete |
| $\\gamma_s$ | ${mat.gammaS ?? 1.15} | Partial safety — reinforcement |`;
    case 'AISC360_22':
      return `| Factor | Value | Description |
|--------|-------|-------------|
| $\\phi$ (Compression) | ${mat.phi ?? 0.90} | LRFD resistance factor |
| $\\phi_v$ (Shear) | 1.00 | LRFD shear factor |`;
    case 'EN1993_1_1':
      return `| Factor | Value | Description |
|--------|-------|-------------|
| $\\gamma_{M0}$ | ${mat.gammaM0 ?? 1.00} | Cross-section resistance |
| $\\gamma_{M1}$ | ${mat.gammaM1 ?? 1.00} | Buckling resistance |`;
    default:
      return '';
  }
}

/** Escape LaTeX special characters */
function esc(s: string): string {
  return s.replace(/([&%$#_{}~^\\])/g, '\\$1');
}

// ─── Export ─────────────────────────────────────────────────────────

export const clauseTracedReport = new ClauseTracedReportGenerator();
export default ClauseTracedReportGenerator;
