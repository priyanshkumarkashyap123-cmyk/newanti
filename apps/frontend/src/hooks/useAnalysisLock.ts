/**
 * useAnalysisLock - Manages the single-device analysis lock
 *
 * RULE: A user can browse from multiple devices, but can only
 * run analysis from ONE device at a time.
 *
 * This hook:
 * - Checks if analysis is available on this device
 * - Acquires the lock before running analysis
 * - Releases the lock when analysis completes or component unmounts
 * - Provides UI state for lock conflicts
 */

import { useState, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';
import { getDeviceId } from './useDeviceId';

const API_URL = API_CONFIG.baseUrl;

export interface AnalysisLockState {
    /** Whether this device currently holds the analysis lock */
    hasLock: boolean;
    /** Whether analysis can run on this device (no conflict) */
    canAnalyze: boolean;
    /** If locked by another device, info about the lock holder */
    lockConflict: {
        deviceId: string;
        deviceName: string;
        lockedSince: string;
    } | null;
    /** Error message if lock cannot be acquired */
    errorMessage: string | null;
    /** Whether a lock operation is in progress */
    isChecking: boolean;
}

export function useAnalysisLock() {
    const { getToken } = useAuth();
    const deviceId = getDeviceId();

    const [lockState, setLockState] = useState<AnalysisLockState>({
        hasLock: false,
        canAnalyze: true,
        lockConflict: null,
        errorMessage: null,
        isChecking: false
    });

    /**
     * Helper: authenticated API call
     */
    const apiCall = useCallback(async (
        path: string,
        method: 'GET' | 'POST' = 'GET',
        body?: Record<string, unknown>
    ) => {
        const token = await getToken();
        if (!token) return null;

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${token}`,
            'X-Device-Id': deviceId
        };

        const opts: RequestInit = { method, headers };
        if (body) {
            headers['Content-Type'] = 'application/json';
            opts.body = JSON.stringify({ ...body, deviceId });
        }

        try {
            const res = await fetch(`${API_URL}${path}`, opts);
            return await res.json();
        } catch (error) {
            console.error(`[AnalysisLock] ${method} ${path} error:`, error);
            return null;
        }
    }, [getToken, deviceId]);

    /**
     * Check if this device can run analysis (without acquiring the lock).
     */
    const checkAnalysisAvailability = useCallback(async (): Promise<boolean> => {
        setLockState(prev => ({ ...prev, isChecking: true }));

        const data = await apiCall(
            `/api/session/analysis-lock/check?deviceId=${deviceId}`
        );

        if (!data) {
            setLockState(prev => ({
                ...prev,
                isChecking: false,
                canAnalyze: true // Fail open
            }));
            return true;
        }

        const granted = data.data?.granted ?? data.granted ?? true;
        const lockDevice = data.data?.currentLockDevice ?? null;

        setLockState({
            hasLock: granted && lockState.hasLock,
            canAnalyze: granted,
            lockConflict: granted ? null : lockDevice,
            errorMessage: granted ? null : (data.data?.reason || data.reason || 'Analysis locked by another device'),
            isChecking: false
        });

        return granted;
    }, [apiCall, deviceId, lockState.hasLock]);

    /**
     * Acquire the analysis lock for this device.
     * Must be called before running any analysis.
     *
     * Returns true if lock acquired, false if blocked.
     */
    const acquireLock = useCallback(async (): Promise<boolean> => {
        setLockState(prev => ({ ...prev, isChecking: true }));

        const data = await apiCall('/api/session/analysis-lock/acquire', 'POST', {
            deviceId
        });

        if (!data) {
            // Network error — fail open (allow analysis)
            setLockState(prev => ({
                ...prev,
                isChecking: false,
                hasLock: true,
                canAnalyze: true
            }));
            return true;
        }

        const granted = data.data?.granted ?? data.granted ?? false;
        const lockDevice = data.data?.currentLockDevice ?? null;

        setLockState({
            hasLock: granted,
            canAnalyze: granted,
            lockConflict: granted ? null : lockDevice,
            errorMessage: granted ? null : (data.message || data.data?.reason || 'Analysis locked by another device'),
            isChecking: false
        });

        return granted;
    }, [apiCall, deviceId]);

    /**
     * Release the analysis lock from this device.
     * Called after analysis completes.
     */
    const releaseLock = useCallback(async (): Promise<void> => {
        await apiCall('/api/session/analysis-lock/release', 'POST', { deviceId });
        setLockState(prev => ({
            ...prev,
            hasLock: false,
            canAnalyze: true,
            lockConflict: null,
            errorMessage: null
        }));
    }, [apiCall, deviceId]);

    /**
     * Force-release the analysis lock from ALL devices.
     * Used when user wants to switch analysis to this device.
     */
    const forceReleaseLock = useCallback(async (): Promise<boolean> => {
        const data = await apiCall('/api/session/analysis-lock/force-release', 'POST');

        if (data?.success) {
            setLockState({
                hasLock: false,
                canAnalyze: true,
                lockConflict: null,
                errorMessage: null,
                isChecking: false
            });
            return true;
        }
        return false;
    }, [apiCall]);

    /**
     * Force-release then immediately acquire the lock for this device.
     * Convenience method for the "Use this device" button.
     */
    const switchToThisDevice = useCallback(async (): Promise<boolean> => {
        const released = await forceReleaseLock();
        if (!released) return false;
        return await acquireLock();
    }, [forceReleaseLock, acquireLock]);

    return {
        ...lockState,
        checkAnalysisAvailability,
        acquireLock,
        releaseLock,
        forceReleaseLock,
        switchToThisDevice,
        deviceId
    };
}

export default useAnalysisLock;
