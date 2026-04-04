/**
 * Professional Report Generator Template Definitions
 * Industry-standard report templates with structured sections
 */

import React from 'react';
import {
  BookOpen,
  Layers,
  FileText,
  Building2,
  BarChart3,
  Table,
  Calculator,
  Shield,
  FileCode,
  CheckCircle,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';
import type { ReportSectionType } from '../../../types/ReportTypes';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSectionType[];
  designCode: string;
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'structural-design',
    name: 'Structural Design Report',
    description: 'Complete structural design with calculations per IS/ACI/EC codes',
    sections: ['cover', 'toc', 'summary', 'geometry', 'materials', 'loads', 'combinations', 'analysis', 'memberForces', 'steelDesign', 'concreteDesign', 'codeCheck', 'appendix'],
    designCode: 'IS 456 + IS 800',
  },
  {
    id: 'analysis-only',
    name: 'Analysis Results Report',
    description: 'Quick analysis summary with reactions and displacements',
    sections: ['cover', 'toc', 'geometry', 'loads', 'analysis', 'reactions', 'displacements', 'memberForces'],
    designCode: 'General',
  },
  {
    id: 'seismic-design',
    name: 'Seismic Design Report',
    description: 'Earthquake-resistant design per IS 1893/ASCE 7',
    sections: ['cover', 'toc', 'summary', 'geometry', 'loads', 'analysis', 'memberForces', 'steelDesign', 'concreteDesign', 'codeCheck'],
    designCode: 'IS 1893:2016',
  },
  {
    id: 'foundation',
    name: 'Foundation Design Report',
    description: 'Footing and pile design calculations',
    sections: ['cover', 'toc', 'summary', 'loads', 'reactions', 'foundationDesign', 'codeCheck'],
    designCode: 'IS 456 + IS 2911',
  },
  {
    id: 'connection',
    name: 'Connection Design Report',
    description: 'Steel connection design and detailing',
    sections: ['cover', 'toc', 'memberForces', 'connectionDesign', 'codeCheck', 'appendix'],
    designCode: 'IS 800:2007',
  },
];

export const SECTION_DEFINITIONS: Record<ReportSectionType, {
  title: string;
  icon: React.ReactNode;
  defaultOptions: Record<string, boolean | string | number>;
  description: string;
}> = {
  cover: { title: 'Cover Page', icon: <BookOpen className="w-4 h-4" />, defaultOptions: { showLogo: true, showDate: true, showRevision: true }, description: 'Title page with project information' },
  toc: { title: 'Table of Contents', icon: <Layers className="w-4 h-4" />, defaultOptions: { showPageNumbers: true, depth: 3 }, description: 'Auto-generated navigation' },
  summary: { title: 'Executive Summary', icon: <FileText className="w-4 h-4" />, defaultOptions: { includeKeyFindings: true, includeRecommendations: true }, description: 'High-level project overview' },
  geometry: { title: 'Model Geometry', icon: <Building2 className="w-4 h-4" />, defaultOptions: { showNodeTable: true, showMemberTable: true, show3DView: true, showPlan: true }, description: 'Nodes, members, and structure views' },
  materials: { title: 'Material Properties', icon: <Layers className="w-4 h-4" />, defaultOptions: { showSteel: true, showConcrete: true, showRebar: true }, description: 'Steel, concrete, and reinforcement properties' },
  loads: { title: 'Load Cases', icon: <BarChart3 className="w-4 h-4" />, defaultOptions: { showDead: true, showLive: true, showSeismic: true, showWind: true, showLoadDiagrams: true }, description: 'Applied loads with diagrams' },
  combinations: { title: 'Load Combinations', icon: <Table className="w-4 h-4" />, defaultOptions: { showFactors: true, showGoverning: true }, description: 'Design load combinations per code' },
  analysis: { title: 'Analysis Summary', icon: <Calculator className="w-4 h-4" />, defaultOptions: { showSolverInfo: true, showConvergence: true, showModalResults: false }, description: 'Solver details and analysis type' },
  reactions: { title: 'Support Reactions', icon: <BarChart3 className="w-4 h-4" />, defaultOptions: { showTable: true, showDiagram: true, showEnvelope: true }, description: 'Reactions at all supports' },
  memberForces: { title: 'Member Forces', icon: <BarChart3 className="w-4 h-4" />, defaultOptions: { showAxial: true, showShear: true, showMoment: true, showDiagrams: true, showEnvelope: true }, description: 'Axial, shear, moment diagrams' },
  displacements: { title: 'Displacements', icon: <BarChart3 className="w-4 h-4" />, defaultOptions: { showTable: true, showDeformedShape: true, showDriftCheck: true }, description: 'Nodal displacements and drift' },
  steelDesign: { title: 'Steel Member Design', icon: <Shield className="w-4 h-4" />, defaultOptions: { showInteraction: true, showUtilization: true, showDetailed: false, designCode: 'IS800' }, description: 'IS 800/AISC member checks' },
  concreteDesign: { title: 'RC Member Design', icon: <Shield className="w-4 h-4" />, defaultOptions: { showReinforcement: true, showCrackWidth: true, showDetailed: false, designCode: 'IS456' }, description: 'IS 456/ACI concrete design' },
  foundationDesign: { title: 'Foundation Design', icon: <Building2 className="w-4 h-4" />, defaultOptions: { showBearing: true, showSettlement: true, showReinforcement: true }, description: 'Footing and pile calculations' },
  connectionDesign: { title: 'Connection Design', icon: <FileCode className="w-4 h-4" />, defaultOptions: { showBoltedConnections: true, showWeldedConnections: true, showDetails: true }, description: 'Bolted and welded connections' },
  codeCheck: { title: 'Code Compliance', icon: <CheckCircle className="w-4 h-4" />, defaultOptions: { showPassFail: true, showUtilization: true, showCritical: true }, description: 'Design code check summary' },
  appendix: { title: 'Appendices', icon: <FileSpreadsheet className="w-4 h-4" />, defaultOptions: { includeCalculations: true, includeDrawings: false, includeSpecs: false }, description: 'Detailed calculations and data' },
  custom: { title: 'Custom Section', icon: <Plus className="w-4 h-4" />, defaultOptions: {}, description: 'User-defined content' },
};
