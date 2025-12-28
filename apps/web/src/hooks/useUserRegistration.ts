/**
 * useUserRegistration - Registers user in MongoDB when signed in
 * 
 * This hook should be called on any page where an authenticated user lands
 * to ensure their record exists in the database.
 */

import { useEffect, useRef } from 'react';
import { useAuth, useUser } from '@clerk/clerk-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useUserRegistration() {
    const { isSignedIn, getToken } = useAuth();
    const { user } = useUser();
    const hasRegistered = useRef(false);

    useEffect(() => {
        // Only run once when user signs in
        if (!isSignedIn || !user || hasRegistered.current) {
            return;
        }

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
                        email: user.primaryEmailAddress?.emailAddress || 'unknown@beamlab.com'
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('[useUserRegistration] User registered:', data);
                    hasRegistered.current = true;
                } else {
                    console.error('[useUserRegistration] Registration failed:', response.status);
                }
            } catch (error) {
                console.error('[useUserRegistration] Error:', error);
            }
        };

        registerUser();
    }, [isSignedIn, user, getToken]);

    return { isRegistered: hasRegistered.current };
}

export default useUserRegistration;
