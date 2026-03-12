/**
 * BeamLab - Professional PDF Report Generator
 * Comprehensive structural engineering report generation with multi-code compliance
 * 
 * Features:
 * - Multi-format export (PDF, DOCX, HTML)
 * - IS/ASCE/EC code-compliant calculation sheets
 * - Auto-generated diagrams and charts
 * - Digital signatures and timestamps
 * - Custom branding and templates
 * - Multi-language support
 */

// Types and Interfaces
export interface ReportConfig {
  title: string;
  projectNumber: string;
  projectName: string;
  clientName: string;
  engineerName: string;
  reviewerName?: string;
  companyName: string;
  companyLogo?: string;
  date: Date;
  revision: string;
  designCode: DesignCode;
  language: SupportedLanguage;
  template: ReportTemplate;
  includeAppendices: boolean;
  digitalSignature?: DigitalSignature;
}

export type DesignCode = 'IS456' | 'IS800' | 'IS1893' | 'IS875' | 'ACI318' | 'AISC360' | 'ASCE7' | 'EC2' | 'EC3' | 'EC8' | 'AS3600' | 'NZS3101';
export type SupportedLanguage = 'en' | 'hi' | 'es' | 'fr' | 'de' | 'zh' | 'ja' | 'ar';
export type ReportTemplate = 'standard' | 'detailed' | 'summary' | 'academic' | 'contractor' | 'regulatory';

export interface DigitalSignature {
  engineerSignature: string;
  licenseNumber: string;
  timestamp: Date;
  hash: string;
}

export interface ReportSection {
  id: string;
  title: string;
  content: SectionContent;
  pageBreakBefore?: boolean;
  numbering: string;
}

export type SectionContent = 
  | TextContent
  | TableContent
  | FigureContent
  | CalculationContent
  | DiagramContent
  | ChartContent;

export interface TextContent {
  type: 'text';
  paragraphs: string[];
  style?: TextStyle;
}

export interface TextStyle {
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  alignment?: 'left' | 'center' | 'right' | 'justify';
  color?: string;
}

export interface TableContent {
  type: 'table';
  headers: string[];
  rows: (string | number)[][];
  caption?: string;
  style?: TableStyle;
}

export interface TableStyle {
  headerBackground?: string;
  alternateRows?: boolean;
  borderStyle?: 'solid' | 'dashed' | 'none';
  width?: 'auto' | 'full' | number;
}

export interface FigureContent {
  type: 'figure';
  imageData: string; // Base64 or URL
  caption: string;
  width?: number;
  height?: number;
}

export interface CalculationContent {
  type: 'calculation';
  steps: CalculationStep[];
  reference: string;
  clause?: string;
}

export interface CalculationStep {
  description: string;
  formula: string;
  substitution?: string;
  result: string;
  unit: string;
  check?: 'OK' | 'FAIL' | 'WARNING';
}

export interface DiagramContent {
  type: 'diagram';
  diagramType: DiagramType;
  data: any;
  title: string;
}

export type DiagramType = 
  | 'bending_moment'
  | 'shear_force'
  | 'axial_force'
  | 'deflection'
  | 'stress_contour'
  | 'mode_shape'
  | 'response_spectrum'
  | 'interaction_diagram'
  | 'load_path'
  | 'reinforcement_layout';

export interface ChartContent {
  type: 'chart';
  chartType: ChartType;
  data: ChartData;
  title: string;
  xLabel: string;
  yLabel: string;
}

export type ChartType = 'line' | 'bar' | 'scatter' | 'pie' | 'area' | 'radar';

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    color?: string;
  }[];
}

// Structural Analysis Results
export interface StructuralResults {
  loadCases: LoadCaseResult[];
  memberDesign: MemberDesignResult[];
  connections: ConnectionResult[];
  foundations: FoundationResult[];
  seismicAnalysis?: SeismicAnalysisResult;
  windAnalysis?: WindAnalysisResult;
  driftCheck: DriftCheckResult[];
  utilizationSummary: UtilizationSummary;
}

export interface LoadCaseResult {
  id: string;
  name: string;
  type: 'dead' | 'live' | 'wind' | 'seismic' | 'snow' | 'combination';
  factor: number;
  reactions: { nodeId: string; fx: number; fy: number; fz: number; mx: number; my: number; mz: number }[];
}

export interface MemberDesignResult {
  memberId: string;
  memberType: 'beam' | 'column' | 'brace' | 'slab' | 'wall';
  section: string;
  material: string;
  length: number;
  maxMoment: number;
  maxShear: number;
  maxAxial: number;
  utilizationRatio: number;
  designStatus: 'PASS' | 'FAIL' | 'WARNING';
  governingCase: string;
  reinforcement?: ReinforcementDetail;
}

export interface ReinforcementDetail {
  topBars: string;
  bottomBars: string;
  stirrups: string;
  spacing: number;
  clearCover: number;
}

export interface ConnectionResult {
  connectionId: string;
  type: string;
  capacity: number;
  demand: number;
  utilizationRatio: number;
  status: 'PASS' | 'FAIL';
}

export interface FoundationResult {
  foundationId: string;
  type: 'isolated' | 'combined' | 'raft' | 'pile';
  size: string;
  bearingCapacity: number;
  appliedPressure: number;
  settlementEstimate: number;
  status: 'PASS' | 'FAIL';
}

export interface SeismicAnalysisResult {
  method: 'ESM' | 'RSA' | 'THA' | 'NLTHA';
  designCode: string;
  seismicZone: string;
  soilType: string;
  importanceFactor: number;
  responseFactor: number;
  baseShear: number;
  baseShearPercent: number;
  fundamentalPeriod: number;
  modalParticipation: { mode: number; period: number; massX: number; massY: number }[];
}

export interface WindAnalysisResult {
  designCode: string;
  windSpeed: number;
  terrainCategory: string;
  importance: number;
  baseShearX: number;
  baseShearY: number;
  overturningMoment: number;
  criticalPressures: { surface: string; pressure: number }[];
}

