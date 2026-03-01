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

import React, { createContext, useContext, useCallback, useMemo, ReactNode } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useUser as useClerkUser, SignIn, SignUp } from '@clerk/clerk-react';
import { AUTH_CONFIG } from '../config/env';
import { authLogger } from '../utils/logger';

// ============================================
// CONFIGURATION
// ============================================

const CLERK_KEY = AUTH_CONFIG.clerkPublishableKey;

// Fail fast with a clear UI if the publishable key is missing
const MissingClerkKey: React.FC = () => (
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-slate-950 text-center px-6">
        <div className="max-w-xl space-y-4 text-slate-900 dark:text-white">
            <div className="text-2xl font-semibold">Clerk publishable key missing</div>
            <p className="text-slate-600 dark:text-slate-300">
                Set <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">VITE_CLERK_PUBLISHABLE_KEY</code> in your environment and rebuild.
                For GitHub Actions, add it as a repository secret and ensure the workflow exports it during the build step.
            </p>
            <ul className="text-left text-sm text-slate-500 dark:text-slate-400 list-disc list-inside space-y-1">
                <li>Local dev: create <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">apps/web/.env</code> with <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs">VITE_CLERK_PUBLISHABLE_KEY=pk_...</code></li>
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
    authProvider: 'clerk';
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
        console.warn('Use <SignIn /> component for Clerk authentication');
        return {
            success: false,
            error: 'Please use the Clerk SignIn component'
        };
    }, []);

    const signUp = useCallback(async (_data: SignUpData) => {
        // Clerk uses its own UI components for sign up
        console.warn('Use <SignUp /> component for Clerk authentication');
        return {
            success: false,
            error: 'Please use the Clerk SignUp component'
        };
    }, []);

    const signOut = useCallback(async () => {
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
// MAIN AUTH PROVIDER
// ============================================

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    if (!CLERK_KEY) {
        // Render a friendly error instead of crashing the ClerkProvider
        return <MissingClerkKey />;
    }

    return (
        <ClerkProvider publishableKey={CLERK_KEY}>
            <ClerkAuthBridge>
                {children}
            </ClerkAuthBridge>
        </ClerkProvider>
    );
};

// ============================================
// HOOKS
// ============================================

/**
 * Main auth hook - works with Clerk
 */
export const useAuth = (): UnifiedAuthContext => {
    const context = useContext(AuthContext);

    if (!context) {
        return {
            isLoaded: false,
            isSignedIn: false,
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
export const useAuthProvider = (): 'clerk' => {
    return 'clerk';
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
    return true;
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
