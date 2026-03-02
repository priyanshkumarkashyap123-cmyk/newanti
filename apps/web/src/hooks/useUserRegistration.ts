/**
 * useUserRegistration - Registers user in MongoDB when signed in
 * 
 * This hook should be called on any page where an authenticated user lands
 * to ensure their record exists in the database.
 */

import { useEffect, useState } from 'react';
import { useAuth, useUser } from '../providers/AuthProvider';
import { API_CONFIG } from '../config/env';

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

        const registerUser = async () => {
            try {
                const token = await getToken();
                if (!token) {
                    console.warn('[useUserRegistration] No auth token available');
                    return;
                }

                const response = await fetch(`${API_URL}/api/user/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
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
