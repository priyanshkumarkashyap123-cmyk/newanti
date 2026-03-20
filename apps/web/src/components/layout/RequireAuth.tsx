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
        // Redirect them to the /sign-in page, but save the current location they were
        // trying to go to when they were redirected. This allows us to send them
        // along to that page after they login, which is a nicer user experience.
        return <Navigate to="/sign-in" state={{ from: location }} replace />;
    }

    return <>{children}</>;
};
