import type React from 'react';
import {
    FileText,
    BookOpen,
    Calculator,
    Shield,
    Layers,
    Zap,
    Building,
    ClipboardList,
} from 'lucide-react';
import type { ReportType } from '../../modules/reporting/config/reportTemplateConfig';
import { REPORT_PAGE_TYPE_DEFINITIONS } from '../../modules/reporting/config/reportUiConfig';

export type ReportTypeUiDefinition = {
    name: string;
    icon: React.ElementType;
    description: string;
    sections: readonly string[];
};

export const REPORT_TYPES: Record<ReportType, ReportTypeUiDefinition> = {
    structural_summary: { ...REPORT_PAGE_TYPE_DEFINITIONS.structural_summary, icon: FileText },
    detailed_analysis: { ...REPORT_PAGE_TYPE_DEFINITIONS.detailed_analysis, icon: BookOpen },
    calculation_sheets: { ...REPORT_PAGE_TYPE_DEFINITIONS.calculation_sheets, icon: Calculator },
    code_compliance: { ...REPORT_PAGE_TYPE_DEFINITIONS.code_compliance, icon: Shield },
    member_design: { ...REPORT_PAGE_TYPE_DEFINITIONS.member_design, icon: Layers },
    connection_design: { ...REPORT_PAGE_TYPE_DEFINITIONS.connection_design, icon: Zap },
    foundation_design: { ...REPORT_PAGE_TYPE_DEFINITIONS.foundation_design, icon: Building },
    seismic_analysis: { ...REPORT_PAGE_TYPE_DEFINITIONS.seismic_analysis, icon: Zap },
    wind_analysis: { ...REPORT_PAGE_TYPE_DEFINITIONS.wind_analysis, icon: Zap },
    full_package: { ...REPORT_PAGE_TYPE_DEFINITIONS.full_package, icon: ClipboardList },
};