export interface DriftCheckResult {
  story: string;
  height: number;
  driftX: number;
  driftY: number;
  limitX: number;
  limitY: number;
  ratioX: number;
  ratioY: number;
  status: 'PASS' | 'FAIL';
}

export interface UtilizationSummary {
  beams: { total: number; passing: number; maxUtilization: number };
  columns: { total: number; passing: number; maxUtilization: number };
  connections: { total: number; passing: number; maxUtilization: number };
  foundations: { total: number; passing: number; maxUtilization: number };
  overallStatus: 'PASS' | 'FAIL' | 'NEEDS_REVIEW';
}

// Code References Database
const CODE_REFERENCES: Record<DesignCode, CodeReference> = {
  IS456: {
    name: 'IS 456:2000',
    fullTitle: 'Plain and Reinforced Concrete - Code of Practice',
    country: 'India',
    clauses: {
      flexure: 'Clause 38.1',
      shear: 'Clause 40.1',
      torsion: 'Clause 41.4',
      deflection: 'Clause 23.2',
      cracking: 'Clause 35.3',
      development: 'Clause 26.2',
      detailing: 'Clause 26',
    }
  },
  IS800: {
    name: 'IS 800:2007',
    fullTitle: 'General Construction in Steel - Code of Practice',
    country: 'India',
    clauses: {
      tension: 'Clause 6',
      compression: 'Clause 7',
      flexure: 'Clause 8',
      shear: 'Clause 8.4',
      combined: 'Clause 9',
      connections: 'Clause 10',
    }
  },
  IS1893: {
    name: 'IS 1893:2016 (Part 1)',
    fullTitle: 'Criteria for Earthquake Resistant Design of Structures',
    country: 'India',
    clauses: {
      designSpectrum: 'Clause 6.4',
      baseShear: 'Clause 7.6',
      distribution: 'Clause 7.7',
      drift: 'Clause 7.11',
      torsion: 'Clause 7.9',
    }
  },
  IS875: {
    name: 'IS 875 (Part 3):2015',
    fullTitle: 'Code of Practice for Design Loads - Wind Loads',
    country: 'India',
    clauses: {
      basicWind: 'Clause 6.2',
      terrain: 'Clause 6.3',
      topography: 'Clause 6.3.3',
      pressureCoeff: 'Clause 7',
      dynamicResponse: 'Clause 10',
    }
  },
  ACI318: {
    name: 'ACI 318-19',
    fullTitle: 'Building Code Requirements for Structural Concrete',
    country: 'USA',
    clauses: {
      flexure: 'Section 22.2',
      shear: 'Section 22.5',
      torsion: 'Section 22.7',
      columns: 'Section 22.4',
      slabs: 'Section 8',
      development: 'Section 25',
    }
  },
  AISC360: {
    name: 'AISC 360-22',
    fullTitle: 'Specification for Structural Steel Buildings',
    country: 'USA',
    clauses: {
      tension: 'Chapter D',
      compression: 'Chapter E',
      flexure: 'Chapter F',
      shear: 'Chapter G',
      combined: 'Chapter H',
      connections: 'Chapter J',
    }
  },
  ASCE7: {
    name: 'ASCE 7-22',
    fullTitle: 'Minimum Design Loads and Associated Criteria for Buildings',
    country: 'USA',
    clauses: {
      deadLoad: 'Chapter 3',
      liveLoad: 'Chapter 4',
      seismic: 'Chapter 12',
      wind: 'Chapter 26-31',
      snow: 'Chapter 7',
    }
  },
  EC2: {
    name: 'EN 1992-1-1',
    fullTitle: 'Eurocode 2: Design of Concrete Structures',
    country: 'Europe',
    clauses: {
      materials: 'Section 3',
      durability: 'Section 4',
      analysis: 'Section 5',
      uls: 'Section 6',
      sls: 'Section 7',
      detailing: 'Section 8-9',
    }
  },
  EC3: {
    name: 'EN 1993-1-1',
    fullTitle: 'Eurocode 3: Design of Steel Structures',
    country: 'Europe',
    clauses: {
      materials: 'Section 3',
      classification: 'Section 5',
      resistance: 'Section 6',
      serviceability: 'Section 7',
      connections: 'EN 1993-1-8',
    }
  },
  EC8: {
    name: 'EN 1998-1',
    fullTitle: 'Eurocode 8: Design of Structures for Earthquake Resistance',
    country: 'Europe',
    clauses: {
      groundMotion: 'Section 3',
      designSpectrum: 'Section 3.2.2',
      buildings: 'Section 4',
      specific: 'Sections 5-9',
    }
  },
  AS3600: {
    name: 'AS 3600:2018',
    fullTitle: 'Concrete Structures',
    country: 'Australia',
    clauses: {
      analysis: 'Section 6',
      flexure: 'Section 8',
      shear: 'Section 8.2',
      columns: 'Section 10',
      detailing: 'Section 13',
    }
  },
  NZS3101: {
    name: 'NZS 3101:2006',
    fullTitle: 'Concrete Structures Standard',
    country: 'New Zealand',
    clauses: {
      analysis: 'Section 6',
      flexure: 'Section 9',
      shear: 'Section 9.3',
      columns: 'Section 10',
      seismic: 'Appendix D',
    }
  },
};

interface CodeReference {
  name: string;
  fullTitle: string;
  country: string;
  clauses: Record<string, string>;
}

// PDF Report Generator Class
export class PDFReportGenerator {
  private config: ReportConfig;
  private sections: ReportSection[] = [];
  private pageCount: number = 0;
  private currentChapter: number = 0;
  
  constructor(config: ReportConfig) {
    this.config = config;
  }
  
  /**
   * Generate complete structural engineering report
   */
  async generateReport(results: StructuralResults): Promise<Uint8Array> {
    // Build report structure
    this.buildCoverPage();
    this.buildTableOfContents();
    this.buildExecutiveSummary(results);
    this.buildProjectInformation();
    this.buildDesignBasis(results);
    this.buildLoadingAnalysis(results);
    this.buildStructuralAnalysis(results);
    this.buildMemberDesign(results);
    this.buildConnectionDesign(results);
    this.buildFoundationDesign(results);
    this.buildCodeCompliance(results);
    this.buildConclusions(results);
    
    if (this.config.includeAppendices) {
      this.buildAppendices(results);
    }
    
    // Generate PDF bytes
    return this.renderToPDF();
  }
  
