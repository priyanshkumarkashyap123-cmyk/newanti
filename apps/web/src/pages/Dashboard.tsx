/**
 * Dashboard - Module Hub Dashboard
 * The first screen after login with module launchers
 */

import { FC, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Home,
    FolderOpen,
    User,
    Settings,
    Plus,
    Upload,
    Box,
    Columns,
    Hammer,
    Link2,
    MoreHorizontal,
    Search
} from 'lucide-react';

// ============================================
// TYPES
// ============================================

interface DashboardProps {
    onLaunchModule?: (module: string) => void;
}

interface RecentFile {
    id: string;
    name: string;
    type: '3D' | 'Truss' | 'Frame' | 'RC';
    lastModified: string;
    status: 'Draft' | 'Final';
}

// ============================================
// DASHBOARD COMPONENT
// ============================================

export const Dashboard: FC<DashboardProps> = ({ onLaunchModule }) => {
    const navigate = useNavigate();
    const [activeNav, setActiveNav] = useState('home');

    const handleLaunchModule = (moduleId: string) => {
        if (onLaunchModule) onLaunchModule(moduleId);
        navigate(`/workspace/${moduleId}`);
    };

    const handleNewProject = () => {
        navigate('/workspace/structural-3d');
    };

    // Get greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    return (
        <div className="min-h-screen bg-gray-100 flex">
            {/* ================================================
                SIDEBAR (Thin Icon Rail)
                ================================================ */}
            <aside className="w-16 bg-slate-900 flex flex-col items-center py-6 gap-4">
                {/* Logo */}
                <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
                    <span className="text-white font-bold text-lg">B</span>
                </div>

                {/* Nav Items */}
                {SIDEBAR_NAV.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveNav(item.id)}
                        className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${activeNav === item.id
                                ? 'bg-blue-600 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                        title={item.label}
                    >
                        <item.icon className="w-5 h-5" />
                    </button>
                ))}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Settings at bottom */}
                <button
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-800 hover:text-white transition-all"
                    title="Settings"
                >
                    <Settings className="w-5 h-5" />
                </button>
            </aside>

            {/* ================================================
                MAIN CONTENT
                ================================================ */}
            <main className="flex-1 p-8 overflow-auto">
                {/* Welcome Section */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {getGreeting()}, Engineer.
                    </h1>
                    <p className="text-gray-500">Welcome back to BeamLab. What would you like to work on today?</p>
                </motion.div>

                {/* Action Bar */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={handleNewProject}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-all shadow-lg shadow-blue-600/25"
                    >
                        <Plus className="w-5 h-5" />
                        New Project
                    </button>
                    <button className="flex items-center gap-2 px-6 py-3 bg-white hover:bg-gray-50 border border-gray-200 rounded-lg font-medium text-gray-700 transition-all">
                        <Upload className="w-5 h-5" />
                        Open File
                    </button>
                    <div className="flex-1" />
                    <div className="relative">
                        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            className="pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                        />
                    </div>
                </div>

                {/* Launch Module Grid */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="mb-12"
                >
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Launch Module</h2>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        {MODULE_LAUNCHERS.map((module) => (
                            <button
                                key={module.id}
                                onClick={() => handleLaunchModule(module.id)}
                                className="group bg-white rounded-xl p-6 border border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all text-left"
                            >
                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bgColor}`}>
                                    <module.icon className={`w-6 h-6 ${module.iconColor}`} />
                                </div>
                                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition-colors">
                                    {module.title}
                                </h3>
                                <p className="text-sm text-gray-500">{module.subtitle}</p>
                            </button>
                        ))}
                    </div>
                </motion.div>

                {/* Recent Files Table */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Files</h2>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Modified</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {RECENT_FILES.map((file) => (
                                    <tr key={file.id} className="hover:bg-gray-50 transition-colors cursor-pointer">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                    <Box className="w-4 h-4 text-blue-600" />
                                                </div>
                                                <span className="font-medium text-gray-900">{file.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                                                {file.type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {file.lastModified}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 text-xs font-medium rounded ${file.status === 'Final'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-yellow-100 text-yellow-700'
                                                }`}>
                                                {file.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </motion.div>
            </main>
        </div>
    );
};

// ============================================
// DATA
// ============================================

const SIDEBAR_NAV = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'projects', label: 'Projects', icon: FolderOpen },
    { id: 'account', label: 'Account', icon: User },
];

const MODULE_LAUNCHERS = [
    { id: 'structural-3d', title: 'Structural 3D', subtitle: '3D Frame Analysis', icon: Box, bgColor: 'bg-blue-100', iconColor: 'text-blue-600' },
    { id: 'rc-design', title: 'RC Design', subtitle: 'Beam & Column Design', icon: Columns, bgColor: 'bg-green-100', iconColor: 'text-green-600' },
    { id: 'steel-design', title: 'Steel Design', subtitle: 'IS 800 / AISC 360', icon: Hammer, bgColor: 'bg-orange-100', iconColor: 'text-orange-600' },
    { id: 'connection', title: 'Connection', subtitle: 'Joint & Base Plate', icon: Link2, bgColor: 'bg-purple-100', iconColor: 'text-purple-600' },
];

const RECENT_FILES: RecentFile[] = [
    { id: '1', name: 'Office Building - Phase 1', type: '3D', lastModified: '2 hours ago', status: 'Draft' },
    { id: '2', name: 'Warehouse Truss System', type: 'Truss', lastModified: 'Yesterday', status: 'Final' },
    { id: '3', name: 'Residential Frame Analysis', type: 'Frame', lastModified: '3 days ago', status: 'Final' },
    { id: '4', name: 'Bridge Pier Design', type: 'RC', lastModified: '1 week ago', status: 'Draft' },
];

export default Dashboard;
