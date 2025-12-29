/**
 * AuthProvider.tsx - Unified Authentication Provider
 * 
 * Provides a single authentication context that can switch between:
 * - Clerk (third-party) - when VITE_USE_CLERK=true
 * - In-house JWT auth - when VITE_USE_CLERK=false or not set
 * 
 * Environment Variables:
 * - VITE_USE_CLERK: 'true' | 'false' - Switch between auth providers
 * - VITE_CLERK_PUBLISHABLE_KEY: Required when using Clerk
 * - VITE_API_URL: Backend API URL for in-house auth
 */

import React, { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { ClerkProvider, useAuth as useClerkAuth, useUser as useClerkUser } from '@clerk/clerk-react';
import { useAuthStore, type User, type SignUpData } from '../store/authStore';

// ============================================
// CONFIGURATION
// ============================================

// Check which auth system to use
const USE_CLERK = import.meta.env.VITE_USE_CLERK === 'true';
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Log auth mode on startup
console.log(`🔐 Auth Mode: ${USE_CLERK && CLERK_KEY ? 'Clerk' : 'In-House JWT'}`);

// ============================================
// UNIFIED AUTH CONTEXT TYPE
// ============================================

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
    
    // Tokens
    getToken: () => Promise<string | null>;
    
    // Provider info
    authProvider: 'clerk' | 'inhouse';
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
// IN-HOUSE AUTH PROVIDER
// ============================================

const InHouseAuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const store = useAuthStore();
    const [isLoaded, setIsLoaded] = useState(false);

    // Initialize auth state on mount
    useEffect(() => {
        const initAuth = async () => {
            await store.checkSession();
            setIsLoaded(true);
        };
        initAuth();
    }, []);

    // Map store user to unified user
    const unifiedUser: UnifiedUser | null = store.user ? {
        id: store.user.id,
        email: store.user.email,
        firstName: store.user.firstName,
        lastName: store.user.lastName,
        fullName: `${store.user.firstName} ${store.user.lastName}`.trim() || null,
        avatarUrl: store.user.avatarUrl || null,
        emailVerified: store.user.emailVerified,
        createdAt: store.user.createdAt ? new Date(store.user.createdAt) : null
    } : null;

    const signIn = useCallback(async (email: string, password: string) => {
        const success = await store.signIn(email, password);
        return {
            success,
            error: success ? undefined : store.error || 'Sign in failed'
        };
    }, [store]);

    const signUp = useCallback(async (data: SignUpData) => {
        const success = await store.signUp(data);
        return {
            success,
            error: success ? undefined : store.error || 'Sign up failed'
        };
    }, [store]);

    const signOut = useCallback(async () => {
        store.signOut();
    }, [store]);

    const getToken = useCallback(async () => {
        // Auto-refresh if needed
        const token = store.getAccessToken();
        if (!token && store.tokens?.refreshToken) {
            const refreshed = await store.refreshSession();
            if (refreshed) {
                return store.getAccessToken();
            }
        }
        return token;
    }, [store]);

    const contextValue: UnifiedAuthContext = {
        isLoaded,
        isSignedIn: !!store.user && !!store.tokens,
        user: unifiedUser,
        userId: store.user?.id ?? null,
        signIn,
        signUp,
        signOut,
        getToken,
        authProvider: 'inhouse'
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

// ============================================
// CLERK AUTH BRIDGE
// ============================================

const ClerkAuthBridge: React.FC<{ children: ReactNode }> = ({ children }) => {
    const clerkAuth = useClerkAuth();
    const { user: clerkUser, isLoaded: userLoaded } = useClerkUser();
    
    // Map Clerk user to unified user
    const unifiedUser: UnifiedUser | null = clerkUser ? {
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || '',
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        fullName: clerkUser.fullName,
        avatarUrl: clerkUser.imageUrl,
        emailVerified: clerkUser.primaryEmailAddress?.verification.status === 'verified',
        createdAt: clerkUser.createdAt ? new Date(clerkUser.createdAt) : null
    } : null;

    // Sign in is handled by Clerk components - return guidance
    const signIn = useCallback(async (_email: string, _password: string) => {
        // Clerk uses its own UI components for sign in
        // This is a fallback that suggests using Clerk's SignIn component
        console.warn('Clerk sign in should use <SignIn /> component');
        return {
            success: false,
            error: 'Please use the Clerk SignIn component'
        };
    }, []);

    const signUp = useCallback(async (_data: SignUpData) => {
        // Clerk uses its own UI components for sign up
        console.warn('Clerk sign up should use <SignUp /> component');
        return {
            success: false,
            error: 'Please use the Clerk SignUp component'
        };
    }, []);

    const signOut = useCallback(async () => {
        await clerkAuth.signOut();
    }, [clerkAuth]);

    const getToken = useCallback(async () => {
        try {
            return await clerkAuth.getToken() || null;
        } catch {
            return null;
        }
    }, [clerkAuth]);

    const contextValue: UnifiedAuthContext = {
        isLoaded: clerkAuth.isLoaded && userLoaded,
        isSignedIn: clerkAuth.isSignedIn ?? false,
        user: unifiedUser,
        userId: clerkAuth.userId ?? null,
        signIn,
        signUp,
        signOut,
        getToken,
        authProvider: 'clerk'
    };

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
    // Use Clerk if enabled and key is available
    if (USE_CLERK && CLERK_KEY) {
        return (
            <ClerkProvider publishableKey={CLERK_KEY}>
                <ClerkAuthBridge>
                    {children}
                </ClerkAuthBridge>
            </ClerkProvider>
        );
    }

    // Otherwise use in-house auth
    return (
        <InHouseAuthProvider>
            {children}
        </InHouseAuthProvider>
    );
};

// ============================================
// HOOKS
// ============================================

/**
 * Main auth hook - works with both Clerk and in-house auth
 */
export const useAuth = (): UnifiedAuthContext => {
    const context = useContext(AuthContext);
    
    if (!context) {
        // Return a safe default if not in provider (e.g., during SSR or tests)
        return {
            isLoaded: false,
            isSignedIn: false,
            user: null,
            userId: null,
            signIn: async () => ({ success: false, error: 'Auth not initialized' }),
            signUp: async () => ({ success: false, error: 'Auth not initialized' }),
            signOut: async () => {},
            getToken: async () => null,
            authProvider: 'inhouse'
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
export const useAuthProvider = (): 'clerk' | 'inhouse' => {
    const { authProvider } = useAuth();
    return authProvider;
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
 * Check if Clerk is being used
 */
export const isUsingClerk = (): boolean => {
    return USE_CLERK && !!CLERK_KEY;
};

/**
 * Check if in-house auth is being used
 */
export const isUsingInHouseAuth = (): boolean => {
    return !USE_CLERK || !CLERK_KEY;
};

export default AuthProvider;
