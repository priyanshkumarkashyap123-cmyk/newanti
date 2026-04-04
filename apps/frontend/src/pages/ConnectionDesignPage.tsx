import React, { useEffect } from 'react';
import { ConnectionDesignPanel } from '../components/design/ConnectionDesignPanel';
// Layout wrapper if needed, e.g. DashboardLayout
// For now, I'll assume the route is wrapped or I just return the panel
// App.tsx wraps them in RequireAuth, but layout might be inside the page or Dashboard

export const ConnectionDesignPage: React.FC = () => {
    useEffect(() => { document.title = 'Connection Design | BeamLab'; }, []);

    return (
        <div className="min-h-screen bg-[#0b1326]">
            {/* Navigation Header usually handled by Sidebar, but we might be in full page mode */}
            <ConnectionDesignPanel />
        </div>
    );
};

export default ConnectionDesignPage;
