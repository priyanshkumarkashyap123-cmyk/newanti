import type { ReportType } from './reportTemplateConfig';

export interface ReportPageTypeDefinition {
  id: ReportType;
  name: string;
  description: string;
  sections: readonly string[];
}

export const REPORT_PAGE_TYPE_DEFINITIONS: Record<ReportType, ReportPageTypeDefinition> = {
  structural_summary: {
    id: 'structural_summary',
    name: 'Structural Summary',
    description: 'Executive summary with key results and design status',
    sections: ['Cover', 'Summary', 'Key Results', 'Status'],
  },
  detailed_analysis: {
    id: 'detailed_analysis',
    name: 'Detailed Analysis Report',
    description: 'Comprehensive analysis results with all data',
    sections: ['Cover', 'TOC', 'Introduction', 'Geometry', 'Materials', 'Loads', 'Analysis', 'Results', 'Conclusions'],
  },
  calculation_sheets: {
    id: 'calculation_sheets',
    name: 'Calculation Sheets',
    description: 'Step-by-step calculation documentation',
    sections: ['Member Calculations', 'Connection Calculations', 'Foundation Calculations'],
  },
  code_compliance: {
    id: 'code_compliance',
    name: 'Code Compliance Report',
    description: 'Detailed code compliance verification',
    sections: ['Compliance Summary', 'Design Parameters', 'Clause Checks', 'Certification'],
  },
  member_design: {
    id: 'member_design',
    name: 'Member Design Report',
    description: 'Complete member-by-member design documentation',
    sections: ['Beam Design', 'Column Design', 'Brace Design', 'Slab Design'],
  },
  connection_design: {
    id: 'connection_design',
    name: 'Connection Design Report',
    description: 'Connection design with details and sketches',
    sections: ['Moment Connections', 'Shear Connections', 'Base Plates', 'Splices'],
  },
  foundation_design: {
    id: 'foundation_design',
    name: 'Foundation Design Report',
    description: 'Foundation analysis and design documentation',
    sections: ['Soil Parameters', 'Footing Design', 'Pile Design', 'Settlement Analysis'],
  },
  seismic_analysis: {
    id: 'seismic_analysis',
    name: 'Seismic Analysis Report',
    description: 'Earthquake analysis per applicable code',
    sections: ['Seismic Parameters', 'Modal Analysis', 'Response Spectrum', 'Story Forces', 'Drift Check'],
  },
  wind_analysis: {
    id: 'wind_analysis',
    name: 'Wind Analysis Report',
    description: 'Wind load analysis and design',
    sections: ['Wind Parameters', 'Pressure Coefficients', 'Load Distribution', 'MWFRS', 'C&C'],
  },
  full_package: {
    id: 'full_package',
    name: 'Complete Report Package',
    description: 'All reports bundled together',
    sections: ['All Sections'],
  },
};
