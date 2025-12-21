/**
 * ProtectedLayout - Clerk authentication guard component
 * Wraps protected routes and redirects unauthenticated users
 */

import { FC, ReactNode } from 'react';
import { useAuth, SignIn, RedirectToSignIn } from '@clerk/clerk-react';

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
    const { isLoaded, userId, isSignedIn } = useAuth();

    // Show loading spinner while Clerk is initializing
    if (!isLoaded) {
        return <LoadingSpinner />;
    }

    // Redirect to sign-in if not authenticated
    if (!isSignedIn || !userId) {
        return <RedirectToSignIn />;
    }

    // User is authenticated, render children
    return <>{children}</>;
};

/**
 * SignInPage component for the /sign-in route
 */
export const SignInPage: FC = () => (
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
