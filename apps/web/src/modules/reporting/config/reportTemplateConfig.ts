/**
 * Report template configurations extracted from ReportGenerationDashboard
 * Defines template types, options, and preset templates
 */

export type ReportType = 
    | 'structural_summary'
    | 'detailed_analysis'
    | 'calculation_sheets'
    | 'code_compliance'
    | 'member_design'
    | 'connection_design'
    | 'foundation_design'
    | 'seismic_analysis'
    | 'wind_analysis'
    | 'full_package';

export type OutputFormat = 'pdf' | 'docx' | 'html' | 'xlsx';

export interface ReportTemplate {
    id: string;
    name: string;
    description: string;
    type: ReportType;
    sections: string[];
    thumbnail?: string;
}

export interface BrandingConfig {
    companyName: string;
    companyLogo?: string;
    primaryColor: string;
    accentColor: string;
    footerText?: string;
    headerStyle: 'modern' | 'classic' | 'minimal';
}

export interface ReportConfig {
    type: ReportType;
    format: OutputFormat;
    template?: string;
    title: string;
    subtitle?: string;
    revision: string;
    confidential: boolean;
    watermark?: string;
    branding: BrandingConfig;
    sections: {
        id: string;
        name: string;
        enabled: boolean;
        order: number;
    }[];
    recipients?: string[];
    schedule?: {
        enabled: boolean;
        frequency: 'once' | 'daily' | 'weekly' | 'monthly';
        time?: string;
    };
}

export interface GeneratedReport {
    id: string;
    name: string;
    type: ReportType;
    format: OutputFormat;
    generatedAt: Date;
    size: string;
    status: 'ready' | 'generating' | 'error';
    downloadUrl?: string;
}

export const REPORT_TEMPLATE_OPTIONS = {
    structural_summary: ['Cover', 'Summary', 'Key Results', 'Status'],
    detailed_analysis: ['Cover', 'TOC', 'Introduction', 'Geometry', 'Materials', 'Loads', 'Analysis', 'Results', 'Conclusions'],
    calculation_sheets: ['Member Calculations', 'Connection Calculations', 'Foundation Calculations'],
    code_compliance: ['Compliance Summary', 'Design Parameters', 'Clause Checks', 'Certification'],
    member_design: ['Beam Design', 'Column Design', 'Brace Design', 'Slab Design'],
    connection_design: ['Moment Connections', 'Shear Connections', 'Base Plates', 'Splices'],
    foundation_design: ['Soil Parameters', 'Footing Design', 'Pile Design', 'Settlement Analysis'],
    seismic_analysis: ['Seismic Parameters', 'Modal Analysis', 'Response Spectrum', 'Story Forces', 'Drift Check'],
    wind_analysis: ['Wind Parameters', 'Pressure Coefficients', 'Load Distribution', 'MWFRS', 'C&C'],
    full_package: ['All Sections'],
} as const;

export interface ReportTypeDefinition {
    name: string;
    description: string;
    sections: readonly string[];
}

export const REPORT_TYPE_DEFINITIONS: Record<ReportType, ReportTypeDefinition> = {
    structural_summary: {
        name: 'Structural Summary',
        description: 'Executive summary with key results and design status',
        sections: REPORT_TEMPLATE_OPTIONS.structural_summary,
    },
    detailed_analysis: {
        name: 'Detailed Analysis Report',
        description: 'Comprehensive analysis results with all data',
        sections: REPORT_TEMPLATE_OPTIONS.detailed_analysis,
    },
    calculation_sheets: {
        name: 'Calculation Sheets',
        description: 'Step-by-step calculation documentation',
        sections: REPORT_TEMPLATE_OPTIONS.calculation_sheets,
    },
    code_compliance: {
        name: 'Code Compliance Report',
        description: 'Detailed code compliance verification',
        sections: REPORT_TEMPLATE_OPTIONS.code_compliance,
    },
    member_design: {
        name: 'Member Design Report',
        description: 'Complete member-by-member design documentation',
        sections: REPORT_TEMPLATE_OPTIONS.member_design,
    },
    connection_design: {
        name: 'Connection Design Report',
        description: 'Connection design with details and sketches',
        sections: REPORT_TEMPLATE_OPTIONS.connection_design,
    },
    foundation_design: {
        name: 'Foundation Design Report',
        description: 'Foundation analysis and design documentation',
        sections: REPORT_TEMPLATE_OPTIONS.foundation_design,
    },
    seismic_analysis: {
        name: 'Seismic Analysis Report',
        description: 'Earthquake analysis per applicable code',
        sections: REPORT_TEMPLATE_OPTIONS.seismic_analysis,
    },
    wind_analysis: {
        name: 'Wind Analysis Report',
        description: 'Wind load analysis and design',
        sections: REPORT_TEMPLATE_OPTIONS.wind_analysis,
    },
    full_package: {
        name: 'Complete Report Package',
        description: 'All reports bundled together',
        sections: REPORT_TEMPLATE_OPTIONS.full_package,
    },
};

export const PRESET_TEMPLATE_DEFINITIONS = [
    {
        id: 'standard',
        name: 'Standard Engineering Report',
        description: 'Professional format with all essential sections',
        type: 'detailed_analysis' as ReportType,
        sections: ['cover', 'toc', 'summary', 'analysis', 'results', 'conclusions']
    },
    {
        id: 'client',
        name: 'Client Presentation',
        description: 'High-level summary suitable for client review',
        type: 'structural_summary' as ReportType,
        sections: ['cover', 'summary', 'key_results', 'recommendations']
    },
    {
        id: 'detailed',
        name: 'Detailed Technical Report',
        description: 'Full technical documentation with calculations',
        type: 'full_package' as ReportType,
        sections: ['all']
    },
    {
        id: 'compliance',
        name: 'Code Compliance Package',
        description: 'Complete code compliance documentation',
        type: 'code_compliance' as ReportType,
        sections: ['parameters', 'checks', 'certification']
    }
] as const;

export const PRESET_TEMPLATES: ReportTemplate[] = PRESET_TEMPLATE_DEFINITIONS.map((template) => ({
    ...template,
    sections: [...template.sections],
}));
