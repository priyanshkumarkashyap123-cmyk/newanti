/**
 * ============================================================================
 * REPORTING MODULES INDEX
 * ============================================================================
 * 
 * Central export hub for all reporting engine modules
 * 
 * @version 2.0.0
 */

// Advanced Report Generator
export { 
    AdvancedReportGenerator,
    type ReportType,
    type OutputFormat,
    type ReportConfig,
    type ProjectInfo,
    type ReportSection,
    type BrandingConfig,
    type SignatureConfig,
    type CalculationStep
} from './AdvancedReportGenerator';

// Detailed Report Engine
export {
    DetailedReportEngine,
    createDetailedReport,
    type DesignCode,
    type CheckStatus,
    type ProjectDetails,
    type EngineerDetails,
    type CompanyDetails,
    type DesignCriteria,
    type MaterialData,
    type LoadSummary,
    type MemberDesignResult,
    type ConnectionDesignResult,
    type FoundationDesignResult,
    type AnalysisResultsSummary,
    type QualityCheckItem,
    type ReportData,
    type ReportSettings
} from './DetailedReportEngine';

// Calculation Sheet Generator
export {
    CalculationSheetGenerator,
    CalculationTemplates,
    createCalculationSheet,
    type CalculationType,
    type CalculationStep as CalcStep,
    type CalculationSection,
    type CalculationSheetData,
    type SheetSettings
} from './CalculationSheetGenerator';

// Code Compliance Report Generator
export {
    CodeComplianceReportGenerator,
    CodeComplianceTemplates,
    createCodeComplianceReport,
    type DesignCodeType,
    type ComplianceStatus,
    type ClauseCheck,
    type CodeSection,
    type CodeComplianceData,
    type ComplianceReportSettings
} from './CodeComplianceReportGenerator';
