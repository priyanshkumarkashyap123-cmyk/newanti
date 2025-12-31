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
    Share2
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
    format: 'csv' | 'json' | 'staad' | 'excel';
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
                case 'csv':
                default:
                    blob = service.exportToCSV(option.dataType as any || 'all');
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
            <button
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
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 
                             text-slate-200 text-sm rounded-md transition-colors border border-slate-600"
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
                                className="absolute right-0 top-full mt-1 w-72 bg-slate-800 border border-slate-700 
                                         rounded-lg shadow-xl z-50 overflow-hidden"
                            >
                                {/* Header */}
                                <div className="px-4 py-2 border-b border-slate-700 bg-slate-750">
                                    <h4 className="text-sm font-semibold text-slate-200">Export Options</h4>
                                    <p className="text-xs text-slate-500">Choose format and data type</p>
                                </div>

                                {/* Export Options */}
                                <div className="py-1 max-h-80 overflow-y-auto">
                                    {EXPORT_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => handleExport(option)}
                                            disabled={exporting !== null}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 
                                                     transition-colors disabled:opacity-50 text-left"
                                        >
                                            <div className="text-slate-400">{option.icon}</div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm text-slate-200 font-medium">
                                                    {option.label}
                                                </div>
                                                <div className="text-xs text-slate-500 truncate">
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
                                <div className="border-t border-slate-700" />

                                {/* Additional Actions */}
                                <div className="py-1">
                                    <button
                                        onClick={handleCopyToClipboard}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-700/50 
                                                 transition-colors text-left"
                                    >
                                        <div className="text-slate-400">
                                            {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                                        </div>
                                        <div className="flex-1">
                                            <div className="text-sm text-slate-200">
                                                {copied ? 'Copied!' : 'Copy to Clipboard'}
                                            </div>
                                            <div className="text-xs text-slate-500">
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
            <button
                onClick={handleCopyToClipboard}
                className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-700 
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
                <button
                    onClick={() => handleExport('csv')}
                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 
                             rounded transition-colors"
                    title="Export CSV"
                >
                    <FileSpreadsheet size={14} />
                </button>
                <button
                    onClick={() => handleExport('json')}
                    className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-slate-700 
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
            <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 
                         text-slate-300 text-xs rounded transition-colors"
            >
                <FileSpreadsheet size={12} />
                CSV
            </button>
            <button
                onClick={() => handleExport('json')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 
                         text-slate-300 text-xs rounded transition-colors"
            >
                <FileJson size={12} />
                JSON
            </button>
            <button
                onClick={() => handleExport('staad')}
                className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-700 hover:bg-slate-600 
                         text-slate-300 text-xs rounded transition-colors"
            >
                <FileText size={12} />
                STAAD
            </button>
        </div>
    );
};

export default ExportToolbar;
