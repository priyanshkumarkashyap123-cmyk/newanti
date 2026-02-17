/**
 * UnifiedDashboard.tsx - Consolidated Dashboard Component
 * 
 * Combines the best features from Dashboard.tsx, DashboardEnhanced.tsx, and StreamDashboard.tsx
 * into a single, maintainable component with consistent styling.
 * 
 * Features:
 * - Project cards with thumbnails
 * - Quick action buttons
 * - Activity timeline
 * - Stats overview
 * - Template gallery
 * - Search and filter
 * - Responsive design
 */

import { FC, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, FolderOpen, Search, Clock, Star, Archive,
    BarChart3, Box, Triangle, Building2, Columns,
    Play, Settings, HelpCircle, ChevronRight, Download,
    Upload, Zap, Layers, Grid3X3, ArrowUpRight, Filter,
    LayoutDashboard, FileText, TrendingUp, Bell, LogOut, Cpu,
    Activity as ActivityIcon
} from 'lucide-react';
import { UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import { useUserRegistration } from '../hooks/useUserRegistration';
import { Tooltip } from '../components/ui/Tooltip';
import beamLabLogo from '../assets/beamlab_logo.png';

// ============================================
// TYPES
// ============================================

interface Project {
    id: string;
    name: string;
    type: 'frame' | 'truss' | 'beam' | 'slab' | 'bridge';
    thumbnail?: string;
    lastModified: Date;
    nodeCount: number;
    memberCount: number;
    status: 'draft' | 'analyzed' | 'designed' | 'complete';
    starred: boolean;
}

interface QuickAction {
    id: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    color: string;
    route: string;
    badge?: string;
}

interface Template {
    id: string;
    name: string;
    type: string;
    icon: React.ReactNode;
    description: string;
}

interface Activity {
    id: string;
    type: 'create' | 'analyze' | 'export' | 'edit';
    project: string;
    timestamp: string;
    user: string;
}

interface StatsCard {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    trend?: string;
    color: string;
}

interface DashboardProps {
    onLaunchModule?: (module: string) => void;
}

// ============================================
// MOCK DATA
// ============================================

const MOCK_PROJECTS: Project[] = [
    {
        id: '1',
        name: 'Multi-Story Building Frame',
        type: 'frame',
        lastModified: new Date(2025, 0, 2, 14, 30),
        nodeCount: 48,
        memberCount: 72,
        status: 'analyzed',
        starred: true
    },
    {
        id: '2',
        name: 'Warehouse Roof Truss',
        type: 'truss',
        lastModified: new Date(2025, 0, 1, 9, 15),
        nodeCount: 24,
        memberCount: 35,
        status: 'designed',
        starred: false
    },
    {
        id: '3',
        name: 'Highway Bridge Girder',
        type: 'bridge',
        lastModified: new Date(2024, 11, 28, 16, 45),
        nodeCount: 32,
        memberCount: 40,
        status: 'complete',
        starred: true
    },
    {
        id: '4',
        name: 'Cantilever Beam Analysis',
        type: 'beam',
        lastModified: new Date(2024, 11, 27, 11, 20),
        nodeCount: 5,
        memberCount: 4,
        status: 'draft',
        starred: false
    },
    {
        id: '5',
        name: 'Two-Way Slab Design',
        type: 'slab',
        lastModified: new Date(2024, 11, 26, 8, 0),
        nodeCount: 16,
        memberCount: 24,
        status: 'analyzed',
        starred: false
    }
];

const QUICK_ACTIONS: QuickAction[] = [
    {
        id: 'new-project',
        title: 'New Project',
        description: 'Start from scratch',
        icon: <Plus className="w-6 h-6" />,
        color: 'from-blue-600 to-blue-700',
        route: '/app'
    },
    {
        id: 'ai-architect',
        title: 'AI Architect',
        description: 'Generate with AI',
        icon: <Zap className="w-6 h-6" />,
        color: 'from-purple-600 to-purple-700',
        route: '/app?mode=ai',
        badge: 'NEW'
    },
    {
        id: 'ai-power',
        title: 'AI Power',
        description: 'Advanced AI Analytics',
        icon: <ActivityIcon className="w-6 h-6" />,
        color: 'from-cyan-600 to-cyan-700',
        route: '/ai-dashboard',
        badge: '🚀'
    },
    {
        id: 'templates',
        title: 'Templates',
        description: 'Pre-built structures',
        icon: <Layers className="w-6 h-6" />,
        color: 'from-emerald-600 to-emerald-700',
        route: '/app?panel=templates'
    },
    {
        id: 'import',
        title: 'Import',
        description: 'DXF, STAAD, SAP',
        icon: <Upload className="w-6 h-6" />,
        color: 'from-orange-600 to-orange-700',
        route: '/app?tool=import'
    }
];

const TEMPLATES: Template[] = [
    { id: 'frame', name: '3D Frame', type: 'Building', icon: <Building2 className="w-5 h-5" />, description: 'Multi-story building' },
    { id: 'truss', name: 'Pratt Truss', type: 'Roof', icon: <Triangle className="w-5 h-5" />, description: 'Standard roof truss' },
    { id: 'portal', name: 'Portal Frame', type: 'Warehouse', icon: <Columns className="w-5 h-5" />, description: 'Industrial shed' },
    { id: 'beam', name: 'Continuous Beam', type: 'Beam', icon: <Box className="w-5 h-5" />, description: 'Multi-span beam' }
];

const RECENT_ACTIVITY: Activity[] = [
    { id: '1', type: 'analyze', project: 'Multi-Story Building Frame', timestamp: '2 hours ago', user: 'You' },
    { id: '2', type: 'create', project: 'New Bridge Project', timestamp: '5 hours ago', user: 'You' },
    { id: '3', type: 'export', project: 'Warehouse Roof Truss', timestamp: 'Yesterday', user: 'You' },
    { id: '4', type: 'edit', project: 'Highway Bridge Girder', timestamp: '2 days ago', user: 'You' }
];

// ============================================
// UTILITY FUNCTIONS
// ============================================

const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
};