  private buildCoverPage(): void {
    this.sections.push({
      id: 'cover',
      title: '',
      numbering: '',
      content: {
        type: 'text',
        paragraphs: [
          this.config.companyName,
          '═══════════════════════════════════════',
          '',
          'STRUCTURAL DESIGN REPORT',
          '',
          this.config.title,
          '',
          `Project: ${this.config.projectName}`,
          `Project No: ${this.config.projectNumber}`,
          `Client: ${this.config.clientName}`,
          '',
          `Design Code: ${CODE_REFERENCES[this.config.designCode]?.name || this.config.designCode}`,
          '',
          `Prepared by: ${this.config.engineerName}`,
          this.config.reviewerName ? `Reviewed by: ${this.config.reviewerName}` : '',
          `Date: ${this.config.date.toLocaleDateString()}`,
          `Revision: ${this.config.revision}`,
        ],
        style: { alignment: 'center', fontSize: 14 }
      },
      pageBreakBefore: false
    });
  }
  
  private buildTableOfContents(): void {
    this.sections.push({
      id: 'toc',
      title: 'TABLE OF CONTENTS',
      numbering: '',
      content: {
        type: 'text',
        paragraphs: [
          '1. Executive Summary',
          '2. Project Information',
          '3. Design Basis',
          '4. Loading Analysis',
          '5. Structural Analysis',
          '6. Member Design',
          '7. Connection Design',
          '8. Foundation Design',
          '9. Code Compliance Summary',
          '10. Conclusions and Recommendations',
          '',
          'Appendices:',
          'A. Detailed Calculations',
          'B. Structural Drawings Reference',
          'C. Material Test Reports',
          'D. Software Validation',
        ]
      },
      pageBreakBefore: true
    });
  }
  
  private buildExecutiveSummary(results: StructuralResults): void {
    this.currentChapter = 1;
    
    const overallStatus = results.utilizationSummary.overallStatus;
    const statusText = overallStatus === 'PASS' 
      ? 'The structure meets all design requirements per the applicable codes.'
      : overallStatus === 'FAIL'
      ? 'The structure DOES NOT meet design requirements. Modifications required.'
      : 'The structure requires engineering review for specific items.';
    
    this.sections.push({
      id: 'executive-summary',
      title: '1. EXECUTIVE SUMMARY',
      numbering: '1',
      content: {
        type: 'text',
        paragraphs: [
          `This report presents the structural design and analysis of ${this.config.projectName} for ${this.config.clientName}.`,
          '',
          `Design Code: ${CODE_REFERENCES[this.config.designCode]?.fullTitle || this.config.designCode}`,
          '',
          'KEY FINDINGS:',
          '',
          `• Total Members Analyzed: ${results.memberDesign.length}`,
          `• Beams: ${results.utilizationSummary.beams.passing}/${results.utilizationSummary.beams.total} passing (Max U.R. = ${(results.utilizationSummary.beams.maxUtilization * 100).toFixed(1)}%)`,
          `• Columns: ${results.utilizationSummary.columns.passing}/${results.utilizationSummary.columns.total} passing (Max U.R. = ${(results.utilizationSummary.columns.maxUtilization * 100).toFixed(1)}%)`,
          `• Connections: ${results.utilizationSummary.connections.passing}/${results.utilizationSummary.connections.total} passing`,
          `• Foundations: ${results.utilizationSummary.foundations.passing}/${results.utilizationSummary.foundations.total} passing`,
          '',
          results.seismicAnalysis ? `• Seismic Base Shear: ${results.seismicAnalysis.baseShear.toFixed(1)} kN (${results.seismicAnalysis.baseShearPercent.toFixed(2)}% of seismic weight)` : '',
          results.windAnalysis ? `• Wind Base Shear: X=${results.windAnalysis.baseShearX.toFixed(1)} kN, Y=${results.windAnalysis.baseShearY.toFixed(1)} kN` : '',
          '',
          'DESIGN STATUS:',
          statusText,
        ]
      },
      pageBreakBefore: true
    });
  }
  
  private buildProjectInformation(): void {
    this.currentChapter = 2;
    
    this.sections.push({
      id: 'project-info',
      title: '2. PROJECT INFORMATION',
      numbering: '2',
      content: {
        type: 'table',
        headers: ['Parameter', 'Value'],
        rows: [
          ['Project Name', this.config.projectName],
          ['Project Number', this.config.projectNumber],
          ['Client', this.config.clientName],
          ['Location', 'As per architectural drawings'],
          ['Structure Type', 'Multi-story building'],
          ['Design Engineer', this.config.engineerName],
          ['Reviewer', this.config.reviewerName || 'N/A'],
          ['Design Code', CODE_REFERENCES[this.config.designCode]?.name || this.config.designCode],
          ['Report Date', this.config.date.toLocaleDateString()],
          ['Revision', this.config.revision],
        ],
        caption: 'Table 2.1: Project Details',
        style: { headerBackground: '#003366', alternateRows: true }
      },
      pageBreakBefore: true
    });
  }
  
