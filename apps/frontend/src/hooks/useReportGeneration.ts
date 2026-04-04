/**
 * ============================================================================
 * USE REPORT GENERATION HOOK
 * ============================================================================
 * 
 * React hook for managing report generation state and operations
 * 
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { 
    ComprehensiveReportService,
    getReportService,
    ReportCategory,
    GenerationRequest,
    GeneratedReportResult,
    BatchGenerationRequest,
    BatchGenerationResult
} from '../services/ComprehensiveReportService';

// ============================================================================
// TYPES
// ============================================================================

export interface ReportGenerationState {
    isGenerating: boolean;
    progress: number;
    currentReport: string | null;
    error: string | null;
    generatedReports: GeneratedReportResult[];
}

export interface UseReportGenerationResult {
    state: ReportGenerationState;
    generateReport: (request: GenerationRequest) => Promise<GeneratedReportResult | null>;
    generateBatch: (request: BatchGenerationRequest) => Promise<BatchGenerationResult | null>;
    downloadReport: (report: GeneratedReportResult) => void;
    printReport: (report: GeneratedReportResult) => Promise<void>;
    previewReport: (report: GeneratedReportResult) => string;
    clearReports: () => void;
    removeReport: (id: string) => void;
    getReportByCategory: (category: ReportCategory) => GeneratedReportResult | undefined;
}

// ============================================================================
// HOOK
// ============================================================================

export function useReportGeneration(): UseReportGenerationResult {
    const serviceRef = useRef<ComprehensiveReportService>(getReportService());
    
    const [state, setState] = useState<ReportGenerationState>({
        isGenerating: false,
        progress: 0,
        currentReport: null,
        error: null,
        generatedReports: []
    });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Revoke object URLs to prevent memory leaks
            state.generatedReports.forEach(report => {
                if (report.url.startsWith('blob:')) {
                    URL.revokeObjectURL(report.url);
                }
            });
        };
    }, []);

    /**
     * Generate a single report
     */
    const generateReport = useCallback(async (request: GenerationRequest): Promise<GeneratedReportResult | null> => {
        setState(prev => ({
            ...prev,
            isGenerating: true,
            progress: 0,
            currentReport: getCategoryName(request.category),
            error: null
        }));

        try {
            // Simulate progress updates
            const progressInterval = setInterval(() => {
                setState(prev => ({
                    ...prev,
                    progress: Math.min(prev.progress + 10, 90)
                }));
            }, 200);

            const result = await serviceRef.current.generateReport(request);

            clearInterval(progressInterval);

            setState(prev => ({
                ...prev,
                isGenerating: false,
                progress: 100,
                currentReport: null,
                generatedReports: [result, ...prev.generatedReports]
            }));

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate report';
            
            setState(prev => ({
                ...prev,
                isGenerating: false,
                progress: 0,
                currentReport: null,
                error: errorMessage
            }));

            console.error('Report generation error:', error);
            return null;
        }
    }, []);

    /**
     * Generate multiple reports in batch
     */
    const generateBatch = useCallback(async (request: BatchGenerationRequest): Promise<BatchGenerationResult | null> => {
        setState(prev => ({
            ...prev,
            isGenerating: true,
            progress: 0,
            error: null
        }));

        try {
            const totalCategories = request.categories.length;
            const results: GeneratedReportResult[] = [];

            for (let i = 0; i < request.categories.length; i++) {
                const category = request.categories[i];
                
                setState(prev => ({
                    ...prev,
                    currentReport: getCategoryName(category),
                    progress: Math.round((i / totalCategories) * 100)
                }));

                const report = await serviceRef.current.generateReport({
                    category,
                    projectData: request.projectData,
                    analysisResults: request.analysisResults,
                    designResults: request.designResults,
                    options: request.options
                });

                results.push(report);
            }

            const batchResult: BatchGenerationResult = {
                reports: results,
                totalSize: results.reduce((sum, r) => sum + r.size, 0),
                generatedAt: new Date()
            };

            setState(prev => ({
                ...prev,
                isGenerating: false,
                progress: 100,
                currentReport: null,
                generatedReports: [...results, ...prev.generatedReports]
            }));

            return batchResult;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to generate batch reports';
            
            setState(prev => ({
                ...prev,
                isGenerating: false,
                progress: 0,
                currentReport: null,
                error: errorMessage
            }));

            console.error('Batch generation error:', error);
            return null;
        }
    }, []);

    /**
     * Download a report
     */
    const downloadReport = useCallback((report: GeneratedReportResult) => {
        serviceRef.current.downloadReport(report);
    }, []);

    /**
     * Print a report
     */
    const printReport = useCallback(async (report: GeneratedReportResult) => {
        await serviceRef.current.printReport(report);
    }, []);

    /**
     * Get preview URL for a report
     */
    const previewReport = useCallback((report: GeneratedReportResult): string => {
        return report.url;
    }, []);

    /**
     * Clear all generated reports
     */
    const clearReports = useCallback(() => {
        state.generatedReports.forEach(report => {
            if (report.url.startsWith('blob:')) {
                URL.revokeObjectURL(report.url);
            }
        });
        
        setState(prev => ({
            ...prev,
            generatedReports: [],
            error: null
        }));
        
        serviceRef.current.clearCache();
    }, [state.generatedReports]);

    /**
     * Remove a specific report
     */
    const removeReport = useCallback((id: string) => {
        setState(prev => {
            const report = prev.generatedReports.find(r => r.id === id);
            if (report?.url.startsWith('blob:')) {
                URL.revokeObjectURL(report.url);
            }
            
            return {
                ...prev,
                generatedReports: prev.generatedReports.filter(r => r.id !== id)
            };
        });
    }, []);

    /**
     * Get report by category
     */
    const getReportByCategory = useCallback((category: ReportCategory): GeneratedReportResult | undefined => {
        return state.generatedReports.find(r => r.category === category);
    }, [state.generatedReports]);

    return {
        state,
        generateReport,
        generateBatch,
        downloadReport,
        printReport,
        previewReport,
        clearReports,
        removeReport,
        getReportByCategory
    };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getCategoryName(category: ReportCategory): string {
    const names: Record<ReportCategory, string> = {
        structural_summary: 'Structural Summary',
        detailed_analysis: 'Detailed Analysis Report',
        calculation_sheets: 'Calculation Sheets',
        code_compliance: 'Code Compliance Report',
        member_design: 'Member Design Report',
        connection_design: 'Connection Design Report',
        foundation_design: 'Foundation Design Report',
        seismic_report: 'Seismic Analysis Report',
        wind_report: 'Wind Analysis Report',
        full_package: 'Complete Report Package'
    };
    return names[category] || category;
}

export default useReportGeneration;
