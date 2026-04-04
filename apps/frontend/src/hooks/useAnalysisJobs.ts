/**
 * useAnalysisJobs — Fetch analysis job history from the Node API
 *
 * Calls GET /api/analyze/jobs with auth, returns the user's last 50 jobs
 * sorted by createdAt descending.
 *
 * Each job includes: id, status, progress, error, errorCode, errorDetails,
 * nodeCount, memberCount, createdAt, completedAt.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { API_CONFIG } from '../config/env';
import { useAuth } from '../providers/AuthProvider';

// ============================================
// Types matching the backend job response
// ============================================

export interface AnalysisJob {
    id: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    result?: Record<string, unknown>;
    error?: string;
    errorCode?: string;
    errorDetails?: Array<{
        type: string;
        message: string;
        elementIds?: string[];
    }>;
    nodeCount: number;
    memberCount: number;
    createdAt: string;
    completedAt?: string;
}

export interface UseAnalysisJobsReturn {
    jobs: AnalysisJob[];
    loading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

// ============================================
// Hook
// ============================================

export function useAnalysisJobs(autoFetch = true): UseAnalysisJobsReturn {
    const [jobs, setJobs] = useState<AnalysisJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { getToken } = useAuth();
    const isMountedRef = useRef(true);

    useEffect(() => {
        return () => { isMountedRef.current = false; };
    }, []);

    const refresh = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const token = await getToken();
            const headers: Record<string, string> = {};
            if (token) headers['Authorization'] = `Bearer ${token}`;

            const res = await fetch(`${API_CONFIG.baseUrl}/api/analyze/jobs`, {
                headers,
                cache: 'no-store',
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch jobs (${res.status})`);
            }

            const data = await res.json();
            if (isMountedRef.current) {
                setJobs(data.jobs || []);
            }
        } catch (err) {
            if (isMountedRef.current) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [getToken]);

    useEffect(() => {
        if (autoFetch) {
            refresh();
        }
    }, [autoFetch, refresh]);

    return { jobs, loading, error, refresh };
}

export default useAnalysisJobs;
