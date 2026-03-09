/**
 * useDeviceSession - Manages device session lifecycle
 *
 * Handles:
 * - Session registration on login
 * - Periodic heartbeat (every 60s) to keep session alive
 * - Session cleanup on logout/unmount
 * - Active sessions listing
 * - Session termination (single or all)
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';
import { getDeviceId, getDeviceName } from './useDeviceId';

const API_URL = API_CONFIG.baseUrl;
const HEARTBEAT_INTERVAL_MS = 60_000; // 60 seconds

export interface ActiveSession {
    deviceId: string;
    deviceName: string;
    isAnalysisLocked: boolean;
    loginAt: string;
    lastHeartbeat: string;
    ipAddress: string;
}

export function useDeviceSession() {
    const { isSignedIn, getToken } = useAuth();
    const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
    const [isSessionRegistered, setIsSessionRegistered] = useState(false);
    const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const deviceId = getDeviceId();
    const deviceName = getDeviceName();

    /**
     * Helper: make authenticated API call
     */
    const apiCall = useCallback(async (
        path: string,
        method: 'GET' | 'POST' | 'DELETE' = 'GET',
        body?: Record<string, unknown>
    ) => {
        const token = await getToken();
        if (!token) return null;

        // Persist latest token for sendBeacon on beforeunload
        try { localStorage.setItem('beamlab_last_token', token); } catch { /* noop */ }

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
            if (!res.ok) {
                if (import.meta.env.DEV) console.warn(`[DeviceSession] ${method} ${path} failed:`, res.status);
                return null;
            }
            return await res.json();
        } catch (error) {
            if (import.meta.env.DEV) console.error(`[DeviceSession] ${method} ${path} error:`, error);
            return null;
        }
    }, [getToken, deviceId]);

    /**
     * Register session on mount/login
     */
    const registerSession = useCallback(async () => {
        const data = await apiCall('/api/session/register', 'POST', {
            deviceId,
            deviceName
        });

        if (data?.success) {
            setIsSessionRegistered(true);
            if (data.data?.activeSessions) {
                setActiveSessions(data.data.activeSessions);
            }
        }
    }, [apiCall, deviceId, deviceName]);

    /**
     * Send heartbeat to keep session alive
     */
    const sendHeartbeat = useCallback(async () => {
        await apiCall('/api/session/heartbeat', 'POST', { deviceId });
    }, [apiCall, deviceId]);

    /**
     * End current device session
     */
    const endCurrentSession = useCallback(async () => {
        await apiCall('/api/session/end', 'POST', { deviceId });
        setIsSessionRegistered(false);
    }, [apiCall, deviceId]);

    /**
     * End all sessions except current
     */
    const endAllOtherSessions = useCallback(async () => {
        const data = await apiCall('/api/session/end-all', 'POST', {
            exceptDeviceId: deviceId
        });
        if (data?.success) {
            // Refresh active sessions
            await refreshActiveSessions();
        }
        return data?.data?.terminated ?? 0;
    }, [apiCall, deviceId]);

    /**
     * Terminate a specific session by deviceId
     */
    const terminateSession = useCallback(async (targetDeviceId: string) => {
        const data = await apiCall(`/api/session/${targetDeviceId}`, 'DELETE');
        if (data?.success) {
            await refreshActiveSessions();
        }
        return data?.success ?? false;
    }, [apiCall]);

    /**
     * Refresh the list of active sessions
     */
    const refreshActiveSessions = useCallback(async () => {
        const data = await apiCall('/api/session/active');
        if (data?.data?.sessions) {
            setActiveSessions(data.data.sessions);
        }
    }, [apiCall]);

    // Register session on login
    useEffect(() => {
        if (!isSignedIn) {
            setIsSessionRegistered(false);
            return;
        }

        // Small delay to let auth settle
        const timer = setTimeout(() => {
            registerSession();
        }, 1000);

        return () => clearTimeout(timer);
    }, [isSignedIn, registerSession]);

    // Start heartbeat when session is registered
    useEffect(() => {
        if (!isSessionRegistered) return;

        heartbeatRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

        return () => {
            if (heartbeatRef.current) {
                clearInterval(heartbeatRef.current);
                heartbeatRef.current = null;
            }
        };
    }, [isSessionRegistered, sendHeartbeat]);

    // End session on unmount (page close / logout)
    useEffect(() => {
        const handleBeforeUnload = () => {
            // Use sendBeacon for reliability during page unload
            const token = localStorage.getItem('beamlab_last_token');
            if (token) {
                const payload = new Blob(
                    [JSON.stringify({ deviceId, token })],
                    { type: 'application/json' }
                );
                navigator.sendBeacon(
                    `${API_URL}/api/session/beacon-end`,
                    payload
                );
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [deviceId]);

    return {
        deviceId,
        deviceName,
        isSessionRegistered,
        activeSessions,
        registerSession,
        endCurrentSession,
        endAllOtherSessions,
        terminateSession,
        refreshActiveSessions
    };
}

export default useDeviceSession;
