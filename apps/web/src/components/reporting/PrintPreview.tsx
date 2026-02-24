/**
 * ============================================================================
 * PRINT PREVIEW COMPONENT
 * ============================================================================
 * 
 * Professional print preview and printing functionality:
 * - Multi-page preview with zoom
 * - Page layout options (portrait/landscape)
 * - Header/footer customization
 * - Print quality settings
 * - Watermark support
 * - Page numbering
 * 
 * @version 1.0.0
 */

import React, { useState, useRef, useCallback } from 'react';
import {
    Printer,
    FileText,
    ChevronLeft,
    ChevronRight,
    ZoomIn,
    ZoomOut,
    RotateCw,
    Maximize2,
    Minimize2,
    Settings,
    Download,
    X,
    Check,
    Layout,
    Type,
    Hash,
    Image,
    AlignLeft,
    AlignCenter,
    AlignRight,
    Eye,
    EyeOff
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export type PageOrientation = 'portrait' | 'landscape';
export type PageSize = 'A4' | 'A3' | 'Letter' | 'Legal' | 'Tabloid';
export type PrintQuality = 'draft' | 'normal' | 'high';

export interface PageMargins {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

export interface HeaderFooterConfig {
    enabled: boolean;
    left: string;
    center: string;
    right: string;
    fontSize: number;
    showLine: boolean;
}

export interface WatermarkConfig {
    enabled: boolean;
    text: string;
    opacity: number;
    angle: number;
    fontSize: number;
}

export interface PrintSettings {
    orientation: PageOrientation;
    pageSize: PageSize;
    margins: PageMargins;
    quality: PrintQuality;
    color: boolean;
    header: HeaderFooterConfig;
    footer: HeaderFooterConfig;
    watermark: WatermarkConfig;
    showPageNumbers: boolean;
    pageNumberFormat: 'number' | 'x-of-y';
    pageNumberPosition: 'header' | 'footer';
}

export interface PageContent {
    id: string;
    title: string;
    content: React.ReactNode;
    type: 'cover' | 'toc' | 'content' | 'appendix';
}

// ============================================================================
// DEFAULTS
// ============================================================================

const PAGE_SIZES: Record<PageSize, { width: number; height: number }> = {
    'A4': { width: 210, height: 297 },
    'A3': { width: 297, height: 420 },
    'Letter': { width: 216, height: 279 },
    'Legal': { width: 216, height: 356 },
    'Tabloid': { width: 279, height: 432 }
};

const DEFAULT_SETTINGS: PrintSettings = {
    orientation: 'portrait',
    pageSize: 'A4',
    margins: { top: 25, right: 20, bottom: 25, left: 20 },
    quality: 'high',
    color: true,
    header: {
        enabled: true,
        left: '{project}',
        center: '',
        right: '{date}',
        fontSize: 9,
        showLine: true
    },
    footer: {
        enabled: true,
        left: 'Confidential',
        center: '',
        right: 'Page {page}',
        fontSize: 9,
        showLine: true
    },
    watermark: {
        enabled: false,
        text: 'DRAFT',
        opacity: 0.1,
        angle: -45,
        fontSize: 72
    },
    showPageNumbers: true,
    pageNumberFormat: 'x-of-y',
    pageNumberPosition: 'footer'
};

// ============================================================================
// PAGE PREVIEW COMPONENT
// ============================================================================

interface PagePreviewProps {
    page: PageContent;
    pageNumber: number;
    totalPages: number;
    settings: PrintSettings;
    scale: number;
    isSelected: boolean;
    onClick: () => void;
    projectName: string;
}

const PagePreview: React.FC<PagePreviewProps> = ({
    page,
    pageNumber,
    totalPages,
    settings,
    scale,
    isSelected,
    onClick,
    projectName
}) => {
    const { pageSize, orientation, margins, header, footer, watermark } = settings;
    const size = PAGE_SIZES[pageSize];
    const width = orientation === 'portrait' ? size.width : size.height;
    const height = orientation === 'portrait' ? size.height : size.width;
    const isCover = page.type === 'cover';
    const isToc = page.type === 'toc';
    const isAppendix = page.type === 'appendix';
    
    const formatText = (text: string): string => {
        return text
            .replace('{page}', String(pageNumber))
            .replace('{pages}', String(totalPages))
            .replace('{date}', new Date().toLocaleDateString())
            .replace('{time}', new Date().toLocaleTimeString())
            .replace('{project}', projectName);
    };
    
    const pageNumberText = settings.pageNumberFormat === 'x-of-y' 
        ? `Page ${pageNumber} of ${totalPages}`
        : String(pageNumber);
    
    return (
        <div 
            onClick={onClick}
            className={`
                relative cursor-pointer transition-all transform hover:scale-[1.02]
                ${isSelected ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-900' : ''}
            `}
            style={{
                width: width * scale,
                height: height * scale,
            }}
        >
            {/* Page Shadow */}
            <div className="absolute inset-0 bg-black/20 transform translate-x-1 translate-y-1 rounded-md" />
            
            {/* Page */}
            <div 
                className="absolute inset-0 bg-white rounded-md shadow-xl overflow-hidden border border-slate-200"
                style={{
                    padding: `${margins.top * scale}px ${margins.right * scale}px ${margins.bottom * scale}px ${margins.left * scale}px`
                }}
            >
                {/* Watermark */}
                {watermark.enabled && (
                    <div 
                        className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden"
                    >
                        <span 
                            className="text-slate-300 font-bold whitespace-nowrap"
                            style={{
                                fontSize: watermark.fontSize * scale,
                                opacity: watermark.opacity,
                                transform: `rotate(${watermark.angle}deg)`
                            }}
                        >
                            {watermark.text}
                        </span>
                    </div>
                )}
                
                {/* Header */}
                {header.enabled && (
                    <div 
                        className={`absolute left-0 right-0 flex items-center justify-between text-slate-500 ${header.showLine ? 'border-b border-slate-200' : ''}`}
                        style={{
                            top: margins.top * scale * 0.3,
                            left: margins.left * scale,
                            right: margins.right * scale,
                            fontSize: header.fontSize * scale,
                            paddingBottom: 2 * scale
                        }}
                    >
                        <span>{formatText(header.left)}</span>
                        <span>{formatText(header.center)}</span>
                        <span>{formatText(header.right)}</span>
                    </div>
                )}
                
                {/* Content Area */}
                <div 
                    className="h-full overflow-hidden text-slate-800"
                    style={{ 
                        fontSize: 10 * scale,
                        marginTop: header.enabled ? 15 * scale : 0,
                        marginBottom: footer.enabled ? 15 * scale : 0
                    }}
                >
                    {isCover ? (
                        <div className="h-full flex flex-col items-center justify-center text-center">
                            <div className="w-10 h-1 bg-cyan-500 rounded-full mb-3" style={{ height: 4 * scale }} />
                            <div className="text-lg font-bold text-slate-900 mb-2" style={{ fontSize: 18 * scale }}>
                                {projectName}
                            </div>
                            <div className="text-slate-600" style={{ fontSize: 13 * scale }}>
                                Structural Analysis Report
                            </div>
                            <div className="text-slate-500 mt-4" style={{ fontSize: 10 * scale }}>
                                {new Date().toLocaleDateString()}
                            </div>
                            <div className="mt-6 grid grid-cols-2 gap-2 text-left text-[8px] text-slate-500" style={{ fontSize: 8 * scale }}>
                                <div className="font-medium text-slate-400">Document Ref</div>
                                <div className="text-slate-700">RPT-{pageNumber.toString().padStart(3, '0')}</div>
                                <div className="font-medium text-slate-400">Revision</div>
                                <div className="text-slate-700">A</div>
                            </div>
                        </div>
                    ) : isToc ? (
                        <div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-2" style={{ fontSize: 9 * scale }}>
                                Table of Contents
                            </div>
                            <div className="space-y-1">
                                {['Executive Summary', 'Design Basis', 'Structural Model', 'Analysis Results', 'Design Verification', 'Conclusions & Recommendations']
                                    .map((label, i) => (
                                        <div key={label} className="flex items-center gap-2">
                                            <span className="text-slate-700" style={{ fontSize: 9 * scale }}>{i + 1}. {label}</span>
                                            <span className="flex-1 border-b border-dotted border-slate-300" />
                                            <span className="text-slate-400" style={{ fontSize: 9 * scale }}>{i + 2}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="text-[9px] uppercase tracking-wider text-slate-400" style={{ fontSize: 9 * scale }}>
                                {isAppendix ? 'Appendix' : `Section ${pageNumber}`}
                            </div>
                            <div className="font-semibold mb-2 text-slate-800" style={{ fontSize: 12 * scale }}>
                                {page.title}
                            </div>
                            <div className="text-slate-600 leading-relaxed">
                                <div className="space-y-1">
                                    {[78, 64, 86, 58, 72, 52, 80, 66].map((width, i) => (
                                        <div
                                            key={i}
                                            className="bg-slate-100 rounded"
                                            style={{ height: 6 * scale, width: `${width}%` }}
                                        />
                                    ))}
                                </div>
                                <div className="mt-3 grid grid-cols-3 gap-1">
                                    {[1, 2, 3].map(col => (
                                        <div key={col} className="h-10 bg-slate-50 border border-slate-200 rounded" style={{ height: 18 * scale }} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                
                {/* Footer */}
                {footer.enabled && (
                    <div 
                        className={`absolute left-0 right-0 flex items-center justify-between text-slate-500 ${footer.showLine ? 'border-t border-slate-200' : ''}`}
                        style={{
                            bottom: margins.bottom * scale * 0.3,
                            left: margins.left * scale,
                            right: margins.right * scale,
                            fontSize: footer.fontSize * scale,
                            paddingTop: 2 * scale
                        }}
                    >
                        <span>{formatText(footer.left)}</span>
                        <span>{formatText(footer.center)}</span>
                        <span>
                            {settings.showPageNumbers && settings.pageNumberPosition === 'footer'
                                ? pageNumberText
                                : formatText(footer.right)
                            }
                        </span>
                    </div>
                )}
            </div>
            
            {/* Page Number Badge */}
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-xs text-slate-400">
                {pageNumber}
            </div>
        </div>
    );
};

// ============================================================================
// SETTINGS PANEL
// ============================================================================

interface SettingsPanelProps {
    settings: PrintSettings;
    onSettingsChange: (settings: PrintSettings) => void;
    onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({
    settings,
    onSettingsChange,
    onClose
}) => {
    const [activeTab, setActiveTab] = useState<'layout' | 'header' | 'watermark'>('layout');
    
    const updateSettings = <K extends keyof PrintSettings>(key: K, value: PrintSettings[K]) => {
        onSettingsChange({ ...settings, [key]: value });
    };
    
    return (
        <div className="absolute right-0 top-0 bottom-0 w-80 bg-slate-900 border-l border-slate-700 flex flex-col z-50">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                    <Settings className="w-4 h-4 text-slate-400" />
                    Print Settings
                </h3>
                <button onClick={onClose} className="p-1 text-slate-400 hover:text-white">
                    <X className="w-4 h-4" />
                </button>
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-slate-700">
                {[
                    { id: 'layout', label: 'Layout', icon: <Layout className="w-4 h-4" /> },
                    { id: 'header', label: 'Header/Footer', icon: <Type className="w-4 h-4" /> },
                    { id: 'watermark', label: 'Watermark', icon: <Image className="w-4 h-4" /> }
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`
                            flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider flex items-center justify-center gap-1 transition-colors
                            ${activeTab === tab.id 
                                ? 'text-cyan-400 border-b-2 border-cyan-400' 
                                : 'text-slate-400 hover:text-white'
                            }
                        `}
                    >
                        {tab.icon}
                        {tab.label}
                    </button>
                ))}
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {activeTab === 'layout' && (
                    <>
                        {/* Page Size */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Page Size</label>
                            <select
                                value={settings.pageSize}
                                onChange={(e) => updateSettings('pageSize', e.target.value as PageSize)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                            >
                                {Object.keys(PAGE_SIZES).map(size => (
                                    <option key={size} value={size}>{size}</option>
                                ))}
                            </select>
                        </div>
                        
                        {/* Orientation */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Orientation</label>
                            <div className="flex gap-2">
                                {(['portrait', 'landscape'] as const).map(orient => (
                                    <button
                                        key={orient}
                                        onClick={() => updateSettings('orientation', orient)}
                                        className={`
                                            flex-1 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2
                                            ${settings.orientation === orient
                                                ? 'bg-cyan-500 text-white'
                                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                            }
                                        `}
                                    >
                                        <div className={`border-2 border-current rounded ${orient === 'portrait' ? 'w-3 h-4' : 'w-4 h-3'}`} />
                                        {orient.charAt(0).toUpperCase() + orient.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        
                        {/* Margins */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-2">Margins (mm)</label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['top', 'right', 'bottom', 'left'] as const).map(side => (
                                    <div key={side}>
                                        <label className="block text-[10px] text-slate-400 mb-0.5 capitalize">{side}</label>
                                        <input
                                            type="number"
                                            value={settings.margins[side]}
                                            onChange={(e) => updateSettings('margins', {
                                                ...settings.margins,
                                                [side]: parseInt(e.target.value) || 0
                                            })}
                                            className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        {/* Quality */}
                        <div>
                            <label className="block text-xs text-slate-400 mb-1">Print Quality</label>
                            <select
                                value={settings.quality}
                                onChange={(e) => updateSettings('quality', e.target.value as PrintQuality)}
                                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                            >
                                <option value="draft">Draft (Fast)</option>
                                <option value="normal">Normal</option>
                                <option value="high">High Quality</option>
                            </select>
                        </div>
                        
                        {/* Color */}
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.color}
                                onChange={(e) => updateSettings('color', e.target.checked)}
                                className="rounded bg-slate-700 border-slate-600 text-cyan-500"
                            />
                            <span className="text-sm text-slate-300">Print in color</span>
                        </label>
                    </>
                )}
                
                {activeTab === 'header' && (
                    <>
                        {/* Header Settings */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">Header</span>
                                <button
                                    onClick={() => updateSettings('header', {
                                        ...settings.header,
                                        enabled: !settings.header.enabled
                                    })}
                                    className={`p-1.5 rounded ${settings.header.enabled ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                                >
                                    {settings.header.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {settings.header.enabled && (
                                <div className="space-y-2 pl-2 border-l-2 border-slate-700">
                                    <input
                                        type="text"
                                        value={settings.header.left}
                                        onChange={(e) => updateSettings('header', { ...settings.header, left: e.target.value })}
                                        placeholder="Left text"
                                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                    />
                                    <input
                                        type="text"
                                        value={settings.header.center}
                                        onChange={(e) => updateSettings('header', { ...settings.header, center: e.target.value })}
                                        placeholder="Center text"
                                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                    />
                                    <input
                                        type="text"
                                        value={settings.header.right}
                                        onChange={(e) => updateSettings('header', { ...settings.header, right: e.target.value })}
                                        placeholder="Right text"
                                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                    />
                                </div>
                            )}
                        </div>
                        
                        {/* Footer Settings */}
                        <div className="space-y-3 pt-4 border-t border-slate-700">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">Footer</span>
                                <button
                                    onClick={() => updateSettings('footer', {
                                        ...settings.footer,
                                        enabled: !settings.footer.enabled
                                    })}
                                    className={`p-1.5 rounded ${settings.footer.enabled ? 'bg-cyan-500 text-white' : 'bg-slate-700 text-slate-400'}`}
                                >
                                    {settings.footer.enabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                </button>
                            </div>
                            
                            {settings.footer.enabled && (
                                <div className="space-y-2 pl-2 border-l-2 border-slate-700">
                                    <input
                                        type="text"
                                        value={settings.footer.left}
                                        onChange={(e) => updateSettings('footer', { ...settings.footer, left: e.target.value })}
                                        placeholder="Left text"
                                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                    />
                                    <input
                                        type="text"
                                        value={settings.footer.center}
                                        onChange={(e) => updateSettings('footer', { ...settings.footer, center: e.target.value })}
                                        placeholder="Center text"
                                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                    />
                                    <input
                                        type="text"
                                        value={settings.footer.right}
                                        onChange={(e) => updateSettings('footer', { ...settings.footer, right: e.target.value })}
                                        placeholder="Right text"
                                        className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                                    />
                                </div>
                            )}
                        </div>
                        
                        {/* Page Numbers */}
                        <div className="pt-4 border-t border-slate-700">
                            <label className="flex items-center gap-2 cursor-pointer mb-3">
                                <input
                                    type="checkbox"
                                    checked={settings.showPageNumbers}
                                    onChange={(e) => updateSettings('showPageNumbers', e.target.checked)}
                                    className="rounded bg-slate-700 border-slate-600 text-cyan-500"
                                />
                                <span className="text-sm text-slate-300">Show page numbers</span>
                            </label>
                            
                            {settings.showPageNumbers && (
                                <div className="space-y-2">
                                    <select
                                        value={settings.pageNumberFormat}
                                        onChange={(e) => updateSettings('pageNumberFormat', e.target.value as any)}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                    >
                                        <option value="number">1, 2, 3...</option>
                                        <option value="x-of-y">Page 1 of N</option>
                                    </select>
                                </div>
                            )}
                        </div>
                        
                        {/* Variables Help */}
                        <div className="p-3 bg-slate-800/50 rounded-lg">
                            <div className="text-xs font-medium text-slate-400 mb-2">Available Variables:</div>
                            <div className="text-xs text-slate-400 space-y-1">
                                <div><code className="text-cyan-400">{'{page}'}</code> - Current page</div>
                                <div><code className="text-cyan-400">{'{pages}'}</code> - Total pages</div>
                                <div><code className="text-cyan-400">{'{date}'}</code> - Current date</div>
                                <div><code className="text-cyan-400">{'{project}'}</code> - Project name</div>
                            </div>
                        </div>
                    </>
                )}
                
                {activeTab === 'watermark' && (
                    <>
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={settings.watermark.enabled}
                                onChange={(e) => updateSettings('watermark', {
                                    ...settings.watermark,
                                    enabled: e.target.checked
                                })}
                                className="rounded bg-slate-700 border-slate-600 text-cyan-500"
                            />
                            <span className="text-sm text-slate-300">Enable watermark</span>
                        </label>
                        
                        {settings.watermark.enabled && (
                            <div className="space-y-4 pt-2">
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Watermark Text</label>
                                    <input
                                        type="text"
                                        value={settings.watermark.text}
                                        onChange={(e) => updateSettings('watermark', {
                                            ...settings.watermark,
                                            text: e.target.value
                                        })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                        Opacity: {Math.round(settings.watermark.opacity * 100)}%
                                    </label>
                                    <input
                                        type="range"
                                        min="0.05"
                                        max="0.5"
                                        step="0.05"
                                        value={settings.watermark.opacity}
                                        onChange={(e) => updateSettings('watermark', {
                                            ...settings.watermark,
                                            opacity: parseFloat(e.target.value)
                                        })}
                                        className="w-full"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">
                                        Angle: {settings.watermark.angle}°
                                    </label>
                                    <input
                                        type="range"
                                        min="-90"
                                        max="90"
                                        step="5"
                                        value={settings.watermark.angle}
                                        onChange={(e) => updateSettings('watermark', {
                                            ...settings.watermark,
                                            angle: parseInt(e.target.value)
                                        })}
                                        className="w-full"
                                    />
                                </div>
                                
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Font Size</label>
                                    <select
                                        value={settings.watermark.fontSize}
                                        onChange={(e) => updateSettings('watermark', {
                                            ...settings.watermark,
                                            fontSize: parseInt(e.target.value)
                                        })}
                                        className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
                                    >
                                        <option value={36}>Small (36pt)</option>
                                        <option value={48}>Medium (48pt)</option>
                                        <option value={72}>Large (72pt)</option>
                                        <option value={96}>Extra Large (96pt)</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ============================================================================
// MAIN PRINT PREVIEW COMPONENT
// ============================================================================

interface PrintPreviewProps {
    pages: PageContent[];
    projectName?: string;
    onPrint?: () => void;
    onExportPDF?: () => void;
    onClose?: () => void;
}

export const PrintPreview: React.FC<PrintPreviewProps> = ({
    pages = [],
    projectName = 'Structural Analysis Report',
    onPrint,
    onExportPDF,
    onClose
}) => {
    const [settings, setSettings] = useState<PrintSettings>(DEFAULT_SETTINGS);
    const [zoom, setZoom] = useState(0.5);
    const [currentPage, setCurrentPage] = useState(1);
    const [showSettings, setShowSettings] = useState(false);
    const [viewMode, setViewMode] = useState<'single' | 'double' | 'overview'>('single');
    
    const containerRef = useRef<HTMLDivElement>(null);
    
    // Generate default pages if none provided
    const displayPages: PageContent[] = pages.length > 0 ? pages : [
        { id: 'cover', title: 'Cover', content: null, type: 'cover' },
        { id: 'toc', title: 'Table of Contents', content: null, type: 'toc' },
        { id: 'summary', title: 'Executive Summary', content: null, type: 'content' },
        { id: 'model', title: 'Structural Model', content: null, type: 'content' },
        { id: 'loads', title: 'Load Cases', content: null, type: 'content' },
        { id: 'results', title: 'Analysis Results', content: null, type: 'content' },
        { id: 'code-check', title: 'Code Compliance', content: null, type: 'content' },
        { id: 'appendix', title: 'Appendix', content: null, type: 'appendix' }
    ];
    
    const totalPages = displayPages.length;
    
    const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 2));
    const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.25));
    const handleZoomReset = () => setZoom(0.5);
    
    const handlePrevPage = () => setCurrentPage(p => Math.max(p - 1, 1));
    const handleNextPage = () => setCurrentPage(p => Math.min(p + 1, totalPages));
    
    const handlePrint = useCallback(() => {
        if (onPrint) {
            onPrint();
        } else {
            window.print();
        }
    }, [onPrint]);
    
    return (
        <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col">
            {/* Header */}
            <div className="h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-cyan-400" />
                        <span className="font-semibold text-white">{projectName}</span>
                        <span className="text-slate-500">• Print Preview</span>
                    </div>
                    <div className="hidden md:flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/70">
                            {settings.pageSize} · {settings.orientation}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/70 uppercase">
                            {settings.quality}
                        </span>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Zoom Controls */}
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                        <button onClick={handleZoomOut} className="p-1.5 text-slate-400 hover:text-white rounded">
                            <ZoomOut className="w-4 h-4" />
                        </button>
                        <span className="text-sm text-white px-2 min-w-[50px] text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button onClick={handleZoomIn} className="p-1.5 text-slate-400 hover:text-white rounded">
                            <ZoomIn className="w-4 h-4" />
                        </button>
                        <button onClick={handleZoomReset} className="p-1.5 text-slate-400 hover:text-white rounded">
                            <RotateCw className="w-4 h-4" />
                        </button>
                    </div>
                    
                    {/* View Mode */}
                    <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
                        {(['single', 'double', 'overview'] as const).map(mode => (
                            <button
                                key={mode}
                                onClick={() => setViewMode(mode)}
                                className={`p-1.5 rounded ${viewMode === mode ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}
                                title={mode === 'single' ? 'Single Page' : mode === 'double' ? 'Two Pages' : 'Overview'}
                            >
                                {mode === 'overview' ? (
                                    <Layout className="w-4 h-4" />
                                ) : (
                                    <FileText className="w-4 h-4" />
                                )}
                            </button>
                        ))}
                    </div>
                    
                    {/* Settings */}
                    <button
                        onClick={() => setShowSettings(!showSettings)}
                        className={`p-2 rounded-lg transition-colors ${
                            showSettings ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                    
                    {/* Actions */}
                    <button
                        onClick={onExportPDF}
                        className="px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        Export PDF
                    </button>
                    
                    <button
                        onClick={handlePrint}
                        className="px-4 py-2 bg-cyan-500 text-white font-medium rounded-lg hover:bg-cyan-400 flex items-center gap-2"
                    >
                        <Printer className="w-4 h-4" />
                        Print
                    </button>
                </div>
            </div>
            
            {/* Main Content */}
            <div className="flex-1 relative overflow-hidden">
                <div 
                    ref={containerRef}
                    className="absolute inset-0 overflow-auto bg-slate-800"
                    style={{ marginRight: showSettings ? '320px' : '0' }}
                >
                    <div className={`
                        min-h-full p-8 flex gap-8 justify-center
                        ${viewMode === 'overview' ? 'flex-wrap content-start' : 'items-start'}
                    `}>
                        {viewMode === 'overview' ? (
                            // Overview mode - show all pages
                            displayPages.map((page, index) => (
                                <PagePreview
                                    key={page.id}
                                    page={page}
                                    pageNumber={index + 1}
                                    totalPages={totalPages}
                                    settings={settings}
                                    scale={zoom * 0.6}
                                    isSelected={currentPage === index + 1}
                                    onClick={() => {
                                        setCurrentPage(index + 1);
                                        setViewMode('single');
                                    }}
                                    projectName={projectName}
                                />
                            ))
                        ) : viewMode === 'double' ? (
                            // Double page view
                            <>
                                {currentPage > 1 && displayPages[currentPage - 2] && (
                                    <PagePreview
                                        page={displayPages[currentPage - 2]}
                                        pageNumber={currentPage - 1}
                                        totalPages={totalPages}
                                        settings={settings}
                                        scale={zoom}
                                        isSelected={false}
                                        onClick={() => setCurrentPage(currentPage - 1)}
                                        projectName={projectName}
                                    />
                                )}
                                {displayPages[currentPage - 1] && (
                                    <PagePreview
                                        page={displayPages[currentPage - 1]}
                                        pageNumber={currentPage}
                                        totalPages={totalPages}
                                        settings={settings}
                                        scale={zoom}
                                        isSelected={true}
                                        onClick={() => {}}
                                        projectName={projectName}
                                    />
                                )}
                            </>
                        ) : (
                            // Single page view
                            displayPages[currentPage - 1] && (
                                <PagePreview
                                    page={displayPages[currentPage - 1]}
                                    pageNumber={currentPage}
                                    totalPages={totalPages}
                                    settings={settings}
                                    scale={zoom}
                                    isSelected={true}
                                    onClick={() => {}}
                                    projectName={projectName}
                                />
                            )
                        )}
                    </div>
                </div>
                
                {/* Settings Panel */}
                {showSettings && (
                    <SettingsPanel
                        settings={settings}
                        onSettingsChange={setSettings}
                        onClose={() => setShowSettings(false)}
                    />
                )}
            </div>
            
            {/* Footer - Page Navigation */}
            <div className="h-12 bg-slate-900 border-t border-slate-800 flex items-center justify-center gap-4">
                <button
                    onClick={handlePrevPage}
                    disabled={currentPage === 1}
                    className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                
                <div className="flex items-center gap-2">
                    <span className="text-white font-medium">{currentPage}</span>
                    <span className="text-slate-400">of</span>
                    <span className="text-slate-400">{totalPages}</span>
                </div>
                
                <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className="p-2 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
                
                {/* Page Thumbnails */}
                <div className="flex items-center gap-1 ml-4">
                    {displayPages.slice(0, 10).map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentPage(index + 1)}
                            className={`w-6 h-8 rounded border transition-colors ${
                                currentPage === index + 1
                                    ? 'bg-cyan-500 border-cyan-400'
                                    : 'bg-slate-800 border-slate-700 hover:border-slate-500'
                            }`}
                        />
                    ))}
                    {totalPages > 10 && (
                        <span className="text-slate-400 text-sm ml-1">+{totalPages - 10}</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PrintPreview;
export { PagePreview, SettingsPanel, PAGE_SIZES, DEFAULT_SETTINGS };
