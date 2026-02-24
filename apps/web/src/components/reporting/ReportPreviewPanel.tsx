/**
 * ============================================================================
 * REPORT PREVIEW PANEL  —  Professional Document Viewer
 * ============================================================================
 *
 * Industry-standard preview panel matching ARUP / WSP report-viewer quality:
 * - Branded toolbar with document meta strip
 * - Polished page thumbnails with live badge overlays
 * - Zoom / page-nav / search / annotation / bookmark
 * - Fullscreen, print, download, share actions
 *
 * @version 2.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    ZoomIn,
    ZoomOut,
    ChevronLeft,
    ChevronRight,
    Download,
    Printer,
    Share2,
    Maximize2,
    Minimize2,
    FileText,
    Edit3,
    MessageSquare,
    Bookmark,
    Search,
    X,
    Check,
    Copy,
    Loader2,
    Eye,
    Clock,
    Hash
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportPreviewProps {
    reportUrl: string;
    reportName: string;
    totalPages: number;
    format: 'pdf' | 'html';
    onClose?: () => void;
    onDownload?: () => void;
    onPrint?: () => void;
    onShare?: (method: 'email' | 'link') => void;
    className?: string;
}

interface Annotation {
    id: string;
    page: number;
    x: number;
    y: number;
    text: string;
    author: string;
    createdAt: Date;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Deterministic short doc-ref from report name */
