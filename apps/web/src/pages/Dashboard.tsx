/**
 * Dashboard - BeamLab Ultimate Projects Dashboard
 * Modern project hub with BeamLab branding
 */

import { FC, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import { useUserRegistration } from '../hooks/useUserRegistration';

// ============================================
// TYPES
// ============================================

interface DashboardProps {
    onLaunchModule?: (module: string) => void;
}

interface Project {
    id: string;
    name: string;
    type: 'Frame' | 'Truss' | 'Beam' | 'Slab';
    lastModified: string;
    nodeCount: number;
    memberCount: number;
    status: 'Analyzed' | 'Draft' | 'Final';
}

// ============================================
// DASHBOARD COMPONENT
// ============================================

export const Dashboard: FC<DashboardProps> = ({ onLaunchModule }) => {
    const navigate = useNavigate();
    const [activeNav, setActiveNav] = useState('projects');
    const [searchQuery, setSearchQuery] = useState('');

    // Register user in MongoDB when signed in
    useUserRegistration();

    // Use unified auth hook
    const { isSignedIn, user, signOut } = useAuth();
    const useClerk = isUsingClerk();
    const userName = isSignedIn && user?.firstName ? user.firstName : 'Engineer';

    const handleLaunchModule = (moduleId: string) => {
        if (onLaunchModule) onLaunchModule(moduleId);
        navigate(`/workspace/${moduleId}`);
    };

    const handleNewProject = () => {
        navigate('/demo');
    };

    const handleOpenProject = (projectId: string) => {
        navigate(`/demo?project=${projectId}`);
    };

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const filteredProjects = RECENT_PROJECTS.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const getTypeIcon = (type: Project['type']) => {
        switch (type) {
            case 'Frame': return 'apartment';
            case 'Truss': return 'grid_on';
            case 'Beam': return 'straighten';
            case 'Slab': return 'layers';
            default: return 'deployed_code';
        }
    };

    return (
        <div className="min-h-screen bg-background-dark flex font-display">
            {/* ================================================
                SIDEBAR
                ================================================ */}
            <aside className="w-64 bg-surface-dark border-r border-border-dark flex flex-col">
                {/* Logo */}
                <div className="h-16 flex items-center px-6 border-b border-border-dark">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-steel-blue">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>architecture</span>
                        </div>
                        <span className="text-lg font-bold text-white">BeamLab</span>
                    </Link>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {SIDEBAR_NAV.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => setActiveNav(item.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${activeNav === item.id
                                ? 'bg-primary text-white'
                                : 'text-text-muted hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>{item.icon}</span>
                            {item.label}
                        </button>
                    ))}
                </nav>

                {/* User Section */}
                <div className="p-4 border-t border-border-dark">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary" style={{ fontSize: '20px' }}>person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-text-muted">Free Plan</p>
                        </div>
                        {isSignedIn && useClerk ? (
                            <UserButton afterSignOutUrl="/" />
                        ) : isSignedIn ? (
                            <button
                                onClick={() => signOut()}
                                className="text-xs text-text-muted hover:text-white"
                            >
                                Sign Out
                            </button>
                        ) : null}
                    </div>
                </div>
            </aside>

            {/* ================================================
                MAIN CONTENT
                ================================================ */}
            <main className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <header className="h-16 bg-surface-dark border-b border-border-dark flex items-center justify-between px-6">
                    <div className="flex items-center gap-4 flex-1">
                        {/* Search */}
                        <div className="relative max-w-md flex-1">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" style={{ fontSize: '20px' }}>search</span>
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 bg-background-dark border border-border-dark rounded-lg text-sm text-white placeholder-text-muted focus:outline-none focus:border-primary"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="h-10 px-4 bg-background-dark border border-border-dark rounded-lg text-sm text-text-muted hover:text-white hover:border-text-muted transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>upload</span>
                            Import
                        </button>
                        <button
                            onClick={handleNewProject}
                            className="h-10 px-5 bg-accent hover:bg-accent-dark text-steel-blue rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg shadow-accent/20"
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>add</span>
                            New Project
                        </button>
                    </div>
                </header>

                {/* Content Area */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Welcome */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-8"
                    >
                        <h1 className="text-2xl font-bold text-white mb-1">
                            {getGreeting()}, {userName}
                        </h1>
                        <p className="text-text-muted">Welcome back. Continue working on your structural projects.</p>
                    </motion.div>

                    {/* Quick Actions (Module Launchers) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="mb-10"
                    >
                        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4">Quick Start</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {MODULE_LAUNCHERS.map((module) => (
                                <button
                                    key={module.id}
                                    onClick={() => handleLaunchModule(module.id)}
                                    className="group bg-surface-dark border border-border-dark rounded-xl p-5 text-left hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all"
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bgColor} group-hover:bg-accent group-hover:text-steel-blue transition-colors`}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{module.icon}</span>
                                    </div>
                                    <h3 className="font-bold text-white mb-1 group-hover:text-primary transition-colors">
                                        {module.title}
                                    </h3>
                                    <p className="text-sm text-text-muted">{module.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </motion.div>

                    {/* Projects Grid */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Projects</h2>
                            <button className="text-sm text-primary hover:underline">View All</button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProjects.map((project) => (
                                <div
                                    key={project.id}
                                    onClick={() => handleOpenProject(project.id)}
                                    className="group bg-surface-dark border border-border-dark rounded-xl overflow-hidden cursor-pointer hover:border-primary hover:shadow-lg hover:shadow-primary/10 transition-all"
                                >
                                    {/* Project Preview */}
                                    <div className="aspect-[4/3] bg-background-dark relative grid-pattern flex items-center justify-center">
                                        <span className="material-symbols-outlined text-5xl text-border-dark group-hover:text-primary/40 transition-colors">
                                            {getTypeIcon(project.type)}
                                        </span>
                                        {/* Status Badge */}
                                        <div className={`absolute top-3 right-3 px-2 py-1 rounded-md text-xs font-bold ${project.status === 'Analyzed' ? 'bg-green-500/20 text-green-400' :
                                            project.status === 'Final' ? 'bg-primary/20 text-primary' :
                                                'bg-accent/20 text-accent'
                                            }`}>
                                            {project.status}
                                        </div>
                                    </div>

                                    {/* Project Info */}
                                    <div className="p-4">
                                        <h3 className="font-bold text-white truncate mb-1 group-hover:text-primary transition-colors">{project.name}</h3>
                                        <div className="flex items-center gap-3 text-xs text-text-muted">
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>circle</span>
                                                {project.nodeCount} Nodes
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <span className="material-symbols-outlined" style={{ fontSize: '14px' }}>horizontal_rule</span>
                                                {project.memberCount} Members
                                            </span>
                                        </div>
                                        <p className="text-xs text-text-muted mt-2">{project.lastModified}</p>
                                    </div>
                                </div>
                            ))}

                            {/* Empty State / New Project Card */}
                            <button
                                onClick={handleNewProject}
                                className="group border-2 border-dashed border-border-dark rounded-xl flex flex-col items-center justify-center gap-3 p-8 hover:border-primary hover:bg-primary/5 transition-all min-h-[240px]"
                            >
                                <div className="w-12 h-12 rounded-full bg-border-dark flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                                    <span className="material-symbols-outlined text-text-muted group-hover:text-primary" style={{ fontSize: '24px' }}>add</span>
                                </div>
                                <span className="text-sm font-medium text-text-muted group-hover:text-primary">Create New Project</span>
                            </button>
                        </div>
                    </motion.div>
                </div>
            </main>
        </div>
    );
};

// ============================================
// DATA
// ============================================

const SIDEBAR_NAV = [
    { id: 'projects', label: 'My Projects', icon: 'folder_open' },
    { id: 'templates', label: 'Templates', icon: 'dashboard' },
    { id: 'shared', label: 'Shared With Me', icon: 'group' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
];

const MODULE_LAUNCHERS = [
    { id: 'structural-3d', title: 'Structural 3D', subtitle: 'Full 3D Frame Analysis', icon: 'deployed_code', bgColor: 'bg-primary/20 text-primary' },
    { id: 'beam', title: 'Beam Tool', subtitle: 'Quick Beam Analysis', icon: 'straighten', bgColor: 'bg-orange-500/20 text-orange-400' },
    { id: 'rc-design', title: 'RC Design', subtitle: 'Concrete Design', icon: 'apartment', bgColor: 'bg-green-500/20 text-green-400' },
    { id: 'steel-design', title: 'Steel Design', subtitle: 'Steel Member Checks', icon: 'construction', bgColor: 'bg-purple-500/20 text-purple-400' },
];

const RECENT_PROJECTS: Project[] = [
    { id: '1', name: 'Office Building Phase 1', type: 'Frame', lastModified: '2 hours ago', nodeCount: 48, memberCount: 82, status: 'Draft' },
    { id: '2', name: 'Warehouse Roof Truss', type: 'Truss', lastModified: 'Yesterday', nodeCount: 24, memberCount: 45, status: 'Analyzed' },
    { id: '3', name: 'Residential Foundation', type: 'Slab', lastModified: '3 days ago', nodeCount: 12, memberCount: 20, status: 'Final' },
];

export default Dashboard;