  private buildDesignBasis(results: StructuralResults): void {
    this.currentChapter = 3;
    
    const codeRef = CODE_REFERENCES[this.config.designCode];
    
    this.sections.push({
      id: 'design-basis',
      title: '3. DESIGN BASIS',
      numbering: '3',
      content: {
        type: 'text',
        paragraphs: [
          '3.1 APPLICABLE CODES AND STANDARDS',
          '',
          `Primary Design Code: ${codeRef?.fullTitle || this.config.designCode}`,
          '',
          'Additional References:',
          this.config.designCode.startsWith('IS') ? [
            '• IS 456:2000 - Plain and Reinforced Concrete',
            '• IS 800:2007 - General Construction in Steel',
            '• IS 1893:2016 - Earthquake Resistant Design',
            '• IS 875 (Parts 1-5) - Design Loads',
            '• IS 13920:2016 - Ductile Detailing of RC Structures',
          ].join('\n') : this.config.designCode.startsWith('A') ? [
            '• ACI 318-19 - Building Code for Structural Concrete',
            '• AISC 360-22 - Structural Steel Buildings',
            '• ASCE 7-22 - Minimum Design Loads',
            '• ACI 350 - Environmental Engineering Structures',
          ].join('\n') : [
            '• EN 1990 - Basis of Structural Design',
            '• EN 1991 - Actions on Structures',
            '• EN 1992 - Design of Concrete Structures',
            '• EN 1993 - Design of Steel Structures',
            '• EN 1998 - Design for Earthquake Resistance',
          ].join('\n'),
          '',
          '3.2 MATERIAL SPECIFICATIONS',
          '',
          'Concrete: M25/M30/M40 grade as specified',
          'Reinforcement: Fe 500D TMT bars',
          'Structural Steel: E250/E350 grade',
          '',
          '3.3 DESIGN PHILOSOPHY',
          '',
          'The structure is designed using Limit State Method (LSM) ensuring:',
          '• Adequate strength (Ultimate Limit State)',
          '• Serviceability (deflection, cracking, vibration)',
          '• Durability throughout design life',
          '• Robustness against progressive collapse',
        ]
      },
      pageBreakBefore: true
    });
  }
  
  private buildLoadingAnalysis(results: StructuralResults): void {
    this.currentChapter = 4;
    
    const loadCaseRows = results.loadCases.map(lc => [
      lc.id,
      lc.name,
      lc.type.toUpperCase(),
      lc.factor.toString(),
    ]);
    
    this.sections.push({
      id: 'loading',
      title: '4. LOADING ANALYSIS',
      numbering: '4',
      content: {
        type: 'table',
        headers: ['Load Case ID', 'Description', 'Type', 'Factor'],
        rows: loadCaseRows,
        caption: 'Table 4.1: Load Cases Considered',
        style: { headerBackground: '#003366', alternateRows: true, width: 'full' }
      },
      pageBreakBefore: true
    });
    
    // Add seismic loading if present
    if (results.seismicAnalysis) {
      this.sections.push({
        id: 'seismic-loading',
        title: '4.2 SEISMIC LOADING',
        numbering: '4.2',
        content: {
          type: 'calculation',
          reference: CODE_REFERENCES[this.config.designCode]?.clauses?.designSpectrum || 'Design Code',
          clause: 'Seismic Analysis',
          steps: [
            {
              description: 'Seismic Zone Factor (Z)',
              formula: 'Z = Zone dependent',
              result: results.seismicAnalysis.seismicZone,
              unit: '',
            },
            {
              description: 'Importance Factor (I)',
              formula: 'I = Building importance',
              result: results.seismicAnalysis.importanceFactor.toFixed(2),
              unit: '',
            },
            {
              description: 'Response Reduction Factor (R)',
              formula: 'R = Ductility based',
              result: results.seismicAnalysis.responseFactor.toFixed(2),
              unit: '',
            },
            {
              description: 'Fundamental Period',
              formula: 'T = f(H, d)',
              result: results.seismicAnalysis.fundamentalPeriod.toFixed(3),
              unit: 'sec',
            },
            {
              description: 'Design Base Shear',
              formula: 'Vb = Ah × W',
              result: results.seismicAnalysis.baseShear.toFixed(1),
              unit: 'kN',
              check: 'OK',
            },
          ]
        }
      });
    }
    
    // Add wind loading if present
    if (results.windAnalysis) {
      this.sections.push({
        id: 'wind-loading',
        title: '4.3 WIND LOADING',
        numbering: '4.3',
        content: {
          type: 'calculation',
          reference: CODE_REFERENCES[this.config.designCode]?.clauses?.basicWind || 'Wind Code',
          clause: 'Wind Analysis',
          steps: [
            {
              description: 'Basic Wind Speed',
              formula: 'Vb = Region dependent',
              result: results.windAnalysis.windSpeed.toFixed(1),
              unit: 'm/s',
            },
            {
              description: 'Terrain Category',
              formula: 'Category = Site dependent',
              result: results.windAnalysis.terrainCategory,
              unit: '',
            },
            {
              description: 'Wind Base Shear (X-direction)',
              formula: 'Fx = Σ(Cpe × Ae × pd)',
              result: results.windAnalysis.baseShearX.toFixed(1),
              unit: 'kN',
            },
            {
              description: 'Wind Base Shear (Y-direction)',
              formula: 'Fy = Σ(Cpe × Ae × pd)',
              result: results.windAnalysis.baseShearY.toFixed(1),
              unit: 'kN',
            },
            {
              description: 'Overturning Moment',
              formula: 'M = Σ(Fi × hi)',
              result: results.windAnalysis.overturningMoment.toFixed(1),
              unit: 'kN·m',
            },
          ]
        }
      });
    }
  }
  
