/**
 * AuthProvider.tsx - Clerk Authentication Provider
 * 
 * Uses Clerk for all authentication.
 * Provides unified context for auth state across the app.
 * 
 * Environment Variables:
 * - VITE_CLERK_PUBLISHABLE_KEY: Required Clerk publishable key
 * - VITE_API_URL: Backend API URL
 */

import React, { createContext, useContext, useCallback, useMemo, ReactNode, useState, useEffect } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useUser as useClerkUser, SignIn, SignUp } from '@clerk/clerk-react';
import { AUTH_CONFIG } from '../config/env';
import { authLogger } from '../utils/logger';

// ============================================
// CONFIGURATION
// ============================================

const CLERK_KEY = AUTH_CONFIG.clerkPublishableKey;

// Fail fast with a clear UI if the publishable key is missing
const MissingClerkKey: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center bg-[#0b1326] text-center px-6">
        <div className="max-w-xl space-y-4 text-[#dae2fd]">
            <div className="text-2xl font-semibold">Clerk publishable key missing</div>
            <p className="text-slate-600 dark:text-slate-300">
                Set <code className="px-1 py-0.5 bg-[#131b2e] rounded text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> in your environment and rebuild.
                For GitHub Actions, add it as a repository secret and ensure the workflow exports it during the build step.
            </p>
            <ul className="text-left text-sm text-[#869ab8] list-disc list-inside space-y-1">
                <li>Local dev: create <code className="px-1 py-0.5 bg-[#131b2e] rounded text-xs">apps/web/.env</code> with <code className="px-1 py-0.5 bg-[#131b2e] rounded text-xs">VITE_CLERK_PUBLISHABLE_KEY=pk_...</code></li>
                <li>Production: set the same secret in the repo and redeploy</li>
                <li>Allow your domain in Clerk Dashboard → Allowed Origins</li>
            </ul>
        </div>
    </div>
);

if (!CLERK_KEY) {
    authLogger.error('VITE_CLERK_PUBLISHABLE_KEY is required!');
}

authLogger.info('Auth Mode: Clerk');

// ============================================
// UNIFIED AUTH CONTEXT TYPE
// ============================================

export interface SignUpData {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
}

export interface UnifiedAuthContext {
    // State
    isLoaded: boolean;
    isSignedIn: boolean;
    authServiceAvailable: boolean;
    user: UnifiedUser | null;
    userId: string | null;

    // Actions
    signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
    signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>;
    signOut: () => Promise<void>;
    forgotPassword: (email: string) => Promise<{ success: boolean; error?: string }>;

    // Tokens
    getToken: () => Promise<string | null>;

    // Provider info
    authProvider: 'clerk' | 'local-dev';
}

export interface UnifiedUser {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    fullName: string | null;
    avatarUrl: string | null;
    emailVerified: boolean;
    createdAt: Date | null;
}

const AuthContext = createContext<UnifiedAuthContext | null>(null);

// ============================================
// CLERK AUTH BRIDGE
// ============================================