const getStatusColor = (status: Project['status']): string => {
    switch (status) {
        case 'draft': return 'bg-slate-500';
        case 'analyzed': return 'bg-blue-500';
        case 'designed': return 'bg-amber-500';
        case 'complete': return 'bg-emerald-500';
        default: return 'bg-slate-500';
    }
};

const getTypeIcon = (type: Project['type']): React.ReactNode => {
    switch (type) {
        case 'frame': return <Building2 className="w-4 h-4" />;
        case 'truss': return <Triangle className="w-4 h-4" />;
        case 'beam': return <Box className="w-4 h-4" />;
        case 'slab': return <Grid3X3 className="w-4 h-4" />;
        case 'bridge': return <Columns className="w-4 h-4" />;
        default: return <Box className="w-4 h-4" />;
    }
};

const getActivityIcon = (type: Activity['type']): React.ReactNode => {
    switch (type) {
        case 'create': return <Plus className="w-4 h-4" />;
        case 'analyze': return <BarChart3 className="w-4 h-4" />;
        case 'export': return <Download className="w-4 h-4" />;
        case 'edit': return <FileText className="w-4 h-4" />;
        default: return <ActivityIcon className="w-4 h-4" />;
    }
};

// ============================================
// SUB-COMPONENTS
// ============================================