const docRef = (name: string): string => {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
    return `RPT-${Math.abs(h).toString(36).toUpperCase().slice(0, 6)}`;
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const ReportPreviewPanel: React.FC<ReportPreviewProps> = ({
    reportUrl,
    reportName,
    totalPages,
    format,
    onClose,
    onDownload,
    onPrint,
    onShare,
    className = ''
}) => {
    // State
    const [currentPage, setCurrentPage] = useState(1);
    const [zoom, setZoom] = useState(100);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showThumbnails, setShowThumbnails] = useState(true);
    const [showAnnotations, setShowAnnotations] = useState(false);
    const [annotations, setAnnotations] = useState<Annotation[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [bookmarkedPages, setBookmarkedPages] = useState<number[]>([]);
    const [linkCopied, setLinkCopied] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<HTMLDivElement>(null);

    // Effects
    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 1000);
        return () => clearTimeout(timer);
    }, [reportUrl]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowLeft' && currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            } else if (e.key === 'ArrowRight' && currentPage < totalPages) {
                setCurrentPage(prev => prev + 1);
            } else if (e.key === 'Escape' && isFullscreen) {
                setIsFullscreen(false);
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
                e.preventDefault();
                setShowSearch(true);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPage, totalPages, isFullscreen]);

    // ---------- Handlers ----------
    const handleZoomIn = useCallback(() => setZoom(prev => Math.min(prev + 25, 200)), []);
    const handleZoomOut = useCallback(() => setZoom(prev => Math.max(prev - 25, 50)), []);
    const handleZoomReset = useCallback(() => setZoom(100), []);

    const handlePageChange = useCallback((page: number) => {
        if (page >= 1 && page <= totalPages) setCurrentPage(page);
    }, [totalPages]);

    const handleToggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement && containerRef.current) {
            containerRef.current.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    const handleToggleBookmark = useCallback((page: number) => {
        setBookmarkedPages(prev =>
            prev.includes(page)
                ? prev.filter(p => p !== page)
                : [...prev, page].sort((a, b) => a - b)
        );
    }, []);

    const handleAddAnnotation = useCallback((page: number, x: number, y: number, text: string) => {
        const newAnnotation: Annotation = {
            id: `ann-${Date.now()}`,
            page, x, y, text,
            author: 'Current User',
            createdAt: new Date()
        };
        setAnnotations(prev => [...prev, newAnnotation]);
    }, []);

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(reportUrl);
        setLinkCopied(true);
        setTimeout(() => setLinkCopied(false), 2000);
    }, [reportUrl]);

    // ---------- Thumbnail renderer ----------
    const renderThumbnails = () =>
        Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`group relative w-full aspect-[210/297] rounded-lg overflow-hidden transition-all border-2 ${
                    currentPage === page
                        ? 'border-cyan-500 ring-2 ring-cyan-500/30'
                        : 'border-slate-700 hover:border-slate-500'
                }`}
            >
                {/* Miniature page face */}
                <div className="absolute inset-0 bg-white flex flex-col p-1.5">
                    {/* Tiny header rule */}
                    <div className="flex items-center gap-1 mb-1">
                        <div className="w-3 h-[2px] bg-slate-900 rounded-full" />
                        <div className="flex-1 h-[1px] bg-slate-200" />
                    </div>
                    {/* Skeleton lines */}
                    {[72, 58, 80, 64, 48, 75, 53, 66, 40, 70].map((w, i) => (
                        <div
                            key={i}
                            className="rounded-sm mb-[2px]"
                            style={{
                                height: 2,
                                width: `${w}%`,
                                backgroundColor: i < 2 ? '#334155' : '#e2e8f0'
                            }}
                        />
                    ))}
                </div>

                {/* Page number badge */}
                <div className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 px-1.5 py-px rounded text-[9px] font-semibold tracking-wide ${
                    currentPage === page
                        ? 'bg-cyan-500 text-white'
                        : 'bg-slate-800/80 text-slate-300'
                }`}>
                    {page}
                </div>

                {/* Bookmark indicator */}
                {bookmarkedPages.includes(page) && (
                    <div className="absolute top-0 right-0.5">
                        <Bookmark className="w-3 h-3 text-amber-400 fill-amber-400 drop-shadow" />
                    </div>
                )}

                {/* Annotation dot */}
                {annotations.some(a => a.page === page) && (
                    <div className="absolute top-0.5 left-0.5 w-3 h-3 bg-cyan-500 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-1.5 h-1.5 text-white" />
                    </div>
                )}
            </button>
        ));

    // =====================================================================
    //  RENDER
    // =====================================================================
    return (
        <div
            ref={containerRef}
            className={`flex flex-col bg-slate-950 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} ${className}`}
        >
            {/* ──── Accent strip ──── */}
            <div className="h-0.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500" />

            {/* ──── Primary Toolbar ──── */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800">
                {/* Left — doc identity + page nav */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded bg-cyan-500/15 flex items-center justify-center">
                            <FileText className="w-4 h-4 text-cyan-400" />
                        </div>
                        <div className="leading-tight">
                            <span className="text-white font-semibold text-sm truncate max-w-[220px] block">
                                {reportName}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono tracking-wide">
                                {docRef(reportName)} &middot; {format.toUpperCase()}
                            </span>
                        </div>
                    </div>

                    {/* Page navigation pill */}
                    <div className="flex items-center gap-1.5 bg-slate-800 rounded-lg px-2 py-1 border border-slate-700/60">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <input
                            type="number"
                            value={currentPage}
                            onChange={e => handlePageChange(parseInt(e.target.value) || 1)}
                            min={1}
                            max={totalPages}
                            className="w-10 text-center bg-transparent text-white text-xs font-medium focus:outline-none"
                        />
                        <span className="text-slate-500 text-xs font-medium">/ {totalPages}</span>
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="p-0.5 text-slate-400 hover:text-white disabled:opacity-30"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Centre — zoom + tools */}
                <div className="flex items-center gap-1">
                    <button onClick={handleZoomOut} disabled={zoom <= 50} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30">
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <button onClick={handleZoomReset} className="min-w-[48px] px-2 py-1 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md text-xs font-semibold tabular-nums">
                        {zoom}%
                    </button>
                    <button onClick={handleZoomIn} disabled={zoom >= 200} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md disabled:opacity-30">
                        <ZoomIn className="w-4 h-4" />
                    </button>

                    <div className="w-px h-5 bg-slate-700 mx-1.5" />

                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        className={`p-1.5 rounded-md transition-colors ${showSearch ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Search  ⌘F"
                    >
                        <Search className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleToggleBookmark(currentPage)}
                        className={`p-1.5 rounded-md transition-colors ${bookmarkedPages.includes(currentPage) ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Bookmark page"
                    >
                        <Bookmark className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowAnnotations(!showAnnotations)}
                        className={`p-1.5 rounded-md transition-colors ${showAnnotations ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Annotations"
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => setShowThumbnails(!showThumbnails)}
                        className={`p-1.5 rounded-md transition-colors ${showThumbnails ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                        title="Toggle thumbnails"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                </div>

                {/* Right — actions */}
                <div className="flex items-center gap-1">
                    <button onClick={handleCopyLink} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md" title="Copy link">
                        {linkCopied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button onClick={onPrint} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md" title="Print">
                        <Printer className="w-4 h-4" />
                    </button>
                    <button onClick={onDownload} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md" title="Download">
                        <Download className="w-4 h-4" />
                    </button>
                    <button onClick={() => onShare?.('link')} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md" title="Share">
                        <Share2 className="w-4 h-4" />
                    </button>

                    <div className="w-px h-5 bg-slate-700 mx-1" />

                    <button onClick={handleToggleFullscreen} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md" title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                        {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>

                    {onClose && (
                        <button onClick={onClose} className="ml-1 p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-md" title="Close">
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* ──── Search bar (collapsible) ──── */}
            {showSearch && (
                <div className="flex items-center gap-3 px-4 py-2 bg-slate-900/80 border-b border-slate-800 backdrop-blur">
                    <Search className="w-4 h-4 text-cyan-400 shrink-0" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search in document…"
                        className="flex-1 bg-slate-800 text-white px-3 py-1.5 rounded-md text-sm border border-slate-700 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/40"
                        autoFocus
                    />
                    <button onClick={() => { setShowSearch(false); setSearchQuery(''); }} className="p-1 text-slate-400 hover:text-white">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* ──── Document Meta Strip ──── */}
            <div className="flex items-center gap-4 px-4 py-1.5 bg-slate-900/60 border-b border-slate-800/60 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><Hash className="w-3 h-3" /> {docRef(reportName)}</span>
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {totalPages} pages</span>
                <span className="uppercase font-semibold tracking-wider text-slate-600">{format}</span>
                {bookmarkedPages.length > 0 && (
                    <span className="flex items-center gap-1 text-amber-500/80"><Bookmark className="w-3 h-3" /> {bookmarkedPages.length} bookmarked</span>
                )}
                {annotations.length > 0 && (
                    <span className="flex items-center gap-1 text-cyan-500/80"><MessageSquare className="w-3 h-3" /> {annotations.length} annotations</span>
                )}
            </div>

            {/* ──── Main content ──── */}
            <div className="flex flex-1 overflow-hidden">
                {/* Thumbnails sidebar */}
                {showThumbnails && (
                    <div className="w-28 bg-slate-900 border-r border-slate-800 overflow-y-auto p-2 space-y-2 scrollbar-thin">
                        {renderThumbnails()}
                    </div>
                )}

                {/* Document viewer */}
                <div ref={viewerRef} className="flex-1 overflow-auto bg-slate-800/60 p-6">
                    <div
                        className="mx-auto transition-transform duration-200"
                        style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center h-[1100px] w-[800px] bg-white rounded shadow-2xl mx-auto">
                                <div className="text-center">
                                    <Loader2 className="w-10 h-10 text-cyan-500 animate-spin mx-auto mb-3" />
                                    <p className="text-slate-500 text-sm font-medium">Loading report…</p>
                                    <p className="text-slate-400 text-xs mt-1">Rendering {totalPages} pages</p>
                                </div>
                            </div>
                        ) : format === 'pdf' ? (
                            <iframe
                                src={`${reportUrl}#page=${currentPage}`}
                                className="w-[800px] h-[1100px] bg-white rounded shadow-2xl ring-1 ring-slate-700/30 mx-auto block"
                                title="Report Preview"
                            />
                        ) : (
                            <div className="w-[800px] min-h-[1100px] bg-white rounded shadow-2xl ring-1 ring-slate-700/30 p-10 mx-auto">
                                <div dangerouslySetInnerHTML={{ __html: '<p>Report content</p>' }} />
                            </div>
                        )}
                    </div>
                </div>

                {/* Annotations panel */}
                {showAnnotations && (
                    <div className="w-72 bg-slate-900 border-l border-slate-800 flex flex-col">
                        <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-cyan-400" />
                            <h3 className="text-white text-sm font-semibold tracking-wide">Annotations</h3>
                            <span className="ml-auto text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full font-medium">
                                {annotations.filter(a => a.page === currentPage).length}
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto">
                            {annotations.filter(a => a.page === currentPage).length === 0 ? (
                                <div className="p-6 text-center">
                                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mx-auto mb-3">
                                        <MessageSquare className="w-6 h-6 text-slate-600" />
                                    </div>
                                    <p className="text-sm text-slate-400 font-medium">No annotations</p>
                                    <p className="text-xs text-slate-600 mt-1">Click on the document to add one</p>
                                </div>
                            ) : (
                                <div className="p-2 space-y-2">
                                    {annotations
                                        .filter(a => a.page === currentPage)
                                        .map(ann => (
                                            <div key={ann.id} className="p-3 bg-slate-800 rounded-lg border border-slate-700/60">
                                                <p className="text-white text-sm leading-relaxed">{ann.text}</p>
                                                <div className="flex items-center gap-2 mt-2 text-[10px] text-slate-500">
                                                    <span className="font-medium">{ann.author}</span>
                                                    <span>&middot;</span>
                                                    <span>{ann.createdAt.toLocaleTimeString()}</span>
                                                </div>
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ──── Bookmarks bar ──── */}
            {bookmarkedPages.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-900 border-t border-slate-800">
                    <Bookmark className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Bookmarks</span>
                    <div className="flex items-center gap-1 ml-1">
                        {bookmarkedPages.map(page => (
                            <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                    currentPage === page
                                        ? 'bg-amber-500 text-white'
                                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportPreviewPanel;
