/**
 * ============================================================================
 * EXPORT MANAGER
 * ============================================================================
 * 
 * Comprehensive export functionality for structural analysis:
 * - 3D Model exports (STEP, IFC, OBJ, STL, DXF)
 * - Analysis results (CSV, Excel, JSON, XML)
 * - Reports (PDF, DOCX, HTML)
 * - Images (PNG, SVG, JPEG)
 * - BIM integration (IFC, Revit, Tekla)
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback } from 'react';
import {
    Download,
    FileText,
    Image,
    Database,
    Box,
    FileCode,
    FileSpreadsheet,
    Settings,
    Check,
    AlertCircle,
    Loader2,
    ChevronRight,
    Folder,
    File,
    X
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type ExportCategory = 'model' | 'results' | 'reports' | 'images' | 'bim';

export type ModelFormat = 'ifc' | 'step' | 'iges' | 'obj' | 'stl' | 'dxf' | 'dwg' | 'fbx' | 'gltf';
export type ResultsFormat = 'csv' | 'xlsx' | 'json' | 'xml' | 'txt' | 'mat';
export type ReportFormat = 'pdf' | 'docx' | 'html' | 'rtf' | 'odt';
export type ImageFormat = 'png' | 'svg' | 'jpeg' | 'tiff' | 'webp';
export type BIMFormat = 'ifc2x3' | 'ifc4' | 'rvt' | 'tekla' | 'navisworks';

export interface ExportFormat {
    id: string;
    name: string;
    extension: string;
    description: string;
    icon: React.ReactNode;
    category: ExportCategory;
    requiresLicense?: boolean;
    beta?: boolean;
}

export interface ExportOptions {
    format: string;
    includeMetadata: boolean;
    includeUnits: boolean;
    precision: number;
    coordinateSystem: 'local' | 'global' | 'project';
    scale: number;
    compression?: boolean;
    splitByMember?: boolean;
    includeLoadCases?: boolean;
    selectedLoadCase?: string;
    includeEnvelopes?: boolean;
}

export interface ExportJob {
    id: string;
    name: string;
    format: ExportFormat;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: number;
    error?: string;
    downloadUrl?: string;
    createdAt: Date;
    completedAt?: Date;
    fileSize?: number;
}

// ============================================================================
// FORMAT DEFINITIONS
// ============================================================================

const EXPORT_FORMATS: Record<ExportCategory, ExportFormat[]> = {
    model: [
        { id: 'ifc', name: 'IFC', extension: '.ifc', description: 'Industry Foundation Classes (BIM)', icon: <Box className="w-4 h-4" />, category: 'model' },
        { id: 'step', name: 'STEP', extension: '.step', description: 'Standard for Exchange of Product Data', icon: <Box className="w-4 h-4" />, category: 'model' },
        { id: 'obj', name: 'OBJ', extension: '.obj', description: 'Wavefront 3D Object', icon: <Box className="w-4 h-4" />, category: 'model' },
        { id: 'stl', name: 'STL', extension: '.stl', description: 'Stereolithography (3D printing)', icon: <Box className="w-4 h-4" />, category: 'model' },
        { id: 'dxf', name: 'DXF', extension: '.dxf', description: 'AutoCAD Drawing Exchange', icon: <Box className="w-4 h-4" />, category: 'model' },
        { id: 'gltf', name: 'glTF', extension: '.gltf', description: 'GL Transmission Format (Web)', icon: <Box className="w-4 h-4" />, category: 'model' },
        { id: 'fbx', name: 'FBX', extension: '.fbx', description: 'Filmbox (Autodesk)', icon: <Box className="w-4 h-4" />, category: 'model', beta: true }
    ],
    results: [
        { id: 'csv', name: 'CSV', extension: '.csv', description: 'Comma-Separated Values', icon: <FileSpreadsheet className="w-4 h-4" />, category: 'results' },
        { id: 'xlsx', name: 'Excel', extension: '.xlsx', description: 'Microsoft Excel Workbook', icon: <FileSpreadsheet className="w-4 h-4" />, category: 'results' },
        { id: 'json', name: 'JSON', extension: '.json', description: 'JavaScript Object Notation', icon: <FileCode className="w-4 h-4" />, category: 'results' },
        { id: 'xml', name: 'XML', extension: '.xml', description: 'Extensible Markup Language', icon: <FileCode className="w-4 h-4" />, category: 'results' },
        { id: 'txt', name: 'Text', extension: '.txt', description: 'Plain Text (Tabulated)', icon: <FileText className="w-4 h-4" />, category: 'results' },
        { id: 'mat', name: 'MATLAB', extension: '.mat', description: 'MATLAB Data File', icon: <Database className="w-4 h-4" />, category: 'results', beta: true }
    ],
    reports: [
        { id: 'pdf', name: 'PDF', extension: '.pdf', description: 'Portable Document Format', icon: <FileText className="w-4 h-4" />, category: 'reports' },
        { id: 'docx', name: 'Word', extension: '.docx', description: 'Microsoft Word Document', icon: <FileText className="w-4 h-4" />, category: 'reports' },
        { id: 'html', name: 'HTML', extension: '.html', description: 'Web Page', icon: <FileCode className="w-4 h-4" />, category: 'reports' },
        { id: 'rtf', name: 'RTF', extension: '.rtf', description: 'Rich Text Format', icon: <FileText className="w-4 h-4" />, category: 'reports' }
    ],
    images: [
        { id: 'png', name: 'PNG', extension: '.png', description: 'Portable Network Graphics', icon: <Image className="w-4 h-4" />, category: 'images' },
        { id: 'svg', name: 'SVG', extension: '.svg', description: 'Scalable Vector Graphics', icon: <Image className="w-4 h-4" />, category: 'images' },
        { id: 'jpeg', name: 'JPEG', extension: '.jpg', description: 'Joint Photographic Experts Group', icon: <Image className="w-4 h-4" />, category: 'images' },
        { id: 'tiff', name: 'TIFF', extension: '.tiff', description: 'Tagged Image File Format', icon: <Image className="w-4 h-4" />, category: 'images' }
    ],
    bim: [
        { id: 'ifc2x3', name: 'IFC 2x3', extension: '.ifc', description: 'Industry Foundation Classes v2x3', icon: <Box className="w-4 h-4" />, category: 'bim' },
        { id: 'ifc4', name: 'IFC 4', extension: '.ifc', description: 'Industry Foundation Classes v4', icon: <Box className="w-4 h-4" />, category: 'bim' },
        { id: 'revit', name: 'Revit', extension: '.rvt', description: 'Autodesk Revit', icon: <Box className="w-4 h-4" />, category: 'bim', requiresLicense: true },
        { id: 'tekla', name: 'Tekla', extension: '.ifc', description: 'Tekla Structures', icon: <Box className="w-4 h-4" />, category: 'bim' }
    ]
};

const CATEGORY_INFO: Record<ExportCategory, { label: string; icon: React.ReactNode; description: string }> = {
    model: { label: '3D Model', icon: <Box className="w-5 h-5" />, description: 'Export geometry and structure' },
    results: { label: 'Results Data', icon: <Database className="w-5 h-5" />, description: 'Export analysis results' },
    reports: { label: 'Reports', icon: <FileText className="w-5 h-5" />, description: 'Generate documentation' },
    images: { label: 'Images', icon: <Image className="w-5 h-5" />, description: 'Export visualizations' },
    bim: { label: 'BIM/CAD', icon: <Box className="w-5 h-5" />, description: 'BIM integration exports' }
};

// ============================================================================
// DEFAULT OPTIONS
// ============================================================================

const DEFAULT_OPTIONS: ExportOptions = {
    format: 'csv',
    includeMetadata: true,
    includeUnits: true,
    precision: 4,
    coordinateSystem: 'global',
    scale: 1.0,
    compression: false,
    splitByMember: false,
    includeLoadCases: true,
    includeEnvelopes: true
};

// ============================================================================
// FORMAT CARD COMPONENT
// ============================================================================

interface FormatCardProps {
    format: ExportFormat;
    selected: boolean;
    onSelect: () => void;
}

const FormatCard: React.FC<FormatCardProps> = ({ format, selected, onSelect }) => (
    <button type="button"
        onClick={onSelect}
        className={`
            p-3 rounded-xl border-2 text-left transition-all
            ${selected 
                ? 'border-blue-500 bg-blue-500/10' 
                : 'border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50 hover:border-slate-300 dark:hover:border-slate-600'
            }
            ${format.requiresLicense ? 'opacity-60' : ''}
        `}
    >
        <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${selected ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}`}>
                {format.icon}
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900 dark:text-white">{format.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{format.extension}</span>
                    {format.beta && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-amber-500/20 text-amber-400 rounded">
                            BETA
                        </span>
                    )}
                    {format.requiresLicense && (
                        <span className="px-1.5 py-0.5 text-[10px] font-medium bg-purple-500/20 text-purple-400 rounded">
                            PRO
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{format.description}</p>
            </div>
            {selected && (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-white" />
                </div>
            )}
        </div>
    </button>
);

// ============================================================================
// OPTIONS PANEL
// ============================================================================

interface OptionsPanelProps {
    options: ExportOptions;
    category: ExportCategory;
    onChange: (options: ExportOptions) => void;
}

const OptionsPanel: React.FC<OptionsPanelProps> = ({ options, category, onChange }) => {
    const updateOption = <K extends keyof ExportOptions>(key: K, value: ExportOptions[K]) => {
        onChange({ ...options, [key]: value });
    };
    
    return (
        <div className="space-y-4">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                Export Options
            </h4>
            
            {/* Common Options */}
            <div className="grid grid-cols-2 gap-4">
                {/* Precision */}
                <div>
                    <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Decimal Precision</label>
                    <select
                        value={options.precision}
                        onChange={(e) => updateOption('precision', parseInt(e.target.value))}
                        className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-blue-500"
                    >
                        <option value={2}>2 decimals</option>
                        <option value={3}>3 decimals</option>
                        <option value={4}>4 decimals</option>
                        <option value={6}>6 decimals</option>
                    </select>
                </div>
                
                {/* Coordinate System */}
                {(category === 'model' || category === 'results') && (
                    <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Coordinate System</label>
                        <select
                            value={options.coordinateSystem}
                            onChange={(e) => updateOption('coordinateSystem', e.target.value as any)}
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-blue-500"
                        >
                            <option value="global">Global (World)</option>
                            <option value="local">Local (Member)</option>
                            <option value="project">Project</option>
                        </select>
                    </div>
                )}
                
                {/* Scale (for model exports) */}
                {category === 'model' && (
                    <div>
                        <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Scale Factor</label>
                        <select
                            value={options.scale}
                            onChange={(e) => updateOption('scale', parseFloat(e.target.value))}
                            className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white text-sm focus:border-blue-500"
                        >
                            <option value={1}>1:1</option>
                            <option value={0.001}>mm to m (÷1000)</option>
                            <option value={1000}>m to mm (×1000)</option>
                            <option value={0.0254}>in to m</option>
                            <option value={0.3048}>ft to m</option>
                        </select>
                    </div>
                )}
            </div>
            
            {/* Toggle Options */}
            <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={options.includeMetadata}
                        onChange={(e) => updateOption('includeMetadata', e.target.checked)}
                        className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Include metadata (project info, timestamp)</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={options.includeUnits}
                        onChange={(e) => updateOption('includeUnits', e.target.checked)}
                        className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-blue-500"
                    />
                    <span className="text-sm text-slate-600 dark:text-slate-300">Include units in headers</span>
                </label>
                
                {category === 'results' && (
                    <>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={options.includeLoadCases}
                                onChange={(e) => updateOption('includeLoadCases', e.target.checked)}
                                className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-blue-500"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">Include all load cases</span>
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={options.includeEnvelopes}
                                onChange={(e) => updateOption('includeEnvelopes', e.target.checked)}
                                className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-blue-500"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">Include envelope values</span>
                        </label>
                        
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={options.splitByMember}
                                onChange={(e) => updateOption('splitByMember', e.target.checked)}
                                className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-blue-500"
                            />
                            <span className="text-sm text-slate-600 dark:text-slate-300">Split into separate files by member</span>
                        </label>
                    </>
                )}
                
                {(category === 'model' || category === 'results') && (
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={options.compression}
                            onChange={(e) => updateOption('compression', e.target.checked)}
                            className="rounded bg-slate-200 dark:bg-slate-700 border-slate-600 text-blue-500"
                        />
                        <span className="text-sm text-slate-600 dark:text-slate-300">Compress output (ZIP)</span>
                    </label>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// EXPORT JOB CARD
// ============================================================================

interface ExportJobCardProps {
    job: ExportJob;
    onDownload: () => void;
    onCancel: () => void;
}

const ExportJobCard: React.FC<ExportJobCardProps> = ({ job, onDownload, onCancel }) => {
    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };
    
    return (
        <div className={`
            p-4 rounded-xl border transition-colors
            ${job.status === 'completed' ? 'border-green-500/30 bg-green-500/5' :
              job.status === 'failed' ? 'border-red-500/30 bg-red-500/5' :
              'border-slate-200 dark:border-slate-700 bg-slate-100/50 dark:bg-slate-800/50'}
        `}>
            <div className="flex items-center gap-3">
                <div className={`
                    p-2 rounded-lg
                    ${job.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                      job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                      job.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400'}
                `}>
                    {job.status === 'processing' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : job.status === 'completed' ? (
                        <Check className="w-4 h-4" />
                    ) : job.status === 'failed' ? (
                        <AlertCircle className="w-4 h-4" />
                    ) : (
                        job.format.icon
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 dark:text-white truncate">{job.name}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">{job.format.extension}</span>
                    </div>
                    
                    {job.status === 'processing' && (
                        <div className="mt-2">
                            <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-blue-500 transition-all duration-300"
                                    style={{ width: `${job.progress}%` }}
                                />
                            </div>
                            <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">{job.progress}% complete</span>
                        </div>
                    )}
                    
                    {job.status === 'completed' && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            {formatFileSize(job.fileSize)} • Completed {job.completedAt?.toLocaleTimeString()}
                        </p>
                    )}
                    
                    {job.status === 'failed' && (
                        <p className="text-xs text-red-400">{job.error || 'Export failed'}</p>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
                    {job.status === 'completed' && (
                        <button type="button"
                            onClick={onDownload}
                            className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-400 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                        </button>
                    )}
                    
                    {(job.status === 'pending' || job.status === 'processing') && (
                        <button type="button"
                            onClick={onCancel}
                            className="p-2 bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-lg hover:bg-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

// ============================================================================
// MAIN EXPORT MANAGER COMPONENT
// ============================================================================

interface ExportManagerProps {
    projectName?: string;
    onExport?: (format: ExportFormat, options: ExportOptions) => Promise<ExportJob>;
}

export const ExportManager: React.FC<ExportManagerProps> = ({
    projectName = 'Untitled Project',
    onExport
}) => {
    const [activeCategory, setActiveCategory] = useState<ExportCategory>('results');
    const [selectedFormat, setSelectedFormat] = useState<ExportFormat | null>(null);
    const [options, setOptions] = useState<ExportOptions>(DEFAULT_OPTIONS);
    const [jobs, setJobs] = useState<ExportJob[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    
    const handleExport = useCallback(async () => {
        if (!selectedFormat) return;
        
        setIsExporting(true);
        
        const newJob: ExportJob = {
            id: `job-${Date.now()}`,
            name: `${projectName}_${selectedFormat.name}`,
            format: selectedFormat,
            status: 'processing',
            progress: 0,
            createdAt: new Date()
        };
        
        setJobs(prev => [newJob, ...prev]);
        
        try {
            // Simulate progress
            for (let i = 0; i <= 100; i += 10) {
                await new Promise(resolve => setTimeout(resolve, 200));
                setJobs(prev => prev.map(j => 
                    j.id === newJob.id ? { ...j, progress: i } : j
                ));
            }
            
            // Complete the job
            setJobs(prev => prev.map(j => 
                j.id === newJob.id ? {
                    ...j,
                    status: 'completed',
                    progress: 100,
                    completedAt: new Date(),
                    fileSize: Math.floor(Math.random() * 1000000) + 50000,
                    downloadUrl: '#'
                } : j
            ));
            
            if (onExport) {
                await onExport(selectedFormat, options);
            }
        } catch (error) {
            setJobs(prev => prev.map(j => 
                j.id === newJob.id ? {
                    ...j,
                    status: 'failed',
                    error: error instanceof Error ? error.message : 'Export failed'
                } : j
            ));
        } finally {
            setIsExporting(false);
        }
    }, [selectedFormat, options, projectName, onExport]);
    
    const handleDownload = (job: ExportJob) => {
        // Trigger download
        if (job.downloadUrl) {
            window.open(job.downloadUrl, '_blank');
        }
    };
    
    const handleCancel = (jobId: string) => {
        setJobs(prev => prev.filter(j => j.id !== jobId));
    };
    
    return (
        <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Download className="w-6 h-6 text-blue-400" />
                    Export Manager
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Export your structural model and analysis results in various formats
                </p>
            </div>
            
            <div className="flex">
                {/* Category Sidebar */}
                <div className="w-56 border-r border-slate-200 dark:border-slate-800 p-4">
                    <div className="space-y-1">
                        {Object.entries(CATEGORY_INFO).map(([key, info]) => (
                            <button type="button"
                                key={key}
                                onClick={() => {
                                    setActiveCategory(key as ExportCategory);
                                    setSelectedFormat(null);
                                }}
                                className={`
                                    w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors
                                    ${activeCategory === key 
                                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/30' 
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                    }
                                `}
                            >
                                {info.icon}
                                <div className="flex-1">
                                    <div className="font-medium text-sm">{info.label}</div>
                                    <div className="text-xs opacity-70">{info.description}</div>
                                </div>
                                {activeCategory === key && (
                                    <ChevronRight className="w-4 h-4" />
                                )}
                            </button>
                        ))}
                    </div>
                    
                    {/* Recent Exports */}
                    {jobs.length > 0 && (
                        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
                            <h4 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                Recent Exports
                            </h4>
                            <div className="space-y-2">
                                {jobs.slice(0, 3).map(job => (
                                    <div
                                        key={job.id}
                                        className={`
                                            flex items-center gap-2 text-xs p-2 rounded-lg
                                            ${job.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                                              job.status === 'failed' ? 'bg-red-500/10 text-red-400' :
                                              'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}
                                        `}
                                    >
                                        <File className="w-3 h-3" />
                                        <span className="truncate flex-1">{job.name}{job.format.extension}</span>
                                        {job.status === 'processing' && (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Main Content */}
                <div className="flex-1 p-6">
                    {/* Format Selection */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                            Select {CATEGORY_INFO[activeCategory].label} Format
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {EXPORT_FORMATS[activeCategory].map(format => (
                                <FormatCard
                                    key={format.id}
                                    format={format}
                                    selected={selectedFormat?.id === format.id}
                                    onSelect={() => setSelectedFormat(format)}
                                />
                            ))}
                        </div>
                    </div>
                    
                    {/* Options Panel */}
                    {selectedFormat && (
                        <div className="mb-6 p-4 bg-slate-100/30 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
                            <OptionsPanel
                                options={options}
                                category={activeCategory}
                                onChange={setOptions}
                            />
                        </div>
                    )}
                    
                    {/* Export Button */}
                    <div className="flex items-center gap-4">
                        <button type="button"
                            onClick={handleExport}
                            disabled={!selectedFormat || isExporting}
                            className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-500 text-white font-semibold rounded-xl hover:from-blue-400 hover:to-blue-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isExporting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Exporting...
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    Export {selectedFormat?.name || 'File'}
                                </>
                            )}
                        </button>
                        
                        {selectedFormat && (
                            <span className="text-sm text-slate-500 dark:text-slate-400">
                                Output: <span className="text-slate-900 dark:text-white">{projectName}{selectedFormat.extension}</span>
                            </span>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Export Jobs */}
            {jobs.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-800 p-6">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                        <Folder className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                        Export Queue
                    </h3>
                    <div className="space-y-3">
                        {jobs.map(job => (
                            <ExportJobCard
                                key={job.id}
                                job={job}
                                onDownload={() => handleDownload(job)}
                                onCancel={() => handleCancel(job.id)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ExportManager;
export { EXPORT_FORMATS, CATEGORY_INFO, FormatCard, OptionsPanel };