const ClerkAuthBridge: React.FC<{ children: ReactNode }> = ({ children }) => {
    const clerkAuth = useClerkAuth();
    const { user: clerkUser, isLoaded: userLoaded } = useClerkUser();

    // Memoize unified user to prevent unnecessary re-renders
    const unifiedUser: UnifiedUser | null = useMemo(() => {
        if (!clerkUser) return null;
        return {
            id: clerkUser.id,
            email: clerkUser.primaryEmailAddress?.emailAddress || '',
            firstName: clerkUser.firstName,
            lastName: clerkUser.lastName,
            fullName: clerkUser.fullName,
            avatarUrl: clerkUser.imageUrl,
            emailVerified: clerkUser.primaryEmailAddress?.verification.status === 'verified',
            createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt) : null
        };
    }, [clerkUser]);

    // Sign in is handled by Clerk components
    const signIn = useCallback(async (_email: string, _password: string) => {
        // Clerk uses its own UI components for sign in
        if (import.meta.env.DEV) console.warn('Use <SignIn /> component for Clerk authentication');
        return {
            success: false,
            error: 'Please use the Clerk SignIn component'
        };
    }, []);

    const signUp = useCallback(async (_data: SignUpData) => {
        // Clerk uses its own UI components for sign up
        if (import.meta.env.DEV) console.warn('Use <SignUp /> component for Clerk authentication');
        return {
            success: false,
            error: 'Please use the Clerk SignUp component'
        };
    }, []);

    const signOut = useCallback(async () => {
        // End device session before signing out (fire-and-forget)
        try {
            const token = await clerkAuth.getToken();
            if (token) {
                const { getDeviceId } = await import('../hooks/useDeviceId');
                const { API_CONFIG } = await import('../config/env');
                const deviceId = getDeviceId();
                fetch(`${API_CONFIG.baseUrl}/api/session/end`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'X-Device-Id': deviceId
                    },
                    body: JSON.stringify({ deviceId })
                }).catch(() => { /* non-critical */ });
            }
        } catch { /* non-critical */ }

        // Clean up persisted token
        try { localStorage.removeItem('beamlab_last_token'); } catch { /* noop */ }

        await clerkAuth.signOut();
    }, [clerkAuth]);

    const forgotPassword = useCallback(async (_email: string) => {
        // Clerk handles password reset via its UI
        return { success: true, error: undefined };
    }, []);

    const getToken = useCallback(async () => {
        try {
            return await clerkAuth.getToken() || null;
        } catch {
            return null;
        }
    }, [clerkAuth]);

    // Memoize context value to prevent unnecessary re-renders
    const contextValue: UnifiedAuthContext = useMemo(() => ({
        isLoaded: clerkAuth.isLoaded && userLoaded,
        isSignedIn: clerkAuth.isSignedIn ?? false,
        authServiceAvailable: true,
        user: unifiedUser,
        userId: clerkAuth.userId ?? null,
        signIn,
        signUp,
        signOut,
        forgotPassword,
        getToken,
        authProvider: 'clerk'
    }), [clerkAuth.isLoaded, userLoaded, clerkAuth.isSignedIn, unifiedUser, clerkAuth.userId, signIn, signUp, signOut, forgotPassword, getToken]);

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// ============================================
// CLERK LOAD TIMEOUT & ERROR BOUNDARY
// ============================================

const CLERK_LOAD_TIMEOUT_MS = 8000;

