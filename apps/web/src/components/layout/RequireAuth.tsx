import { useAuth } from "../../providers/AuthProvider";
import { Navigate, useLocation } from "react-router-dom";
import React from "react";

interface RequireAuthProps {
    children: React.ReactNode;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
    const { isLoaded, isSignedIn } = useAuth();
    const location = useLocation();

    if (!isLoaded) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-[#0b1326]" role="status" aria-label="Loading">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" aria-hidden="true"></div>
                <span className="sr-only">Loading authentication...</span>
            </div>
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
