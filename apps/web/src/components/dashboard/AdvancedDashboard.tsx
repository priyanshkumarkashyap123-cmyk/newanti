/**
 * AdvancedDashboard.tsx
 * 
 * Professional engineering dashboard with:
 * - Real-time project metrics
 * - Analysis progress visualization
 * - Quick actions panel
 * - Recent activity feed
 * - Resource utilization charts
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface Project {
  id: string;
  name: string;
  type: 'frame' | 'truss' | 'building' | 'bridge';
  status: 'draft' | 'analyzing' | 'complete' | 'failed';
  progress: number;
  lastModified: Date;
  members: number;
  nodes: number;
  thumbnail?: string;
}

interface AnalysisJob {
  id: string;
  projectName: string;
  type: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  progress: number;
  startTime: Date;
  duration?: number;
}

interface Notification {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
}

interface DashboardStats {
  totalProjects: number;
  activeAnalyses: number;
  completedThisWeek: number;
  storageUsed: number;
  storageLimit: number;
  computeHours: number;
}

// ============================================
// MOCK DATA (Replace with real data hooks)
// ============================================

const mockProjects: Project[] = [
  { id: '1', name: 'Mumbai Metro Station', type: 'building', status: 'complete', progress: 100, lastModified: new Date(), members: 245, nodes: 180 },
  { id: '2', name: 'Warehouse Portal Frame', type: 'frame', status: 'analyzing', progress: 67, lastModified: new Date(), members: 48, nodes: 32 },
  { id: '3', name: 'Highway Bridge Truss', type: 'bridge', status: 'draft', progress: 0, lastModified: new Date(Date.now() - 86400000), members: 156, nodes: 98 },
  { id: '4', name: 'Industrial Roof Truss', type: 'truss', status: 'complete', progress: 100, lastModified: new Date(Date.now() - 172800000), members: 72, nodes: 45 },
];

const mockAnalysisJobs: AnalysisJob[] = [
  { id: 'a1', projectName: 'Warehouse Portal Frame', type: 'P-Delta Analysis', status: 'running', progress: 67, startTime: new Date(Date.now() - 120000) },
  { id: 'a2', projectName: 'Mumbai Metro Station', type: 'Modal Analysis', status: 'complete', progress: 100, startTime: new Date(Date.now() - 600000), duration: 245 },
];

const mockNotifications: Notification[] = [
  { id: 'n1', type: 'success', title: 'Analysis Complete', message: 'Mumbai Metro Station modal analysis completed successfully', timestamp: new Date(), read: false },
  { id: 'n2', type: 'warning', title: 'High Utilization', message: 'Member M-45 has 92% stress utilization ratio', timestamp: new Date(Date.now() - 3600000), read: false },
  { id: 'n3', type: 'info', title: 'New Feature', message: 'Try our new AI-powered design optimization', timestamp: new Date(Date.now() - 7200000), read: true },
];

const mockStats: DashboardStats = {
  totalProjects: 12,
  activeAnalyses: 2,
  completedThisWeek: 8,
  storageUsed: 2.4,
  storageLimit: 10,
  computeHours: 45.5,
};

// ============================================
// ICON COMPONENTS
// ============================================

const icons = {
  project: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
  analysis: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  storage: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
    </svg>
  ),
  plus: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  upload: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  code: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  building: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  frame: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
    </svg>
  ),
  truss: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 18h18M3 18l9-12m9 12L12 6m0 12V6" />
    </svg>
  ),
  bridge: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h18M3 12c0-3 3-6 9-6s9 3 9 6M3 12v6m18-6v6M6 18v-3m12 3v-3" />
    </svg>
  ),
};

// ============================================
// SUB-COMPONENTS
// ============================================

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: { value: number; positive: boolean };
  color: string;
}> = ({ icon, label, value, trend, color }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={`relative overflow-hidden rounded-xl bg-gradient-to-br ${color} p-5 text-slate-900 dark:text-white shadow-lg`}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium opacity-80">{label}</p>
        <p className="mt-1 text-3xl font-bold">{value}</p>
        {trend && (
          <p className={`mt-1 text-xs ${trend.positive ? 'text-green-200' : 'text-red-200'}`}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% from last week
          </p>
        )}
      </div>
      <div className="rounded-full bg-white/20 p-3">
        {icon}
      </div>
    </div>
    <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-white/10" />
  </motion.div>
);

const ProjectCard: React.FC<{
  project: Project;
  onOpen: () => void;
  onAnalyze?: () => void;
}> = ({ project, onOpen, onAnalyze }) => {
  const typeIcon = {
    frame: icons.frame,
    truss: icons.truss,
    building: icons.building,
    bridge: icons.bridge,
  }[project.type];

  const statusColors = {
    draft: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    analyzing: 'bg-blue-900/50 text-blue-400',
    complete: 'bg-green-900/50 text-green-400',
    failed: 'bg-red-900/50 text-red-400',
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -4 }}
      className="group relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-sm transition-shadow hover:shadow-lg"
    >
      {/* Thumbnail / Preview */}
      <div className="relative h-32 bg-gradient-to-br from-slate-700 to-slate-800 p-4">
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
          {typeIcon}
        </div>
        <div className="absolute top-2 left-2">
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusColors[project.status]}`}>
            {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
          </span>
        </div>
        {project.status === 'analyzing' && (
          <div className="absolute bottom-2 left-2 right-2">
            <div className="h-1.5 rounded-full bg-slate-600">
              <motion.div
                className="h-full rounded-full bg-blue-500"
                initial={{ width: 0 }}
                animate={{ width: `${project.progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{project.progress}% complete</p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-slate-700 dark:text-slate-200 truncate">{project.name}</h3>
        <div className="mt-2 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
          <span>{project.members} members</span>
          <span>{project.nodes} nodes</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Modified {new Date(project.lastModified).toLocaleDateString()}
        </p>
      </div>

      {/* Actions */}
      <div className="flex border-t border-slate-200 dark:border-slate-700">
        <button type="button"
          onClick={onOpen}
          className="flex-1 py-2 text-sm font-medium text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:text-slate-200 transition-colors"
        >
          Open
        </button>
        {onAnalyze && (
          <>
            <div className="w-px bg-slate-200 dark:bg-slate-700" />
            <button type="button"
              onClick={onAnalyze}
              className="flex-1 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              Analyze
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
};

const AnalysisJobRow: React.FC<{ job: AnalysisJob }> = ({ job }) => {
  const statusColors = {
    queued: 'text-slate-500 dark:text-slate-400',
    running: 'text-blue-500',
    complete: 'text-green-500',
    failed: 'text-red-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-3 hover:bg-slate-200 dark:hover:bg-slate-700"
    >
      <div className={`h-2 w-2 rounded-full ${job.status === 'running' ? 'animate-pulse bg-blue-500' : job.status === 'complete' ? 'bg-green-500' : 'bg-slate-600'}`} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-200 truncate">{job.projectName}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{job.type}</p>
      </div>
      {job.status === 'running' && (
        <div className="w-24">
          <div className="h-1.5 rounded-full bg-slate-600">
            <motion.div
              className="h-full rounded-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${job.progress}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 text-center">{job.progress}%</p>
        </div>
      )}
      {job.status === 'complete' && job.duration && (
        <span className="text-sm text-slate-500 dark:text-slate-400">{job.duration}s</span>
      )}
      <span className={`text-sm font-medium ${statusColors[job.status]}`}>
        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
      </span>
    </motion.div>
  );
};

const NotificationItem: React.FC<{ notification: Notification; onRead: () => void }> = ({ notification, onRead }) => {
  const typeStyles = {
    success: 'border-l-green-500 bg-green-900/30',
    warning: 'border-l-yellow-500 bg-yellow-900/30',
    error: 'border-l-red-500 bg-red-900/30',
    info: 'border-l-blue-500 bg-blue-900/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      onClick={onRead}
      className={`cursor-pointer border-l-4 rounded-r-lg p-3 ${typeStyles[notification.type]} ${!notification.read ? 'ring-2 ring-blue-700' : ''}`}
    >
      <div className="flex justify-between items-start">
        <h4 className="font-medium text-slate-700 dark:text-slate-200">{notification.title}</h4>
        {!notification.read && <div className="h-2 w-2 rounded-full bg-blue-500" />}
      </div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{notification.message}</p>
      <p className="mt-1 text-xs text-slate-500">
        {new Date(notification.timestamp).toLocaleTimeString()}
      </p>
    </motion.div>
  );
};

const QuickActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  description: string;
  onClick: () => void;
  color: string;
}> = ({ icon, label, description, onClick, color }) => (
  <motion.button
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className={`flex items-center gap-4 w-full rounded-xl border-2 border-transparent bg-gradient-to-r ${color} p-4 text-left text-slate-900 dark:text-white shadow-md transition-all hover:shadow-lg`}
  >
    <div className="rounded-lg bg-white/20 p-3">
      {icon}
    </div>
    <div>
      <p className="font-semibold">{label}</p>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  </motion.button>
);

// ============================================
// MAIN COMPONENT
// ============================================

interface AdvancedDashboardProps {
  onNewProject?: () => void;
  onOpenProject?: (id: string) => void;
  onImportFile?: () => void;
  onOpenAI?: () => void;
}

export const AdvancedDashboard: React.FC<AdvancedDashboardProps> = ({
  onNewProject,
  onOpenProject,
  onImportFile,
  onOpenAI,
}) => {
  const [projects] = useState<Project[]>(mockProjects);
  const [analysisJobs] = useState<AnalysisJob[]>(mockAnalysisJobs);
  const [notifications, setNotifications] = useState<Notification[]>(mockNotifications);
  const [stats] = useState<DashboardStats>(mockStats);
  const [activeTab, setActiveTab] = useState<'projects' | 'analytics'>('projects');
  
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  
  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <header className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Dashboard</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">Welcome back! Here's your engineering overview.</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Tab Switcher */}
              <div className="flex rounded-lg bg-slate-200 dark:bg-slate-700 p-1">
                <button type="button"
                  onClick={() => setActiveTab('projects')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'projects' ? 'bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Projects
                </button>
                <button type="button"
                  onClick={() => setActiveTab('analytics')}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'analytics' ? 'bg-slate-600 text-slate-800 dark:text-slate-100 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-200'
                  }`}
                >
                  Analytics
                </button>
              </div>
              {/* Notification Badge */}
              <button type="button" className="relative rounded-full p-2 hover:bg-slate-200 dark:hover:bg-slate-700">
                <svg className="w-6 h-6 text-slate-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-medium text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard
            icon={icons.project}
            label="Total Projects"
            value={stats.totalProjects}
            trend={{ value: 12, positive: true }}
            color="from-blue-500 to-blue-600"
          />
          <StatCard
            icon={icons.analysis}
            label="Active Analyses"
            value={stats.activeAnalyses}
            color="from-purple-500 to-purple-600"
          />
          <StatCard
            icon={icons.check}
            label="Completed This Week"
            value={stats.completedThisWeek}
            trend={{ value: 25, positive: true }}
            color="from-green-500 to-green-600"
          />
          <StatCard
            icon={icons.storage}
            label="Storage Used"
            value={`${stats.storageUsed}/${stats.storageLimit} GB`}
            color="from-orange-500 to-orange-600"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-8">
            {/* Quick Actions */}
            <section>
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <QuickActionButton
                  icon={icons.plus}
                  label="New Project"
                  description="Start a new structural analysis"
                  onClick={() => onNewProject?.()}
                  color="from-blue-500 to-indigo-600"
                />
                <QuickActionButton
                  icon={icons.upload}
                  label="Import File"
                  description="Import from DXF, IFC, or JSON"
                  onClick={() => onImportFile?.()}
                  color="from-purple-500 to-pink-600"
                />
                <QuickActionButton
                  icon={icons.ai}
                  label="AI Assistant"
                  description="Generate structure with AI"
                  onClick={() => onOpenAI?.()}
                  color="from-green-500 to-teal-600"
                />

              </div>
            </section>

            {/* Projects Grid */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Recent Projects</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.slice(0, 4).map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => onOpenProject?.(project.id)}
                  />
                ))}
              </div>
            </section>

            {/* Active Analyses */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Analysis Queue</h2>
                <span className="text-sm text-slate-500 dark:text-slate-400">{analysisJobs.length} jobs</span>
              </div>
              <div className="space-y-3">
                {analysisJobs.map(job => (
                  <AnalysisJobRow key={job.id} job={job} />
                ))}
                {analysisJobs.length === 0 && (
                  <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                    No active analyses. Start a new one!
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Sidebar - 1 column */}
          <div className="space-y-8">
            {/* Notifications */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">Notifications</h2>
                {unreadCount > 0 && (
                  <button type="button"
                    onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {notifications.slice(0, 5).map(notification => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onRead={() => markAsRead(notification.id)}
                  />
                ))}
              </div>
            </section>

            {/* Resource Usage */}
            <section className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-5">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-4">Resource Usage</h2>
              
              {/* Storage */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Storage</span>
                  <span className="font-medium">{stats.storageUsed} / {stats.storageLimit} GB</span>
                </div>
                <div className="h-2 rounded-full bg-slate-600">
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{ width: `${(stats.storageUsed / stats.storageLimit) * 100}%` }}
                  />
                </div>
              </div>
              
              {/* Compute Hours */}
              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500 dark:text-slate-400">Compute Hours</span>
                  <span className="font-medium">{stats.computeHours} hrs used</span>
                </div>
                <div className="h-2 rounded-full bg-slate-600">
                  <div
                    className="h-full rounded-full bg-green-500"
                    style={{ width: `${Math.min((stats.computeHours / 100) * 100, 100)}%` }}
                  />
                </div>
              </div>
              
              <button type="button" className="w-full mt-4 py-2 text-sm font-medium text-blue-400 border border-blue-700 rounded-lg hover:bg-blue-900/30 transition-colors">
                Upgrade Plan
              </button>
            </section>

            {/* Tips & Tricks */}
            <section className="rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 p-5 text-white">
              <h2 className="text-lg font-semibold mb-2">💡 Pro Tip</h2>
              <p className="text-sm opacity-90">
                Use the AI Assistant to quickly generate optimized structural designs. 
                Try saying "Create a portal frame for 15m span warehouse".
              </p>
              <button type="button"
                onClick={() => onOpenAI?.()}
                className="mt-4 w-full py-2 bg-white/20 rounded-lg text-sm font-medium hover:bg-white/30 transition-colors"
              >
                Try AI Assistant
              </button>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdvancedDashboard;