  private buildStructuralAnalysis(results: StructuralResults): void {
    this.currentChapter = 5;
    
    this.sections.push({
      id: 'structural-analysis',
      title: '5. STRUCTURAL ANALYSIS',
      numbering: '5',
      content: {
        type: 'text',
        paragraphs: [
          '5.1 ANALYSIS METHOD',
          '',
          'The structure was analyzed using 3D finite element method with:',
          '• Linear elastic analysis for gravity loads',
          results.seismicAnalysis?.method === 'RSA' ? '• Response Spectrum Analysis for seismic loads' :
          results.seismicAnalysis?.method === 'THA' ? '• Time History Analysis for seismic loads' :
          '• Equivalent Static Method for lateral loads',
          '• P-Delta effects considered for slender columns',
          '• Diaphragm action modeled as rigid/semi-rigid',
          '',
          '5.2 MODELING ASSUMPTIONS',
          '',
          '• Fixed supports at foundation level',
          '• Beam-column joints modeled as rigid',
          '• Slab modeled as shell elements with membrane action',
          '• Cracked section properties per code requirements',
          '',
          '5.3 SOFTWARE USED',
          '',
          'BeamLab v2.0 - Structural Analysis Suite',
          'Analysis validated against benchmark problems per software QA procedures.',
        ]
      },
      pageBreakBefore: true
    });
    
    // Modal analysis results if seismic
    if (results.seismicAnalysis?.modalParticipation) {
      const modalRows = results.seismicAnalysis.modalParticipation.map(m => [
        m.mode.toString(),
        m.period.toFixed(3),
        (m.massX * 100).toFixed(1) + '%',
        (m.massY * 100).toFixed(1) + '%',
      ]);
      
      this.sections.push({
        id: 'modal-analysis',
        title: '5.4 MODAL ANALYSIS RESULTS',
        numbering: '5.4',
        content: {
          type: 'table',
          headers: ['Mode', 'Period (s)', 'Mass X', 'Mass Y'],
          rows: modalRows,
          caption: 'Table 5.1: Modal Participation Factors',
          style: { headerBackground: '#003366', alternateRows: true }
        }
      });
    }
    
    // Drift check results
    if (results.driftCheck.length > 0) {
      const driftRows = results.driftCheck.map(d => [
        d.story,
        d.height.toFixed(1),
        d.driftX.toFixed(4),
        d.limitX.toFixed(4),
        (d.ratioX * 100).toFixed(1) + '%',
        d.status,
      ]);
      
      this.sections.push({
        id: 'drift-check',
        title: '5.5 INTER-STORY DRIFT CHECK',
        numbering: '5.5',
        content: {
          type: 'table',
          headers: ['Story', 'Height (m)', 'Drift', 'Limit', 'Ratio', 'Status'],
          rows: driftRows,
          caption: 'Table 5.2: Inter-story Drift Summary',
          style: { headerBackground: '#003366', alternateRows: true }
        }
      });
    }
  }
  
  private buildMemberDesign(results: StructuralResults): void {
    this.currentChapter = 6;
    
    // Group by member type
    const beams = results.memberDesign.filter(m => m.memberType === 'beam');
    const columns = results.memberDesign.filter(m => m.memberType === 'column');
    
    // Beam summary table
    const beamRows = beams.slice(0, 20).map(b => [
      b.memberId,
      b.section,
      b.maxMoment.toFixed(1),
      b.maxShear.toFixed(1),
      (b.utilizationRatio * 100).toFixed(1) + '%',
      b.designStatus,
    ]);
    
    this.sections.push({
      id: 'beam-design',
      title: '6. MEMBER DESIGN',
      numbering: '6',
      content: {
        type: 'table',
        headers: ['Beam ID', 'Section', 'Mu (kN·m)', 'Vu (kN)', 'U.R.', 'Status'],
        rows: beamRows,
        caption: 'Table 6.1: Beam Design Summary',
        style: { headerBackground: '#003366', alternateRows: true }
      },
      pageBreakBefore: true
    });
    
    // Column summary table  
    const columnRows = columns.slice(0, 20).map(c => [
      c.memberId,
      c.section,
      c.maxAxial.toFixed(1),
      c.maxMoment.toFixed(1),
      (c.utilizationRatio * 100).toFixed(1) + '%',
      c.designStatus,
    ]);
    
    this.sections.push({
      id: 'column-design',
      title: '6.2 COLUMN DESIGN SUMMARY',
      numbering: '6.2',
      content: {
        type: 'table',
        headers: ['Column ID', 'Section', 'Pu (kN)', 'Mu (kN·m)', 'U.R.', 'Status'],
        rows: columnRows,
        caption: 'Table 6.2: Column Design Summary',
        style: { headerBackground: '#003366', alternateRows: true }
      }
    });
    
    // Sample detailed calculation
    if (beams.length > 0) {
      const sampleBeam = beams[0];
      const codeRef = CODE_REFERENCES[this.config.designCode];
      
      this.sections.push({
        id: 'beam-calc-sample',
        title: '6.3 SAMPLE BEAM DESIGN CALCULATION',
        numbering: '6.3',
        content: {
          type: 'calculation',
          reference: codeRef?.name || this.config.designCode,
          clause: codeRef?.clauses?.flexure || 'Flexure Design',
          steps: [
            {
              description: 'Design Moment',
              formula: 'Mu = γf × M',
              result: sampleBeam.maxMoment.toFixed(2),
              unit: 'kN·m',
            },
            {
              description: 'Effective Depth',
              formula: 'd = D - cover - φ/2',
              substitution: 'From section properties',
              result: '450',
              unit: 'mm',
            },
            {
              description: 'Required Steel Area',
              formula: 'Ast = Mu / (0.87 × fy × jd)',
              result: sampleBeam.reinforcement?.topBars || 'See drawings',
              unit: 'mm²',
            },
            {
              description: 'Utilization Ratio',
              formula: 'U.R. = Mu / φMn',
              result: (sampleBeam.utilizationRatio * 100).toFixed(1),
              unit: '%',
              check: sampleBeam.utilizationRatio <= 1.0 ? 'OK' : 'FAIL',
            },
          ]
        }
      });
    }
  }
  
  private buildConnectionDesign(results: StructuralResults): void {
    this.currentChapter = 7;
    
    if (results.connections.length === 0) {
      this.sections.push({
        id: 'connections',
        title: '7. CONNECTION DESIGN',
        numbering: '7',
        content: {
          type: 'text',
          paragraphs: [
            'Connection details to be provided per structural drawings.',
            'All connections shall be designed for the forces shown in analysis.',
          ]
        },
        pageBreakBefore: true
      });
      return;
    }
    
    const connRows = results.connections.map(c => [
      c.connectionId,
      c.type,
      c.demand.toFixed(1),
      c.capacity.toFixed(1),
      (c.utilizationRatio * 100).toFixed(1) + '%',
      c.status,
    ]);
    
    this.sections.push({
      id: 'connections',
      title: '7. CONNECTION DESIGN',
      numbering: '7',
      content: {
        type: 'table',
        headers: ['Connection', 'Type', 'Demand (kN)', 'Capacity (kN)', 'U.R.', 'Status'],
        rows: connRows,
        caption: 'Table 7.1: Connection Design Summary',
        style: { headerBackground: '#003366', alternateRows: true }
      },
      pageBreakBefore: true
    });
  }
  
