import { Building2, ClipboardCheck, FileCheck, HardHat, Shield, Users } from 'lucide-react';

export const REPORT_LAYOUT = {
  docRefMultiplierNode: 37,
  docRefMultiplierMember: 53,
  docRefBase: 1000,
  docRefWidth: 5,
  alternatingRowEven: 'bg-white',
  alternatingRowOdd: 'bg-slate-50/70',
} as const;

export const PROFESSIONAL_REPORT_ACTIONS = {
  downloadPdf: 'Download PDF',
  print: 'Print',
  share: 'Share',
  exportDxf: 'DXF',
  exportIfc: 'IFC',
  exportExcel: 'Excel',
} as const;

export const PROFESSIONAL_REPORT_ICONS = {
  executiveSummary: Building2,
  detailedDesign: FileCheck,
  codeCompliance: Shield,
  peerReview: Users,
  constructionDocs: HardHat,
  calculationSheet: ClipboardCheck,
} as const;
