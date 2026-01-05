/**
 * StreamDashboard - Main Application Entry Point
 * 
 * Modern dashboard that appears before the modeler with:
 * - Project overview cards
 * - Quick actions for common workflows
 * - Recent activity feed
 * - Structure templates
 * - Analysis summary widgets
 * 
 * Premium Navy/Slate Theme
 */

import { FC, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, FolderOpen, Search, Clock, Star, Archive,
    BarChart3, Box, Triangle, Building2, Columns,
    Play, Settings, HelpCircle, ChevronRight, Download,
    Upload, Zap, Layers, Grid3X3, ArrowUpRight, Filter,
    LayoutDashboard, FileText, TrendingUp, Bell, LogOut, Cpu
} from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { Tooltip } from '../components/ui/Tooltip';

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

// ============================================
// MOCK DATA
// ============================================

const MOCK_PROJECTS: Project[] = [
    {
        id: '1',
        name: 'Multi-Story Building Frame',
        type: 'frame',
        lastModified: new Date(2025, 11, 28, 14, 30),
        nodeCount: 48,
        memberCount: 72,
        status: 'analyzed',
        starred: true
    },
    {
        id: '2',
        name: 'Warehouse Roof Truss',
        type: 'truss',
        lastModified: new Date(2025, 11, 27, 9, 15),
        nodeCount: 24,
        memberCount: 35,
        status: 'designed',
        starred: false
    },
    {
        id: '3',
        name: 'Highway Bridge Girder',
        type: 'bridge',
        lastModified: new Date(2025, 11, 25, 16, 45),
        nodeCount: 32,
        memberCount: 40,
        status: 'complete',
        starred: true
    },
    {
        id: '4',
        name: 'Cantilever Beam Analysis',
        type: 'beam',
        lastModified: new Date(2025, 11, 24, 11, 20),
        nodeCount: 5,
        memberCount: 4,
        status: 'draft',
        starred: false
    },
    {
        id: '5',
        name: 'Two-Way Slab Design',
        type: 'slab',
        lastModified: new Date(2025, 11, 23, 8, 0),
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

// ============================================
// COMPONENTS
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
                <h3 className="font-semibold text-slate-100 truncate flex-1 group-hover:text-blue-400 transition-colors">{project.name}</h3>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
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

const QuickActionCard: FC<{ action: QuickAction; onClick: () => void }> = ({ action, onClick }) => (
    <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
        className={`relative flex flex-col items-start gap-3 p-5 rounded-xl bg-gradient-to-br ${action.color} text-white shadow-lg overflow-hidden group border border-white/10`}
    >
        <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-colors" />
        <div className="relative z-10 w-full">
            <div className="flex items-center justify-between mb-2">
                <div className="p-2 rounded-lg bg-white/20 backdrop-blur-sm">
                    {action.icon}
                </div>
                {action.badge && (
                    <span className="px-1.5 py-0.5 bg-white text-blue-600 rounded text-[10px] font-bold shadow-sm">
                        {action.badge}
                    </span>
                )}
            </div>
            <h3 className="font-bold text-lg leading-tight text-left">{action.title}</h3>
            <p className="text-xs text-white/80 text-left mt-1 font-medium">{action.description}</p>
        </div>
    </motion.button>
);

const StatCard: FC<{ label: string; value: string | number; icon: React.ReactNode; trend?: string }> = ({ label, value, icon, trend }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
        <div className="flex items-center justify-between mb-3">
            <span className="text-slate-400 text-sm font-medium">{label}</span>
            <span className="text-slate-600 bg-slate-800 p-1.5 rounded-md">{icon}</span>
        </div>
        <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-white tracking-tight">{value}</span>
            {trend && (
                <span className="text-xs text-emerald-400 flex items-center gap-0.5 mb-1.5 font-medium bg-emerald-500/10 px-1.5 py-0.5 rounded">
                    <TrendingUp className="w-3 h-3" />
                    {trend}
                </span>
            )}
        </div>
    </div>
);

// ============================================
// MAIN COMPONENT
// ============================================

export const StreamDashboard: FC = () => {
    const navigate = useNavigate();
    const { isSignedIn, user, signOut } = useAuth(); // Added signOut here if available
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [showStarred, setShowStarred] = useState(false);

    const userName = user?.firstName || 'Engineer';

    const filteredProjects = useMemo(() => {
        return MOCK_PROJECTS.filter(p => {
            const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            const matchesStarred = !showStarred || p.starred;
            return matchesSearch && matchesStatus && matchesStarred;
        });
    }, [searchQuery, filterStatus, showStarred]);

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-blue-500/30">
            {/* ================================================
                HEADER
                ================================================ */}
            <header className="sticky top-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-blue-500/25 transition-all">
                            <Cpu className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="font-bold text-lg text-white bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-300">BeamLab</span>
                            <span className="ml-1.5 px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-bold rounded tracking-wide">ULTIMATE</span>
                        </div>
                    </Link>

                    {/* Center Nav */}
                    <nav className="hidden md:flex items-center justify-center p-1 bg-slate-900/50 rounded-lg border border-slate-800/50">
                        <button className="px-4 py-1.5 text-white bg-slate-800 rounded-md text-sm font-medium shadow-sm border border-slate-700">
                            <LayoutDashboard className="w-4 h-4 inline mr-2" />
                            Dashboard
                        </button>
                        <button
                            onClick={() => navigate('/app')}
                            className="px-4 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md text-sm font-medium transition-colors"
                        >
                            <Box className="w-4 h-4 inline mr-2" />
                            Modeler
                        </button>
                        <button className="px-4 py-1.5 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-md text-sm font-medium transition-colors">
                            <FileText className="w-4 h-4 inline mr-2" />
                            Reports
                        </button>
                    </nav>

                    {/* Right Actions */}
                    <div className="flex items-center gap-3">
                        <Tooltip content="Notifications">
                            <button className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
                                <Bell className="w-5 h-5" />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-slate-950" />
                            </button>
                        </Tooltip>

                        <div className="h-6 w-px bg-slate-800 mx-1" />

                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <div className="text-sm font-medium text-white">{userName}</div>
                                <div className="text-[10px] text-slate-500 font-medium">Free Plan</div>
                            </div>
                            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-inner ring-2 ring-slate-900">
                                {userName.charAt(0).toUpperCase()}
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* ================================================
                MAIN CONTENT
                ================================================ */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {/* Welcome Section */}
                <section className="mb-10">
                    <h1 className="text-3xl font-bold mb-2 tracking-tight">
                        {getGreeting()}, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">{userName}</span>
                    </h1>
                    <p className="text-slate-400">
                        Ready to innovate? Select an action below to get started.
                    </p>
                </section>

                {/* Quick Actions */}
                <section className="mb-12">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                            <Zap className="w-5 h-5 text-amber-400" />
                            Quick Actions
                        </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {QUICK_ACTIONS.map(action => (
                            <QuickActionCard
                                key={action.id}
                                action={action}
                                onClick={() => navigate(action.route)}
                            />
                        ))}
                    </div>
                </section>

                {/* Stats */}
                <section className="mb-12">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <StatCard label="Total Projects" value={MOCK_PROJECTS.length} icon={<FolderOpen className="w-5 h-5" />} />
                        <StatCard label="Analyzed" value={MOCK_PROJECTS.filter(p => p.status === 'analyzed').length} icon={<BarChart3 className="w-5 h-5" />} trend="+2 this week" />
                        <StatCard label="Total Nodes" value={MOCK_PROJECTS.reduce((sum, p) => sum + p.nodeCount, 0)} icon={<Grid3X3 className="w-5 h-5" />} />
                        <StatCard label="Total Members" value={MOCK_PROJECTS.reduce((sum, p) => sum + p.memberCount, 0)} icon={<Box className="w-5 h-5" />} />
                    </div>
                </section>

                {/* Projects Section */}
                <section className="mb-12">
                    <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                            <FolderOpen className="w-5 h-5 text-blue-400" />
                            Recent Projects
                        </h2>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {/* Search */}
                            <div className="relative flex-1 sm:flex-none">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                                <input
                                    type="text"
                                    placeholder="Search projects..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full sm:w-64 pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                                />
                            </div>
                            {/* Filter */}
                            <select
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                                className="px-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-sm text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            >
                                <option value="all">All Status</option>
                                <option value="draft">Draft</option>
                                <option value="analyzed">Analyzed</option>
                                <option value="designed">Designed</option>
                                <option value="complete">Complete</option>
                            </select>
                            {/* Starred Toggle */}
                            <Tooltip content="Show Starred Only">
                                <button
                                    onClick={() => setShowStarred(!showStarred)}
                                    className={`p-2 rounded-lg border transition-colors ${showStarred
                                            ? 'bg-amber-500/10 border-amber-500/50 text-amber-400'
                                            : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-amber-400 hover:border-slate-700'
                                        }`}
                                >
                                    <Star className="w-4 h-4" />
                                </button>
                            </Tooltip>
                        </div>
                    </div>

                    {/* Project Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <AnimatePresence mode="popLayout">
                            {filteredProjects.map(project => (
                                <ProjectCard
                                    key={project.id}
                                    project={project}
                                    onClick={() => navigate(`/app?project=${project.id}`)}
                                />
                            ))}
                        </AnimatePresence>

                        {/* New Project Card */}
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => navigate('/app')}
                            className="aspect-[4/3] flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all group bg-slate-900/50 relative overflow-hidden"
                        >
                            {/* Hint Text */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                                <div className="absolute inset-0 bg-blue-500/5 blur-xl" />
                            </div>

                            <div className="w-14 h-14 rounded-full bg-slate-800 group-hover:bg-blue-500/20 flex items-center justify-center mb-4 transition-colors z-10 border border-slate-700 group-hover:border-blue-500/50">
                                <Plus className="w-6 h-6 text-slate-500 group-hover:text-blue-400" />
                            </div>
                            <span className="text-sm font-semibold text-slate-500 group-hover:text-blue-400 transition-colors z-10">
                                Create New Project
                            </span>
                        </motion.button>
                    </div>

                    {filteredProjects.length === 0 && searchQuery && (
                        <div className="text-center py-16 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
                            <Search className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                            <p className="text-slate-500 text-lg">No projects found matching "{searchQuery}"</p>
                            <button onClick={() => setSearchQuery('')} className="mt-4 text-blue-400 hover:text-blue-300 text-sm font-medium">
                                Clear Search
                            </button>
                        </div>
                    )}
                </section>

                {/* Templates Section */}
                <section>
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-200">
                            <Layers className="w-5 h-5 text-emerald-400" />
                            Quick Templates
                        </h2>
                        <button
                            onClick={() => navigate('/app?panel=templates')}
                            className="text-sm text-slate-400 hover:text-white flex items-center gap-1 transition-colors font-medium"
                        >
                            View All <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                        {TEMPLATES.map(template => (
                            <motion.button
                                key={template.id}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/app?template=${template.id}`)}
                                className="flex items-center gap-3 p-4 bg-slate-900 border border-slate-800 rounded-xl hover:border-slate-700 hover:bg-slate-800/80 transition-all text-left group"
                            >
                                <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-white group-hover:scale-110 transition-all border border-slate-700/50">
                                    {template.icon}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-slate-200 text-sm truncate">{template.name}</h3>
                                    <p className="text-xs text-slate-500 truncate">{template.description}</p>
                                </div>
                            </motion.button>
                        ))}
                    </div>
                </section>
            </main>

            {/* ================================================
                FOOTER
                ================================================ */}
            <footer className="border-t border-slate-800 mt-16 bg-slate-900/30">
                <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row items-center justify-between text-sm text-slate-500">
                    <span className="mb-4 md:mb-0">© 2025 BeamLab Ultimate. All rights reserved.</span>
                    <div className="flex items-center gap-6">
                        <Link to="/help" className="hover:text-white transition-colors">Help Center</Link>
                        <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default StreamDashboard;
