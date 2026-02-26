/**
 * ============================================================================
 * DETAILED CALCULATION VIEW COMPONENT
 * ============================================================================
 * 
 * React component for displaying detailed engineering calculations with:
 * - Step-by-step calculation breakdown
 * - LaTeX formula rendering
 * - Value substitution display
 * - Code clause references
 * - Diagrams and visualizations
 * - Export functionality (PDF/Excel)
 * 
 * @version 1.0.0
 */

'use client';

import React, { useState, useMemo } from 'react';
import {
  CalculationStep,
  DiagramData,
  DiagramType,
  DesignCode,
} from '../modules/core/CalculationEngine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DetailedCalculationViewProps {
  title: string;
  subtitle?: string;
  projectInfo?: {
    projectName?: string;
    projectNumber?: string;
    engineer?: string;
    checker?: string;
    date?: string;
  };
  calculations: CalculationStep[];
  diagrams?: DiagramData[];
  summary?: {
    status: 'ADEQUATE' | 'INADEQUATE' | 'REVIEW';
    utilizationRatio: number;
    governingCondition: string;
    recommendations?: string[];
  };
  showAllSteps?: boolean;
  onExport?: (format: 'pdf' | 'excel' | 'json') => void;
}

// ============================================================================
// CODE NAME MAPPING
// ============================================================================

const CODE_NAMES: Record<DesignCode, string> = {
  [DesignCode.IS_456]: 'IS 456:2000',
  [DesignCode.IS_800]: 'IS 800:2007',
  [DesignCode.IS_875_1]: 'IS 875-1:1987',
  [DesignCode.IS_875_2]: 'IS 875-2:1987',
  [DesignCode.IS_875_3]: 'IS 875-3:2015',
  [DesignCode.IS_1893]: 'IS 1893:2016',
  [DesignCode.IS_2911]: 'IS 2911:2010',
  [DesignCode.IS_13920]: 'IS 13920:2016',
  [DesignCode.IS_14458]: 'IS 14458:2015',
  [DesignCode.ACI_318]: 'ACI 318-19',
  [DesignCode.AISC_360]: 'AISC 360-22',
  [DesignCode.ASCE_7]: 'ASCE 7-22',
  [DesignCode.EC2]: 'EN 1992-1-1',
  [DesignCode.EC3]: 'EN 1993-1-1',
  [DesignCode.EC7]: 'EN 1997-1',
  [DesignCode.EC8]: 'EN 1998-1',
};

// ============================================================================
// LATEX RENDERER COMPONENT
// ============================================================================

interface LaTeXRendererProps {
  formula: string;
  display?: boolean;
}

const LaTeXRenderer: React.FC<LaTeXRendererProps> = ({ formula, display = false }) => {
  // In production, you would use a library like KaTeX or MathJax
  // This is a simplified placeholder that shows the raw formula
  
  // Convert common LaTeX to Unicode for basic rendering
  const renderBasicLatex = (tex: string): string => {
    return tex
      .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
      .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
      .replace(/\\times/g, '×')
      .replace(/\\cdot/g, '·')
      .replace(/\\leq/g, '≤')
      .replace(/\\geq/g, '≥')
      .replace(/\\neq/g, '≠')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ')
      .replace(/\\epsilon/g, 'ε')
      .replace(/\\phi/g, 'φ')
      .replace(/\\psi/g, 'ψ')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\tau/g, 'τ')
      .replace(/\\sum/g, 'Σ')
      .replace(/\\pi/g, 'π')
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/_\{([^}]+)\}/g, '[$1]')
      .replace(/\{|\}/g, '');
  };

  const rendered = renderBasicLatex(formula);

  return (
    <span 
      className={`font-mono ${display ? 'block text-center text-lg my-2' : 'inline'}`}
      style={{ 
        fontFamily: "'Cambria Math', 'Times New Roman', serif",
        fontStyle: 'italic'
      }}
    >
      {rendered}
    </span>
  );
};

