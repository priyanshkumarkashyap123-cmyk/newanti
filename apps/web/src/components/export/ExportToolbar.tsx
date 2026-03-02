/**
 * ExportToolbar.tsx - Comprehensive Export Controls for Analysis Results
 * 
 * Features:
 * - Multiple export formats (CSV, JSON, STAAD, Excel)
 * - Export specific tables or all data
 * - Copy to clipboard
 * - Share functionality
 */

import React, { FC, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Download,
    FileSpreadsheet,
    FileJson,
    FileText,
    Copy,
    Check,
    ChevronDown,
    Package,
    Table,
    ClipboardCheck,
    Share2,
    Printer
} from 'lucide-react';
import {
    ExportService,
    ExportData,
    downloadBlob,
    generateFilename,
    exportJSON,
    exportSTAAD,
    exportAllCSV
} from '../../services/ExportService';

// ============================================
// TYPES
// ============================================

interface ExportToolbarProps {
    exportData: ExportData;
    onExportStart?: () => void;
    onExportComplete?: (format: string) => void;
    className?: string;
}

type ExportOption = {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    format: 'csv' | 'json' | 'staad' | 'excel' | 'pdf' | 'dxf' | 'ifc' | 'image';
    dataType?: 'nodes' | 'members' | 'reactions' | 'design' | 'all';
};

// ============================================
// CONSTANTS
// ============================================

const EXPORT_OPTIONS: ExportOption[] = [
    {
        id: 'csv-all',
        label: 'Complete Results (CSV)',
        description: 'All results in one spreadsheet',
        icon: <Package size={16} />,
        format: 'csv',
        dataType: 'all'
    },
    {
        id: 'pdf-report',
        label: 'Clean PDF Report',
        description: 'Professional report for printing',
        icon: <Printer size={16} />,
        format: 'pdf'
    },
    {
        id: 'csv-nodes',
        label: 'Node Displacements (CSV)',
        description: 'Nodal translations and rotations',
        icon: <FileSpreadsheet size={16} />,
        format: 'csv',
        dataType: 'nodes'
    },
    {
        id: 'csv-members',
        label: 'Member Forces (CSV)',
        description: 'Axial, shear, moment, torsion',
        icon: <FileSpreadsheet size={16} />,
        format: 'csv',
        dataType: 'members'
    },
    {
        id: 'csv-reactions',
        label: 'Reactions (CSV)',
        description: 'Support reactions',
        icon: <FileSpreadsheet size={16} />,
        format: 'csv',
        dataType: 'reactions'
    },
    {
        id: 'json',
        label: 'JSON Format',
        description: 'Structured data for integration',
        icon: <FileJson size={16} />,
        format: 'json'
    },
    {
        id: 'staad',
        label: 'STAAD Format',
        description: 'Text format compatible with STAAD.Pro',
        icon: <FileText size={16} />,
        format: 'staad'
    },
    {
        id: 'dxf',
        label: 'DXF Drawing',
        description: '2D CAD drawing format',
        icon: <FileText size={16} />,
        format: 'dxf'
    },
    {
        id: 'ifc',
        label: 'IFC Model',
        description: 'BIM exchange format (IFC 4.0)',
        icon: <FileText size={16} />,
        format: 'ifc'
    },
    {
        id: 'image',
        label: 'Image Export',
        description: 'PNG / SVG screenshot of viewport',
        icon: <FileText size={16} />,
        format: 'image'
    },
    {
        id: 'excel',
        label: 'Excel Workbook',
        description: 'Multi-sheet XLSX with all results',
        icon: <FileSpreadsheet size={16} />,
        format: 'excel'
    }
];

// ============================================
// EXPORT TOOLBAR COMPONENT
// ============================================

