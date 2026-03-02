/**
 * useUsageTracking - Frontend hook for usage monitoring
 *
 * Provides:
 * - User usage summary (analysis history, report history, stats)
 * - Analysis result saving
 * - Report tracking
 * - Lazy-loaded data with caching
 */

import { useState, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';

const API_URL = API_CONFIG.baseUrl;

// ============================================
// TYPES
// ============================================

export interface AnalysisResultSummary {
    _id: string;
    analysisType: string;
    analysisName: string;
    status: 'completed' | 'failed';
    inputSummary: {
        nodeCount: number;
        memberCount: number;
        loadCases: number;
        supports: number;
    };
    resultSummary: string;
    computeTimeMs: number;
    solverUsed: string;
    createdAt: string;
    projectId?: { _id: string; name: string };
}

export interface ReportSummary {
    _id: string;
    reportType: string;
    format: string;
    reportName: string;
    fileSizeBytes: number;
    generationTimeMs: number;
    pageCount?: number;
    downloadCount: number;
    status: 'generating' | 'completed' | 'failed';
    createdAt: string;
    projectId?: { _id: string; name: string };
}

export interface UsageSummary {
    user: {
        email: string;
        tier: string;
        createdAt: string;
        lastLogin: string;
        lastActiveAt: string;
        totalLoginCount: number;
    };
    analysis: {
        totalRuns: number;
        dailyRemaining: number;
        recentResults: AnalysisResultSummary[];
        byType: Record<string, number>;
    };
    reports: {
        totalGenerated: number;
        totalDownloads: number;
        recentReports: ReportSummary[];
    };
    projects: {
        totalCreated: number;
        activeCount: number;
    };
    storage: {
        usedBytes: number;
    };
    sessions: {
        activeDeviceCount: number;
        totalSessionsEver: number;
    };
}

export function useUsageTracking() {
    const { getToken } = useAuth();
    const [usageSummary, setUsageSummary] = useState<UsageSummary | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    /**
     * Helper: authenticated API call
     */
    const apiCall = useCallback(async (
        path: string,
        method: 'GET' | 'POST' = 'GET',
        body?: Record<string, unknown>
    ): Promise<Record<string, unknown> | null> => {
        const token = await getToken();
        if (!token) return null;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        };

        const opts: RequestInit = { method, headers };
        if (body) opts.body = JSON.stringify(body);

        try {
            const res = await fetch(`${API_URL}${path}`, opts);
            if (!res.ok) {
                console.warn(`[UsageTracking] ${path} failed:`, res.status);
                return null;
            }
            return await res.json();
        } catch (err) {
            console.error(`[UsageTracking] ${path} error:`, err);
            return null;
        }
    }, [getToken]);

    // ============================================
    // USAGE SUMMARY
    // ============================================

    /**
     * Fetch the full usage summary for the current user
     */
    const fetchUsageSummary = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        const data = await apiCall('/api/usage/summary');
        if (data?.data) {
            setUsageSummary(data.data as unknown as UsageSummary);
        } else {
            setError('Failed to load usage data');
        }

        setIsLoading(false);
    }, [apiCall]);

    // ============================================
    // ANALYSIS RESULTS
    // ============================================

    /**
     * Save an analysis result to the backend
     */
    const saveAnalysisResult = useCallback(async (params: {
        projectId: string;
        analysisType: string;
        analysisName: string;
        status: 'completed' | 'failed';
        inputSummary: { nodeCount: number; memberCount: number; loadCases?: number; supports?: number };
        resultData?: Record<string, unknown>;
        resultSummary?: string;
        computeTimeMs?: number;
        solverUsed?: 'wasm' | 'rust_api' | 'python';
        deviceId?: string;
        tags?: string[];
        notes?: string;
    }): Promise<boolean> => {
        const data = await apiCall('/api/usage/analysis-results', 'POST', params);
        return !!data?.success;
    }, [apiCall]);

    /**
     * Fetch analysis results with optional filters
     */
    const fetchAnalysisResults = useCallback(async (filters?: {
        projectId?: string;
        analysisType?: string;
        status?: string;
        limit?: number;
        skip?: number;
    }): Promise<{ results: AnalysisResultSummary[]; total: number }> => {
        const params = new URLSearchParams();
        if (filters?.projectId) params.set('projectId', filters.projectId);
        if (filters?.analysisType) params.set('analysisType', filters.analysisType);
        if (filters?.status) params.set('status', filters.status);
        if (filters?.limit) params.set('limit', String(filters.limit));
        if (filters?.skip) params.set('skip', String(filters.skip));

        const data = await apiCall(`/api/usage/analysis-results?${params}`);
        if (data?.data) {
            const d = data.data as { results: AnalysisResultSummary[]; total: number };
            return { results: d.results, total: d.total };
        }
        return { results: [], total: 0 };
    }, [apiCall]);

    // ============================================
    // REPORT TRACKING
    // ============================================

    /**
     * Track a report generation event
     */
    const trackReport = useCallback(async (params: {
        projectId?: string;
        analysisResultId?: string;
        reportType: string;
        format: string;
        reportName: string;
        fileSizeBytes?: number;
        generationTimeMs?: number;
        pageCount?: number;
        templateUsed?: string;
        status?: 'generating' | 'completed' | 'failed';
    }): Promise<boolean> => {
        const data = await apiCall('/api/usage/reports', 'POST', params);
        return !!data?.success;
    }, [apiCall]);

    /**
     * Record a report download
     */
    const trackReportDownload = useCallback(async (reportId: string): Promise<boolean> => {
        const data = await apiCall(`/api/usage/reports/${reportId}/download`, 'POST');
        return !!data?.success;
    }, [apiCall]);

    /**
     * Fetch report history
     */
    const fetchReports = useCallback(async (filters?: {
        projectId?: string;
        reportType?: string;
        format?: string;
        limit?: number;
        skip?: number;
    }): Promise<{ reports: ReportSummary[]; total: number }> => {
        const params = new URLSearchParams();
        if (filters?.projectId) params.set('projectId', filters.projectId);
        if (filters?.reportType) params.set('reportType', filters.reportType);
        if (filters?.format) params.set('format', filters.format);
        if (filters?.limit) params.set('limit', String(filters.limit));
        if (filters?.skip) params.set('skip', String(filters.skip));

        const data = await apiCall(`/api/usage/reports?${params}`);
        if (data?.data) {
            const d = data.data as { reports: ReportSummary[]; total: number };
            return { reports: d.reports, total: d.total };
        }
        return { reports: [], total: 0 };
    }, [apiCall]);

    return {
        // State
        usageSummary,
        isLoading,
        error,

        // Actions
        fetchUsageSummary,
        saveAnalysisResult,
        fetchAnalysisResults,
        trackReport,
        trackReportDownload,
        fetchReports
    };
}

export default useUsageTracking;
