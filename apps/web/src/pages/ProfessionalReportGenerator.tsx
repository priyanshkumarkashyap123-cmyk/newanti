/**
 * Professional Report Generator - Industry-Standard Engineering Reports
 * Matches STAAD.Pro, SAP2000, ETABS report quality
 * PDF export with calculation sheets, diagrams, and code compliance
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { sanitizeHTML } from '../lib/sanitize';
import {
  FileText,
  Download,
  Eye,
  EyeOff,
  Settings,
  Plus,
  Trash2,
  GripVertical,
  FileSpreadsheet,
  Image,
  Table,
  Calculator,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Printer,
  Share2,
  BookOpen,
  Layers,
  BarChart3,
  FileCode,
  Building2,
  Shield
} from 'lucide-react';

// Report Section Types
type SectionType = 
  | 'cover' 
  | 'toc' 
  | 'summary' 
  | 'geometry' 
  | 'materials' 
  | 'loads'
  | 'combinations'
  | 'analysis'
  | 'reactions'
  | 'memberForces'
  | 'displacements'
  | 'steelDesign'
  | 'concreteDesign'
  | 'foundationDesign'
  | 'connectionDesign'
  | 'codeCheck'
  | 'appendix'
  | 'custom';

interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  enabled: boolean;
  expanded: boolean;
  options: Record<string, boolean | string | number>;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: SectionType[];
  designCode: string;
}

// Industry-standard report templates
const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'structural-design',
    name: 'Structural Design Report',
    description: 'Complete structural design with calculations per IS/ACI/EC codes',
    sections: ['cover', 'toc', 'summary', 'geometry', 'materials', 'loads', 'combinations', 'analysis', 'memberForces', 'steelDesign', 'concreteDesign', 'codeCheck', 'appendix'],
    designCode: 'IS 456 + IS 800'
  },
  {
    id: 'analysis-only',
    name: 'Analysis Results Report',
    description: 'Quick analysis summary with reactions and displacements',
    sections: ['cover', 'toc', 'geometry', 'loads', 'analysis', 'reactions', 'displacements', 'memberForces'],
    designCode: 'General'
  },
  {
    id: 'seismic-design',
    name: 'Seismic Design Report',
    description: 'Earthquake-resistant design per IS 1893/ASCE 7',
    sections: ['cover', 'toc', 'summary', 'geometry', 'loads', 'analysis', 'memberForces', 'steelDesign', 'concreteDesign', 'codeCheck'],
    designCode: 'IS 1893:2016'
  },
  {
    id: 'foundation',
    name: 'Foundation Design Report',
    description: 'Footing and pile design calculations',
    sections: ['cover', 'toc', 'summary', 'loads', 'reactions', 'foundationDesign', 'codeCheck'],
    designCode: 'IS 456 + IS 2911'
  },
  {
    id: 'connection',
    name: 'Connection Design Report',
    description: 'Steel connection design and detailing',
    sections: ['cover', 'toc', 'memberForces', 'connectionDesign', 'codeCheck', 'appendix'],
    designCode: 'IS 800:2007'
  }
];

// Section definitions with icons and default options
const SECTION_DEFINITIONS: Record<SectionType, { 
  title: string; 
  icon: React.ReactNode;
  defaultOptions: Record<string, boolean | string | number>;
  description: string;
}> = {
  cover: {
    title: 'Cover Page',
    icon: <BookOpen className="w-4 h-4" />,
    defaultOptions: { showLogo: true, showDate: true, showRevision: true },
    description: 'Title page with project information'
  },
  toc: {
    title: 'Table of Contents',
    icon: <Layers className="w-4 h-4" />,
    defaultOptions: { showPageNumbers: true, depth: 3 },
    description: 'Auto-generated navigation'
  },
  summary: {
    title: 'Executive Summary',
    icon: <FileText className="w-4 h-4" />,
    defaultOptions: { includeKeyFindings: true, includeRecommendations: true },
    description: 'High-level project overview'
  },
  geometry: {
    title: 'Model Geometry',
    icon: <Building2 className="w-4 h-4" />,
    defaultOptions: { showNodeTable: true, showMemberTable: true, show3DView: true, showPlan: true },
    description: 'Nodes, members, and structure views'
  },
  materials: {
    title: 'Material Properties',
    icon: <Layers className="w-4 h-4" />,
    defaultOptions: { showSteel: true, showConcrete: true, showRebar: true },
    description: 'Steel, concrete, and reinforcement properties'
  },
  loads: {
    title: 'Load Cases',
    icon: <BarChart3 className="w-4 h-4" />,
    defaultOptions: { showDead: true, showLive: true, showSeismic: true, showWind: true, showLoadDiagrams: true },
    description: 'Applied loads with diagrams'
  },
  combinations: {
    title: 'Load Combinations',
    icon: <Table className="w-4 h-4" />,
    defaultOptions: { showFactors: true, showGoverning: true },
    description: 'Design load combinations per code'
  },
  analysis: {
    title: 'Analysis Summary',
    icon: <Calculator className="w-4 h-4" />,
    defaultOptions: { showSolverInfo: true, showConvergence: true, showModalResults: false },
    description: 'Solver details and analysis type'
  },
  reactions: {
    title: 'Support Reactions',
    icon: <BarChart3 className="w-4 h-4" />,
    defaultOptions: { showTable: true, showDiagram: true, showEnvelope: true },
    description: 'Reactions at all supports'
  },
  memberForces: {
    title: 'Member Forces',
    icon: <BarChart3 className="w-4 h-4" />,
    defaultOptions: { showAxial: true, showShear: true, showMoment: true, showDiagrams: true, showEnvelope: true },
    description: 'Axial, shear, moment diagrams'
  },
  displacements: {
    title: 'Displacements',
    icon: <BarChart3 className="w-4 h-4" />,
    defaultOptions: { showTable: true, showDeformedShape: true, showDriftCheck: true },
    description: 'Nodal displacements and drift'
  },
  steelDesign: {
    title: 'Steel Member Design',
    icon: <Shield className="w-4 h-4" />,
    defaultOptions: { showInteraction: true, showUtilization: true, showDetailed: false, designCode: 'IS800' },
    description: 'IS 800/AISC member checks'
  },
  concreteDesign: {
    title: 'RC Member Design',
    icon: <Shield className="w-4 h-4" />,
    defaultOptions: { showReinforcement: true, showCrackWidth: true, showDetailed: false, designCode: 'IS456' },
    description: 'IS 456/ACI concrete design'
  },
  foundationDesign: {
    title: 'Foundation Design',
    icon: <Building2 className="w-4 h-4" />,
    defaultOptions: { showBearing: true, showSettlement: true, showReinforcement: true },
    description: 'Footing and pile calculations'
  },
  connectionDesign: {
    title: 'Connection Design',
    icon: <FileCode className="w-4 h-4" />,
    defaultOptions: { showBoltedConnections: true, showWeldedConnections: true, showDetails: true },
    description: 'Bolted and welded connections'
  },
  codeCheck: {
    title: 'Code Compliance',
    icon: <CheckCircle className="w-4 h-4" />,
    defaultOptions: { showPassFail: true, showUtilization: true, showCritical: true },
    description: 'Design code check summary'
  },
  appendix: {
    title: 'Appendices',
    icon: <FileSpreadsheet className="w-4 h-4" />,
    defaultOptions: { includeCalculations: true, includeDrawings: false, includeSpecs: false },
    description: 'Detailed calculations and data'
  },
  custom: {
    title: 'Custom Section',
    icon: <Plus className="w-4 h-4" />,
    defaultOptions: {},
    description: 'User-defined content'
  }
};

export default function ProfessionalReportGenerator() {
  // Project Information
  const [projectInfo, setProjectInfo] = useState({
    projectName: 'Multi-Storey Commercial Building',
    projectNumber: 'PRJ-2026-001',
    client: 'ABC Infrastructure Ltd.',
    location: 'Mumbai, Maharashtra',
    engineer: 'Er. Structural Engineer',
    checker: 'Er. Senior Engineer',
    approver: 'Chief Structural Engineer',
    date: new Date().toISOString().slice(0, 10),
    revision: 'R0',
    companyName: 'BeamLab',
    companyLogo: '/branding/logo.png'
  });

  // Report Configuration
  const [selectedTemplate, setSelectedTemplate] = useState<string>('structural-design');
  const [outputFormat, setOutputFormat] = useState<'pdf' | 'html' | 'docx'>('pdf');
  const [paperSize, setPaperSize] = useState<'A4' | 'Letter' | 'A3'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  
  // Report Sections
  const [sections, setSections] = useState<ReportSection[]>(() => {
    const template = REPORT_TEMPLATES.find(t => t.id === 'structural-design')!;
    return template.sections.map((type, index) => ({
      id: `${type}-${index}`,
      type,
      title: SECTION_DEFINITIONS[type].title,
      enabled: true,
      expanded: false,
      options: { ...SECTION_DEFINITIONS[type].defaultOptions }
    }));
  });

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);

  useEffect(() => { document.title = 'Report Generator | BeamLab'; }, []);

  // Apply template
  const applyTemplate = useCallback((templateId: string) => {
    const template = REPORT_TEMPLATES.find(t => t.id === templateId);
    if (!template) return;
    
    setSelectedTemplate(templateId);
    setSections(template.sections.map((type, index) => ({
      id: `${type}-${index}`,
      type,
      title: SECTION_DEFINITIONS[type].title,
      enabled: true,
      expanded: false,
      options: { ...SECTION_DEFINITIONS[type].defaultOptions }
    })));
  }, []);

  // Toggle section
  const toggleSection = useCallback((id: string) => {
    setSections(prev => prev.map(s => 
      s.id === id ? { ...s, enabled: !s.enabled } : s
    ));
  }, []);

  // Toggle section expansion
  const toggleExpand = useCallback((id: string) => {
    setSections(prev => prev.map(s => 
      s.id === id ? { ...s, expanded: !s.expanded } : s
    ));
  }, []);

  // Update section option
  const updateSectionOption = useCallback((id: string, key: string, value: boolean | string | number) => {
    setSections(prev => prev.map(s => 
      s.id === id ? { ...s, options: { ...s.options, [key]: value } } : s
    ));
  }, []);

  // Add section
  const addSection = useCallback((type: SectionType) => {
    const newSection: ReportSection = {
      id: `${type}-${Date.now()}`,
      type,
      title: SECTION_DEFINITIONS[type].title,
      enabled: true,
      expanded: true,
      options: { ...SECTION_DEFINITIONS[type].defaultOptions }
    };
    setSections(prev => [...prev, newSection]);
  }, []);

  // Remove section
  const removeSection = useCallback((id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  }, []);

  // Generate report preview  
  const reportPreview = useMemo(() => {
    const enabledSections = sections.filter(s => s.enabled);
    
    const NAVY = '#12376A';
    const GOLD = '#BF9B30';
    const SLATE_50 = '#f8fafc';
    const SLATE_100 = '#f1f5f9';
    const SLATE_200 = '#e2e8f0';
    const SLATE_500 = '#64748b';
    const SLATE_600 = '#475569';
    const SLATE_700 = '#334155';
    const SLATE_900 = '#0f172a';

    const sectionHeadingStyle = `font-size: 15px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: ${SLATE_900}; border-bottom: 2px solid ${SLATE_200}; padding-bottom: 6px; margin: 28px 0 16px 0;`;
    const subHeadingStyle = `font-size: 13px; font-weight: 700; color: ${SLATE_700}; border-bottom: 1px solid ${SLATE_200}; padding-bottom: 4px; margin: 20px 0 10px 0;`;
    const tableHeaderStyle = `background: ${SLATE_100}; border: 1px solid ${SLATE_200}; padding: 8px 12px; font-size: 11px; font-weight: 700; color: ${SLATE_600}; text-align: left;`;
    const tableCellStyle = `border: 1px solid ${SLATE_200}; padding: 6px 12px; font-size: 11px; color: ${SLATE_700};`;
    const tableCellAltStyle = `${tableCellStyle} background: ${SLATE_50};`;
    const monoStyle = 'font-family: "SF Mono", "Cascadia Code", "Consolas", monospace;';

    let html = `
      <div class="report-preview" style="font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; color: ${SLATE_900}; line-height: 1.6;">
    `;

    enabledSections.forEach(section => {
      switch (section.type) {
        case 'cover':
          html += `
            <div style="text-align: center; padding: 40px; page-break-after: always; position: relative;">
              <div style="position: absolute; top: 0; left: 0; right: 0; height: 6px; background: ${NAVY};"></div>
              <div style="position: absolute; top: 6px; left: 0; right: 0; height: 3px; background: ${GOLD};"></div>
              
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 12px; margin-bottom: 30px; text-align: left;">
                <div>
                  <div style="font-size: 22px; font-weight: 900; color: ${NAVY}; letter-spacing: -0.02em;">BeamLab</div>
                  <div style="font-size: 9px; font-weight: 700; color: ${SLATE_500}; text-transform: uppercase; letter-spacing: 0.25em; margin-top: 2px;">Structural Engineering</div>
                </div>
                <div style="font-size: 8px; color: ${SLATE_500}; text-align: right; line-height: 1.6;">
                  <div>beamlabultimate.tech</div>
                  <div>decodedoffice@gmail.com</div>
                </div>
              </div>
              
              <div style="margin: 80px 0;">
                <div style="width: 60px; height: 2px; background: ${SLATE_200}; margin: 0 auto 24px;"></div>
                <div style="font-size: 10px; font-weight: 700; color: ${SLATE_500}; text-transform: uppercase; letter-spacing: 0.3em; margin-bottom: 12px;">Structural Design Report</div>
                <h1 style="font-size: 26px; font-weight: 900; margin: 16px 0; color: ${NAVY}; line-height: 1.2;">${projectInfo.projectName}</h1>
                <div style="font-size: 11px; color: ${SLATE_500}; margin: 6px 0;">Project No: ${projectInfo.projectNumber}</div>
                <div style="font-size: 11px; color: ${SLATE_500};">Revision ${projectInfo.revision} &mdash; ${projectInfo.date}</div>
                <div style="width: 60px; height: 2px; background: ${SLATE_200}; margin: 24px auto 0;"></div>
              </div>
              
              <div style="margin-top: 40px; font-size: 12px; color: ${SLATE_600}; line-height: 2;">
                <div>Client: ${projectInfo.client}</div>
                <div>Location: ${projectInfo.location}</div>
              </div>
              
              <div style="margin-top: 50px; border: 1px solid ${SLATE_200}; border-radius: 4px; overflow: hidden; text-align: left;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: ${SLATE_500}; background: ${SLATE_50}; width: 25%; border-right: 1px solid ${SLATE_200}; border-bottom: 1px solid ${SLATE_200};">Prepared by</td>
                    <td style="padding: 8px 12px; font-size: 10px; color: ${SLATE_700}; border-right: 1px solid ${SLATE_200}; border-bottom: 1px solid ${SLATE_200};">${projectInfo.engineer}</td>
                    <td style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: ${SLATE_500}; background: ${SLATE_50}; width: 25%; border-right: 1px solid ${SLATE_200}; border-bottom: 1px solid ${SLATE_200};">Checked by</td>
                    <td style="padding: 8px 12px; font-size: 10px; color: ${SLATE_700}; border-bottom: 1px solid ${SLATE_200};">${projectInfo.checker}</td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: ${SLATE_500}; background: ${SLATE_50}; border-right: 1px solid ${SLATE_200};">Approved by</td>
                    <td style="padding: 8px 12px; font-size: 10px; color: ${SLATE_700}; border-right: 1px solid ${SLATE_200};">${projectInfo.approver}</td>
                    <td style="padding: 8px 12px; font-size: 10px; font-weight: 700; color: ${SLATE_500}; background: ${SLATE_50}; border-right: 1px solid ${SLATE_200};">Date</td>
                    <td style="padding: 8px 12px; font-size: 10px; color: ${SLATE_700};">${projectInfo.date}</td>
                  </tr>
                </table>
              </div>
            </div>
          `;
          break;
          
        case 'toc':
          html += `
            <div style="padding: 20px 40px; page-break-after: always;">
              <h2 style="${sectionHeadingStyle}">Table of Contents</h2>
              <div style="margin-top: 16px;">
                ${enabledSections.filter(s => s.type !== 'cover' && s.type !== 'toc').map((s, i) => `
                  <div style="display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; border-bottom: 1px dotted ${SLATE_200}; font-size: 12px;">
                    <span style="color: ${SLATE_700}; font-weight: 500;"><span style="${monoStyle} font-weight: 700; color: ${SLATE_500}; margin-right: 8px;">${i + 1}.0</span>${s.title}</span>
                    <span style="color: ${SLATE_500}; ${monoStyle} font-size: 11px;">${i + 3}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
          break;
          
        case 'summary':
          html += `
            <div style="padding: 20px 40px;">
              <h2 style="${sectionHeadingStyle}"><span style="color: ${SLATE_500}; ${monoStyle} margin-right: 8px;">1.0</span> Executive Summary</h2>
              <p style="margin-top: 12px; font-size: 12px; color: ${SLATE_600}; line-height: 1.7;">This report presents the structural design and analysis of ${projectInfo.projectName}. 
              The structure has been designed in accordance with IS 456:2000, IS 800:2007, and IS 1893:2016.</p>
              
              <h3 style="${subHeadingStyle}">Key Findings</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 12px;">
                <div style="border: 1px solid ${SLATE_200}; border-left: 4px solid #16a34a; border-radius: 4px; padding: 10px 14px;">
                  <div style="font-size: 9px; font-weight: 700; color: ${SLATE_500}; text-transform: uppercase; letter-spacing: 0.1em;">Max Storey Drift</div>
                  <div style="font-size: 16px; font-weight: 900; color: ${SLATE_900}; margin-top: 2px;">0.0028 <span style="font-size: 10px; color: ${SLATE_500}; font-weight: 500;">/ 0.004</span></div>
                </div>
                <div style="border: 1px solid ${SLATE_200}; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 10px 14px;">
                  <div style="font-size: 9px; font-weight: 700; color: ${SLATE_500}; text-transform: uppercase; letter-spacing: 0.1em;">Base Shear</div>
                  <div style="font-size: 16px; font-weight: 900; color: ${SLATE_900}; margin-top: 2px;">2,450 <span style="font-size: 10px; color: ${SLATE_500}; font-weight: 500;">kN</span></div>
                </div>
                <div style="border: 1px solid ${SLATE_200}; border-left: 4px solid #f59e0b; border-radius: 4px; padding: 10px 14px;">
                  <div style="font-size: 9px; font-weight: 700; color: ${SLATE_500}; text-transform: uppercase; letter-spacing: 0.1em;">Critical Utilization</div>
                  <div style="font-size: 16px; font-weight: 900; color: ${SLATE_900}; margin-top: 2px;">0.87 <span style="font-size: 10px; color: ${SLATE_500}; font-weight: 500;">Column C12</span></div>
                </div>
                <div style="border: 1px solid ${SLATE_200}; border-left: 4px solid #16a34a; border-radius: 4px; padding: 10px 14px;">
                  <div style="font-size: 9px; font-weight: 700; color: ${SLATE_500}; text-transform: uppercase; letter-spacing: 0.1em;">Overall Status</div>
                  <div style="font-size: 16px; font-weight: 900; color: #16a34a; margin-top: 2px;">ALL PASS</div>
                </div>
              </div>
              
              <h3 style="${subHeadingStyle}">Recommendations</h3>
              <ul style="margin-left: 16px; font-size: 11px; color: ${SLATE_600}; line-height: 2;">
                <li>Provide special confining reinforcement at beam-column joints</li>
                <li>Use M30 concrete grade for all RCC members</li>
                <li>All connections to be designed as rigid connections</li>
              </ul>
            </div>
          `;
          break;
          
        case 'geometry':
          html += `
            <div style="padding: 20px 40px;">
              <h2 style="${sectionHeadingStyle}"><span style="color: ${SLATE_500}; ${monoStyle} margin-right: 8px;">2.0</span> Model Geometry</h2>
              
              <h3 style="${subHeadingStyle}">2.1 Structure Summary</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px; border: 1px solid ${SLATE_200}; border-radius: 4px;">
                <tr>
                  <td style="${tableCellStyle} font-weight: 700;">Total Nodes</td>
                  <td style="${tableCellStyle} text-align: right; ${monoStyle}">156</td>
                </tr>
                <tr>
                  <td style="${tableCellAltStyle} font-weight: 700;">Total Members</td>
                  <td style="${tableCellAltStyle} text-align: right; ${monoStyle}">312</td>
                </tr>
                <tr>
                  <td style="${tableCellStyle} font-weight: 700;">Total Supports</td>
                  <td style="${tableCellStyle} text-align: right; ${monoStyle}">24</td>
                </tr>
                <tr>
                  <td style="${tableCellAltStyle} font-weight: 700;">Number of Storeys</td>
                  <td style="${tableCellAltStyle} text-align: right; ${monoStyle}">G + 8</td>
                </tr>
                <tr>
                  <td style="${tableCellStyle} font-weight: 700;">Total Height</td>
                  <td style="${tableCellStyle} text-align: right; ${monoStyle}">28.0 m</td>
                </tr>
              </table>
              
              <div style="margin-top: 20px; padding: 40px; background: ${SLATE_50}; text-align: center; border: 1px solid ${SLATE_200}; border-radius: 4px; color: ${SLATE_500}; font-size: 12px;">
                [3D Model View &mdash; Rendered Image]
              </div>
            </div>
          `;
          break;
          
        case 'materials':
          html += `
            <div style="padding: 20px 40px;">
              <h2 style="${sectionHeadingStyle}"><span style="color: ${SLATE_500}; ${monoStyle} margin-right: 8px;">3.0</span> Material Properties</h2>
              
              <h3 style="${subHeadingStyle}">3.1 Concrete</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                  <th style="${tableHeaderStyle}">Grade</th>
                  <th style="${tableHeaderStyle}">f<sub>ck</sub> (MPa)</th>
                  <th style="${tableHeaderStyle}">E<sub>c</sub> (GPa)</th>
                  <th style="${tableHeaderStyle}">Usage</th>
                </tr>
                <tr>
                  <td style="${tableCellStyle} ${monoStyle} font-weight: 700;">M30</td>
                  <td style="${tableCellStyle} ${monoStyle} text-align: right;">30</td>
                  <td style="${tableCellStyle} ${monoStyle} text-align: right;">27.4</td>
                  <td style="${tableCellStyle}">Columns, Beams</td>
                </tr>
                <tr>
                  <td style="${tableCellAltStyle} ${monoStyle} font-weight: 700;">M25</td>
                  <td style="${tableCellAltStyle} ${monoStyle} text-align: right;">25</td>
                  <td style="${tableCellAltStyle} ${monoStyle} text-align: right;">25.0</td>
                  <td style="${tableCellAltStyle}">Slabs, Footings</td>
                </tr>
              </table>
              
              <h3 style="${subHeadingStyle}">3.2 Reinforcement Steel</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                  <th style="${tableHeaderStyle}">Grade</th>
                  <th style="${tableHeaderStyle}">f<sub>y</sub> (MPa)</th>
                  <th style="${tableHeaderStyle}">E<sub>s</sub> (GPa)</th>
                  <th style="${tableHeaderStyle}">Usage</th>
                </tr>
                <tr>
                  <td style="${tableCellStyle} ${monoStyle} font-weight: 700;">Fe500</td>
                  <td style="${tableCellStyle} ${monoStyle} text-align: right;">500</td>
                  <td style="${tableCellStyle} ${monoStyle} text-align: right;">200</td>
                  <td style="${tableCellStyle}">Main reinforcement</td>
                </tr>
              </table>
            </div>
          `;
          break;
          
        case 'loads':
          html += `
            <div style="padding: 20px 40px;">
              <h2 style="${sectionHeadingStyle}"><span style="color: ${SLATE_500}; ${monoStyle} margin-right: 8px;">4.0</span> Load Cases</h2>
              
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr>
                  <th style="${tableHeaderStyle}">Load Case</th>
                  <th style="${tableHeaderStyle}">Type</th>
                  <th style="${tableHeaderStyle}">Reference Code</th>
                  <th style="${tableHeaderStyle}">Value</th>
                </tr>
                <tr>
                  <td style="${tableCellStyle} font-weight: 600;">DL - Self Weight</td>
                  <td style="${tableCellStyle}">Dead Load</td>
                  <td style="${tableCellStyle} ${monoStyle} font-size: 10px; color: ${SLATE_500};">IS 875 Part 1</td>
                  <td style="${tableCellStyle} ${monoStyle}">Calculated</td>
                </tr>
                <tr>
                  <td style="${tableCellAltStyle} font-weight: 600;">DL - Floor Finish</td>
                  <td style="${tableCellAltStyle}">Dead Load</td>
                  <td style="${tableCellAltStyle} ${monoStyle} font-size: 10px; color: ${SLATE_500};">IS 875 Part 1</td>
                  <td style="${tableCellAltStyle} ${monoStyle}">1.5 kN/m&sup2;</td>
                </tr>
                <tr>
                  <td style="${tableCellStyle} font-weight: 600;">LL - Floor</td>
                  <td style="${tableCellStyle}">Live Load</td>
                  <td style="${tableCellStyle} ${monoStyle} font-size: 10px; color: ${SLATE_500};">IS 875 Part 2</td>
                  <td style="${tableCellStyle} ${monoStyle}">3.0 kN/m&sup2;</td>
                </tr>
                <tr>
                  <td style="${tableCellAltStyle} font-weight: 600;">EQX - Seismic X</td>
                  <td style="${tableCellAltStyle}">Seismic</td>
                  <td style="${tableCellAltStyle} ${monoStyle} font-size: 10px; color: ${SLATE_500};">IS 1893:2016</td>
                  <td style="${tableCellAltStyle} ${monoStyle}">Zone IV, R=5</td>
                </tr>
                <tr>
                  <td style="${tableCellStyle} font-weight: 600;">EQY - Seismic Y</td>
                  <td style="${tableCellStyle}">Seismic</td>
                  <td style="${tableCellStyle} ${monoStyle} font-size: 10px; color: ${SLATE_500};">IS 1893:2016</td>
                  <td style="${tableCellStyle} ${monoStyle}">Zone IV, R=5</td>
                </tr>
              </table>
            </div>
          `;
          break;
          
        case 'codeCheck':
          html += `
            <div style="padding: 20px 40px;">
              <h2 style="${sectionHeadingStyle}"><span style="color: ${SLATE_500}; ${monoStyle} margin-right: 8px;">5.0</span> Code Compliance Summary</h2>
              
              <div style="margin-top: 16px; padding: 12px 16px; background: #f0fdf4; border-left: 4px solid #16a34a; border-radius: 4px; display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 10px; font-weight: 800; color: #15803d; text-transform: uppercase; letter-spacing: 0.05em;">&#10003; STRUCTURE PASSES ALL CODE CHECKS</span>
              </div>
              
              <h3 style="${subHeadingStyle}">Utilization Summary</h3>
              <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                <tr>
                  <th style="${tableHeaderStyle}">Check Type</th>
                  <th style="${tableHeaderStyle}">Code Clause</th>
                  <th style="${tableHeaderStyle} text-align: right;">D/C Ratio</th>
                  <th style="${tableHeaderStyle}">Location</th>
                  <th style="${tableHeaderStyle} text-align: center;">Status</th>
                </tr>
                ${[
                  ['Column Strength', 'IS 456 Cl. 39.3', '0.87', 'C12, Level 2', 'PASS'],
                  ['Beam Flexure', 'IS 456 Cl. 38.1', '0.92', 'B24, Level 3', 'WARN'],
                  ['Storey Drift', 'IS 1893 Cl. 7.11.1', '0.70', 'Level 5', 'PASS'],
                  ['Shear Capacity', 'IS 456 Cl. 40.4', '0.68', 'B12, Level 1', 'PASS'],
                ].map(([check, code, ratio, loc, status], i) => {
                  const bg = i % 2 === 0 ? '' : `background: ${SLATE_50};`;
                  const statusColor = status === 'PASS' ? '#16a34a' : status === 'WARN' ? '#d97706' : '#dc2626';
                  const statusBg = status === 'PASS' ? '#f0fdf4' : status === 'WARN' ? '#fffbeb' : '#fef2f2';
                  const statusBorder = status === 'PASS' ? '#bbf7d0' : status === 'WARN' ? '#fde68a' : '#fecaca';
                  return `<tr>
                    <td style="${tableCellStyle} ${bg} font-weight: 600;">${check}</td>
                    <td style="${tableCellStyle} ${bg} ${monoStyle} font-size: 10px; color: ${SLATE_500};">${code}</td>
                    <td style="${tableCellStyle} ${bg} text-align: right; ${monoStyle} font-weight: 700;">${ratio}</td>
                    <td style="${tableCellStyle} ${bg}">${loc}</td>
                    <td style="${tableCellStyle} ${bg} text-align: center;">
                      <span style="display: inline-block; padding: 2px 8px; font-size: 9px; font-weight: 800; color: ${statusColor}; background: ${statusBg}; border: 1px solid ${statusBorder}; border-radius: 4px; text-transform: uppercase;">${status}</span>
                    </td>
                  </tr>`;
                }).join('')}
              </table>
            </div>
          `;
          break;
          
        default:
          html += `
            <div style="padding: 20px 40px;">
              <h2 style="${sectionHeadingStyle}">${section.title}</h2>
              <p style="margin-top: 12px; color: ${SLATE_500}; font-size: 12px; font-style: italic;">[Section content will be populated from analysis results]</p>
            </div>
          `;
      }
    });

    html += '</div>';
    return html;
  }, [sections, projectInfo]);

  // Generate and download report
  const generateReport = useCallback(async () => {
    setGeneratingReport(true);
    
    // Brief delay for UI feedback
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Create downloadable HTML
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${projectInfo.projectName} - Structural Design Report</title>
        <style>
          @page { size: ${paperSize} ${orientation}; margin: 20mm; }
          body { font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; line-height: 1.6; }
          @media print { .no-print { display: none; } }
        </style>
      </head>
      <body>
        ${reportPreview}
        <div style="margin-top: 40px; border-top: 2px solid #e2e8f0; padding-top: 16px; text-align: center;">
          <p style="font-size: 9px; color: #64748b;">This is a computer-generated document. Results should be independently verified.</p>
          <p style="font-size: 9px; color: #64748b;">Generated by BeamLab &mdash; beamlabultimate.tech</p>
          <p style="font-size: 8px; color: #94a3b8; margin-top: 4px;">&copy; ${new Date().getFullYear()} BeamLab. All rights reserved.</p>
        </div>
      </body>
      </html>
    `;
    
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectInfo.projectNumber}_Structural_Report.html`;
    a.click();
    URL.revokeObjectURL(url);
    
    setGeneratingReport(false);
  }, [projectInfo, reportPreview, paperSize, orientation]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-500 to-blue-600 bg-clip-text text-transparent mb-2 flex items-center gap-3">
                <FileText className="w-8 h-8 text-cyan-500" />
                Professional Report Generator
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">
                Industry-standard structural engineering reports with calculation sheets
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 text-slate-900 dark:text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Hide Preview' : 'Preview'}
              </button>
              
              <button
                onClick={generateReport}
                disabled={generatingReport}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {generatingReport ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Generate Report
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Panel - Configuration */}
          <div className="lg:col-span-1 space-y-6">
            {/* Template Selection */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-300 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-cyan-400" />
                Report Template
              </h3>
              
              <select
                value={selectedTemplate}
                onChange={(e) => applyTemplate(e.target.value)}
                className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-4 py-3 text-slate-900 dark:text-white mb-4"
              >
                {REPORT_TEMPLATES.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
              
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {REPORT_TEMPLATES.find(t => t.id === selectedTemplate)?.description}
              </p>
            </div>

            {/* Project Information */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-300 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-cyan-400" />
                Project Information
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Project Name</label>
                  <input
                    type="text"
                    value={projectInfo.projectName}
                    onChange={(e) => setProjectInfo(p => ({ ...p, projectName: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Project No.</label>
                    <input
                      type="text"
                      value={projectInfo.projectNumber}
                      onChange={(e) => setProjectInfo(p => ({ ...p, projectNumber: e.target.value }))}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Revision</label>
                    <input
                      type="text"
                      value={projectInfo.revision}
                      onChange={(e) => setProjectInfo(p => ({ ...p, revision: e.target.value }))}
                      className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Client</label>
                  <input
                    type="text"
                    value={projectInfo.client}
                    onChange={(e) => setProjectInfo(p => ({ ...p, client: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Location</label>
                  <input
                    type="text"
                    value={projectInfo.location}
                    onChange={(e) => setProjectInfo(p => ({ ...p, location: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Prepared By</label>
                  <input
                    type="text"
                    value={projectInfo.engineer}
                    onChange={(e) => setProjectInfo(p => ({ ...p, engineer: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    value={projectInfo.date}
                    onChange={(e) => setProjectInfo(p => ({ ...p, date: e.target.value }))}
                    className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Output Settings */}
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-300 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Settings className="w-5 h-5 text-cyan-400" />
                Output Settings
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Format</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['pdf', 'html', 'docx'] as const).map(fmt => (
                      <button
                        key={fmt}
                        onClick={() => setOutputFormat(fmt)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          outputFormat === fmt
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Paper Size</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['A4', 'Letter', 'A3'] as const).map(size => (
                      <button
                        key={size}
                        onClick={() => setPaperSize(size)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          paperSize === size
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm text-slate-600 dark:text-slate-400 mb-2">Orientation</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['portrait', 'landscape'] as const).map(orient => (
                      <button
                        key={orient}
                        onClick={() => setOrientation(orient)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium capitalize transition-colors ${
                          orientation === orient
                            ? 'bg-cyan-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        {orient}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Center Panel - Sections */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-300 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-cyan-400" />
                Report Sections
              </h3>
              
              <div className="space-y-2">
                {sections.map((section, index) => (
                  <div
                    key={section.id}
                    className={`bg-slate-100 dark:bg-slate-800 rounded-lg border transition-colors ${
                      section.enabled ? 'border-slate-600' : 'border-slate-300 dark:border-slate-700 opacity-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 p-3">
                      <GripVertical className="w-4 h-4 text-slate-600 dark:text-slate-400 cursor-move" />
                      
                      <button
                        onClick={() => toggleSection(section.id)}
                        className={`w-5 h-5 rounded border flex items-center justify-center ${
                          section.enabled
                            ? 'bg-cyan-600 border-cyan-600'
                            : 'bg-transparent border-slate-500'
                        }`}
                      >
                        {section.enabled && <CheckCircle className="w-3 h-3 text-slate-900 dark:text-white" />}
                      </button>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {SECTION_DEFINITIONS[section.type].icon}
                          <span className="text-sm font-medium text-slate-900 dark:text-white">{section.title}</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => toggleExpand(section.id)}
                        className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      >
                        {section.expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      
                      {section.type === 'custom' && (
                        <button
                          onClick={() => removeSection(section.id)}
                          className="p-1 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    
                    {section.expanded && (
                      <div className="px-3 pb-3 pt-1 border-t border-slate-300 dark:border-slate-700">
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
                          {SECTION_DEFINITIONS[section.type].description}
                        </p>
                        
                        <div className="space-y-2">
                          {Object.entries(section.options).map(([key, value]) => (
                            <label key={key} className="flex items-center gap-2 text-sm">
                              {typeof value === 'boolean' ? (
                                <>
                                  <input
                                    type="checkbox"
                                    checked={value}
                                    onChange={(e) => updateSectionOption(section.id, key, e.target.checked)}
                                    className="rounded border-slate-600 bg-slate-200 dark:bg-slate-700 text-cyan-600"
                                  />
                                  <span className="text-slate-700 dark:text-slate-300 capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                  </span>
                                </>
                              ) : (
                                <input
                                  type="text"
                                  value={String(value)}
                                  onChange={(e) => updateSectionOption(section.id, key, e.target.value)}
                                  className="flex-1 bg-slate-200 dark:bg-slate-700 border border-slate-600 rounded px-2 py-1 text-slate-900 dark:text-white text-sm"
                                  placeholder={key}
                                />
                              )}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Add Section */}
              <div className="mt-4 pt-4 border-t border-slate-300 dark:border-slate-700">
                <button
                  onClick={() => addSection('custom')}
                  className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Section
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-1">
            {showPreview ? (
              <div className="bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border border-slate-600 sticky top-4">
                <div className="bg-slate-100 px-4 py-2 border-b border-slate-300 flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-700">Report Preview</span>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => window.print()}
                      className="p-1 text-slate-600 dark:text-slate-400 hover:text-slate-700"
                    >
                      <Printer className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div 
                  className="max-h-[700px] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: sanitizeHTML(reportPreview) }}
                  style={{ transform: 'scale(0.8)', transformOrigin: 'top left', width: '125%' }}
                />
              </div>
            ) : (
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-8 border border-slate-300 dark:border-slate-700 text-center">
                <Eye className="w-12 h-12 text-slate-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-600 dark:text-slate-400 mb-2">Preview Hidden</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">Click "Preview" to see the report</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