// ============================================================================
// DIAGRAM RENDERER COMPONENT
// ============================================================================

interface DiagramRendererProps {
  diagram: DiagramData;
}

const DiagramRenderer: React.FC<DiagramRendererProps> = ({ diagram }) => {
  // Placeholder for actual diagram rendering
  // In production, you would use libraries like:
  // - D3.js for general diagrams
  // - Three.js for 3D sections
  // - Custom SVG components for structural diagrams

  const renderDiagramPlaceholder = () => {
    switch (diagram.type) {
      case DiagramType.CROSS_SECTION:
        return <CrossSectionDiagram data={diagram.data} />;
      case DiagramType.STRESS_DIAGRAM:
        return <StressDiagram data={diagram.data} />;
      case DiagramType.MOMENT_DIAGRAM:
        return <MomentDiagram data={diagram.data} />;
      case DiagramType.SHEAR_DIAGRAM:
        return <ShearDiagram data={diagram.data} />;
      case DiagramType.REINFORCEMENT_LAYOUT:
        return <ReinforcementLayout data={diagram.data} />;
      case DiagramType.LOADING_DIAGRAM:
        return <LoadingDiagram data={diagram.data} />;
      default:
        return <GenericDiagram data={diagram.data} title={diagram.title} />;
    }
  };

  return (
    <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
      <h4 className="text-sm font-semibold text-slate-300 mb-3">{diagram.title}</h4>
      <div className="flex justify-center">
        {renderDiagramPlaceholder()}
      </div>
    </div>
  );
};

// ============================================================================
// DIAGRAM COMPONENTS (Simplified SVG representations)
// ============================================================================

const CrossSectionDiagram: React.FC<{ data: any }> = ({ data }) => {
  const { b = 300, D = 500, d, cover = 40 } = data?.section || data || {};
  const scale = 0.4;
  
  return (
    <svg width={b * scale + 40} height={D * scale + 40} className="bg-slate-900">
      {/* Concrete section */}
      <rect 
        x={20} y={20} 
        width={b * scale} height={D * scale}
        fill="#e0e0e0" stroke="#333" strokeWidth={2}
      />
      
      {/* Dimension lines */}
      <line x1={5} y1={20} x2={5} y2={20 + D * scale} stroke="#666" strokeWidth={1} />
      <text x={10} y={20 + D * scale / 2} fontSize={10} transform={`rotate(-90, 10, ${20 + D * scale / 2})`}>
        {D}mm
      </text>
      
      <line x1={20} y1={D * scale + 35} x2={20 + b * scale} y2={D * scale + 35} stroke="#666" strokeWidth={1} />
      <text x={20 + b * scale / 2} y={D * scale + 50} fontSize={10} textAnchor="middle">
        {b}mm
      </text>
      
      {/* Reinforcement indication */}
      {data?.tension?.bars && (
        <g>
          <circle cx={20 + cover * scale} cy={20 + D * scale - cover * scale} r={5} fill="#333" />
          <circle cx={20 + b * scale - cover * scale} cy={20 + D * scale - cover * scale} r={5} fill="#333" />
          <text x={20 + b * scale / 2} y={20 + D * scale - cover * scale + 4} fontSize={8} textAnchor="middle">
            {data.tension.bars}
          </text>
        </g>
      )}
    </svg>
  );
};

const StressDiagram: React.FC<{ data: any }> = ({ data }) => {
  return (
    <svg width={300} height={200} className="bg-slate-900">
      {/* Section outline */}
      <rect x={50} y={20} width={60} height={160} fill="none" stroke="#333" strokeWidth={2} />
      
      {/* Stress block - compression */}
      <polygon 
        points="110,20 180,20 180,80 110,80" 
        fill="#f44336" fillOpacity={0.3} stroke="#f44336" strokeWidth={1}
      />
      
      {/* Neutral axis */}
      <line x1={40} y1={80} x2={200} y2={80} stroke="#666" strokeDasharray="5,5" strokeWidth={1} />
      <text x={205} y={83} fontSize={10}>N.A.</text>
      
      {/* Stress block - tension */}
      <polygon 
        points="110,80 110,180 180,180 180,140" 
        fill="#2196f3" fillOpacity={0.3} stroke="#2196f3" strokeWidth={1}
      />
      
      {/* Labels */}
      <text x={190} y={50} fontSize={10} fill="#f44336">0.447fck</text>
      <text x={190} y={160} fontSize={10} fill="#2196f3">0.87fy</text>
    </svg>
  );
};

