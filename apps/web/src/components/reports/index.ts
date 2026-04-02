/**
 * ============================================================================
 * REPORTING COMPONENTS INDEX
 * ============================================================================
 * 
 * Central export hub for all reporting-related components
 * 
 * @version 2.0.0
 */

// Hooks
export { useReportCapture } from './useReportCapture';
export type { ReportCaptureResult, CapturedImage } from './useReportCapture';

// Professional Report Templates
export {
    ProfessionalReportGenerator,
    type ReportTemplate,
    type ReportSection,
    type ProjectInfo,
    type ReportConfig as TemplateReportConfig,
    type ReportOutput,
} from './ProfessionalReportTemplates';

// Print Preview
export {
    PrintPreview,
    PagePreview,
    SettingsPanel as PrintSettingsPanel,
    PAGE_SIZES,
    DEFAULT_SETTINGS as DEFAULT_PRINT_SETTINGS,
    type PageOrientation,
    type PageSize,
    type PrintQuality,
    type PageMargins,
    type HeaderFooterConfig,
    type WatermarkConfig,
    type PrintSettings,
    type PageContent
} from './PrintPreview';

// Report Generation Dashboard
export {
	ReportGenerationDashboard,
    type ReportGenerationDashboardProps,
} from './ReportGenerationDashboard';

export type {
    ReportType,
    OutputFormat,
    BrandingConfig,
    ReportConfig,
    GeneratedReport,
} from '../../modules/reporting/config/reportTemplateConfig';

// Report Preview Panel
export {
    ReportPreviewPanel,
    type ReportPreviewProps
} from './ReportPreviewPanel';