const ProjectCard: FC<{ project: Project; onClick: () => void }> = ({ project, onClick }) => (
    <motion.div
        whileHover={{ y: -4, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        onClick={onClick}
        className="group relative bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer hover:border-blue-500/30 hover:bg-slate-800/80 transition-all shadow-lg shadow-black/20"
    >
        {/* Thumbnail / Preview */}
        <div className="aspect-video bg-slate-950 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative border border-slate-800/50">
            <div className="text-slate-700 text-4xl group-hover:scale-110 transition-transform duration-500">
                {getTypeIcon(project.type)}
            </div>
            {project.starred && (
                <div className="absolute top-2 right-2">
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-blue-500/20 backdrop-blur-sm rounded-full p-2 border border-blue-500/30">
                    <ArrowUpRight className="w-4 h-4 text-blue-400" />
                </div>
            </div>
        </div>

        {/* Info */}
        <div className="space-y-2">
            <div className="flex items-start justify-between">
                <h3 className="font-semibold text-slate-100 truncate flex-1 group-hover:text-blue-400 transition-colors">
                    {project.name}
                </h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(project.lastModified)}
                </span>
                <span>•</span>
                <span>{project.nodeCount} nodes</span>
                <span>•</span>
                <span>{project.memberCount} members</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white shadow-sm ${getStatusColor(project.status)}`}>
                    {project.status.toUpperCase()}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                    {getTypeIcon(project.type)}
                    {project.type.charAt(0).toUpperCase() + project.type.slice(1)}
                </span>
            </div>
        </div>
    </motion.div>
);

const StatsCardComponent: FC<StatsCard> = ({ label, value, icon, trend, color }) => (
    <div className={`bg-gradient-to-br ${color} rounded-xl p-4 border border-white/10`}>
        <div className="flex items-center justify-between mb-2">
            <span className="text-white/70 text-sm">{label}</span>
            <div className="text-white/50">{icon}</div>
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
        {trend && (
            <div className="flex items-center gap-1 mt-1 text-xs text-white/70">
                <TrendingUp className="w-3 h-3" />
                {trend}
            </div>
        )}
    </div>
);

const ActivityItem: FC<{ activity: Activity }> = ({ activity }) => (
    <div className="flex items-center gap-3 py-3 border-b border-slate-800 last:border-0">
        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400">
            {getActivityIcon(activity.type)}
        </div>
        <div className="flex-1">
            <div className="text-sm text-slate-200">
                {activity.type === 'create' && 'Created '}
                {activity.type === 'analyze' && 'Analyzed '}
                {activity.type === 'export' && 'Exported '}
                {activity.type === 'edit' && 'Edited '}
                <span className="text-blue-400">{activity.project}</span>
            </div>
            <div className="text-xs text-slate-400">{activity.timestamp}</div>
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const UnifiedDashboard: FC<DashboardProps> = ({ onLaunchModule }) => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [view, setView] = useState<'grid' | 'list'>('grid');

    // Register user in MongoDB when signed in
    useUserRegistration();

    // Use unified auth hook
    const { isSignedIn, user, signOut } = useAuth();
    const isClerkEnabled = isUsingClerk();
    const userName = isSignedIn && user?.firstName ? user.firstName : 'Engineer';

    // Get greeting based on time - memoized to avoid impure Date call during render
    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    }, []);

    // Filter projects
    const filteredProjects = useMemo(() => {
        return MOCK_PROJECTS.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            return matchesSearch && matchesStatus;
        });
    }, [searchQuery, filterStatus]);

    // Stats
    const stats: StatsCard[] = [
        { label: 'Total Projects', value: MOCK_PROJECTS.length, icon: <FolderOpen className="w-5 h-5" />, trend: '+2 this week', color: 'from-blue-600 to-blue-700' },
        { label: 'Analyses Run', value: 47, icon: <BarChart3 className="w-5 h-5" />, trend: '+12 this month', color: 'from-purple-600 to-purple-700' },
        { label: 'Members Designed', value: '2.4k', icon: <Cpu className="w-5 h-5" />, color: 'from-emerald-600 to-emerald-700' },
        { label: 'Time Saved', value: '156h', icon: <Clock className="w-5 h-5" />, trend: 'vs manual methods', color: 'from-orange-600 to-orange-700' }
    ];

    const handleOpenProject = (projectId: string) => {
        navigate(`/demo?project=${projectId}`);
    };

    const handleQuickAction = (route: string) => {
        navigate(route);
    };

    return (
        <div className="min-h-screen bg-slate-950">
            {/* Header */}
            <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        {/* Logo & Nav */}
                        <div className="flex items-center gap-8">
                            <Link to="/" className="flex items-center gap-3">
                                <img src={beamLabLogo} alt="BeamLab" className="h-8 w-8" />
                                <span className="text-xl font-bold text-white">BeamLab</span>
                                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs font-bold">ULTIMATE</span>
                            </Link>
                            <nav className="hidden md:flex items-center gap-1">
                                <Link to="/stream" className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2">
                                    <LayoutDashboard className="w-4 h-4" />
                                    Dashboard
                                </Link>
                                <Link to="/reports" className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Reports
                                </Link>
                                <Link to="/settings" className="px-4 py-2 rounded-lg text-slate-300 hover:bg-slate-800 transition-colors flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    Settings
                                </Link>
                            </nav>
                        </div>

                        {/* User & Actions */}
                        <div className="flex items-center gap-4">
                            <button
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors relative"
                                aria-label="Notifications"
                            >
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
                            </button>
                            <button
                                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
                                aria-label="Help"
                            >
                                <HelpCircle className="w-5 h-5" />
                            </button>
                            <div className="h-6 w-px bg-slate-700" />
                            {isClerkEnabled ? (
                                <UserButton afterSignOutUrl="/" />
                            ) : (
                                <div className="flex items-center gap-3">
                                    <span className="text-sm text-slate-400">{userName}</span>
                                    <button
                                        onClick={() => signOut()}
                                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 transition-colors"
                                        aria-label="Sign Out"
                                    >
                                        <LogOut className="w-5 h-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Welcome Section */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">
                        {greeting}, {userName}! 👋
                    </h1>
                    <p className="text-slate-400">
                        Ready to design something amazing? Let's build the future of structural engineering.
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {stats.map((stat, index) => (
                        <motion.div
                            key={stat.label}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                        >
                            <StatsCardComponent {...stat} />
                        </motion.div>
                    ))}
                </div>

                {/* Quick Actions */}
                <div className="mb-8">
                    <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {QUICK_ACTIONS.map((action, index) => (
                            <motion.button
                                key={action.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: 0.2 + index * 0.1 }}
                                onClick={() => handleQuickAction(action.route)}
                                className={`relative bg-gradient-to-br ${action.color} rounded-xl p-6 text-left hover:scale-105 transition-transform shadow-lg`}
                            >
                                {action.badge && (
                                    <span className="absolute top-3 right-3 px-2 py-0.5 bg-white/20 rounded-full text-[10px] font-bold text-white">
                                        {action.badge}
                                    </span>
                                )}
                                <div className="text-white mb-3">{action.icon}</div>
                                <h3 className="font-semibold text-white">{action.title}</h3>
                                <p className="text-sm text-white/70">{action.description}</p>
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Main Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Projects Section */}
                    <div className="lg:col-span-2">
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-4 gap-3">
                            <h2 className="text-lg font-semibold text-white">Recent Projects</h2>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search projects..."
                                        aria-label="Search projects"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-full sm:w-64"
                                    />
                                </div>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500"
                                >
                                    <option value="all">All Status</option>
                                    <option value="draft">Draft</option>
                                    <option value="analyzed">Analyzed</option>
                                    <option value="designed">Designed</option>
                                    <option value="complete">Complete</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <AnimatePresence>
                                {filteredProjects.map((project, index) => (
                                    <motion.div
                                        key={project.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -20 }}
                                        transition={{ delay: index * 0.05 }}
                                    >
                                        <ProjectCard
                                            project={project}
                                            onClick={() => handleOpenProject(project.id)}
                                        />
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>

                        {filteredProjects.length === 0 && (
                            <div className="empty-state bg-slate-900/50 border border-slate-800 rounded-xl">
                                <FolderOpen className="empty-state-icon" />
                                <h3 className="empty-state-title">No projects found</h3>
                                <p className="empty-state-description">
                                    {searchQuery 
                                        ? `No projects match "${searchQuery}". Try adjusting your search or filter.`
                                        : "You haven't created any projects yet. Start building something amazing!"
                                    }
                                </p>
                                <button 
                                    onClick={() => navigate('/app')}
                                    className="empty-state-action"
                                    aria-label="Create your first project"
                                >
                                    <span className="flex items-center gap-2">
                                        <Plus className="w-4 h-4" />
                                        Create New Project
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Activity Feed */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                <ActivityIcon className="w-4 h-4 text-blue-400" />
                                Recent Activity
                            </h3>
                            <div className="space-y-1">
                                {RECENT_ACTIVITY.map(activity => (
                                    <ActivityItem key={activity.id} activity={activity} />
                                ))}
                            </div>
                        </div>

                        {/* Templates */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                                <Layers className="w-4 h-4 text-emerald-400" />
                                Quick Templates
                            </h3>
                            <div className="grid grid-cols-2 gap-2">
                                {TEMPLATES.map(template => (
                                    <button
                                        key={template.id}
                                        onClick={() => navigate(`/app?template=${template.id}`)}
                                        className="p-3 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors text-left"
                                    >
                                        <div className="text-slate-400 mb-2">{template.icon}</div>
                                        <div className="text-sm font-medium text-slate-200">{template.name}</div>
                                        <div className="text-xs text-slate-400">{template.type}</div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Pro Features CTA */}
                        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/30 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Zap className="w-5 h-5 text-blue-400" />
                                <span className="font-semibold text-white">Unlock Pro Features</span>
                            </div>
                            <p className="text-sm text-slate-300 mb-4">
                                Get AI-powered design suggestions, unlimited cloud saves, and advanced analysis tools.
                            </p>
                            <button
                                onClick={() => navigate('/pricing')}
                                className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Upgrade Now
                            </button>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="border-t border-slate-800 mt-16 py-8">
                <div className="max-w-7xl mx-auto px-6 text-center text-sm text-slate-400">
                    <p>© {new Date().getFullYear()} BeamLab Ultimate. Professional Structural Analysis Software.</p>
                    <div className="flex items-center justify-center gap-4 mt-4">
                        <Link to="/privacy" className="hover:text-slate-300 transition-colors">Privacy</Link>
                        <Link to="/terms" className="hover:text-slate-300 transition-colors">Terms</Link>
                        <Link to="/help" className="hover:text-slate-300 transition-colors">Help</Link>
                        <Link to="/contact" className="hover:text-slate-300 transition-colors">Contact</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default UnifiedDashboard;
