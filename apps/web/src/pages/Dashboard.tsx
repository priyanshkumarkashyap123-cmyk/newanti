/**
 * Dashboard - BeamLab Ultimate Projects Dashboard
 * Modern project hub with BeamLab Branding & New UI System
 */

import { FC, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { UserButton } from '@clerk/clerk-react';
import { useAuth, isUsingClerk } from '../providers/AuthProvider';
import { useUserRegistration } from '../hooks/useUserRegistration';
import {
    Folder, Plus, Upload, Grid, Search,
    Layout, Settings, Users, LogOut, FileText
} from 'lucide-react';

// New UI System
import {
    Avatar, Badge, EmptyState, StatCard,
    Tabs, TabPanel, Button
} from '../components/ui';

import { PageTransition, StaggerContainer, StaggerItem } from '../components/ui/PageTransition';

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
    const [activeTab, setActiveTab] = useState('projects');
    const [searchQuery, setSearchQuery] = useState('');

    // Register user
    useUserRegistration();

    // Contexts
    const { isSignedIn, user, signOut } = useAuth();
    const isClerkEnabled = isUsingClerk();
    const userName = isSignedIn && user?.firstName ? user.firstName : 'Engineer';
    const userEmail = isSignedIn && (user as any)?.emailAddresses?.[0]?.emailAddress || 'engineer@beamlab.io';

    const handleLaunchModule = (moduleId: string) => {
        if (onLaunchModule) onLaunchModule(moduleId);
        navigate(`/workspace/${moduleId}`);
    };

    const handleNewProject = () => navigate('/demo');
    const handleOpenProject = (projectId: string) => navigate(`/demo?project=${projectId}`);

    // Greeting
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

    // Tabs Config
    const tabs = [
        { id: 'projects', label: 'My Projects', icon: <Folder className="w-4 h-4" /> },
        { id: 'templates', label: 'Templates', icon: <Layout className="w-4 h-4" /> },
        { id: 'shared', label: 'Shared', icon: <Users className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-slate-950 flex font-sans">
            {/* ================================================
                SIDEBAR (Updated with Avatar)
                ================================================ */}
            <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-slate-800">
                    <Link to="/" className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-blue-600 text-white">
                            <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>architecture</span>
                        </div>
                        <span className="text-lg font-bold text-white">BeamLab</span>
                    </Link>
                </div>

                <nav className="flex-1 px-3 py-4 space-y-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                                ${activeTab === tab.id
                                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }
                            `}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                    <div className="pt-4 mt-4 border-t border-slate-800">
                        <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                            <Settings className="w-4 h-4" />
                            Settings
                        </button>
                        <Link to="/ui-showcase" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors">
                            <Layout className="w-4 h-4" />
                            UI Showcase
                        </Link>
                    </div>
                </nav>

                <div className="p-4 border-t border-slate-800 bg-slate-900/50">
                    <div className="flex items-center gap-3">
                        <Avatar name={userName} size="md" status="online" className="bg-blue-600" />
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{userName}</p>
                            <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                        </div>
                        {isSignedIn && !isClerkEnabled && (
                            <button
                                onClick={() => signOut()}
                                className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-800"
                                title="Sign Out"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                        {isSignedIn && isClerkEnabled && <UserButton afterSignOutUrl="/" />}
                    </div>
                </div>
            </aside>

            {/* ================================================
                MAIN CONTENT (Updated with New Components)
                ================================================ */}
            <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                {/* Header */}
                <header className="h-16 bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-10">
                    <div className="flex items-center gap-4 flex-1">
                        <div className="relative max-w-md flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" className="gap-2">
                            <Upload className="w-4 h-4" />
                            Import
                        </Button>
                        <Button onClick={handleNewProject} size="sm" className="gap-2 shadow-lg shadow-blue-500/20">
                            <Plus className="w-4 h-4" />
                            New Project
                        </Button>
                    </div>
                </header>

                <PageTransition className="flex-1 overflow-auto p-6">
                    {/* Welcome Section */}
                    <div className="mb-8">
                        <h1 className="text-3xl font-bold text-white mb-2">
                            {getGreeting()}, {userName}
                        </h1>
                        <p className="text-slate-400">Here's what's happening with your projects today.</p>
                        <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm flex items-start gap-3">
                            <span className="material-symbols-outlined text-base leading-5">info</span>
                            <div className="space-y-1">
                                <p className="font-semibold text-amber-50">Engineering decision support</p>
                                <p>Results are provided for review and validation only and are not a stamped deliverable. Please verify against code provisions and project requirements.</p>
                            </div>
                        </div>
                    </div>

                    {/* Stats Row */}
                    <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        <StaggerItem>
                            <StatCard title="Total Projects" value="12" icon={<Folder className="w-4 h-4" />} color="blue" />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard title="Active Analyses" value="3" icon={<Grid className="w-4 h-4" />} color="green" />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard title="Shared With Me" value="5" icon={<Users className="w-4 h-4" />} color="purple" />
                        </StaggerItem>
                        <StaggerItem>
                            <StatCard title="Storage Used" value="45%" icon={<FileText className="w-4 h-4" />} color="yellow" />
                        </StaggerItem>
                    </StaggerContainer>

                    {/* Quick Start */}
                    <div className="mb-10">
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Quick Start</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {MODULE_LAUNCHERS.map((module) => (
                                <button
                                    key={module.id}
                                    onClick={() => handleLaunchModule(module.id)}
                                    className="group bg-slate-900 border border-slate-800 rounded-xl p-5 text-left hover:border-blue-500 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bgColor} group-hover:bg-blue-600 group-hover:text-white transition-colors`}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{module.icon}</span>
                                    </div>
                                    <h3 className="font-bold text-white mb-1 group-hover:text-blue-400 transition-colors">
                                        {module.title}
                                    </h3>
                                    <p className="text-sm text-slate-400">{module.subtitle}</p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Projects Tabs */}
                    <Tabs
                        tabs={tabs}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        variant="underline"
                        className="mb-6"
                    />

                    {/* Projects Grid */}
                    <TabPanel isActive={activeTab === 'projects'}>
                        {filteredProjects.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {filteredProjects.map((project) => (
                                    <motion.div
                                        layout
                                        key={project.id}
                                        onClick={() => handleOpenProject(project.id)}
                                        className="group bg-slate-900 border border-slate-800 rounded-xl overflow-hidden cursor-pointer hover:border-blue-500 hover:shadow-lg hover:shadow-blue-500/10 transition-all"
                                    >
                                        <div className="aspect-[4/3] bg-slate-950 relative grid-pattern flex items-center justify-center">
                                            <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-blue-500/40 transition-colors">
                                                {getTypeIcon(project.type)}
                                            </span>
                                            <div className="absolute top-3 right-3">
                                                <Badge variant={
                                                    project.status === 'Final' ? 'success' :
                                                        project.status === 'Analyzed' ? 'info' : 'outline'
                                                }>
                                                    {project.status}
                                                </Badge>
                                            </div>
                                        </div>
                                        <div className="p-4">
                                            <h3 className="font-bold text-white truncate mb-1 group-hover:text-blue-400 transition-colors">{project.name}</h3>
                                            <div className="flex items-center gap-3 text-xs text-slate-400">
                                                <span>{project.nodeCount} Nodes</span>
                                                <span className="w-1 h-1 bg-slate-700 rounded-full" />
                                                <span>{project.memberCount} Members</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[10px]">schedule</span>
                                                {project.lastModified}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}

                                {/* Add New Card */}
                                <button
                                    onClick={handleNewProject}
                                    className="border-2 border-dashed border-slate-800 rounded-xl flex flex-col items-center justify-center gap-3 p-8 hover:border-blue-500 hover:bg-blue-500/5 transition-all min-h-[240px]"
                                >
                                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                                        <Plus className="w-6 h-6" />
                                    </div>
                                    <span className="text-sm font-medium text-slate-400 group-hover:text-blue-500">Create New Project</span>
                                </button>
                            </div>
                        ) : (
                            <EmptyState
                                title="No projects found"
                                description="Get started by creating your first structural project."
                                icon={<Folder className="w-8 h-8" />}
                                action={
                                    <Button onClick={handleNewProject} className="mt-4">
                                        Create Project
                                    </Button>
                                }
                            />
                        )}
                    </TabPanel>

                    <TabPanel isActive={activeTab === 'templates'}>
                        <EmptyState
                            title="Templates Gallery"
                            description="Start with pre-built structural templates."
                            icon={<Layout className="w-8 h-8" />}
                            action={<Button variant="outline" className="mt-4">Browse Gallery</Button>}
                        />
                    </TabPanel>

                    <TabPanel isActive={activeTab === 'shared'}>
                        <EmptyState
                            title="Shared Projects"
                            description="Projects shared with you by your team will appear here."
                            icon={<Users className="w-8 h-8" />}
                        />
                    </TabPanel>
                </PageTransition>
            </main>
        </div>
    );
};

// ============================================
// DATA
// ============================================

const MODULE_LAUNCHERS = [
    { id: 'structural-3d', title: 'Structural 3D', subtitle: 'Full 3D Frame Analysis', icon: 'deployed_code', bgColor: 'bg-blue-500/20 text-blue-400' },
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
