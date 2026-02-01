/**
 * ============================================================================
 * STRUCTURAL CALCULATION REPORT GENERATOR
 * ============================================================================
 * 
 * Professional PDF report generation for structural calculations
 * Includes:
 * - Executive summary
 * - Input parameters
 * - Detailed calculations
 * - Code compliance checks
 * - Diagrams and figures
 * 
 * @version 1.0.0
 */

'use client';

import React, { useRef } from 'react';
import { 
  FileText, 
  Download, 
  Printer, 
  Share2,
  Building2,
  Calculator,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CalculationResult, CalculationInput, CalculationType, DesignCodeType } from './StructuralCalculator';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportData {
  projectInfo: {
    projectName: string;
    projectNumber: string;
    clientName: string;
    engineer: string;
    checker: string;
    date: string;
    revision: string;
  };
  calculationType: CalculationType;
  designCode: DesignCodeType;
  inputs: CalculationInput;
  result: CalculationResult;
}

export interface CalculationReportProps {
  data: ReportData;
  onExportPDF?: () => void;
  onPrint?: () => void;
  className?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const ReportHeader: React.FC<{ projectInfo: ReportData['projectInfo'] }> = ({ projectInfo }) => (
  <div className="border-b-2 border-gray-800 pb-4 mb-6">
    <div className="flex justify-between items-start">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{projectInfo.projectName}</h1>
        <p className="text-gray-600">Project No: {projectInfo.projectNumber}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-2 justify-end">
          <Building2 className="h-8 w-8 text-blue-600" />
          <span className="text-xl font-bold text-blue-600">BeamLab</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Structural Engineering Software</p>
      </div>
    </div>
    
    <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
      <div>
        <span className="text-gray-500">Client:</span>
        <p className="font-medium">{projectInfo.clientName}</p>
      </div>
      <div>
        <span className="text-gray-500">Engineer:</span>
        <p className="font-medium">{projectInfo.engineer}</p>
      </div>
      <div>
        <span className="text-gray-500">Checked by:</span>
        <p className="font-medium">{projectInfo.checker}</p>
      </div>
      <div>
        <span className="text-gray-500">Date:</span>
        <p className="font-medium">{projectInfo.date}</p>
      </div>
    </div>
  </div>
);

const SectionTitle: React.FC<{ children: React.ReactNode; icon?: React.ReactNode }> = ({ children, icon }) => (
  <div className="flex items-center gap-2 border-b border-gray-300 pb-2 mb-4 mt-8">
    {icon}
    <h2 className="text-lg font-bold text-gray-800">{children}</h2>
  </div>
);

const InputTable: React.FC<{ inputs: CalculationInput; title: string }> = ({ inputs, title }) => (
  <div className="mb-6">
    <h3 className="text-sm font-semibold text-gray-700 mb-2">{title}</h3>
    <table className="w-full text-sm border border-gray-300">
      <tbody>
        {Object.entries(inputs).map(([key, value], idx) => (
          <tr key={key} className={idx % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
            <td className="px-3 py-1.5 border-r border-gray-300 font-medium text-gray-700 w-1/2">
              {key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
            </td>
            <td className="px-3 py-1.5 text-gray-900">
              {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const StatusIcon: React.FC<{ status: 'PASS' | 'FAIL' | 'WARNING' | 'OK' }> = ({ status }) => {
  switch (status) {
    case 'PASS':
    case 'OK':
      return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case 'WARNING':
      return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    case 'FAIL':
      return <XCircle className="h-4 w-4 text-red-600" />;
    default:
      return null;
  }
};

// ============================================================================
// MAIN REPORT COMPONENT
// ============================================================================

export const CalculationReport: React.FC<CalculationReportProps> = ({
  data,
  onExportPDF,
  onPrint,
  className,
}) => {
  const reportRef = useRef<HTMLDivElement>(null);
  
  const { projectInfo, calculationType, designCode, inputs, result } = data;
  
  // Design code info
  const codeInfo = {
    IS_456: { name: 'IS 456:2000', title: 'Plain and Reinforced Concrete - Code of Practice' },
    IS_800: { name: 'IS 800:2007', title: 'General Construction in Steel - Code of Practice' },
    IS_1343: { name: 'IS 1343:2012', title: 'Prestressed Concrete - Code of Practice' },
    IS_1893: { name: 'IS 1893:2016', title: 'Criteria for Earthquake Resistant Design' },
    IS_1905: { name: 'IS 1905:1987', title: 'Structural Use of Unreinforced Masonry' },
    IS_883: { name: 'IS 883:1994', title: 'Design of Structural Timber in Building' },
    IS_2911: { name: 'IS 2911', title: 'Design and Construction of Pile Foundations' },
    ACI_318: { name: 'ACI 318-19', title: 'Building Code Requirements for Structural Concrete' },
    AISC_360: { name: 'AISC 360-22', title: 'Specification for Structural Steel Buildings' },
    ASCE_7: { name: 'ASCE 7-22', title: 'Minimum Design Loads for Buildings' },
    EC2: { name: 'EN 1992-1-1', title: 'Eurocode 2: Design of Concrete Structures' },
    EC3: { name: 'EN 1993-1-1', title: 'Eurocode 3: Design of Steel Structures' },
    EC8: { name: 'EN 1998-1', title: 'Eurocode 8: Design of Structures for Earthquake Resistance' },
  }[designCode] || { name: designCode, title: '' };
  
  const calcTypeInfo = {
    beam_design: 'RC Beam Design',
    column_design: 'RC Column Design',
    slab_design: 'RC Slab Design',
    steel_beam: 'Steel Beam Design',
    steel_column: 'Steel Column Design',
    base_plate: 'Base Plate Design',
    bolted_connection: 'Bolted Connection Design',
    combined_footing: 'Combined Footing Design',
    connection: 'Connection Design',
    continuous_beam: 'Continuous Beam Analysis',
    deflection_analysis: 'Deflection Analysis',
    foundation: 'Foundation Design',
    influence_line: 'Influence Line Analysis',
    isolated_footing: 'Isolated Footing Design',
    load_combination: 'Load Combination',
    masonry_wall: 'Masonry Wall Design',
    pile: 'Pile Design',
    portal_frame: 'Portal Frame Analysis',
    prestressed_beam: 'Prestressed Concrete Beam',
    retaining_wall: 'Retaining Wall Design',
    seismic_analysis: 'Seismic Analysis',
    seismic_equivalent_static: 'Equivalent Static Seismic Analysis',
    seismic_response_spectrum: 'Response Spectrum Analysis',
    shear_wall: 'Shear Wall Design',
    timber_beam: 'Timber Beam Design',
    welded_connection: 'Welded Connection Design',
    wind_load: 'Wind Load Analysis',
  }[calculationType] || calculationType;
  
  return (
    <div className={cn("bg-white", className)}>
      {/* Toolbar */}
      <div className="sticky top-0 z-10 bg-gray-100 border-b border-gray-200 px-4 py-2 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-700">Calculation Report</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onExportPDF}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export PDF
          </button>
          <button
            onClick={onPrint || (() => window.print())}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="h-4 w-4" />
            Print
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>
      </div>
      
      {/* Report Content */}
      <div 
        ref={reportRef}
        className="max-w-4xl mx-auto p-8 print:p-0 print:max-w-none"
        style={{ fontFamily: 'Georgia, serif' }}
      >
        <ReportHeader projectInfo={projectInfo} />
        
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{calcTypeInfo}</h1>
          <p className="text-gray-600">Design Calculation Sheet</p>
          <p className="text-sm text-gray-500 mt-1">
            As per {codeInfo.name}
            {codeInfo.title && ` - ${codeInfo.title}`}
          </p>
        </div>
        
        {/* Executive Summary */}
        <div className={cn(
          "p-4 rounded-lg border-2 mb-8",
          result.isAdequate 
            ? "border-green-500 bg-green-50" 
            : "border-red-500 bg-red-50"
        )}>
          <div className="flex items-center gap-3 mb-2">
            <StatusIcon status={result.status} />
            <h3 className="text-lg font-bold">
              Design {result.isAdequate ? 'ADEQUATE' : 'INADEQUATE'}
            </h3>
          </div>
          <p className="text-gray-700">{result.message}</p>
          <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-300">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{result.capacity.toFixed(1)}</p>
              <p className="text-sm text-gray-500">Capacity (kN·m)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{result.demand.toFixed(1)}</p>
              <p className="text-sm text-gray-500">Demand (kN·m)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: result.utilization <= 1 ? '#16a34a' : '#dc2626' }}>
                {(result.utilization * 100).toFixed(1)}%
              </p>
              <p className="text-sm text-gray-500">Utilization</p>
            </div>
          </div>
        </div>
        
        {/* Input Parameters */}
        <SectionTitle icon={<Calculator className="h-5 w-5 text-blue-600" />}>
          Input Parameters
        </SectionTitle>
        
        <div className="grid grid-cols-2 gap-6">
          <InputTable 
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) => 
                ['width', 'depth', 'effective_depth', 'span', 'clear_cover'].includes(k)
              )
            )} 
            title="Geometry" 
          />
          <InputTable 
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) => 
                ['fck', 'fy', 'steel_grade'].includes(k)
              )
            )} 
            title="Materials" 
          />
          <InputTable 
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) => 
                ['Mu', 'Vu', 'Pu', 'Mux', 'Muy'].includes(k)
              )
            )} 
            title="Loading" 
          />
          <InputTable 
            inputs={Object.fromEntries(
              Object.entries(inputs).filter(([k]) => 
                ['design_type', 'exposure', 'end_condition'].includes(k)
              )
            )} 
            title="Design Options" 
          />
        </div>
        
        {/* Calculation Steps */}
        <SectionTitle icon={<FileText className="h-5 w-5 text-blue-600" />}>
          Detailed Calculations
        </SectionTitle>
        
        {result.steps.map((step, idx) => (
          <div key={idx} className="mb-6 pl-4 border-l-2 border-blue-200">
            <h4 className="font-bold text-gray-800 mb-1">
              Step {idx + 1}: {step.title}
            </h4>
            <p className="text-sm text-gray-600 mb-2">{step.description}</p>
            
            {step.formula && (
              <div className="bg-gray-50 border border-gray-200 rounded p-3 mb-2 font-mono text-sm">
                {step.formula}
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              {Object.entries(step.values).map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-500">{key}:</span>
                  <span className="font-medium text-gray-800">{val}</span>
                </div>
              ))}
            </div>
            
            {step.reference && (
              <p className="text-xs text-blue-600 mt-2 italic">
                Ref: {step.reference}
              </p>
            )}
          </div>
        ))}
        
        {/* Code Compliance Checks */}
        <SectionTitle>Code Compliance Summary</SectionTitle>
        
        <table className="w-full text-sm border border-gray-300 mb-8">
          <thead>
            <tr className="bg-gray-100">
              <th className="px-3 py-2 text-left border-b border-gray-300">Clause</th>
              <th className="px-3 py-2 text-left border-b border-gray-300">Check</th>
              <th className="px-3 py-2 text-center border-b border-gray-300">Required</th>
              <th className="px-3 py-2 text-center border-b border-gray-300">Provided</th>
              <th className="px-3 py-2 text-center border-b border-gray-300">Status</th>
            </tr>
          </thead>
          <tbody>
            {result.codeChecks.map((check, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-3 py-2 font-mono text-xs border-b border-gray-200">{check.clause}</td>
                <td className="px-3 py-2 border-b border-gray-200">{check.description}</td>
                <td className="px-3 py-2 text-center border-b border-gray-200">{check.required}</td>
                <td className="px-3 py-2 text-center font-medium border-b border-gray-200">{check.provided}</td>
                <td className="px-3 py-2 text-center border-b border-gray-200">
                  <span className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold",
                    check.status === 'PASS' && "bg-green-100 text-green-700",
                    check.status === 'WARNING' && "bg-yellow-100 text-yellow-700",
                    check.status === 'FAIL' && "bg-red-100 text-red-700",
                  )}>
                    <StatusIcon status={check.status} />
                    {check.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Warnings */}
        {result.warnings.length > 0 && (
          <>
            <SectionTitle icon={<AlertTriangle className="h-5 w-5 text-yellow-600" />}>
              Warnings & Recommendations
            </SectionTitle>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 mb-8">
              {result.warnings.map((warning, idx) => (
                <li key={idx}>{warning}</li>
              ))}
            </ul>
          </>
        )}
        
        {/* Footer */}
        <div className="mt-12 pt-4 border-t-2 border-gray-800">
          <div className="grid grid-cols-3 gap-8 text-sm">
            <div>
              <p className="text-gray-500 mb-1">Prepared by:</p>
              <div className="h-12 border-b border-gray-400 mb-1"></div>
              <p className="font-medium">{projectInfo.engineer}</p>
              <p className="text-xs text-gray-500">Structural Engineer</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Checked by:</p>
              <div className="h-12 border-b border-gray-400 mb-1"></div>
              <p className="font-medium">{projectInfo.checker}</p>
              <p className="text-xs text-gray-500">Senior Engineer</p>
            </div>
            <div>
              <p className="text-gray-500 mb-1">Approved by:</p>
              <div className="h-12 border-b border-gray-400 mb-1"></div>
              <p className="font-medium">_________________</p>
              <p className="text-xs text-gray-500">Project Manager</p>
            </div>
          </div>
          
          <div className="mt-8 text-center text-xs text-gray-400">
            <p>Generated by BeamLab Structural Engineering Software v1.0</p>
            <p>This is a computer-generated document. Please verify all calculations independently.</p>
            <p>© {new Date().getFullYear()} BeamLab Engineering. All rights reserved.</p>
          </div>
        </div>
        
        {/* Page numbers for print */}
        <div className="hidden print:block fixed bottom-4 right-4 text-xs text-gray-400">
          Page <span className="page-number"></span>
        </div>
      </div>
    </div>
  );
};

export default CalculationReport;
