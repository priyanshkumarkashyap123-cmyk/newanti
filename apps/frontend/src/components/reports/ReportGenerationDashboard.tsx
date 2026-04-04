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

import React, { useState, useCallback, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { API_CONFIG } from '../../config/env';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { 
    PRESET_TEMPLATES,
    type ReportType,
    type ReportTemplate,
    type BrandingConfig,
    type ReportConfig,
    type GeneratedReport
} from '../../modules/reporting/config/reportTemplateConfig';
import { OUTPUT_FORMATS, type OutputFormat } from '../../modules/reporting/config/reportFormatConfig';
import { COLOR_PRESETS, DEFAULT_BRANDING } from '../../modules/reporting/config/reportBrandingConfig';
import { useToast } from '../../providers/ToastProvider';
import { REPORT_TYPES } from './reportGenerationTypes';

// ============================================================================
// CONSTANTS
// ============================================================================

export interface ReportGenerationDashboardProps {
    projectName: string;
    projectNumber: string;
    analysisComplete: boolean;
    onGenerate: (config: ReportConfig) => Promise<GeneratedReport>;
    onPreview: (config: ReportConfig) => Promise<string>;
    existingReports?: GeneratedReport[];
    /** Optional analysis data payload required for async job-based reports */
    analysisData?: Record<string, any>;
    /** Optional override for Python API base */
    pythonApiBase?: string;
    className?: string;
}

type ReportJobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

interface ReportJob {
    jobId: string;
    status: ReportJobStatus;
    progress: number;
    error?: string | null;
    filename?: string | null;
    downloadReady?: boolean;
}

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
    analysisData,
    pythonApiBase,
    className = ''
}) => {
    // State
    const [activeTab, setActiveTab] = useState<'generate' | 'history' | 'schedule'>('generate');
    const [selectedType, setSelectedType] = useState<ReportType>('detailed_analysis');
    const [selectedFormat, setSelectedFormat] = useState<OutputFormat>('pdf');
    const [selectedTemplate, setSelectedTemplate] = useState<string>('standard');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [jobs, setJobs] = useState<ReportJob[]>([]);
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

    const pythonBase = (pythonApiBase || API_CONFIG?.pythonUrl || '').replace(/\/$/, '');
    const toast = useToast();

    const upsertJob = useCallback((job: ReportJob) => {
        setJobs(prev => {
            const existing = prev.find(j => j.jobId === job.jobId);
            if (existing) {
                return prev.map(j => (j.jobId === job.jobId ? { ...existing, ...job } : j));
            }
            return [job, ...prev];
        });
    }, []);

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
        // Prefer async job flow when analysisData is available
        if (analysisData && pythonBase) {
            setIsGenerating(true);
            try {
                const response = await fetch(`${pythonBase}/reports/jobs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        analysis_data: analysisData,
                        customization: {
                            project_name: config.title,
                            project_number: projectNumber,
                            primary_color: [0.0, 0.4, 0.8],
                            include_cover_page: true,
                            include_toc: true,
                        }
                    })
                });

                if (!response.ok) {
                    throw new Error(`Job creation failed (${response.status})`);
                }

                const payload = await response.json();
                const jobId = payload.job_id as string;
                upsertJob({ jobId, status: payload.status ?? 'pending', progress: 0 });
            } catch (error) {
                console.error('Report job creation failed:', error);
                toast.error('Failed to start report job', 'Report Generation');
            } finally {
                setIsGenerating(false);
            }
            return;
        }

        // Fallback to legacy inline generation
        setIsGenerating(true);
        try {
            const report = await onGenerate(config);
            setGeneratedReports(prev => [report, ...prev]);
        } catch (error) {
            console.error('Report generation failed:', error);
            toast.error('Report generation failed', 'Report Generation');
        } finally {
            setIsGenerating(false);
        }
    }, [analysisData, pythonBase, config, onGenerate, projectNumber, upsertJob]);

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

    // Poll running/pending jobs
    useEffect(() => {
        if (!pythonBase) return;
        const active = jobs.filter(j => j.status === 'pending' || j.status === 'running');
        if (active.length === 0) return;

        const controller = new AbortController();
        const interval = setInterval(async () => {
            for (const job of active) {
                try {
                    const resp = await fetch(`${pythonBase}/reports/jobs/${job.jobId}`, { signal: controller.signal });
                    if (!resp.ok) continue;
                    const data = await resp.json();
                    upsertJob({
                        jobId: job.jobId,
                        status: data.status,
                        progress: data.progress ?? job.progress,
                        error: data.error,
                        filename: data.filename,
                        downloadReady: data.download_ready,
                    });
                    if (data.status === 'succeeded' && data.download_ready) {
                        toast.success('Report is ready to download', 'Report Generation');
                    }
                    if (data.status === 'failed' && data.error) {
                        toast.error(data.error || 'Report generation failed', 'Report Generation');
                    }
                } catch (err) {
                    console.error('Job poll failed', err);
                }
            }
        }, 2000);

        return () => {
            controller.abort();
            clearInterval(interval);
        };
    }, [jobs, pythonBase, upsertJob]);

    const renderJobStatus = (job: ReportJob) => {
        const statusColor: Record<ReportJobStatus, string> = {
            pending: 'text-amber-400',
            running: 'text-blue-400',
            succeeded: 'text-green-400',
            failed: 'text-red-400',
        };

        const iconByStatus: Record<ReportJobStatus, React.ReactElement> = {
            pending: <Clock className="w-4 h-4" />, 
            running: <RefreshCw className="w-4 h-4 animate-spin" />, 
            succeeded: <CheckCircle className="w-4 h-4" />, 
            failed: <XCircle className="w-4 h-4" />,
        };

        const downloadUrl = job.downloadReady ? `${pythonBase}/reports/jobs/${job.jobId}/download` : null;

        return (
            <div key={job.jobId} className="flex items-center justify-between px-3 py-2 bg-[#0f1729] border border-[#1f2a40] rounded-lg">
                <div className="flex items-center space-x-2">
                    <span className={statusColor[job.status]}>{iconByStatus[job.status]}</span>
                    <div>
                        <p className="text-[12px] text-[#e5edff] font-semibold">{job.filename || 'Report job'}</p>
                        <p className="text-[11px] text-[#869ab8]">ID: {job.jobId}</p>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <div className="w-28 h-2 bg-[#1f2a40] rounded-full overflow-hidden">
                        <div
                            className={`h-2 ${job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}
                            style={{ width: `${job.progress ?? 0}%` }}
                        />
                    </div>
                    {job.error && <span className="text-[11px] text-red-300">{job.error}</span>}
                    {downloadUrl && (
                        <a
                            href={downloadUrl}
                            className="inline-flex items-center space-x-1 px-3 py-1.5 text-[11px] font-bold rounded-lg border border-green-500 text-green-300 hover:bg-green-500/10"
                        >
                            <Download className="w-4 h-4" />
                            <span>Download</span>
                        </a>
                    )}
                </div>
            </div>
        );
    };

    // Render
    return (
        <div className={`bg-[#0b1326] rounded-xl shadow-xl border border-[#1a2333] ${className}`}>
            {/* Header */}
            <div className="px-6 py-5 border-b border-[#1a2333] bg-[#0b1326] rounded-t-xl">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center">
                            <FileText className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-[#dae2fd] tracking-tight">Report Generation Centre</h2>
                            <p className="text-[#869ab8] text-[12px] font-medium tracking-wide">
                                <span className="text-[#869ab8]">Project:</span> {projectName} &nbsp;•&nbsp;
                                <span className="text-[#869ab8]">No:</span> {projectNumber}
                            </p>
                        </div>
                    </div>
                    
                    {!analysisComplete ? (
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-amber-500/15 border border-amber-500/30 rounded-lg">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span className="text-[11px] text-amber-300 font-bold uppercase tracking-wider">Run Analysis First</span>
                        </div>
                    ) : (
                        <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-500/15 border border-green-500/30 rounded-lg">
                            <CheckCircle className="w-4 h-4 text-green-400" />
                            <span className="text-[11px] text-green-300 font-bold uppercase tracking-wider">Analysis Complete</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-[#1a2333] bg-[#131b2e]">
                {[
                    { id: 'generate', label: 'Generate Report', icon: FileText },
                    { id: 'history', label: 'Report History', icon: Clock },
                    { id: 'schedule', label: 'Scheduled Reports', icon: Calendar }
                ].map(tab => (
                    <button type="button"
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as typeof activeTab)}
                        className={`flex items-center space-x-2 px-6 py-3 text-[12px] font-bold uppercase tracking-wider transition-colors ${
                            activeTab === tab.id
                                ? 'text-blue-400 border-b-2 border-blue-500 bg-[#131b2e]'
                                : 'text-slate-500 hover:text-[#adc6ff] hover:bg-[#131b2e]'
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
                            <h3 className="text-[11px] font-bold text-[#869ab8] uppercase tracking-wider mb-3 flex items-center">
                                <FileText className="w-3.5 h-3.5 mr-2" />
                                Select Report Type
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5">
                                {Object.entries(REPORT_TYPES).map(([type, info]) => (
                                    <button type="button"
                                        key={type}
                                        onClick={() => handleTypeChange(type as ReportType)}
                                        className={`group relative p-4 rounded-lg border-2 transition-all ${
                                            selectedType === type
                                                ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100'
                                                : 'border-slate-200 hover:border-slate-300 dark:border-slate-600 hover:bg-[#131b2e]'
                                        }`}
                                    >
                                        {selectedType === type && (
                                            <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-500" />
                                        )}
                                        <info.icon className={`w-7 h-7 mx-auto mb-2 transition-colors ${
                                            selectedType === type ? 'text-blue-600' : 'text-slate-700 group-hover:text-[#869ab8]'
                                        }`} />
                                        <p className={`text-[11px] font-bold text-center leading-tight ${
                                            selectedType === type ? 'text-blue-700' : 'text-[#adc6ff]'
                                        }`}>
                                            {info.name}
                                        </p>
                                    </button>
                                ))}
                            </div>
                            <div className="mt-3 px-3 py-2 bg-[#131b2e] border border-[#1a2333] rounded-lg">
                                <p className="text-[11px] text-[#869ab8]">
                                    <span className="font-bold text-[#adc6ff]">{REPORT_TYPES[selectedType].name}:</span>{' '}
                                    {REPORT_TYPES[selectedType].description}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                    {REPORT_TYPES[selectedType].sections.map((s) => (
                                        <span key={s} className="text-[9px] font-bold text-[#869ab8] bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded px-1.5 py-0.5 uppercase tracking-wider">{s}</span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Output Format */}
                        <div>
                            <h3 className="text-[11px] font-bold text-[#869ab8] uppercase tracking-wider mb-3 flex items-center">
                                <File className="w-3.5 h-3.5 mr-2" />
                                Output Format
                            </h3>
                            <div className="flex space-x-3">
                                {Object.entries(OUTPUT_FORMATS).map(([format, info]) => (
                                    <button type="button"
                                        key={format}
                                        onClick={() => handleFormatChange(format as OutputFormat)}
                                        className={`flex items-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                                            selectedFormat === format
                                                ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-900/20'
                                                : 'border-slate-300 dark:border-slate-600 hover:border-slate-500 hover:bg-[#131b2e]'
                                        }`}
                                    >
                                        <info.icon className={`w-5 h-5 ${
                                            selectedFormat === format ? 'text-blue-400' : 'text-[#869ab8]'
                                        }`} />
                                        <span className={`text-[11px] font-bold ${
                                            selectedFormat === format ? 'text-blue-300' : 'text-[#adc6ff]'
                                        }`}>
                                            {info.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Template Selection */}
                        <div>
                            <h3 className="text-[11px] font-bold text-[#869ab8] uppercase tracking-wider mb-3 flex items-center">
                                <Palette className="w-3.5 h-3.5 mr-2" />
                                Template
                            </h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {PRESET_TEMPLATES.map(template => (
                                    <button type="button"
                                        key={template.id}
                                        onClick={() => {
                                            setSelectedTemplate(template.id);
                                            setConfig(prev => ({ ...prev, template: template.id }));
                                        }}
                                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                                            selectedTemplate === template.id
                                                ? 'border-blue-500 bg-blue-900/30 shadow-lg shadow-blue-900/20'
                                                : 'border-slate-300 dark:border-slate-600 hover:border-slate-500 hover:bg-[#131b2e]'
                                        }`}
                                    >
                                        <p className={`text-[11px] font-bold ${
                                            selectedTemplate === template.id ? 'text-blue-300' : 'text-slate-700 dark:text-slate-200'
                                        }`}>
                                            {template.name}
                                        </p>
                                        <p className="text-[10px] text-[#869ab8] mt-1">
                                            {template.description}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Report Details */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                                    Report Title
                                </label>
                                <input
                                    type="text"
                                    value={config.title}
                                    onChange={e => setConfig(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full px-4 py-2 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                                        Revision
                                    </label>
                                    <input
                                        type="text"
                                        value={config.revision}
                                        onChange={e => setConfig(prev => ({ ...prev, revision: e.target.value }))}
                                        className="w-full px-4 py-2 bg-[#131b2e] border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium tracking-wide text-[#adc6ff] mb-1">
                                        Confidential
                                    </label>
                                    <button type="button"
                                        onClick={() => setConfig(prev => ({ ...prev, confidential: !prev.confidential }))}
                                        className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg border-2 transition-all ${
                                            config.confidential
                                                ? 'border-red-500 bg-red-900/30 text-red-400'
                                                : 'border-slate-300 dark:border-slate-600 bg-[#131b2e] text-[#adc6ff]'
                                        }`}
                                    >
                                        {config.confidential ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                                        <span>{config.confidential ? 'Yes' : 'No'}</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Async Job Status */}
                        {jobs.length > 0 && (
                            <div>
                                <h3 className="text-[11px] font-bold text-[#869ab8] uppercase tracking-wider mb-3 flex items-center">
                                    <RefreshCw className="w-3.5 h-3.5 mr-2" />
                                    Report Jobs
                                </h3>
                                <div className="space-y-2">
                                    {jobs.map(renderJobStatus)}
                                </div>
                            </div>
                        )}

                        {/* Advanced Options */}
                        <div className="border border-[#1a2333] rounded-lg">
                            <button type="button"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#131b2e]"
                            >
                                <span className="flex items-center space-x-2">
                                    <Settings className="w-5 h-5 text-[#869ab8]" />
                                    <span className="font-medium tracking-wide text-[#adc6ff]">Advanced Options</span>
                                </span>
                                {showAdvanced ? (
                                    <ChevronDown className="w-5 h-5 text-[#869ab8]" />
                                ) : (
                                    <ChevronRight className="w-5 h-5 text-[#869ab8]" />
                                )}
                            </button>
                            
                            {showAdvanced && (
                                <div className="p-4 border-t border-[#1a2333] space-y-4">
                                    {/* Branding */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-[#adc6ff] mb-2">Branding</h4>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs text-[#869ab8] mb-1">Company Name</label>
                                                <input
                                                    type="text"
                                                    value={config.branding.companyName}
                                                    onChange={e => setConfig(prev => ({
                                                        ...prev,
                                                        branding: { ...prev.branding, companyName: e.target.value }
                                                    }))}
                                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-[#869ab8] mb-1">Primary Color</label>
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
                                                        className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                                                    >
                                                        <option value="">Preset Colors</option>
                                                        {COLOR_PRESETS.map(p => (
                                                            <option key={p.name} value={p.primary}>{p.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-[#869ab8] mb-1">Company Logo</label>
                                                <input
                                                    ref={fileInputRef}
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleLogoUpload}
                                                    className="hidden"
                                                />
                                                <button type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="w-full flex items-center justify-center space-x-2 px-3 py-2 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg text-sm text-[#adc6ff] hover:border-blue-500 hover:text-blue-600 transition-colors"
                                                >
                                                    <Upload className="w-4 h-4" />
                                                    <span>{config.branding.companyLogo ? 'Change Logo' : 'Upload Logo'}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sections */}
                                    <div>
                                        <h4 className="text-sm font-semibold text-[#adc6ff] mb-2">Sections to Include</h4>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                            {config.sections.map(section => (
                                                <label
                                                    key={section.id}
                                                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                                                        section.enabled
                                                            ? 'bg-blue-50 border-blue-200'
                                                            : 'bg-[#131b2e] border-[#1a2333]'
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
                                        <label className="block text-xs text-[#869ab8] mb-1">Watermark Text (Optional)</label>
                                        <input
                                            type="text"
                                            value={config.watermark || ''}
                                            onChange={e => setConfig(prev => ({ ...prev, watermark: e.target.value }))}
                                            placeholder="e.g., DRAFT, FOR REVIEW ONLY"
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-5 border-t-2 border-[#1a2333]">
                            <button type="button"
                                onClick={handlePreview}
                                className="flex items-center space-x-2 px-4 py-2.5 text-[#adc6ff] border border-slate-300 dark:border-slate-600 hover:bg-[#131b2e] rounded-lg transition-colors text-sm font-medium tracking-wide"
                            >
                                <Eye className="w-4 h-4" />
                                <span>Preview</span>
                            </button>
                            
                            <div className="flex items-center space-x-2">
                                <button type="button"
                                    className="flex items-center space-x-2 px-4 py-2.5 text-[#869ab8] border border-[#1a2333] hover:bg-[#131b2e] rounded-lg transition-colors text-sm font-medium tracking-wide"
                                >
                                    <Printer className="w-4 h-4" />
                                    <span>Print</span>
                                </button>
                                
                                <button type="button"
                                    onClick={handleGenerate}
                                    disabled={isGenerating || !analysisComplete}
                                    className={`flex items-center space-x-2 px-8 py-2.5 rounded-lg text-sm font-bold transition-all ${
                                        isGenerating || !analysisComplete
                                            ? 'bg-[#131b2e] text-[#869ab8] cursor-not-allowed border border-[#1a2333]'
                                            : 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-blue-300'
                                    }`}
                                >
                                    {isGenerating ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Generating…</span>
                                        </>
                                    ) : (
                                        <>
                                            <Download className="w-4 h-4" />
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
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Generated Reports</h3>
                            <span className="text-sm text-[#869ab8]">{generatedReports.length} reports</span>
                        </div>
                        
                        {generatedReports.length === 0 ? (
                            <div className="text-center py-12 text-[#869ab8]">
                                <FileText className="w-12 h-12 mx-auto mb-3 text-[#adc6ff]" />
                                <p>No reports generated yet</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {generatedReports.map(report => (
                                    <div
                                        key={report.id}
                                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-[#131b2e] transition-colors"
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
                                                <p className="font-medium tracking-wide text-slate-800 dark:text-slate-200">{report.name}</p>
                                                <p className="text-sm text-[#869ab8]">
                                                    {report.generatedAt.toLocaleDateString()} • {report.size}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        {report.status === 'ready' && (
                                            <div className="flex items-center space-x-2">
                                                <button type="button" aria-label="Preview report" title="Preview report" className="p-2 text-[#869ab8] hover:text-blue-600 transition-colors">
                                                    <Eye className="w-5 h-5" />
                                                </button>
                                                <button type="button" aria-label="Download report" title="Download report" className="p-2 text-[#869ab8] hover:text-blue-600 transition-colors">
                                                    <Download className="w-5 h-5" />
                                                </button>
                                                <button type="button" aria-label="Email report" title="Email report" className="p-2 text-[#869ab8] hover:text-blue-600 transition-colors">
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
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Scheduled Reports</h3>
                            <button type="button" className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <Calendar className="w-4 h-4" />
                                <span>New Schedule</span>
                            </button>
                        </div>
                        
                        <div className="text-center py-12 text-[#869ab8]">
                            <Calendar className="w-12 h-12 mx-auto mb-3 text-[#adc6ff]" />
                            <p>No scheduled reports</p>
                            <p className="text-sm mt-1">Set up automatic report generation</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            <Dialog open={showPreview && !!previewUrl} onOpenChange={(open) => !open && setShowPreview(false)}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0">
                    <DialogHeader className="px-6 pt-6">
                        <DialogTitle>Report Preview</DialogTitle>
                    </DialogHeader>
                    <div className="p-4 h-[70vh] overflow-auto">
                        <iframe
                            src={previewUrl!}
                            className="w-full h-full border border-[#1a2333] rounded-lg"
                            title="Report Preview"
                        />
                    </div>
                    <div className="px-6 pb-6 flex justify-end space-x-3 border-t border-[#1a2333]">
                        <button type="button" onClick={() => setShowPreview(false)} className="px-4 py-2 text-[#adc6ff] border border-[#1a2333] rounded-lg hover:bg-[#131b2e] transition-colors">
                            Close
                        </button>
                        <button type="button" onClick={handleGenerate} className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                            <Download className="w-4 h-4" />
                            <span>Generate Full Report</span>
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ReportGenerationDashboard;