export const ExportToolbar: FC<ExportToolbarProps> = ({
    exportData,
    onExportStart,
    onExportComplete,
    className = ''
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [copied, setCopied] = useState(false);
    const [exporting, setExporting] = useState<string | null>(null);

    const handleExport = useCallback(async (option: ExportOption) => {
        setExporting(option.id);
        onExportStart?.();

        try {
            const service = new ExportService(exportData);
            let blob: Blob;
            let extension: string;

            switch (option.format) {
                case 'json':
                    blob = service.exportToJSON(true);
                    extension = 'json';
                    break;
                case 'staad':
                    blob = service.exportToSTAAD();
                    extension = 'txt';
                    break;
                case 'excel':
                    blob = service.exportToExcel(option.dataType as any);
                    extension = 'csv';
                    break;
                case 'pdf':
                    // Trigger print dialog for now (Clean PDF is handled by print stylesheet)
                    window.print();
                    onExportComplete?.('pdf');
                    setExporting(null);
                    setIsOpen(false);
                    return; // Exit early as no blob is downloaded
                case 'dxf':
                    // DXF export – placeholder until CAD service is wired
                    blob = new Blob([`DXF export placeholder for ${exportData.projectName}`], { type: 'application/dxf' });
                    extension = 'dxf';
                    break;
                case 'ifc':
                    // IFC export – placeholder until BIM service is wired
                    blob = new Blob([`IFC export placeholder for ${exportData.projectName}`], { type: 'application/x-step' });
                    extension = 'ifc';
                    break;
                case 'image':
                    // Capture viewport as PNG
                    {
                        const canvas = document.querySelector('canvas');
                        if (canvas) {
                            const dataUrl = canvas.toDataURL('image/png');
                            const res = await fetch(dataUrl);
                            blob = await res.blob();
                        } else {
                            blob = new Blob([], { type: 'image/png' });
                        }
                        extension = 'png';
                    }
                    break;
                case 'csv':
                default:
                    blob = service.exportToCSV((option.dataType as any) || 'all');
                    extension = 'csv';
                    break;
            }

            const typeLabel = option.dataType || 'results';
            downloadBlob(blob, generateFilename(exportData.projectName, typeLabel, extension));

            onExportComplete?.(option.format);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setExporting(null);
            setIsOpen(false);
        }
    }, [exportData, onExportStart, onExportComplete]);

    const handleCopyToClipboard = useCallback(async () => {
        try {
            const service = new ExportService(exportData);
            const blob = service.exportToJSON(true);
            const text = await blob.text();
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (error) {
            console.error('Copy failed:', error);
        }
    }, [exportData]);

    const handleQuickExport = useCallback(() => {
        exportAllCSV(exportData);
        onExportComplete?.('csv');
    }, [exportData, onExportComplete]);

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            {/* Quick Export Button */}
            <button type="button"
                onClick={handleQuickExport}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 
                         text-white text-sm font-medium rounded-md transition-colors"
                title="Quick export all results to CSV"
            >
                <Download size={14} />
                Export
            </button>

            {/* Dropdown Menu */}
            <div className="relative">
                <button type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 px-2 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 
                             text-slate-700 dark:text-slate-200 text-sm rounded-md transition-colors border border-slate-600"
                >
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Backdrop */}
                            <div
                                className="fixed inset-0 z-40"
                                onClick={() => setIsOpen(false)}
                            />

                            {/* Dropdown */}
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{ duration: 0.15 }}
                                className="absolute right-0 top-full mt-1 w-72 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 
                                         rounded-lg shadow-xl z-50 overflow-hidden"
                            >
                                {/* Header */}
                                <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700 bg-slate-750">
                                    <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Export Options</h4>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">Choose format and data type</p>
                                </div>

                                {/* Export Options */}
                                <div className="py-1 max-h-80 overflow-y-auto">
                                    {EXPORT_OPTIONS.map((option) => (
                                        <button type="button"
                                            key={option.id}
                                            onClick={() => handleExport(option)}
                                            disabled={exporting !== null}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 
                                                     transition-colors disabled:opacity-50 text-left"
                                        >
                                            <div className="text-slate-500 dark:text-slate-400">{option.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-slate-700 dark:text-slate-200 font-medium">
                                                    {option.label}
                                                </div>
                                                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    {option.description}
                                                </div>
                                            </div>
                                            {exporting === option.id && (
                                                <div className="w-4 h-4 border-2 border-cyan-400 border-t-transparent 
                                                              rounded-full animate-spin" />
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* Divider */}
                                <div className="border-t border-slate-200 dark:border-slate-700" />

                                {/* Additional Actions */}
                                <div className="py-1">
                                    <button type="button"
                                        onClick={handleCopyToClipboard}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-200/50 dark:hover:bg-slate-700/50 
                                                 transition-colors text-left"
                                    >
                                        <div className="text-slate-500 dark:text-slate-400">
                                            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm text-slate-700 dark:text-slate-200">
                                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                                            </div>
                                            <div className="text-xs text-slate-500 dark:text-slate-400">
                                                Copy JSON data to clipboard
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>
            </div>

            {/* Copy Button */}
            <button type="button"
                onClick={handleCopyToClipboard}
                className="p-1.5 text-slate-500 hover:text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 
                         rounded transition-colors"
                title="Copy results to clipboard"
            >
                {copied ? <ClipboardCheck size={16} className="text-green-400" /> : <Copy size={16} />}
            </button>
        </div>
    );
};

// ============================================
// INLINE EXPORT BUTTONS
// ============================================

interface InlineExportButtonsProps {
    exportData: ExportData;
    compact?: boolean;
}

export const InlineExportButtons: FC<InlineExportButtonsProps> = ({
    exportData,
    compact = false
}) => {
    const handleExport = useCallback((format: 'csv' | 'json' | 'staad') => {
        switch (format) {
            case 'json':
                exportJSON(exportData);
                break;
            case 'staad':
                exportSTAAD(exportData);
                break;
            case 'csv':
            default:
                exportAllCSV(exportData);
                break;
        }
    }, [exportData]);

    if (compact) {
        return (
            <div className="flex items-center gap-1">
                <button type="button"
                    onClick={() => handleExport('csv')}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 
                             rounded transition-colors"
                    title="Export CSV"
                >
                    <FileSpreadsheet size={14} />
                </button>
                <button type="button"
                    onClick={() => handleExport('json')}
                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-cyan-400 hover:bg-slate-200 dark:hover:bg-slate-700 
                             rounded transition-colors"
                    title="Export JSON"
                >
                    <FileJson size={14} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <button type="button"
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 
                         text-slate-600 dark:text-slate-300 text-xs rounded transition-colors"
            >
                <FileSpreadsheet size={12} />
                CSV
            </button>
            <button type="button"
                onClick={() => handleExport('json')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 
                         text-slate-600 dark:text-slate-300 text-xs rounded transition-colors"
            >
                <FileJson size={12} />
                JSON
            </button>
            <button type="button"
                onClick={() => handleExport('staad')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-600 
                         text-slate-600 dark:text-slate-300 text-xs rounded transition-colors"
            >
                <FileText size={12} />
                STAAD
            </button>
        </div>
    );
};

export default ExportToolbar;