const MomentDiagram: React.FC<{ data: any }> = ({ data }) => {
  return (
    <svg width={300} height={150} className="bg-slate-900">
      {/* Beam line */}
      <line x1={30} y1={75} x2={270} y2={75} stroke="#333" strokeWidth={2} />
      
      {/* Supports */}
      <polygon points="30,75 20,95 40,95" fill="#333" />
      <polygon points="270,75 260,95 280,95" fill="#333" />
      
      {/* Moment diagram (parabolic for UDL) */}
      <path 
        d="M 30 75 Q 150 130 270 75" 
        fill="#2196f3" fillOpacity={0.3} stroke="#2196f3" strokeWidth={2}
      />
      
      {/* Max moment indicator */}
      <line x1={150} y1={75} x2={150} y2={127} stroke="#2196f3" strokeWidth={1} />
      <circle cx={150} cy={127} r={3} fill="#2196f3" />
      <text x={155} y={135} fontSize={10}>Mmax</text>
    </svg>
  );
};

const ShearDiagram: React.FC<{ data: any }> = ({ data }) => {
  return (
    <svg width={300} height={150} className="bg-slate-900">
      {/* Beam line */}
      <line x1={30} y1={75} x2={270} y2={75} stroke="#333" strokeWidth={2} />
      
      {/* Supports */}
      <polygon points="30,75 20,95 40,95" fill="#333" />
      <polygon points="270,75 260,95 280,95" fill="#333" />
      
      {/* Shear diagram (linear for UDL) */}
      <polygon 
        points="30,75 30,45 270,105 270,75" 
        fill="#4caf50" fillOpacity={0.3} stroke="#4caf50" strokeWidth={2}
      />
      
      {/* Zero crossing */}
      <circle cx={150} cy={75} r={3} fill="#4caf50" />
      
      {/* Labels */}
      <text x={35} y={40} fontSize={10} fill="#4caf50">+V</text>
      <text x={245} y={120} fontSize={10} fill="#4caf50">-V</text>
    </svg>
  );
};

const ReinforcementLayout: React.FC<{ data: any }> = ({ data }) => {
  return (
    <svg width={350} height={200} className="bg-slate-900">
      {/* Beam elevation */}
      <rect x={25} y={50} width={300} height={100} fill="#e0e0e0" stroke="#333" strokeWidth={2} />
      
      {/* Top bars */}
      <line x1={35} y1={60} x2={315} y2={60} stroke="#333" strokeWidth={3} />
      
      {/* Bottom bars */}
      <line x1={35} y1={140} x2={315} y2={140} stroke="#333" strokeWidth={4} />
      
      {/* Stirrups */}
      {[50, 100, 150, 200, 250, 300].map((x, i) => (
        <rect key={i} x={x} y={55} width={20} height={90} fill="none" stroke="#666" strokeWidth={1} />
      ))}
      
      {/* Labels */}
      <text x={175} y={30} fontSize={10} textAnchor="middle">REINFORCEMENT LAYOUT</text>
      <text x={330} y={63} fontSize={9}>Top bars</text>
      <text x={330} y={143} fontSize={9}>Bottom bars</text>
      <text x={175} y={185} fontSize={9} textAnchor="middle">Stirrups @ spacing c/c</text>
    </svg>
  );
};