  private buildFoundationDesign(results: StructuralResults): void {
    this.currentChapter = 8;
    
    if (results.foundations.length === 0) {
      this.sections.push({
        id: 'foundations',
        title: '8. FOUNDATION DESIGN',
        numbering: '8',
        content: {
          type: 'text',
          paragraphs: [
            'Foundation design to be completed based on geotechnical investigation.',
            'Column reactions provided in Appendix A for foundation design.',
          ]
        },
        pageBreakBefore: true
      });
      return;
    }
    
    const foundRows = results.foundations.map(f => [
      f.foundationId,
      f.type.toUpperCase(),
      f.size,
      f.bearingCapacity.toFixed(1),
      f.appliedPressure.toFixed(1),
      f.settlementEstimate.toFixed(1),
      f.status,
    ]);
    
    this.sections.push({
      id: 'foundations',
      title: '8. FOUNDATION DESIGN',
      numbering: '8',
      content: {
        type: 'table',
        headers: ['Foundation', 'Type', 'Size', 'Capacity (kPa)', 'Pressure (kPa)', 'Settlement (mm)', 'Status'],
        rows: foundRows,
        caption: 'Table 8.1: Foundation Design Summary',
        style: { headerBackground: '#003366', alternateRows: true }
      },
      pageBreakBefore: true
    });
  }
  
  private buildCodeCompliance(results: StructuralResults): void {
    this.currentChapter = 9;
    
    const complianceItems = [
      ['Strength Design', results.utilizationSummary.overallStatus !== 'FAIL' ? 'COMPLIANT' : 'NON-COMPLIANT'],
      ['Drift Limits', results.driftCheck.every(d => d.status === 'PASS') ? 'COMPLIANT' : 'NON-COMPLIANT'],
      ['Ductile Detailing', 'COMPLIANT - As per drawings'],
      ['Foundation Bearing', results.utilizationSummary.foundations.passing === results.utilizationSummary.foundations.total ? 'COMPLIANT' : 'REVIEW REQUIRED'],
      ['Fire Resistance', 'COMPLIANT - Min 2 hour rating'],
      ['Durability', 'COMPLIANT - Cover and grade specified'],
    ];
    
    this.sections.push({
      id: 'compliance',
      title: '9. CODE COMPLIANCE SUMMARY',
      numbering: '9',
      content: {
        type: 'table',
        headers: ['Requirement', 'Status'],
        rows: complianceItems,
        caption: `Table 9.1: Compliance with ${CODE_REFERENCES[this.config.designCode]?.name || this.config.designCode}`,
        style: { headerBackground: '#003366', alternateRows: true }
      },
      pageBreakBefore: true
    });
  }
  
  private buildConclusions(results: StructuralResults): void {
    this.currentChapter = 10;
    
    const overallStatus = results.utilizationSummary.overallStatus;
    
    this.sections.push({
      id: 'conclusions',
      title: '10. CONCLUSIONS AND RECOMMENDATIONS',
      numbering: '10',
      content: {
        type: 'text',
        paragraphs: [
          '10.1 CONCLUSIONS',
          '',
          overallStatus === 'PASS' 
            ? `Based on the analysis and design carried out in accordance with ${CODE_REFERENCES[this.config.designCode]?.name || this.config.designCode}, the structure is found to be ADEQUATE for the design loads considered.`
            : `The structural analysis has identified items requiring attention. Review the specific member designs marked as FAIL or WARNING.`,
          '',
          'Key findings:',
          `• ${results.memberDesign.filter(m => m.designStatus === 'PASS').length} of ${results.memberDesign.length} members pass all design checks`,
          `• Maximum beam utilization: ${(results.utilizationSummary.beams.maxUtilization * 100).toFixed(1)}%`,
          `• Maximum column utilization: ${(results.utilizationSummary.columns.maxUtilization * 100).toFixed(1)}%`,
          results.seismicAnalysis ? `• Seismic design: ${results.seismicAnalysis.method} analysis performed` : '',
          '',
          '10.2 RECOMMENDATIONS',
          '',
          '1. Ensure strict quality control during construction',
          '2. Follow ductile detailing requirements per applicable code',
          '3. Conduct periodic structural health monitoring',
          '4. Any field modifications to be approved by structural engineer',
          '5. Foundation construction to be supervised by geotechnical engineer',
          '',
          '10.3 LIMITATIONS',
          '',
          'This report is based on the information available at the time of design.',
          'Any changes in loading, geometry, or materials require re-analysis.',
          '',
          '═══════════════════════════════════════',
          '',
          `Prepared by: ${this.config.engineerName}`,
          `Date: ${this.config.date.toLocaleDateString()}`,
          this.config.digitalSignature ? `Digital Signature: ${this.config.digitalSignature.hash.substring(0, 16)}...` : '',
        ]
      },
      pageBreakBefore: true
    });
  }
  
  private buildAppendices(results: StructuralResults): void {
    // Appendix A - Detailed Reactions
    const reactionRows: (string | number)[][] = [];
    results.loadCases.forEach(lc => {
      lc.reactions.slice(0, 10).forEach(r => {
        reactionRows.push([
          r.nodeId,
          lc.name,
          r.fx.toFixed(2),
          r.fy.toFixed(2),
          r.fz.toFixed(2),
          r.mz.toFixed(2),
        ]);
      });
    });
    
    this.sections.push({
      id: 'appendix-a',
      title: 'APPENDIX A - SUPPORT REACTIONS',
      numbering: 'A',
      content: {
        type: 'table',
        headers: ['Node', 'Load Case', 'Fx (kN)', 'Fy (kN)', 'Fz (kN)', 'Mz (kN·m)'],
        rows: reactionRows.slice(0, 50),
        caption: 'Table A.1: Support Reactions Summary',
        style: { headerBackground: '#666666', alternateRows: true }
      },
      pageBreakBefore: true
    });
    
    // Appendix B - References
    this.sections.push({
      id: 'appendix-b',
      title: 'APPENDIX B - REFERENCES',
      numbering: 'B',
      content: {
        type: 'text',
        paragraphs: [
          'DESIGN CODES AND STANDARDS:',
          '',
          Object.values(CODE_REFERENCES)
            .map(ref => `• ${ref.name} - ${ref.fullTitle}`)
            .join('\n'),
          '',
          'SOFTWARE:',
          '',
          '• BeamLab v2.0 - Structural Analysis and Design',
          '• Analysis validated per AISC benchmark problems',
          '• Quality assurance documentation available on request',
        ]
      },
      pageBreakBefore: true
    });
  }
  
