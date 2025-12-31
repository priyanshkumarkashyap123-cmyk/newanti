/**
 * ProtectedLayout - Authentication guard component
 * Wraps protected routes and redirects unauthenticated users
 * Supports both Clerk and in-house authentication
 */

import { FC, ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { SignIn, RedirectToSignIn } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';

interface ProtectedLayoutProps {
    children: ReactNode;
}

/**
 * Loading spinner component
 */
const LoadingSpinner: FC = () => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#111',
        flexDirection: 'column',
        gap: '1rem'
    }}>
        <div style={{
            width: '48px',
            height: '48px',
            border: '4px solid rgba(100, 150, 255, 0.2)',
            borderTopColor: '#4F8EF7',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
        }} />
        <style>{`
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `}</style>
        <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '14px' }}>
            Loading authentication...
        </span>
    </div>
);

/**
 * ProtectedLayout component
 * Shows spinner while loading, redirects to sign-in if not authenticated
 */
export const ProtectedLayout: FC<ProtectedLayoutProps> = ({ children }) => {
    const { isLoaded, isSignedIn, userId } = useAuth();
    const location = useLocation();
    const isClerkEnabled = isUsingClerk();

    // Show loading spinner while auth is initializing
    if (!isLoaded) {
        return <LoadingSpinner />;
    }

    // Redirect to sign-in if not authenticated
    if (!isSignedIn || !userId) {
        if (isClerkEnabled) {
            return <RedirectToSignIn />;
        }
        // For in-house auth, redirect to sign-in page
        return <Navigate to="/sign-in" state={{ from: location }} replace />;
    }

    // User is authenticated, render children
    return <>{children}</>;
};

/**
 * SignInPage component for the /sign-in route (legacy Clerk version)
 */
export const SignInPageProtected: FC = () => (
    <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: '#111',
    }}>
        <SignIn
            appearance={{
                variables: {
                    colorPrimary: '#4F8EF7',
                    colorBackground: '#1E1E2E',
                    colorText: '#ffffff',
                    colorInputBackground: '#2A2A3E',
                }
            }}
            routing="path"
            path="/sign-in"
        />
    </div>
);

export default ProtectedLayout;
