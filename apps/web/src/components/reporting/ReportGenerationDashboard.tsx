/**
 * ============================================================================
 * REPORT GENERATION DASHBOARD
 * ============================================================================
 * 
 * Comprehensive UI for generating structural engineering reports:
 * - Multiple report types
 * - Template selection
 * - Preview capability
 * - Export options
 * - Report scheduling
 * 
 * @version 2.0.0
 */

import React, { useState, useCallback, useRef } from 'react';
import {
    FileText,
    Download,
    Settings,
    Eye,
    Printer,
    Clock,
    CheckCircle,
    AlertTriangle,
    XCircle,
    ChevronRight,
    ChevronDown,
    File,
    FileSpreadsheet,
    FileCode,
    FileType,
    Palette,
    Building,
    Calculator,
    Shield,
    Layers,
    Zap,
    BookOpen,
    ClipboardList,
    RefreshCw,
    Mail,
    Calendar,
    Lock,
    Unlock,
    Upload,
    Image,
    Hash,
    Users,
    Briefcase
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

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

interface ReportGenerationDashboardProps {
    projectName: string;
    projectNumber: string;
    analysisComplete: boolean;
    onGenerate: (config: ReportConfig) => Promise<GeneratedReport>;
    onPreview: (config: ReportConfig) => Promise<string>;
    existingReports?: GeneratedReport[];
    className?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const REPORT_TYPES: Record<ReportType, { name: string; icon: React.ElementType; description: string; sections: string[] }> = {
    structural_summary: {
        name: 'Structural Summary',
        icon: FileText,
        description: 'Executive summary with key results and design status',
        sections: ['Cover', 'Summary', 'Key Results', 'Status']
    },
    detailed_analysis: {
        name: 'Detailed Analysis Report',
        icon: BookOpen,
        description: 'Comprehensive analysis results with all data',
        sections: ['Cover', 'TOC', 'Introduction', 'Geometry', 'Materials', 'Loads', 'Analysis', 'Results', 'Conclusions']
    },
    calculation_sheets: {
        name: 'Calculation Sheets',
        icon: Calculator,
        description: 'Step-by-step calculation documentation',
        sections: ['Member Calculations', 'Connection Calculations', 'Foundation Calculations']
    },
    code_compliance: {
        name: 'Code Compliance Report',
        icon: Shield,
        description: 'Detailed code compliance verification',
        sections: ['Compliance Summary', 'Design Parameters', 'Clause Checks', 'Certification']
    },
    member_design: {
        name: 'Member Design Report',
        icon: Layers,
        description: 'Complete member-by-member design documentation',
        sections: ['Beam Design', 'Column Design', 'Brace Design', 'Slab Design']
    },
    connection_design: {
        name: 'Connection Design Report',
        icon: Zap,
        description: 'Connection design with details and sketches',
        sections: ['Moment Connections', 'Shear Connections', 'Base Plates', 'Splices']
    },
    foundation_design: {
        name: 'Foundation Design Report',
        icon: Building,
        description: 'Foundation analysis and design documentation',
        sections: ['Soil Parameters', 'Footing Design', 'Pile Design', 'Settlement Analysis']
    },
    seismic_analysis: {
        name: 'Seismic Analysis Report',
        icon: Zap,
        description: 'Earthquake analysis per applicable code',
        sections: ['Seismic Parameters', 'Modal Analysis', 'Response Spectrum', 'Story Forces', 'Drift Check']
    },
    wind_analysis: {
        name: 'Wind Analysis Report',
        icon: Zap,
        description: 'Wind load analysis and design',
        sections: ['Wind Parameters', 'Pressure Coefficients', 'Load Distribution', 'MWFRS', 'C&C']
    },
    full_package: {
        name: 'Complete Report Package',
        icon: ClipboardList,
        description: 'All reports bundled together',
        sections: ['All Sections']
    }
};

const OUTPUT_FORMATS: Record<OutputFormat, { name: string; icon: React.ElementType; extension: string }> = {
    pdf: { name: 'PDF Document', icon: FileText, extension: '.pdf' },
    docx: { name: 'Word Document', icon: FileType, extension: '.docx' },
    html: { name: 'HTML Report', icon: FileCode, extension: '.html' },
    xlsx: { name: 'Excel Spreadsheet', icon: FileSpreadsheet, extension: '.xlsx' }
};

const PRESET_TEMPLATES: ReportTemplate[] = [
    {
        id: 'standard',
        name: 'Standard Engineering Report',
        description: 'Professional format with all essential sections',
        type: 'detailed_analysis',
        sections: ['cover', 'toc', 'summary', 'analysis', 'results', 'conclusions']
    },
    {
        id: 'client',
        name: 'Client Presentation',
        description: 'High-level summary suitable for client review',
        type: 'structural_summary',
        sections: ['cover', 'summary', 'key_results', 'recommendations']
    },
    {
        id: 'detailed',
        name: 'Detailed Technical Report',
        description: 'Full technical documentation with calculations',
        type: 'full_package',
        sections: ['all']
    },
    {
        id: 'compliance',
        name: 'Code Compliance Package',
        description: 'Complete code compliance documentation',
        type: 'code_compliance',
        sections: ['parameters', 'checks', 'certification']
    }
];

const COLOR_PRESETS = [
    { name: 'Blue Professional', primary: '#1e40af', accent: '#3b82f6' },
    { name: 'Green Corporate', primary: '#166534', accent: '#22c55e' },
    { name: 'Gray Minimal', primary: '#374151', accent: '#6b7280' },
    { name: 'Red Bold', primary: '#991b1b', accent: '#dc2626' },
    { name: 'Purple Modern', primary: '#5b21b6', accent: '#8b5cf6' },
    { name: 'Teal Fresh', primary: '#115e59', accent: '#14b8a6' },
];

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ReportGenerationDashboard: React.FC<ReportGenerationDashboardProps> = ({
    projectName,
    projectNumber,
    analysisComplete,
    onGenerate,
    onPreview,
    existingReports = [],
    className = ''
}) => {
    // State
    const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'schedule'>('generate');
    const [selectedType, setSelectedType] = useState<ReportType>('detailed_analysis');
    const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('pdf');
    const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>(existingReports);
    
    const [config, setConfig] = useState<ReportConfig>({
        type: 'detailed_analysis',
        format: 'pdf',
        template: 'standard',
        title: `Structural Analysis Report - ${projectName}`,
        revision: 'A',
        confidential: true,
        branding: {
            companyName: 'Structural Engineering Consultants',
            primaryColor: '#1e40af',
            accentColor: '#3b82f6',
            headerStyle: 'modern'
        },
        sections: REPORT_TYPES.detailed_analysis.sections.map((s, i) => ({
            id: s.toLowerCase().replace(/\s/g, '_'),
            name: s,
            enabled: true,
            order: i
        }))
    });
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Handlers
    const handleTypeChange = useCallback((type: ReportType) => {
        setSelectedType(type);
        setConfig(prev => ({
            ...prev,
            type,
            title: `${REPORT_TYPES[type].name} - ${projectName}`,
            sections: REPORT_TYPES[type].sections.map((s, i) => ({
                id: s.toLowerCase().replace(/\s/g, '_'),
                name: s,
                enabled: true,
                order: i
            }))
        }));
    }, [projectName]);

    const handleFormatChange = useCallback((format: OutputFormat) => {
        setSelectedFormat(format);
        setConfig(prev => ({ ...prev, format }));
    }, []);

    const handleGenerate = useCallback(async () => {
        setIsGenerating(true);
        try {
            const report = await onGenerate(config);
            setGeneratedReports(prev => [report, ...prev]);
        } catch (error) {
            console.error('Report generation failed:', error);
        } finally {
            setIsGenerating(false);
        }
    }, [config, onGenerate]);

    const handlePreview = useCallback(async () => {
        try {
            const url = await onPreview(config);
            setPreviewUrl(url);
            setShowPreview(true);
        } catch (error) {
            console.error('Preview failed:', error);
        }
    }, [config, onPreview]);

    const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setConfig(prev => ({
                    ...prev,
                    branding: { ...prev.branding, companyLogo: event.target?.result as string }
                }));
            };
            reader.readAsDataURL(file);
        }
    }, []);

    const toggleSection = useCallback((sectionId: string) => {
        setConfig(prev => ({
            ...prev,
            sections: prev.sections.map(s => 
                s.id === sectionId ? { ...s, enabled: !s.enabled } : s
            )
        }));
    }, []);

    // Render
    return (
        <div className={`bg-white rounded-xl shadow-lg ${className}`}>
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 rounded-t-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                        <FileText className="w-8 h-8 text-white" />
                        <div>
                            <h2 className="text-xl font-bold text-white">Report Generation</h2>
                            <p className="text-blue-100 text-sm">{projectName} • {projectNumber}</p>
                        </div>
                    </div>
                    
                    {!analysisComplete && (
                        <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-500 rounded-full">
                            <AlertTriangle className="w-4 h-4 text-white" />
                            <span className="text-sm text-white font-medium">Analysis Required</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
                {[
                    { id: 'generate', label: 'Generate Report', icon: FileText },
                    { id: 'history', label: 'Report History', icon: Clock },
                    { id: 'schedule', label: 'Scheduled Reports', icon: Calendar }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex items-center space-x-2 px-6 py-3 font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                        }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Content */}
            <div className="p-6">
                {activeTab === 'generate' && (
                    <div className="space-y-6">
                        {/* Report Type Selection */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                <FileText className="w-4 h-4 mr-2" />
                                Report Type
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {Object.entries(REPORT_TYPES).map(([type, info]) => (
                                    <button
                                        key={type}
                                        onClick={() => handleTypeChange(type as ReportType)}
                                        className={`p-4 rounded-lg border-2 transition-all ${
                                            selectedType === type
                                                ? 'border-blue-500 bg-blue-50 shadow-md'
                                                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                    >
                                        <info.icon className={`w-8 h-8 mx-auto mb-2 ${
                                            selectedType === type ? 'text-blue-600' : 'text-gray-400'
                                        }`} />
                                        <p className={`text-sm font-medium text-center ${
                                            selectedType === type ? 'text-blue-700' : 'text-gray-700'
                                        }`}>
                                            {info.name}
                                        </p>
                                    </button>
                                ))}
                            </div>
                            <p className="mt-2 text-sm text-gray-500">
                                {REPORT_TYPES[selectedType].description}
                            </p>
                        </div>

                        {/* Output Format */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                <File className="w-4 h-4 mr-2" />
                                Output Format
                            </h3>
                            <div className="flex space-x-3">
                                {Object.entries(OUTPUT_FORMATS).map(([format, info]) => (
                                    <button
                                        key={format}
                                        onClick={() => handleFormatChange(format as OutputFormat)}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                                            selectedFormat === format
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <info.icon className={`w-5 h-5 ${
                                            selectedFormat === format ? 'text-blue-600' : 'text-gray-400'
                                        }`} />
                                        <span className={`text-sm font-medium ${
                                            selectedFormat === format ? 'text-blue-700' : 'text-gray-600'
                                        }`}>
                                            {info.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Template Selection */}
                        <div>
                            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center">
                                <Palette className="w-4 h-4 mr-2" />
                                Template
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {PRESET_TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => {
                                            setSelectedTemplate(template.id);
                                            setConfig(prev => ({ ...prev, template: template.id }));
                                        }}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            selectedTemplate === template.id
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                        }`}
                                    >
                                        <p className={`font-medium ${
                                            selectedTemplate === template.id ? 'text-blue-700' : 'text-gray-700'
                                        }`}>
                                            {template.name}
                                        </p>
                                        <p className="text-xs text-gray-500 mt-1">
                                            {template.description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Report Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Report Title
                                </label>
                                <input
                                    type="text"
                                    value={config.title}
                                    onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Revision
                                    </label>
                                    <input
                                        type="text"
                                        value={config.revision}
                                        onChange={e => setConfig(prev => ({ ...prev, revision: e.target.value }))}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Confidential
                                    </label>
                                    <button
                                        onClick={() => setConfig(prev => ({ ...prev, confidential: !prev.confidential }))}
                                        className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                                            config.confidential
                                                ? 'border-red-500 bg-red-50 text-red-700'
                                                : 'border-gray-300 bg-white text-gray-600'
                                        }`}
                                    >
                                        {config.confidential ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                        <span>{config.confidential ? 'Yes' : 'No'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Advanced Options */}
                        <div className="border border-gray-200 rounded-lg">
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
                            >
                                <span className="flex items-center space-x-2">
                                    <Settings className="w-5 h-5 text-gray-400" />
                                    <span className="font-medium text-gray-700">Advanced Options</span>
                                </span>
                                {showAdvanced ? (
                                    <ChevronDown className="w-5 h-5 text-gray-400" />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-400" />
                                )}
                            </button>
                            
                            {showAdvanced && (
                                <div className="p-4 border-t border-gray-200 space-y-4">
                                    {/* Branding */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Branding</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Company Name</label>
                                                <input
                                                    type="text"
                                                    value={config.branding.companyName}
                                                    onChange={e => setConfig(prev => ({
                                                        ...prev,
                                                        branding: { ...prev.branding, companyName: e.target.value }
                                                    }))}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Primary Color</label>
                                                <div className="flex space-x-2">
                                                    <input
                                                        type="color"
                                                        value={config.branding.primaryColor}
                                                        onChange={e => setConfig(prev => ({
                                                            ...prev,
                                                            branding: { ...prev.branding, primaryColor: e.target.value }
                                                        }))}
                                                        className="w-10 h-10 rounded-lg cursor-pointer"
                                                    />
                                                    <select
                                                        onChange={e => {
                                                            const preset = COLOR_PRESETS.find(p => p.primary === e.target.value);
                                                            if (preset) {
                                                                setConfig(prev => ({
                                                                    ...prev,
                                                                    branding: { 
                                                                        ...prev.branding, 
                                                                        primaryColor: preset.primary,
                                                                        accentColor: preset.accent
                                                                    }
                                                                }));
                                                            }
                                                        }}
                                                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                                    >
                                                        <option value="">Preset Colors</option>
                                                        {COLOR_PRESETS.map(p => (
                                                            <option key={p.name} value={p.primary}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">Company Logo</label>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                    className="hidden"
                                                />
                                                <button
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    <span>{config.branding.companyLogo ? 'Change Logo' : 'Upload Logo'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sections */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Sections to Include</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {config.sections.map(section => (
                                                <label
                                                    key={section.id}
                                                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                                        section.enabled
                                                            ? 'bg-blue-50 border-blue-200'
                                                            : 'bg-gray-50 border-gray-200'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={section.enabled}
                                                        onChange={() => toggleSection(section.id)}
                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm">{section.name}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Watermark */}
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">Watermark Text (Optional)</label>
                                        <input
                                            type="text"
                                            value={config.watermark || ''}
                                            onChange={e => setConfig(prev => ({ ...prev, watermark: e.target.value }))}
                                            placeholder="e.g., DRAFT, FOR REVIEW ONLY"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                            <button
                                onClick={handlePreview}
                                className="flex items-center space-x-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <Eye className="w-5 h-5" />
                                <span>Preview</span>
                            </button>
                            
                            <div className="flex items-center space-x-3">
                                <button
                                    className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    <Printer className="w-5 h-5" />
                                    <span>Print</span>
                                </button>
                                
                                <button
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !analysisComplete}
                                    className={`flex items-center space-x-2 px-6 py-2 rounded-lg font-medium transition-all ${
                                        isGenerating || !analysisComplete
                                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg hover:shadow-xl'
                                    }`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            <span>Generating...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-5 h-5" />
                                            <span>Generate Report</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-800">Generated Reports</h3>
                            <span className="text-sm text-gray-500">{generatedReports.length} reports</span>
                        </div>
                        
                        {generatedReports.length === 0 ? (
                            <div className="text-center py-12 text-gray-500">
                                <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                                <p>No reports generated yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {generatedReports.map(report => (
                                    <div
                                        key={report.id}
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center space-x-4">
                                            {report.status === 'ready' ? (
                                                <CheckCircle className="w-5 h-5 text-green-500" />
                                            ) : report.status === 'generating' ? (
                                                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                                            ) : (
                                                <XCircle className="w-5 h-5 text-red-500" />
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">{report.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {report.generatedAt.toLocaleDateString()} • {report.size}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {report.status === 'ready' && (
                                            <div className="flex items-center space-x-2">
                                                <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                                <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                                    <Download className="w-5 h-5" />
                                                </button>
                                                <button className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                                                    <Mail className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'schedule' && (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-800">Scheduled Reports</h3>
                            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <Calendar className="w-4 h-4" />
                                <span>New Schedule</span>
                            </button>
                        </div>
                        
                        <div className="text-center py-12 text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                            <p>No scheduled reports</p>
                            <p className="text-sm mt-1">Set up automatic report generation</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {showPreview && previewUrl && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold">Report Preview</h3>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <XCircle className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-4 h-[70vh] overflow-auto">
                            <iframe
                                src={previewUrl}
                                className="w-full h-full border border-gray-200 rounded-lg"
                                title="Report Preview"
                            />
                        </div>
                        <div className="flex justify-end space-x-3 px-6 py-4 border-t border-gray-200">
                            <button
                                onClick={() => setShowPreview(false)}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Close
                            </button>
                            <button
                                onClick={handleGenerate}
                                className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Download className="w-4 h-4" />
                                <span>Generate Full Report</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportGenerationDashboard;
