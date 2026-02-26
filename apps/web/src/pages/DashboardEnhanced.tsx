/**
 * Dashboard - BeamLab Ultimate Projects Dashboard (Enhanced)
 * Advanced template with stats cards, activity timeline, and professional design
 */

import { FC, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import { useUserRegistration } from '../hooks/useUserRegistration';
import { StatusBadge } from '../components/ui';
import beamLabLogo from '../assets/beamlab_logo.png';

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
    thumbnail?: string;
}

interface Activity {
    id: string;
    type: 'create' | 'analyze' | 'export' | 'edit';
    project: string;
    timestamp: string;
    user: string;
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
    const isClerkEnabled = isUsingClerk();
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

    const getActivityIcon = (type: Activity['type']) => {
        switch (type) {
            case 'create': return 'add_circle';
            case 'analyze': return 'analytics';
            case 'export': return 'download';
            case 'edit': return 'edit';
            default: return 'circle';
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
                        <div className="flex h-8 w-8 items-center justify-center rounded overflow-hidden">
                            <img src={beamLabLogo} alt="BeamLab" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-lg font-bold text-white">BeamLab</span>
                    </Link>
                </div>

                {/* Nav Items */}
                <nav className="flex-1 px-3 py-4 space-y-1">
                    {SIDEBAR_NAV.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setActiveNav(item.id);
                                if (item.id === 'settings') navigate('/settings-enhanced');
                                else if (item.id === 'projects') navigate('/dashboard-enhanced');
                                // Add other routes as needed
                            }}
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
                        {isSignedIn && isClerkEnabled ? (
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
                        <p className="text-text-muted">Welcome back. Here's what's happening with your projects.</p>
                    </motion.div>

                    {/* Stats Cards */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
                    >
                        {STATS.map((stat, idx) => (
                            <div
                                key={stat.label}
                                className="bg-surface-dark border border-border-dark rounded-xl p-5 hover:border-primary/30 transition-colors"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                                        <span className="material-symbols-outlined text-[20px]">{stat.icon}</span>
                                    </div>
                                    <div className={`flex items-center gap-1 text-xs font-semibold ${stat.trend === 'up' ? 'text-green-400' : stat.trend === 'down' ? 'text-red-400' : 'text-text-muted'}`}>
                                        {stat.trend === 'up' && <span className="material-symbols-outlined text-[14px]">trending_up</span>}
                                        {stat.trend === 'down' && <span className="material-symbols-outlined text-[14px]">trending_down</span>}
                                        {stat.change}
                                    </div>
                                </div>
                                <h3 className="text-2xl font-bold text-white mb-1">{stat.value}</h3>
                                <p className="text-sm text-text-muted">{stat.label}</p>
                            </div>
                        ))}
                    </motion.div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Recent Projects */}
                        <div className="lg:col-span-2">
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Projects</h2>
                                <button className="text-sm text-primary hover:underline">View All</button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                            <div className="absolute top-3 right-3">
                                                <StatusBadge
                                                    variant={project.status === 'Analyzed' ? 'pass' : project.status === 'Final' ? 'ok' : 'draft'}
                                                    size="sm"
                                                >
                                                    {project.status}
                                                </StatusBadge>
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
                        </div>

                        {/* Activity Timeline */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-sm font-bold text-white uppercase tracking-wider">Recent Activity</h2>
                            </div>

                            <div className="bg-surface-dark border border-border-dark rounded-xl p-4">
                                <div className="space-y-4">
                                    {RECENT_ACTIVITY.map((activity, idx) => (
                                        <div key={activity.id} className="flex gap-3">
                                            <div className="flex flex-col items-center">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${activity.type === 'analyze' ? 'bg-blue-500/20 text-blue-400' :
                                                    activity.type === 'create' ? 'bg-green-500/20 text-green-400' :
                                                        activity.type === 'export' ? 'bg-purple-500/20 text-purple-400' :
                                                            'bg-orange-500/20 text-orange-400'
                                                    }`}>
                                                    <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>{getActivityIcon(activity.type)}</span>
                                                </div>
                                                {idx < RECENT_ACTIVITY.length - 1 && (
                                                    <div className="w-px h-8 bg-border-dark mt-1"></div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0 pb-4">
                                                <p className="text-sm text-white font-medium">{activity.project}</p>
                                                <p className="text-xs text-text-muted mt-0.5">{activity.timestamp}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
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

const STATS: {
    label: string;
    value: string;
    change: string;
    trend: 'up' | 'down' | 'neutral';
    icon: string;
    bgColor: string;
}[] = [
        { label: 'Total Projects', value: '12', change: '+2', trend: 'up', icon: 'folder', bgColor: 'bg-blue-500/20 text-blue-400' },
        { label: 'Active Designs', value: '5', change: '+1', trend: 'up', icon: 'architecture', bgColor: 'bg-indigo-500/20 text-indigo-400' },
        { label: 'Cloud Storage', value: '45%', change: '0%', trend: 'neutral', icon: 'cloud', bgColor: 'bg-cyan-500/20 text-cyan-400' },
        { label: 'Team Members', value: '3', change: '+1', trend: 'up', icon: 'group', bgColor: 'bg-violet-500/20 text-violet-400' }
    ];

const RECENT_PROJECTS: Project[] = [
    { id: '1', name: 'Office Building Phase 1', type: 'Frame', lastModified: '2 hours ago', nodeCount: 48, memberCount: 82, status: 'Draft' },
    { id: '2', name: 'Warehouse Roof Truss', type: 'Truss', lastModified: 'Yesterday', nodeCount: 24, memberCount: 45, status: 'Analyzed' },
    { id: '3', name: 'Residential Foundation', type: 'Slab', lastModified: '3 days ago', nodeCount: 12, memberCount: 20, status: 'Final' },
];

const RECENT_ACTIVITY: Activity[] = [
    { id: '1', type: 'analyze', project: 'Ran analysis on Office Building', timestamp: '2 hours ago', user: 'You' },
    { id: '2', type: 'create', project: 'Created Warehouse Roof project', timestamp: 'Yesterday', user: 'You' },
    { id: '3', type: 'export', project: 'Exported Foundation report PDF', timestamp: '2 days ago', user: 'You' },
    { id: '4', type: 'edit', project: 'Updated Beam properties', timestamp: '3 days ago', user: 'You' },
];

export default Dashboard;