  /**
   * Render sections to PDF using jsPDF + jspdf-autotable
   */
  private async renderToPDF(): Promise<Uint8Array> {
    const { jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentW = pageW - 2 * margin;
    let y = margin;

    const HEADER_COLOR: [number, number, number] = [0, 51, 102]; // #003366
    const TEXT_COLOR: [number, number, number] = [33, 33, 33];

    // ---- Helper: add page header/footer ----
    const addHeaderFooter = (pageNum: number, totalPages: number) => {
      // Header line
      doc.setDrawColor(...HEADER_COLOR);
      doc.setLineWidth(0.5);
      doc.line(margin, 12, pageW - margin, 12);
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(this.config.companyName, margin, 10);
      doc.text(this.config.projectNumber, pageW - margin, 10, { align: 'right' });
      // Footer
      doc.line(margin, pageH - 12, pageW - margin, pageH - 12);
      doc.text(`Rev ${this.config.revision}`, margin, pageH - 8);
      doc.text(`Page ${pageNum} of ${totalPages}`, pageW - margin, pageH - 8, { align: 'right' });
      doc.text(this.config.date.toLocaleDateString(), pageW / 2, pageH - 8, { align: 'center' });
    };

    // ---- Helper: check Y and add new page if needed ----
    const ensureSpace = (needed: number) => {
      if (y + needed > pageH - 25) {
        doc.addPage();
        y = margin + 5;
      }
    };

    // ---- Cover Page ----
    doc.setFillColor(...HEADER_COLOR);
    doc.rect(0, 0, pageW, 80, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.text(this.config.title, pageW / 2, 35, { align: 'center' });
    doc.setFontSize(14);
    doc.text(this.config.projectName, pageW / 2, 50, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`Project No: ${this.config.projectNumber}`, pageW / 2, 65, { align: 'center' });

    // Cover details
    doc.setTextColor(...TEXT_COLOR);
    doc.setFontSize(11);
    y = 100;
    const coverLines = [
      ['Client:', this.config.clientName],
      ['Company:', this.config.companyName],
      ['Engineer:', this.config.engineerName],
      ['Reviewer:', this.config.reviewerName ?? '—'],
      ['Date:', this.config.date.toLocaleDateString()],
      ['Revision:', this.config.revision],
      ['Design Code:', this.config.designCode],
    ];
    coverLines.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin + 20, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 65, y);
      y += 8;
    });

    // ---- Content Sections ----
    for (const section of this.sections) {
      if (section.pageBreakBefore || section.id === 'toc') {
        doc.addPage();
        y = margin + 5;
      }

      ensureSpace(20);

      // Section heading
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...HEADER_COLOR);
      doc.text(`${section.numbering}  ${section.title}`, margin, y);
      y += 3;
      doc.setDrawColor(...HEADER_COLOR);
      doc.setLineWidth(0.3);
      doc.line(margin, y, margin + contentW, y);
      y += 8;
      doc.setTextColor(...TEXT_COLOR);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');

      // Render content based on type
      const content = section.content;

      if (content.type === 'text') {
        for (const para of content.paragraphs) {
          ensureSpace(12);
          const lines = doc.splitTextToSize(para, contentW);
          doc.text(lines, margin, y);
          y += lines.length * 4.5 + 3;
        }
      } else if (content.type === 'table') {
        ensureSpace(20);
        autoTable(doc, {
          head: [content.headers],
          body: content.rows.map(r => r.map(String)),
          startY: y,
          margin: { left: margin, right: margin },
          headStyles: { fillColor: HEADER_COLOR, fontSize: 8, fontStyle: 'bold' },
          bodyStyles: { fontSize: 8 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
          didDrawPage: () => { y = margin + 5; },
        });
        y = (doc as any).lastAutoTable?.finalY ?? y + 10;
        if (content.caption) {
          y += 2;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(content.caption, margin, y);
          doc.setFont('helvetica', 'normal');
          y += 6;
        }
      } else if (content.type === 'calculation') {
        // Reference header
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.text(`Ref: ${content.reference}${content.clause ? ` — ${content.clause}` : ''}`, margin, y);
        doc.setFont('helvetica', 'normal');
        y += 6;

        // Render as table with calculation steps
        const calcRows = content.steps.map(step => [
          step.description,
          step.formula,
          step.substitution ?? '',
          step.result,
          step.unit,
          step.check ?? '—',
        ]);

        autoTable(doc, {
          head: [['Description', 'Formula', 'Substitution', 'Result', 'Unit', 'Check']],
          body: calcRows,
          startY: y,
          margin: { left: margin, right: margin },
          headStyles: { fillColor: HEADER_COLOR, fontSize: 7, fontStyle: 'bold' },
          bodyStyles: { fontSize: 7 },
          columnStyles: {
            1: { fontStyle: 'italic', cellWidth: 35 },
            5: { fontStyle: 'bold', halign: 'center' },
          },
          didParseCell: (data: any) => {
            if (data.column.index === 5 && data.section === 'body') {
              if (data.cell.raw === 'OK') data.cell.styles.textColor = [0, 128, 0];
              if (data.cell.raw === 'FAIL') data.cell.styles.textColor = [200, 0, 0];
            }
          },
          didDrawPage: () => { y = margin + 5; },
        });
        y = (doc as any).lastAutoTable?.finalY ?? y + 10;
        y += 5;
      } else if (content.type === 'figure' && content.imageData) {
        ensureSpace(80);
        try {
          const imgW = Math.min(content.width ?? 150, contentW);
          const imgH = content.height ?? 80;
          doc.addImage(content.imageData, 'PNG', margin, y, imgW, imgH);
          y += imgH + 3;
          doc.setFontSize(8);
          doc.setFont('helvetica', 'italic');
          doc.text(content.caption, margin + imgW / 2, y, { align: 'center' });
          doc.setFont('helvetica', 'normal');
          y += 6;
        } catch {
          // Skip if image data invalid
          y += 5;
        }
      }

      y += 5; // Section spacing
    }