const LoadingDiagram: React.FC<{ data: any }> = ({ data }) => {
  return (
    <svg width={300} height={180} className="bg-slate-900">
      {/* Building outline */}
      <rect x={100} y={30} width={100} height={120} fill="none" stroke="#333" strokeWidth={2} />
      
      {/* Wind arrows */}
      {[40, 60, 80, 100, 120].map((y, i) => (
        <g key={i}>
          <line x1={30} y1={y} x2={95} y2={y} stroke="#2196f3" strokeWidth={2} />
          <polygon points={`95,${y} 85,${y-5} 85,${y+5}`} fill="#2196f3" />
        </g>
      ))}
      
      {/* Base shear arrow */}
      <line x1={150} y1={160} x2={150} y2={175} stroke="#f44336" strokeWidth={2} />
      <polygon points="150,175 145,165 155,165" fill="#f44336" />
      
      {/* Labels */}
      <text x={15} y={80} fontSize={10} fill="#2196f3">Wind</text>
      <text x={145} y={190} fontSize={10} fill="#f44336">VB</text>
      <text x={150} y={20} fontSize={10} textAnchor="middle">LOADING DIAGRAM</text>
    </svg>
  );
};

const GenericDiagram: React.FC<{ data: any; title: string }> = ({ data, title }) => {
  return (
    <div className="w-full h-40 bg-slate-800 border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center">
      <div className="text-center text-slate-400">
        <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" 
          />
        </svg>
        <p className="text-sm">{title}</p>
        <p className="text-xs mt-1">Diagram visualization</p>
      </div>
    </div>
  );
};

// ============================================================================
// CALCULATION STEP COMPONENT
// ============================================================================

interface CalculationStepCardProps {
  step: CalculationStep;
  isExpanded: boolean;
  onToggle: () => void;
}

