/**
 * useUserRegistration - Registers user in MongoDB when signed in
 * 
 * This hook should be called on any page where an authenticated user lands
 * to ensure their record exists in the database.
 * 
 * Also registers a device session for multi-device management.
 */

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';
import { getDeviceId, getDeviceName } from './useDeviceId';

const API_URL = API_CONFIG.baseUrl;

// Module-level flag to prevent duplicate registration across component remounts
let hasRegisteredGlobal = false;

export function useUserRegistration() {
    const { isSignedIn, getToken } = useAuth();
    const user = useUser();
    const [isRegistered, setIsRegistered] = useState(false);

    useEffect(() => {
        // Only run once per session when user signs in
        if (!isSignedIn || !user || hasRegisteredGlobal) {
            return;
        }

        const controller = new AbortController();
        const deviceId = getDeviceId();
        const deviceName = getDeviceName();

        const registerUser = async () => {
            try {
                const token = await getToken();
                if (!token) {
                    console.warn('[useUserRegistration] No auth token available');
                    return;
                }

                const headers: Record<string, string> = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                    'X-Device-Id': deviceId
                };

                // 1. Register user in MongoDB
                const response = await fetch(`${API_URL}/api/user/login`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        email: user.email || 'unknown@beamlab.app'
                    }),
                    signal: controller.signal
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('[useUserRegistration] User registered:', data);
                    hasRegisteredGlobal = true;
                    setIsRegistered(true);

                    // 2. Register device session (fire-and-forget)
                    fetch(`${API_URL}/api/session/register`, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({ deviceId, deviceName }),
                        signal: controller.signal
                    }).catch(() => {
                        // Non-critical — don't block user
                    });
                } else {
                    console.error('[useUserRegistration] Registration failed:', response.status);
                }
            } catch (error) {
                if ((error as Error).name !== 'AbortError') {
                    console.error('[useUserRegistration] Error:', error);
                }
            }
        };

        registerUser();
        return () => controller.abort();
    }, [isSignedIn, user, getToken]);

    return { isRegistered };
}

export default useUserRegistration;