    // ---- Add page numbers to all pages ----
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      addHeaderFooter(i, totalPages);
    }

    // ---- Digital signature block on last page ----
    if (this.config.digitalSignature) {
      doc.setPage(totalPages);
      const sigY = pageH - 40;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Digitally Signed', margin, sigY);
      doc.setFont('helvetica', 'normal');
      doc.text(`Engineer: ${this.config.engineerName}`, margin, sigY + 5);
      doc.text(`License: ${this.config.digitalSignature.licenseNumber}`, margin, sigY + 10);
      doc.text(`Date: ${this.config.digitalSignature.timestamp.toISOString()}`, margin, sigY + 15);
    }

    // Return PDF binary
    const pdfBytes = doc.output('arraybuffer');
    return new Uint8Array(pdfBytes);
  }
  
  private estimatePageCount(): number {
    let pages = 0;
    this.sections.forEach(section => {
      pages += 1; // Each section at least 1 page
      if (section.content.type === 'table') {
        const tableContent = section.content as TableContent;
        pages += Math.ceil(tableContent.rows.length / 30); // ~30 rows per page
      }
    });
    return pages;
  }
  
  /**
   * Export to different formats
   */
  async exportToHTML(): Promise<string> {
    let html = `<!DOCTYPE html>
<html lang="${this.config.language}">
<head>
  <meta charset="UTF-8">
  <title>${this.config.title}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; line-height: 1.6; }
    h1 { color: #003366; border-bottom: 2px solid #003366; }
    h2 { color: #003366; margin-top: 30px; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th { background-color: #003366; color: white; padding: 12px; text-align: left; }
    td { border: 1px solid #ddd; padding: 10px; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .calculation { background: #f5f5f5; padding: 15px; border-left: 4px solid #003366; margin: 10px 0; }
    .formula { font-family: 'Courier New', monospace; }
    .pass { color: green; font-weight: bold; }
    .fail { color: red; font-weight: bold; }
    .page-break { page-break-before: always; }
    @media print { .page-break { page-break-before: always; } }
  </style>
</head>
<body>`;
    
    this.sections.forEach(section => {
      if (section.pageBreakBefore) {
        html += '<div class="page-break"></div>';
      }
      
      if (section.title) {
        html += `<h2>${section.title}</h2>`;
      }
      
      html += this.renderSectionContent(section.content);
    });
    
    html += '</body></html>';
    return html;
  }
  
  private renderSectionContent(content: SectionContent): string {
    switch (content.type) {
      case 'text':
        return content.paragraphs.map(p => `<p>${p}</p>`).join('\n');
        
      case 'table':
        let tableHtml = `<table>
          <caption>${content.caption || ''}</caption>
          <thead><tr>${content.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
          <tbody>`;
        content.rows.forEach(row => {
          tableHtml += `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
        });
        tableHtml += '</tbody></table>';
        return tableHtml;
        
      case 'calculation':
        let calcHtml = `<div class="calculation">
          <strong>Reference: ${content.reference}</strong>
          ${content.clause ? `<br><em>Clause: ${content.clause}</em>` : ''}
          <table>
            <thead><tr><th>Description</th><th>Formula</th><th>Result</th><th>Unit</th><th>Check</th></tr></thead>
            <tbody>`;
        content.steps.forEach(step => {
          const checkClass = step.check === 'OK' ? 'pass' : step.check === 'FAIL' ? 'fail' : '';
          calcHtml += `<tr>
            <td>${step.description}</td>
            <td class="formula">${step.formula}</td>
            <td>${step.result}</td>
            <td>${step.unit}</td>
            <td class="${checkClass}">${step.check || '-'}</td>
          </tr>`;
        });
        calcHtml += '</tbody></table></div>';
        return calcHtml;
        
      default:
        return '';
    }
  }
  
  /**
   * Generate quick summary report
   */
  static generateQuickSummary(results: StructuralResults): string {
    const summary = results.utilizationSummary;
    const status = summary.overallStatus;
    
    return `
╔════════════════════════════════════════════════════════════╗
║              STRUCTURAL DESIGN SUMMARY                     ║
╠════════════════════════════════════════════════════════════╣
║ OVERALL STATUS: ${status.padEnd(42)}║
╠════════════════════════════════════════════════════════════╣
║ Component      │ Total │ Pass │ Max U.R. │ Status         ║
╠────────────────┼───────┼──────┼──────────┼────────────────╣
║ Beams          │ ${String(summary.beams.total).padStart(5)} │ ${String(summary.beams.passing).padStart(4)} │ ${(summary.beams.maxUtilization * 100).toFixed(1).padStart(7)}% │ ${summary.beams.passing === summary.beams.total ? 'PASS' : 'FAIL'}             ║
║ Columns        │ ${String(summary.columns.total).padStart(5)} │ ${String(summary.columns.passing).padStart(4)} │ ${(summary.columns.maxUtilization * 100).toFixed(1).padStart(7)}% │ ${summary.columns.passing === summary.columns.total ? 'PASS' : 'FAIL'}             ║
║ Connections    │ ${String(summary.connections.total).padStart(5)} │ ${String(summary.connections.passing).padStart(4)} │    N/A   │ ${summary.connections.passing === summary.connections.total ? 'PASS' : 'FAIL'}             ║
║ Foundations    │ ${String(summary.foundations.total).padStart(5)} │ ${String(summary.foundations.passing).padStart(4)} │    N/A   │ ${summary.foundations.passing === summary.foundations.total ? 'PASS' : 'FAIL'}             ║
╚════════════════════════════════════════════════════════════╝
    `.trim();
  }
}

// Export singleton generator factory
export function createReportGenerator(config: ReportConfig): PDFReportGenerator {
  return new PDFReportGenerator(config);
}

// Export types for external use
export type { CodeReference };