const CalculationStepCard: React.FC<CalculationStepCardProps> = ({ 
  step, 
  isExpanded, 
  onToggle 
}) => {
  const statusColors = {
    OK: 'bg-green-900/50 text-green-300 border-green-700',
    WARNING: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    FAIL: 'bg-red-900/50 text-red-300 border-red-700',
    INFO: 'bg-blue-900/50 text-blue-300 border-blue-700',
  };

  const statusIcons = {
    OK: '✓',
    WARNING: '⚠',
    FAIL: '✗',
    INFO: 'ℹ',
  };

  return (
    <div className={`border rounded-lg mb-3 overflow-hidden ${
      step.status === 'FAIL' ? 'border-red-700' : 
      step.status === 'WARNING' ? 'border-yellow-700' : 'border-slate-700'
    }`}>
      {/* Header */}
      <div 
        className={`px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-slate-700 ${
          step.status === 'FAIL' ? 'bg-red-900/30' : 
          step.status === 'WARNING' ? 'bg-yellow-900/30' : 'bg-slate-800'
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
            {step.step}
          </span>
          <div>
            <h3 className="font-semibold text-slate-200">{step.title}</h3>
            <p className="text-sm text-slate-400">{step.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-1 rounded text-xs font-medium border ${statusColors[step.status || 'INFO']}`}>
            {statusIcons[step.status || 'INFO']} {step.status || 'INFO'}
          </span>
          <svg 
            className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-4 bg-slate-800/50 border-t border-slate-700">
          {/* Code Reference */}
          {step.reference?.code && (
            <div className="mb-3 flex items-center gap-2 text-sm">
              <span className="font-medium text-slate-300">Reference:</span>
              <span className="px-2 py-0.5 bg-blue-900/50 text-blue-300 rounded text-xs">
                {CODE_NAMES[step.reference.code]}
              </span>
              {step.reference?.clause && (
                <span className="text-slate-400">Clause {step.reference.clause}</span>
              )}
              {step.reference?.table && (
                <span className="text-slate-400">| {step.reference.table}</span>
              )}
              {step.reference?.figure && (
                <span className="text-slate-400">| {step.reference.figure}</span>
              )}
            </div>
          )}
          
          {/* Formula */}
          <div className="mb-4 p-3 bg-slate-900 rounded border border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Formula:</p>
            {step.formulaLatex ? (
              <LaTeXRenderer formula={step.formulaLatex} display />
            ) : (
              <p className="font-mono text-center text-lg">{step.formula}</p>
            )}
          </div>
          
          {/* Input Values */}
          {step.values && Object.keys(step.values).length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-slate-400 mb-2">Input Values:</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {Object.entries(step.values).map(([key, val]) => {
                  if (!val) return null;
                  const value = typeof val === 'object' ? val : { value: val };
                  return (
                    <div key={key} className="p-2 bg-slate-900 rounded border border-slate-700">
                      <p className="text-xs text-slate-400">{key}</p>
                      <p className="font-mono font-medium text-slate-200">
                        {typeof value.value === 'number' ? value.value.toString() : value.value}
                        {value.unit && <span className="text-slate-400 text-sm ml-1">{value.unit}</span>}
                      </p>
                      {value.description && (
                        <p className="text-xs text-slate-500">{value.description}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Result */}
          <div className="p-3 bg-slate-900 rounded border-2 border-blue-700">
            <p className="text-xs text-slate-400 mb-1">Result:</p>
            <p className="text-xl font-bold text-blue-400">
              {typeof step.result.value === 'number' 
                ? step.result.value.toString() 
                : step.result.value}
              {step.result.unit && (
                <span className="text-sm font-normal text-slate-400 ml-2">{step.result.unit}</span>
              )}
            </p>
            {step.result.description && (
              <p className="text-sm text-slate-400 mt-1">{step.result.description}</p>
            )}
          </div>
          
          {/* Notes */}
          {step.notes && step.notes.length > 0 && (
            <div className="mt-3 p-2 bg-yellow-900/30 rounded border border-yellow-700">
              <p className="text-xs font-medium text-yellow-400 mb-1">Notes:</p>
              <ul className="text-sm text-yellow-300 list-disc list-inside">
                {step.notes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </div>
          )}
          
          {/* Diagram */}
          {step.diagram && (
            <DiagramRenderer diagram={step.diagram} />
          )}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DetailedCalculationView: React.FC<DetailedCalculationViewProps> = ({
  title,
  subtitle,
  projectInfo,
  calculations,
  diagrams,
  summary,
  showAllSteps = false,
  onExport,
}) => {
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(
    showAllSteps ? new Set(calculations.map(c => c.step)) : new Set([1])
  );
  const [activeTab, setActiveTab] = useState<'calculations' | 'diagrams' | 'summary'>('calculations');

  const toggleStep = (step: number) => {
    const newExpanded = new Set(expandedSteps);
    if (newExpanded.has(step)) {
      newExpanded.delete(step);
    } else {
      newExpanded.add(step);
    }
    setExpandedSteps(newExpanded);
  };

  const expandAll = () => {
    setExpandedSteps(new Set(calculations.map(c => c.step)));
  };

  const collapseAll = () => {
    setExpandedSteps(new Set());
  };

  return (
    <div className="bg-slate-900 rounded-xl shadow-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-blue-100 mt-1">{subtitle}</p>}
          </div>
          {onExport && (
            <div className="flex gap-2">
              <button
                onClick={() => onExport('pdf')}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
              >
                📄 PDF
              </button>
              <button
                onClick={() => onExport('excel')}
                className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors"
              >
                📊 Excel
              </button>
            </div>
          )}
        </div>
        
        {/* Project Info */}
        {projectInfo && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {projectInfo.projectName && (
              <div>
                <p className="text-blue-200">Project</p>
                <p className="font-medium">{projectInfo.projectName}</p>
              </div>
            )}
            {projectInfo.engineer && (
              <div>
                <p className="text-blue-200">Engineer</p>
                <p className="font-medium">{projectInfo.engineer}</p>
              </div>
            )}
            {projectInfo.checker && (
              <div>
                <p className="text-blue-200">Checked By</p>
                <p className="font-medium">{projectInfo.checker}</p>
              </div>
            )}
            {projectInfo.date && (
              <div>
                <p className="text-blue-200">Date</p>
                <p className="font-medium">{projectInfo.date}</p>
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Tab Navigation */}
      <div className="border-b border-slate-700">
        <nav className="flex">
          {['calculations', 'diagrams', 'summary'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'calculations' && ` (${calculations.length})`}
              {tab === 'diagrams' && diagrams && ` (${diagrams.length})`}
            </button>
          ))}
        </nav>
      </div>
      
      {/* Content */}
      <div className="p-6">
        {/* Calculations Tab */}
        {activeTab === 'calculations' && (
          <div>
            {/* Controls */}
            <div className="flex justify-end gap-2 mb-4">
              <button
                onClick={expandAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Expand All
              </button>
              <span className="text-slate-600">|</span>
              <button
                onClick={collapseAll}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Collapse All
              </button>
            </div>
            
            {/* Calculation Steps */}
            <div>
              {calculations.map((calc) => (
                <CalculationStepCard
                  key={calc.step}
                  step={calc}
                  isExpanded={expandedSteps.has(calc.step)}
                  onToggle={() => toggleStep(calc.step)}
                />
              ))}
            </div>
          </div>
        )}
        
        {/* Diagrams Tab */}
        {activeTab === 'diagrams' && diagrams && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {diagrams.map((diagram, index) => (
              <DiagramRenderer key={index} diagram={diagram} />
            ))}
          </div>
        )}
        
        {/* Summary Tab */}
        {activeTab === 'summary' && summary && (
          <div className="max-w-2xl mx-auto">
            {/* Status Card */}
            <div className={`p-6 rounded-lg text-center mb-6 ${
              summary.status === 'ADEQUATE' ? 'bg-green-900/30 border border-green-700' :
              summary.status === 'INADEQUATE' ? 'bg-red-900/30 border border-red-700' :
              'bg-yellow-900/30 border border-yellow-700'
            }`}>
              <div className={`text-6xl mb-2 ${
                summary.status === 'ADEQUATE' ? 'text-green-500' :
                summary.status === 'INADEQUATE' ? 'text-red-500' :
                'text-yellow-500'
              }`}>
                {summary.status === 'ADEQUATE' ? '✓' :
                 summary.status === 'INADEQUATE' ? '✗' : '⚠'}
              </div>
              <h2 className={`text-2xl font-bold ${
                summary.status === 'ADEQUATE' ? 'text-green-700' :
                summary.status === 'INADEQUATE' ? 'text-red-700' :
                'text-yellow-700'
              }`}>
                {summary.status}
              </h2>
              <p className="text-slate-400 mt-2">
                Governing Condition: {summary.governingCondition}
              </p>
            </div>
            
            {/* Utilization Ratio */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-300 mb-2">Utilization Ratio</h3>
              <div className="relative h-8 bg-slate-700 rounded-full overflow-hidden">
                <div 
                  className={`absolute inset-y-0 left-0 rounded-full ${
                    summary.utilizationRatio <= 0.8 ? 'bg-green-500' :
                    summary.utilizationRatio <= 1.0 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(summary.utilizationRatio * 100, 100)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-center text-sm font-bold text-slate-200">
                  {(summary.utilizationRatio * 100).toFixed(1)}%
                </div>
              </div>
              <div className="flex justify-between text-xs text-slate-400 mt-1">
                <span>0%</span>
                <span>80%</span>
                <span>100%</span>
              </div>
            </div>
            
            {/* Recommendations */}
            {summary.recommendations && summary.recommendations.length > 0 && (
              <div className="p-4 bg-blue-900/30 rounded-lg border border-blue-700">
                <h3 className="font-medium text-blue-300 mb-2">Recommendations</h3>
                <ul className="text-sm text-blue-300 list-disc list-inside space-y-1">
                  {summary.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DetailedCalculationView;
