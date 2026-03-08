/**
 * Reports Services Index
 */

export {
    reportGenerator,
    default as ReportGeneratorService,
    type ReportConfig,
    type ReportSection,
    type ReportTable,
    type ReportFigure,
    type Calculation,
    type GeneratedReport
} from './ReportGeneratorService';

// Calculation Traceability Engine — equation-level clause-traced checks
export {
    generateMemberTraceReport,
    formatTraceReportMarkdown,
    formatTraceReportPlainText,
    traceIS800_Tension,
    traceIS800_Compression,
    traceIS800_BendingMajor,
    traceIS800_Shear,
    traceIS800_Combined,
    traceIS456_BeamFlexure,
    traceIS456_BeamShear,
    traceAISC360_Compression,
    traceAISC360_Flexure,
    traceAISC360_Shear,
    traceEN1993_BendingMajor,
    type TracedCalculation,
    type CalculationStep as TracedCalculationStep,
    type MemberTraceReport,
    type MemberDesignInput,
    type SectionInputs,
    type MaterialInputs,
    type DesignCodeId,
    type Verdict
} from './CalculationTraceabilityEngine';

// Clause-Traced Report Generator — PE-ready reports with full equation derivation
export {
    clauseTracedReport,
    ClauseTracedReportGenerator,
    type TracedReportOptions,
    type TracedReportProject,
    type TracedReportEngineer,
    type TracedReportMember,
    type TracedReportResult,
    type TracedReportSummary,
    type LoadCaseInfo
} from './ClauseTracedReportGenerator';

// Calculation Sheet PDF Exporter — renders traced calcs as A4 PDF sheets
export {
    CalculationSheetExporter,
    downloadPdf,
    type CalcSheetProject
} from './CalculationSheetExporter';
