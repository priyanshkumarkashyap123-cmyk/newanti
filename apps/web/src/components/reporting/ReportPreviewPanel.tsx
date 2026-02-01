/**
 * ============================================================================
 * REPORT PREVIEW PANEL
 * ============================================================================
 * 
 * Interactive preview panel for viewing generated reports with:
 * - Page navigation
 * - Zoom controls
 * - Annotation tools
 * - Export options
 * - Print functionality
 * 
 * @version 1.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
    ZoomIn,
    ZoomOut,
    RotateCcw,
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
    ExternalLink,
    Loader2
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

    // Handlers
    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 25, 200));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - 25, 50));
    }, []);

    const handleZoomReset = useCallback(() => {
        setZoom(100);
    }, []);

    const handlePageChange = useCallback((page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
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
            page,
            x,
            y,
            text,
            author: 'Current User',
            createdAt: new Date()
        };
        setAnnotations(prev => [...prev, newAnnotation]);
    }, []);

    const handleCopyLink = useCallback(() => {
        navigator.clipboard.writeText(reportUrl);
    }, [reportUrl]);

    // Generate page thumbnails
    const renderThumbnails = () => {
        return Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`relative w-full aspect-[3/4] border-2 rounded-lg overflow-hidden transition-all ${
                    currentPage === page
                        ? 'border-blue-500 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300'
                }`}
            >
                <div className="absolute inset-0 bg-gradient-to-b from-gray-100 to-gray-200 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-gray-400" />
                </div>
                
                {/* Page number badge */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/60 rounded text-xs text-white font-medium">
                    {page}
                </div>
                
                {/* Bookmark indicator */}
                {bookmarkedPages.includes(page) && (
                    <div className="absolute top-0 right-1">
                        <Bookmark className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    </div>
                )}
                
                {/* Annotation indicator */}
                {annotations.some(a => a.page === page) && (
                    <div className="absolute top-1 left-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                        <MessageSquare className="w-2.5 h-2.5 text-white" />
                    </div>
                )}
            </button>
        ));
    };

    // Render
    return (
        <div
            ref={containerRef}
            className={`flex flex-col bg-gray-900 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} ${className}`}
        >
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
                {/* Left section */}
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <FileText className="w-5 h-5 text-gray-400" />
                        <span className="text-white font-medium truncate max-w-[200px]">
                            {reportName}
                        </span>
                    </div>
                    
                    {/* Page navigation */}
                    <div className="flex items-center space-x-2 bg-gray-700 rounded-lg px-2 py-1">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        
                        <input
                            type="number"
                            value={currentPage}
                            onChange={e => handlePageChange(parseInt(e.target.value) || 1)}
                            min={1}
                            max={totalPages}
                            className="w-12 text-center bg-transparent text-white text-sm focus:outline-none"
                        />
                        
                        <span className="text-gray-400 text-sm">/ {totalPages}</span>
                        
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage >= totalPages}
                            className="p-1 text-gray-400 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                
                {/* Center section - Zoom */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleZoomOut}
                        disabled={zoom <= 50}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg disabled:opacity-50"
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={handleZoomReset}
                        className="px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg text-sm font-medium"
                    >
                        {zoom}%
                    </button>
                    
                    <button
                        onClick={handleZoomIn}
                        disabled={zoom >= 200}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg disabled:opacity-50"
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    
                    <div className="w-px h-6 bg-gray-700 mx-2" />
                    
                    <button
                        onClick={() => setShowSearch(!showSearch)}
                        className={`p-2 rounded-lg transition-colors ${
                            showSearch ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                    >
                        <Search className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => handleToggleBookmark(currentPage)}
                        className={`p-2 rounded-lg transition-colors ${
                            bookmarkedPages.includes(currentPage) 
                                ? 'bg-yellow-600 text-white' 
                                : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                    >
                        <Bookmark className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => setShowAnnotations(!showAnnotations)}
                        className={`p-2 rounded-lg transition-colors ${
                            showAnnotations ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'
                        }`}
                    >
                        <Edit3 className="w-4 h-4" />
                    </button>
                </div>
                
                {/* Right section - Actions */}
                <div className="flex items-center space-x-2">
                    <button
                        onClick={onPrint}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                        title="Print"
                    >
                        <Printer className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={onDownload}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                        title="Download"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                    
                    <button
                        onClick={() => onShare?.('link')}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                        title="Share"
                    >
                        <Share2 className="w-4 h-4" />
                    </button>
                    
                    <div className="w-px h-6 bg-gray-700 mx-2" />
                    
                    <button
                        onClick={handleToggleFullscreen}
                        className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                        title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    >
                        {isFullscreen ? (
                            <Minimize2 className="w-4 h-4" />
                        ) : (
                            <Maximize2 className="w-4 h-4" />
                        )}
                    </button>
                    
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg"
                            title="Close"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>
            
            {/* Search bar */}
            {showSearch && (
                <div className="flex items-center space-x-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
                    <Search className="w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search in document..."
                        className="flex-1 bg-gray-700 text-white px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        autoFocus
                    />
                    <button
                        onClick={() => setShowSearch(false)}
                        className="p-1 text-gray-400 hover:text-white"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}
            
            {/* Main content area */}
            <div className="flex flex-1 overflow-hidden">
                {/* Thumbnails sidebar */}
                {showThumbnails && (
                    <div className="w-32 bg-gray-800 border-r border-gray-700 overflow-y-auto p-2 space-y-2">
                        {renderThumbnails()}
                    </div>
                )}
                
                {/* Document viewer */}
                <div ref={viewerRef} className="flex-1 overflow-auto bg-gray-600 p-4">
                    <div 
                        className="mx-auto transition-transform duration-200"
                        style={{ 
                            transform: `scale(${zoom / 100})`,
                            transformOrigin: 'top center'
                        }}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center h-[800px] bg-white rounded-lg shadow-2xl">
                                <div className="text-center">
                                    <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                                    <p className="text-gray-600">Loading report...</p>
                                </div>
                            </div>
                        ) : format === 'pdf' ? (
                            <iframe
                                src={`${reportUrl}#page=${currentPage}`}
                                className="w-[800px] h-[1100px] bg-white rounded-lg shadow-2xl"
                                title="Report Preview"
                            />
                        ) : (
                            <div className="w-[800px] min-h-[1100px] bg-white rounded-lg shadow-2xl p-8">
                                {/* HTML content would be rendered here */}
                                <div 
                                    dangerouslySetInnerHTML={{ __html: '<p>Report content</p>' }}
                                />
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Annotations panel */}
                {showAnnotations && (
                    <div className="w-72 bg-gray-800 border-l border-gray-700 overflow-y-auto">
                        <div className="p-4 border-b border-gray-700">
                            <h3 className="text-white font-medium flex items-center space-x-2">
                                <MessageSquare className="w-4 h-4" />
                                <span>Annotations</span>
                            </h3>
                        </div>
                        
                        {annotations.filter(a => a.page === currentPage).length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                <MessageSquare className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                                <p className="text-sm">No annotations on this page</p>
                                <p className="text-xs mt-1">Click on the document to add one</p>
                            </div>
                        ) : (
                            <div className="p-2 space-y-2">
                                {annotations
                                    .filter(a => a.page === currentPage)
                                    .map(annotation => (
                                        <div
                                            key={annotation.id}
                                            className="p-3 bg-gray-700 rounded-lg"
                                        >
                                            <p className="text-white text-sm">{annotation.text}</p>
                                            <p className="text-gray-400 text-xs mt-2">
                                                {annotation.author} • {annotation.createdAt.toLocaleTimeString()}
                                            </p>
                                        </div>
                                    ))
                                }
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Bookmarks bar */}
            {bookmarkedPages.length > 0 && (
                <div className="flex items-center space-x-2 px-4 py-2 bg-gray-800 border-t border-gray-700">
                    <Bookmark className="w-4 h-4 text-yellow-500" />
                    <span className="text-gray-400 text-sm">Bookmarks:</span>
                    <div className="flex items-center space-x-1">
                        {bookmarkedPages.map(page => (
                            <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`px-2 py-0.5 rounded text-sm ${
                                    currentPage === page
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
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
