import { useAuth } from "../../providers/AuthProvider";
import { Navigate, useLocation } from "react-router-dom";
import React from "react";
import { RouteLoadingState } from "../ui/RouteLoadingState";

interface RequireAuthProps {
    children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
    const { isLoaded, isSignedIn } = useAuth();
    const location = useLocation();

    // Bypass auth on localhost:5173
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost' && window.location.port === '5173';
    if (isLocalhost) {
        return <>{children}</>;
    }

    if (!isLoaded) {
        return (
            <RouteLoadingState
                variant="generic"
                title="Authenticating session"
                subtitle="Validating access credentials..."
                timeoutMs={10000}
            />
        );
    }

    if (!isSignedIn) {
        // Redirect to /sign-in, preserving the destination URL in both
        // router state (for in-house auth) and a ?redirect= query param
        // (for Clerk, which reads forceRedirectUrl from the URL).
        const destination = location.pathname + location.search + location.hash;
        const signInUrl = `/sign-in?redirect=${encodeURIComponent(destination)}`;
        return <Navigate to={signInUrl} state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