/** Monitors Clerk SDK load and triggers fallback if it takes too long. */
const ClerkLoadGuard: React.FC<{ children: ReactNode; onTimeout: () => void }> = ({ children, onTimeout }) => {
    const { isLoaded } = useClerkAuth();

    useEffect(() => {
        if (isLoaded) return;
        const timer = setTimeout(() => {
            authLogger.warn('Clerk SDK did not load within timeout — switching to read-only fallback');
            onTimeout();
        }, CLERK_LOAD_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [isLoaded, onTimeout]);

    return <>{children}</>;
};

/** Read-only fallback context when Clerk is unavailable */
const FALLBACK_AUTH: UnifiedAuthContext = {
    isLoaded: true,
    isSignedIn: false,
    authServiceAvailable: false,
    user: null,
    userId: null,
    signIn: async () => ({ success: false, error: 'Authentication service unavailable. Please try again later.' }),
    signUp: async () => ({ success: false, error: 'Authentication service unavailable. Please try again later.' }),
    signOut: async () => {},
    forgotPassword: async () => ({ success: false, error: 'Authentication service unavailable.' }),
    getToken: async () => null,
    authProvider: 'clerk',
};

const ClerkUnavailableBanner: React.FC = () => (
    <div className="bg-amber-500/90 text-white text-center text-sm py-1.5 px-4 sticky top-0 z-[9999]" role="alert">
        Authentication service is temporarily unavailable. You can still use engineering tools in read-only mode.
    </div>
);

/** Class-based error boundary to catch Clerk render errors */
class ClerkErrorBoundary extends React.Component<
    { children: ReactNode; fallback: ReactNode },
    { hasError: boolean }
> {
    override state = { hasError: false };

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    override componentDidCatch(error: Error) {
        authLogger.error('Clerk error boundary caught:', error.message);
    }

    override render() {
        if (this.state.hasError) return this.props.fallback;
        return this.props.children;
    }
}

// ============================================
// MAIN AUTH PROVIDER
// ============================================

interface AuthProviderProps {
    children: ReactNode;
}

function isLocalDevBypassEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0';
    const envFlag = import.meta.env.VITE_LOCAL_AUTH_BYPASS;
    const bypassByFlag = envFlag === undefined ? import.meta.env.DEV : envFlag === 'true';
    return isLocalHost && bypassByFlag;
}

const LOCAL_DEV_AUTH: UnifiedAuthContext = {
    isLoaded: true,
    isSignedIn: true,
    authServiceAvailable: false,
    user: {
        id: 'local-dev-user',
        email: 'dev@localhost',
        firstName: 'Dev',
        lastName: 'User',
        fullName: 'Dev User',
        avatarUrl: null,
        emailVerified: true,
        createdAt: new Date(),
    },
    userId: 'local-dev-user',
    signIn: async () => ({ success: true }),
    signUp: async () => ({ success: true }),
    signOut: async () => {},
    forgotPassword: async () => ({ success: true }),
    getToken: async () => null,
    authProvider: 'local-dev',
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [clerkFailed, setClerkFailed] = useState(false);

    const handleClerkTimeout = useCallback(() => setClerkFailed(true), []);

    if (isLocalDevBypassEnabled()) {
        return (
            <AuthContext.Provider value={LOCAL_DEV_AUTH}>
                {children}
            </AuthContext.Provider>
        );
    }

    if (!CLERK_KEY) {
        return <MissingClerkKey />;
    }

    if (clerkFailed) {
        return (
            <AuthContext.Provider value={FALLBACK_AUTH}>
                <ClerkUnavailableBanner />
                {children}
            </AuthContext.Provider>
        );
    }

    return (
        <ClerkErrorBoundary
            fallback={
                <AuthContext.Provider value={FALLBACK_AUTH}>
                    <ClerkUnavailableBanner />
                    {children}
                </AuthContext.Provider>
            }
        >
            <ClerkProvider publishableKey={CLERK_KEY}>
                <ClerkLoadGuard onTimeout={handleClerkTimeout}>
                    <ClerkAuthBridge>
                        {children}
                    </ClerkAuthBridge>
                </ClerkLoadGuard>
            </ClerkProvider>
        </ClerkErrorBoundary>
    );
};

// ============================================
// HOOKS
// ============================================

/**
 * Main auth hook - works with Clerk
 */
export const useAuth = (): UnifiedAuthContext => {
    if (isLocalDevBypassEnabled()) {
        return LOCAL_DEV_AUTH;
    }

    const context = useContext(AuthContext);
    if (!context) {
        return {
            isLoaded: false,
            isSignedIn: false,
            authServiceAvailable: false,
            user: null,
            userId: null,
            signIn: async () => ({ success: false, error: 'Auth not initialized' }),
            signUp: async () => ({ success: false, error: 'Auth not initialized' }),
            signOut: async () => { },
            forgotPassword: async () => ({ success: false, error: 'Auth not initialized' }),
            getToken: async () => null,
            authProvider: 'clerk'
        };
    }
    return context;
};

/**
 * Get current user
 */
export const useUser = (): UnifiedUser | null => {
    const { user } = useAuth();
    return user;
};

/**
 * Check if signed in
 */
export const useIsSignedIn = (): boolean => {
    const { isSignedIn, isLoaded } = useAuth();
    return isLoaded && isSignedIn;
};

/**
 * Check which auth provider is being used
 */
export const useAuthProvider = (): 'clerk' | 'local-dev' => {
    return useAuth().authProvider === 'local-dev' ? 'local-dev' : 'clerk';
};

/**
 * Get auth loading state
 */
export const useAuthLoading = (): boolean => {
    const { isLoaded } = useAuth();
    return !isLoaded;
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Always using Clerk
 */
export const isUsingClerk = (): boolean => {
    return AUTH_CONFIG.isClerkEnabled && !isLocalDevBypassEnabled();
};

/**
 * Not using in-house auth
 */
export const isUsingInHouseAuth = (): boolean => {
    return false;
};

// Re-export Clerk components for convenience
export { SignIn, SignUp };

export default AuthProvider;
