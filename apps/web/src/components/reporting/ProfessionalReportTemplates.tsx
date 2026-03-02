/**
 * ============================================================================
 * PROFESSIONAL REPORT TEMPLATES
 * ============================================================================
 * 
 * Multiple professional report templates for structural analysis:
 * - Executive Summary Report
 * - Detailed Design Report
 * - Code Compliance Report  
 * - Peer Review Report
 * - Construction Documents
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
    FileText,
    Download,
    Printer,
    Mail,
    Share2,
    Settings,
    Eye,
    Check,
    ChevronDown,
    ChevronRight,
    Building2,
    Shield,
    ClipboardCheck,
    Users,
    HardHat,
    FileCheck,
    AlertTriangle,
    CheckCircle2,
    XCircle
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ReportTemplate = 
    | 'executive-summary'
    | 'detailed-design'
    | 'code-compliance'
    | 'peer-review'
    | 'construction-docs'
    | 'calculation-sheet'
    | 'load-takeoff'
    | 'connection-schedule';

export interface ReportSection {
    id: string;
    title: string;
    description: string;
    included: boolean;
    order: number;
    subsections?: ReportSection[];
}

export interface ProjectInfo {
    projectName: string;
    projectNumber?: string;
    clientName?: string;
    engineerName?: string;
    checkerName?: string;
    approverName?: string;
    designCode: string;
    dateCreated: Date;
    dateRevised?: Date;
    revision?: string;
    description?: string;
    address?: string;
}

export interface ReportConfig {
    template: ReportTemplate;
    sections: ReportSection[];
    projectInfo: ProjectInfo;
    includeSignatures: boolean;
    includeDisclaimer: boolean;
    includeCompanyLogo: boolean;
    paperSize: 'A4' | 'Letter' | 'Legal';
    orientation: 'portrait' | 'landscape';
    colorScheme: 'professional' | 'minimal' | 'colorful';
    watermark?: string;
    confidential: boolean;
}

export interface ReportOutput {
    type: 'pdf' | 'docx' | 'html' | 'print';
    quality: 'draft' | 'standard' | 'high';
}

// ============================================================================
// TEMPLATE DEFINITIONS
// ============================================================================

const REPORT_TEMPLATES: Record<ReportTemplate, {
    name: string;
    description: string;
    icon: React.ReactNode;
    sections: ReportSection[];
    estimatedPages: number;
}> = {
    'executive-summary': {
        name: 'Executive Summary',
        description: 'Brief overview for stakeholders and management',
        icon: <Building2 className="w-5 h-5" />,
        estimatedPages: 3,
        sections: [
            { id: 'cover', title: 'Cover Page', description: 'Project title, company logo, date', included: true, order: 1 },
            { id: 'summary', title: 'Executive Summary', description: 'Key findings and recommendations', included: true, order: 2 },
            { id: 'scope', title: 'Project Scope', description: 'Objectives and constraints', included: true, order: 3 },
            { id: 'results', title: 'Key Results', description: 'Critical values and status', included: true, order: 4 },
            { id: 'conclusions', title: 'Conclusions', description: 'Final assessment and recommendations', included: true, order: 5 }
        ]
    },
    'detailed-design': {
        name: 'Detailed Design Report',
        description: 'Comprehensive analysis and design documentation',
        icon: <FileText className="w-5 h-5" />,
        estimatedPages: 25,
        sections: [
            { id: 'cover', title: 'Cover Page', description: 'Project identification', included: true, order: 1 },
            { id: 'toc', title: 'Table of Contents', description: 'Auto-generated TOC', included: true, order: 2 },
            { id: 'intro', title: 'Introduction', description: 'Project background and objectives', included: true, order: 3 },
            { id: 'codes', title: 'Design Codes & Standards', description: 'Applicable codes and references', included: true, order: 4 },
            { id: 'materials', title: 'Material Properties', description: 'Concrete, steel, other materials', included: true, order: 5 },
            { id: 'loads', title: 'Load Analysis', description: 'Dead, live, wind, seismic loads', included: true, order: 6 },
            { id: 'model', title: 'Structural Model', description: '3D model and assumptions', included: true, order: 7 },
            { id: 'analysis', title: 'Analysis Results', description: 'Forces, moments, reactions', included: true, order: 8 },
            { id: 'design', title: 'Member Design', description: 'Section design and checks', included: true, order: 9 },
            { id: 'connections', title: 'Connection Design', description: 'Joint details and design', included: true, order: 10 },
            { id: 'foundation', title: 'Foundation Design', description: 'Footing and foundation details', included: false, order: 11 },
            { id: 'drawings', title: 'Design Drawings', description: 'Plans, sections, details', included: true, order: 12 },
            { id: 'appendix', title: 'Appendices', description: 'Detailed calculations', included: true, order: 13 }
        ]
    },
    'code-compliance': {
        name: 'Code Compliance Report',
        description: 'Verification of design code requirements',
        icon: <Shield className="w-5 h-5" />,
        estimatedPages: 15,
        sections: [
            { id: 'cover', title: 'Cover Page', description: 'Project identification', included: true, order: 1 },
            { id: 'codes', title: 'Applicable Codes', description: 'List of codes and editions', included: true, order: 2 },
            { id: 'strength', title: 'Strength Design', description: 'Member capacity checks', included: true, order: 3 },
            { id: 'serviceability', title: 'Serviceability', description: 'Deflection, vibration checks', included: true, order: 4 },
            { id: 'stability', title: 'Stability', description: 'Buckling, P-delta effects', included: true, order: 5 },
            { id: 'seismic', title: 'Seismic Design', description: 'Seismic code compliance', included: true, order: 6 },
            { id: 'wind', title: 'Wind Design', description: 'Wind load compliance', included: true, order: 7 },
            { id: 'fire', title: 'Fire Resistance', description: 'Fire rating verification', included: false, order: 8 },
            { id: 'durability', title: 'Durability', description: 'Cover, exposure classes', included: true, order: 9 },
            { id: 'summary', title: 'Compliance Summary', description: 'Pass/fail summary table', included: true, order: 10 }
        ]
    },
    'peer-review': {
        name: 'Peer Review Report',
        description: 'Independent review documentation',
        icon: <Users className="w-5 h-5" />,
        estimatedPages: 10,
        sections: [
            { id: 'cover', title: 'Cover Page', description: 'Review identification', included: true, order: 1 },
            { id: 'scope', title: 'Review Scope', description: 'What was reviewed', included: true, order: 2 },
            { id: 'documents', title: 'Documents Reviewed', description: 'List of reviewed documents', included: true, order: 3 },
            { id: 'methodology', title: 'Review Methodology', description: 'How review was conducted', included: true, order: 4 },
            { id: 'findings', title: 'Review Findings', description: 'Observations and comments', included: true, order: 5 },
            { id: 'verification', title: 'Independent Verification', description: 'Spot check calculations', included: true, order: 6 },
            { id: 'recommendations', title: 'Recommendations', description: 'Required changes', included: true, order: 7 },
            { id: 'conclusion', title: 'Conclusion', description: 'Overall assessment', included: true, order: 8 },
            { id: 'signatures', title: 'Signatures', description: 'Reviewer sign-off', included: true, order: 9 }
        ]
    },
    'construction-docs': {
        name: 'Construction Documents',
        description: 'Documents for construction team',
        icon: <HardHat className="w-5 h-5" />,
        estimatedPages: 20,
        sections: [
            { id: 'cover', title: 'Cover Sheet', description: 'Project identification', included: true, order: 1 },
            { id: 'notes', title: 'General Notes', description: 'Design assumptions and notes', included: true, order: 2 },
            { id: 'schedule', title: 'Member Schedule', description: 'Beam, column schedules', included: true, order: 3 },
            { id: 'connections', title: 'Connection Schedule', description: 'Connection details', included: true, order: 4 },
            { id: 'foundation', title: 'Foundation Schedule', description: 'Footing details', included: true, order: 5 },
            { id: 'rebar', title: 'Reinforcement Details', description: 'Bar bending schedules', included: true, order: 6 },
            { id: 'materials', title: 'Material Specifications', description: 'Required materials', included: true, order: 7 },
            { id: 'qa', title: 'Quality Requirements', description: 'Testing and inspection', included: true, order: 8 }
        ]
    },
    'calculation-sheet': {
        name: 'Calculation Sheet',
        description: 'Detailed hand calculations',
        icon: <ClipboardCheck className="w-5 h-5" />,
        estimatedPages: 30,
        sections: [
            { id: 'cover', title: 'Cover Page', description: 'Calculation identification', included: true, order: 1 },
            { id: 'contents', title: 'Contents', description: 'Calculation index', included: true, order: 2 },
            { id: 'loads', title: 'Load Calculations', description: 'Load derivation', included: true, order: 3 },
            { id: 'beams', title: 'Beam Design', description: 'Beam calculations', included: true, order: 4 },
            { id: 'columns', title: 'Column Design', description: 'Column calculations', included: true, order: 5 },
            { id: 'slabs', title: 'Slab Design', description: 'Slab calculations', included: false, order: 6 },
            { id: 'footings', title: 'Foundation Design', description: 'Footing calculations', included: true, order: 7 },
            { id: 'connections', title: 'Connection Design', description: 'Connection calculations', included: true, order: 8 }
        ]
    },
    'load-takeoff': {
        name: 'Load Takeoff Report',
        description: 'Summary of all applied loads',
        icon: <FileCheck className="w-5 h-5" />,
        estimatedPages: 8,
        sections: [
            { id: 'cover', title: 'Cover Page', description: 'Report identification', included: true, order: 1 },
            { id: 'dead', title: 'Dead Loads', description: 'Permanent loads', included: true, order: 2 },
            { id: 'live', title: 'Live Loads', description: 'Variable loads', included: true, order: 3 },
            { id: 'wind', title: 'Wind Loads', description: 'Wind load calculation', included: true, order: 4 },
            { id: 'seismic', title: 'Seismic Loads', description: 'Seismic load calculation', included: true, order: 5 },
            { id: 'combinations', title: 'Load Combinations', description: 'Factored combinations', included: true, order: 6 },
            { id: 'summary', title: 'Summary Table', description: 'Load summary', included: true, order: 7 }
        ]
    },
    'connection-schedule': {
        name: 'Connection Schedule',
        description: 'Tabulated connection details',
        icon: <FileText className="w-5 h-5" />,
        estimatedPages: 5,
        sections: [
            { id: 'cover', title: 'Cover Page', description: 'Schedule identification', included: true, order: 1 },
            { id: 'types', title: 'Connection Types', description: 'Type definitions', included: true, order: 2 },
            { id: 'schedule', title: 'Connection Schedule', description: 'Tabulated schedule', included: true, order: 3 },
            { id: 'details', title: 'Typical Details', description: 'Standard details', included: true, order: 4 }
        ]
    }
};

// ============================================================================
// TEMPLATE SELECTOR COMPONENT
// ============================================================================

interface TemplateSelectorProps {
    selected: ReportTemplate;
    onSelect: (template: ReportTemplate) => void;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({ selected, onSelect }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(REPORT_TEMPLATES).map(([key, template]) => (
                <button type="button"
                    key={key}
                    onClick={() => onSelect(key as ReportTemplate)}
                    className={`
                        p-4 rounded-xl border transition-all text-left shadow-sm hover:shadow-md
                        ${selected === key 
                            ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500/30'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/60 hover:border-slate-300 dark:hover:border-slate-600'
                        }
                    `}
                >
                    <div className={`mb-2 ${selected === key ? 'text-cyan-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {template.icon}
                    </div>
                    <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1">{template.name}</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{template.description}</p>
                    <div className="mt-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300/70 dark:border-slate-700/70">
                        ~{template.estimatedPages} pages
                    </div>
                </button>
            ))}
        </div>
    );
};

// ============================================================================
// SECTION CONFIGURATOR
// ============================================================================

interface SectionConfiguratorProps {
    sections: ReportSection[];
    onSectionsChange: (sections: ReportSection[]) => void;
}

const SectionConfigurator: React.FC<SectionConfiguratorProps> = ({
    sections,
    onSectionsChange
}) => {
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    
    const toggleSection = (id: string) => {
        const updated = sections.map(s => 
            s.id === id ? { ...s, included: !s.included } : s
        );
        onSectionsChange(updated);
    };
    
    const toggleExpanded = (id: string) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };
    
    const selectAll = () => {
        onSectionsChange(sections.map(s => ({ ...s, included: true })));
    };
    
    const selectNone = () => {
        onSectionsChange(sections.map(s => ({ ...s, included: false })));
    };
    
    const includedCount = sections.filter(s => s.included).length;
    
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {includedCount} of {sections.length} sections included
                </span>
                <div className="flex items-center gap-2">
                    <button type="button"
                        onClick={selectAll}
                        className="text-xs text-cyan-400 hover:text-cyan-300 font-medium"
                    >
                        Select All
                    </button>
                    <span className="text-slate-500">|</span>
                    <button type="button"
                        onClick={selectNone}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium"
                    >
                        Clear
                    </button>
                </div>
            </div>
            
            <div className="space-y-1">
                {sections.sort((a, b) => a.order - b.order).map(section => (
                    <div
                        key={section.id}
                        className={`
                            rounded-lg border transition-colors
                            ${section.included 
                                ? 'border-slate-200 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/60' 
                                : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 opacity-60'
                            }
                        `}
                    >
                        <div className="flex items-center p-3">
                            <button type="button"
                                onClick={() => toggleSection(section.id)}
                                className={`
                                    w-5 h-5 rounded flex items-center justify-center mr-3 transition-colors
                                    ${section.included 
                                        ? 'bg-cyan-500 text-white' 
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'
                                    }
                                `}
                            >
                                {section.included && <Check className="w-3 h-3" />}
                            </button>
                            
                            <div className="flex-1">
                                <h4 className="text-sm font-medium text-slate-900 dark:text-white">{section.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{section.description}</p>
                            </div>
                            
                            {section.subsections && section.subsections.length > 0 && (
                                <button type="button"
                                    onClick={() => toggleExpanded(section.id)}
                                    className="p-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                >
                                    {expandedSections.has(section.id) 
                                        ? <ChevronDown className="w-4 h-4" />
                                        : <ChevronRight className="w-4 h-4" />
                                    }
                                </button>
                            )}
                        </div>
                        
                        {/* Subsections */}
                        {expandedSections.has(section.id) && section.subsections && (
                            <div className="pl-10 pr-3 pb-3 space-y-1">
                                {section.subsections.map(sub => (
                                    <label
                                        key={sub.id}
                                        className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={sub.included}
                                            onChange={() => {/* Handle subsection toggle */}}
                                            className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                                        />
                                        {sub.title}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// ============================================================================
// PROJECT INFO FORM
// ============================================================================

interface ProjectInfoFormProps {
    projectInfo: ProjectInfo;
    onChange: (info: ProjectInfo) => void;
}

const ProjectInfoForm: React.FC<ProjectInfoFormProps> = ({ projectInfo, onChange }) => {
    const updateField = <K extends keyof ProjectInfo>(key: K, value: ProjectInfo[K]) => {
        onChange({ ...projectInfo, [key]: value });
    };
    
    return (
        <div className="grid grid-cols-2 gap-4">
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Project Name *</label>
                <input
                    type="text"
                    value={projectInfo.projectName}
                    onChange={(e) => updateField('projectName', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="Enter project name"
                />
            </div>
            
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Project Number</label>
                <input
                    type="text"
                    value={projectInfo.projectNumber || ''}
                    onChange={(e) => updateField('projectNumber', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="e.g., PRJ-2026-001"
                />
            </div>
            
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Client Name</label>
                <input
                    type="text"
                    value={projectInfo.clientName || ''}
                    onChange={(e) => updateField('clientName', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="Client organization"
                />
            </div>
            
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Design Code</label>
                <select
                    value={projectInfo.designCode}
                    onChange={(e) => updateField('designCode', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                >
                    <option value="IS 456:2000">IS 456:2000 (Concrete)</option>
                    <option value="IS 800:2007">IS 800:2007 (Steel)</option>
                    <option value="IS 1893:2016">IS 1893:2016 (Seismic)</option>
                    <option value="ACI 318-19">ACI 318-19 (Concrete)</option>
                    <option value="AISC 360-22">AISC 360-22 (Steel)</option>
                    <option value="Eurocode 2">Eurocode 2 (Concrete)</option>
                    <option value="Eurocode 3">Eurocode 3 (Steel)</option>
                </select>
            </div>
            
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Design Engineer</label>
                <input
                    type="text"
                    value={projectInfo.engineerName || ''}
                    onChange={(e) => updateField('engineerName', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="Engineer name"
                />
            </div>
            
            <div>
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Checker</label>
                <input
                    type="text"
                    value={projectInfo.checkerName || ''}
                    onChange={(e) => updateField('checkerName', e.target.value)}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                    placeholder="Checker name"
                />
            </div>
            
            <div className="col-span-2">
                <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Project Description</label>
                <textarea
                    value={projectInfo.description || ''}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 resize-none"
                    placeholder="Brief project description..."
                />
            </div>
        </div>
    );
};

// ============================================================================
// REPORT PREVIEW
// ============================================================================

interface ReportPreviewProps {
    config: ReportConfig;
}

const ReportPreview: React.FC<ReportPreviewProps> = ({ config }) => {
    const template = REPORT_TEMPLATES[config.template];
    const includedSections = config.sections.filter(s => s.included);
    
    return (
        <div className="relative bg-white rounded-lg shadow-xl overflow-hidden" style={{ maxHeight: '500px' }}>
            {/* Cover Page Preview */}
            <div className="p-8 border-b border-slate-200 relative">
                {/* Branded accent bars */}
                <div className="absolute top-0 left-0 right-0 h-[5px] bg-[#12376A]" />
                <div className="absolute top-[5px] left-0 right-0 h-[2px] bg-[#BF9B30]" />

                <div className="flex items-center justify-between mb-6 mt-1">
                    {config.includeCompanyLogo ? (
                        <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-slate-100 rounded-lg border border-slate-200" />
                            <div>
                                <div className="text-sm font-black text-[#12376A] tracking-tight">BeamLab</div>
                                <div className="text-[8px] font-bold text-slate-500 uppercase tracking-[0.2em]">Structural Engineering</div>
                            </div>
                        </div>
                    ) : (
                        <div className="text-[8px] text-slate-400 uppercase tracking-wider">Company Logo</div>
                    )}
                    <div className="text-[8px] text-slate-500 text-right leading-relaxed">
                        <div>beamlab.app</div>
                        <div>Doc Ref: RPT-{config.projectInfo.projectNumber || '0001'}</div>
                    </div>
                </div>

                <div className="text-center my-6">
                    <div className="w-12 h-[2px] bg-slate-200 mx-auto mb-4" />
                    <p className="text-[9px] font-bold text-slate-500 uppercase tracking-[0.3em] mb-2">
                        {template.name}
                    </p>
                    <h1 className="text-xl font-black text-[#12376A] leading-tight mb-3">
                        {config.projectInfo.projectName || 'Untitled Project'}
                    </h1>
                    <p className="text-[10px] text-slate-500 font-medium">
                        Revision 00 &mdash; {config.projectInfo.dateCreated.toLocaleDateString()}
                    </p>
                    <div className="w-12 h-[2px] bg-slate-200 mx-auto mt-4" />
                </div>

                <div className="grid grid-cols-2 gap-3 text-[10px] text-slate-600 mt-4">
                    {config.projectInfo.projectNumber && (
                        <div>
                            <span className="text-slate-400 font-bold text-[9px] uppercase">Project No:</span>
                            <span className="ml-2 font-mono">{config.projectInfo.projectNumber}</span>
                        </div>
                    )}
                    {config.projectInfo.clientName && (
                        <div>
                            <span className="text-slate-400 font-bold text-[9px] uppercase">Client:</span>
                            <span className="ml-2">{config.projectInfo.clientName}</span>
                        </div>
                    )}
                    <div>
                        <span className="text-slate-400 font-bold text-[9px] uppercase">Design Code:</span>
                        <span className="ml-2 font-mono">{config.projectInfo.designCode}</span>
                    </div>
                    <div>
                        <span className="text-slate-400 font-bold text-[9px] uppercase">Date:</span>
                        <span className="ml-2">{config.projectInfo.dateCreated.toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="mt-5 border border-slate-200 rounded-sm text-[10px] overflow-hidden">
                    <div className="grid grid-cols-3 bg-slate-50 px-3 py-1.5 text-slate-500 font-bold uppercase text-[9px] tracking-wider border-b border-slate-200">
                        <span>Prepared</span>
                        <span>Checked</span>
                        <span>Approved</span>
                    </div>
                    <div className="grid grid-cols-3 px-3 py-2 text-slate-700 font-medium">
                        <span>{config.projectInfo.engineerName || '\u2014'}</span>
                        <span>{config.projectInfo.checkerName || '\u2014'}</span>
                        <span>{config.projectInfo.approverName || '\u2014'}</span>
                    </div>
                </div>

                {config.confidential && (
                    <div className="mt-4 inline-block px-3 py-1 bg-red-50 text-red-600 text-[9px] font-bold tracking-wider rounded border border-red-200">
                        CONFIDENTIAL
                    </div>
                )}
            </div>
            
            {/* Table of Contents Preview */}
            <div className="p-6 overflow-y-auto" style={{ maxHeight: '300px' }}>
                <h3 className="text-[10px] font-extrabold text-slate-900 uppercase tracking-[0.1em] border-b-2 border-slate-200 pb-1.5 mb-3">
                    Table of Contents
                </h3>
                <div className="space-y-1.5">
                    {includedSections.map((section, index) => (
                        <div key={section.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-700 font-medium">
                                <span className="font-mono font-bold text-slate-500 mr-2">{index + 1}.0</span>
                                {section.title}
                            </span>
                            <span className="text-slate-300 border-b border-dotted border-slate-200 flex-1 mx-2" />
                            <span className="text-slate-400 tabular-nums font-mono text-[10px]">{index + 2}</span>
                        </div>
                    ))}
                </div>
            </div>
            
            {/* Watermark */}
            {config.watermark && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.03]">
                    <span className="text-8xl font-black text-slate-900 rotate-[-30deg]">
                        {config.watermark}
                    </span>
                </div>
            )}
        </div>
    );
};

// ============================================================================
// MAIN REPORT GENERATOR COMPONENT
// ============================================================================

interface ProfessionalReportGeneratorProps {
    onGenerate?: (config: ReportConfig, output: ReportOutput) => void;
    defaultProjectInfo?: Partial<ProjectInfo>;
}

export const ProfessionalReportGenerator: React.FC<ProfessionalReportGeneratorProps> = ({
    onGenerate,
    defaultProjectInfo
}) => {
    const [activeStep, setActiveStep] = useState(1);
    const [config, setConfig] = useState<ReportConfig>({
        template: 'detailed-design',
        sections: REPORT_TEMPLATES['detailed-design'].sections,
        projectInfo: {
            projectName: defaultProjectInfo?.projectName || '',
            projectNumber: defaultProjectInfo?.projectNumber,
            clientName: defaultProjectInfo?.clientName,
            engineerName: defaultProjectInfo?.engineerName,
            designCode: defaultProjectInfo?.designCode || 'IS 456:2000',
            dateCreated: new Date(),
            ...defaultProjectInfo
        },
        includeSignatures: true,
        includeDisclaimer: true,
        includeCompanyLogo: true,
        paperSize: 'A4',
        orientation: 'portrait',
        colorScheme: 'professional',
        confidential: false
    });
    
    const [output, setOutput] = useState<ReportOutput>({
        type: 'pdf',
        quality: 'standard'
    });
    
    const [isGenerating, setIsGenerating] = useState(false);
    
    const handleTemplateChange = (template: ReportTemplate) => {
        setConfig(prev => ({
            ...prev,
            template,
            sections: REPORT_TEMPLATES[template].sections
        }));
    };
    
    const handleGenerate = async () => {
        setIsGenerating(true);
        try {
            await onGenerate?.(config, output);
        } finally {
            setIsGenerating(false);
        }
    };
    
    const steps = [
        { number: 1, title: 'Template', icon: <FileText className="w-4 h-4" /> },
        { number: 2, title: 'Project Info', icon: <Building2 className="w-4 h-4" /> },
        { number: 3, title: 'Sections', icon: <ClipboardCheck className="w-4 h-4" /> },
        { number: 4, title: 'Generate', icon: <Download className="w-4 h-4" /> }
    ];
    
    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FileText className="w-6 h-6 text-cyan-400" />
                    Professional Report Generator
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Create comprehensive analysis reports with customizable templates
                </p>
            </div>
            
            {/* Progress Steps */}
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                    {steps.map((step, index) => (
                        <React.Fragment key={step.number}>
                            <button type="button"
                                onClick={() => setActiveStep(step.number)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg transition-all
                                    ${activeStep === step.number 
                                        ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/20' 
                                        : activeStep > step.number
                                            ? 'bg-green-500/20 text-green-400'
                                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                    }
                                `}
                            >
                                <span className={`
                                    w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                                    ${activeStep > step.number ? 'bg-green-500 text-white' : 'bg-slate-200 dark:bg-slate-700'}
                                `}>
                                    {activeStep > step.number ? <Check className="w-3 h-3" /> : step.number}
                                </span>
                                <span className="hidden sm:inline">{step.title}</span>
                            </button>
                            {index < steps.length - 1 && (
                                <div className={`flex-1 h-0.5 mx-2 rounded-full ${
                                    activeStep > step.number ? 'bg-green-500' : 'bg-slate-700/70'
                                }`} />
                            )}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            
            {/* Content */}
            <div className="p-6">
                {/* Step 1: Template Selection */}
                {activeStep === 1 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Report Template</h3>
                        <TemplateSelector
                            selected={config.template}
                            onSelect={handleTemplateChange}
                        />
                    </div>
                )}
                
                {/* Step 2: Project Info */}
                {activeStep === 2 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Project Information</h3>
                        <ProjectInfoForm
                            projectInfo={config.projectInfo}
                            onChange={(info) => setConfig(prev => ({ ...prev, projectInfo: info }))}
                        />
                    </div>
                )}
                
                {/* Step 3: Section Configuration */}
                {activeStep === 3 && (
                    <div className="space-y-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Configure Sections</h3>
                        <SectionConfigurator
                            sections={config.sections}
                            onSectionsChange={(sections) => setConfig(prev => ({ ...prev, sections }))}
                        />
                    </div>
                )}
                
                {/* Step 4: Generate */}
                {activeStep === 4 && (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-6">
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Output Options</h3>
                            
                            {/* Format Selection */}
                            <div>
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Output Format</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {(['pdf', 'docx', 'html', 'print'] as const).map(type => (
                                        <button type="button"
                                            key={type}
                                            onClick={() => setOutput(prev => ({ ...prev, type }))}
                                            className={`
                                                px-3 py-2 rounded-lg text-sm uppercase font-medium transition-colors
                                                ${output.type === type 
                                                    ? 'bg-cyan-500 text-white' 
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }
                                            `}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Quality */}
                            <div>
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Quality</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {(['draft', 'standard', 'high'] as const).map(quality => (
                                        <button type="button"
                                            key={quality}
                                            onClick={() => setOutput(prev => ({ ...prev, quality }))}
                                            className={`
                                                px-3 py-2 rounded-lg text-sm capitalize transition-colors
                                                ${output.quality === quality 
                                                    ? 'bg-cyan-500 text-white' 
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                                }
                                            `}
                                        >
                                            {quality}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Additional Options */}
                            <div className="space-y-2">
                                <label className="block text-sm text-slate-500 dark:text-slate-400 mb-2">Additional Options</label>
                                {[
                                    { key: 'includeSignatures', label: 'Include Signature Blocks' },
                                    { key: 'includeDisclaimer', label: 'Include Disclaimer' },
                                    { key: 'includeCompanyLogo', label: 'Include Company Logo' },
                                    { key: 'confidential', label: 'Mark as Confidential' }
                                ].map(({ key, label }) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={config[key as keyof ReportConfig] as boolean}
                                            onChange={(e) => setConfig(prev => ({ 
                                                ...prev, 
                                                [key]: e.target.checked 
                                            }))}
                                            className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-cyan-500"
                                        />
                                        <span className="text-sm text-slate-600 dark:text-slate-300">{label}</span>
                                    </label>
                                ))}
                            </div>
                            
                            {/* Generate Button */}
                            <button type="button"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-semibold rounded-xl hover:from-cyan-400 hover:to-blue-400 transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {isGenerating ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Download className="w-5 h-5" />
                                        Generate Report
                                    </>
                                )}
                            </button>
                        </div>
                        
                        {/* Preview */}
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Preview</h3>
                            <ReportPreview config={config} />
                        </div>
                    </div>
                )}
            </div>
            
            {/* Navigation */}
            <div className="px-6 py-4 bg-slate-100/30 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-800 flex justify-between">
                <button type="button"
                    onClick={() => setActiveStep(Math.max(1, activeStep - 1))}
                    disabled={activeStep === 1}
                    className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    Previous
                </button>
                
                {activeStep < 4 && (
                    <button type="button"
                        onClick={() => setActiveStep(Math.min(4, activeStep + 1))}
                        className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-400 transition-colors"
                    >
                        Next
                    </button>
                )}
            </div>
        </div>
    );
};

export default ProfessionalReportGenerator;
export { REPORT_TEMPLATES, TemplateSelector, SectionConfigurator, ProjectInfoForm };
