/**
 * Dashboard - BeamLab Projects Dashboard
 * Modern project hub with BeamLab Branding & New UI System
 */

import { FC, useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UserButton } from "@clerk/clerk-react";
import { useAuth, isUsingClerk } from "../providers/AuthProvider";
import {
  Folder,
  Plus,
  Upload,
  Grid,
  Search,
  Layout,
  Settings,
  Users,
  LogOut,
  FileText,
  Loader2,
  RefreshCw,
  Bell,
  Star,
  Trash2,
  BarChart3,
  FileSpreadsheet,
  MoreVertical,
  List,
  LayoutGrid,
  BookOpen,
  Bot,
  Calculator,
  Building2,
  Construction,
  Copy,
  Edit,
  Download,
  Archive,
} from "lucide-react";

// New UI System
import {
  Avatar,
  Badge,
  EmptyState,
  StatCard,
  Tabs,
  TabPanel,
  Button,
} from "../components/ui";

import {
  PageTransition,
  StaggerContainer,
  StaggerItem,
} from "../components/ui/PageTransition";
import {
  ProjectService,
  Project as CloudProject,
} from "../services/ProjectService";
import { useModelStore } from "../store/model";

// ============================================
// TYPES
// ============================================

interface DashboardProps {
  onLaunchModule?: (module: string) => void;
}

interface Project {
  id: string;
  name: string;
  type: "Frame" | "Truss" | "Beam" | "Slab";
  lastModified: string;
  nodeCount: number;
  memberCount: number;
  status: "Analyzed" | "Draft" | "Final";
}

/**
 * Helper: human-readable relative time from an ISO date string
 */
function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  return new Date(dateStr).toLocaleDateString();
}

/**
 * Convert a cloud project to the dashboard display format
 */
function cloudToDisplayProject(cp: CloudProject): Project {
  const data = cp.data as any;
  const nodeCount = data?.nodes?.length ?? 0;
  const memberCount = data?.members?.length ?? 0;
  const hasResults = !!data?.analysisResults;
  return {
    id: cp._id,
    name: cp.name,
    type: "Frame", // default display type
    lastModified: timeAgo(cp.updatedAt),
    nodeCount,
    memberCount,
    status: hasResults ? "Analyzed" : "Draft",
  };
}

// ============================================
// DASHBOARD COMPONENT
// ============================================

export const Dashboard: FC<DashboardProps> = ({ onLaunchModule }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showNotifications, setShowNotifications] = useState(false);

  useEffect(() => {
    document.title = 'Dashboard - BeamLab';
  }, []);

  // Contexts
  const { isSignedIn, user, signOut, getToken } = useAuth();
  const isClerkEnabled = isUsingClerk();
  const userName = isSignedIn && user?.firstName ? user.firstName : "Engineer";
  const userEmail =
    (isSignedIn && (user as any)?.emailAddresses?.[0]?.emailAddress) ||
    "engineer@beamlab.app";

  // ============================================
  // REAL PROJECT DATA FROM MONGODB
  // ============================================
  const [cloudProjects, setCloudProjects] = useState<CloudProject[]>([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isLoadingOne, setIsLoadingOne] = useState<string | null>(null); // Track which project is being opened

  /** Fetch user's projects from the API (MongoDB) */
  const fetchProjects = useCallback(async () => {
    if (!isSignedIn) {
      setCloudProjects([]);
      return;
    }
    setIsLoadingProjects(true);
    setProjectsError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Not authenticated");
      const projects = await ProjectService.listProjects(token);
      setCloudProjects(projects);
    } catch (err) {
      console.error("[Dashboard] Failed to load projects:", err);
      setProjectsError("Failed to load projects. Check your connection.");
    } finally {
      setIsLoadingProjects(false);
    }
  }, [isSignedIn, getToken]);

  // Fetch real projects on mount & when auth changes
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  /** Open a project: fetch full data from MongoDB, load into store, navigate to editor */
  const handleOpenProject = useCallback(
    async (projectId: string) => {
      if (!isSignedIn) {
        navigate("/app");
        return;
      }
      setIsLoadingOne(projectId);
      try {
        const token = await getToken();
        if (!token) throw new Error("Not authenticated");

        const fullProject = await ProjectService.getProject(projectId, token);
        const data = fullProject.data as any;

        if (data) {
          // Use the store's loadProject method — it handles all fields
          // (nodes, members, loads, loadCases, plates, floorLoads, etc.)
          // and supports both tuple and object serialization formats.
          const projectData = {
            ...data,
            projectInfo: {
              ...(data.projectInfo || {}),
              cloudId: fullProject._id,
            },
          };
          const loaded = useModelStore.getState().loadProject(projectData);
          if (!loaded) {
            throw new Error('Failed to parse project data');
          }
        }

        navigate("/app");
      } catch (err) {
        console.error("[Dashboard] Failed to open project:", err);
        setProjectsError("Failed to open project. Please try again.");
      } finally {
        setIsLoadingOne(null);
      }
    },
    [isSignedIn, getToken, navigate],
  );

  const handleLaunchModule = (moduleId: string) => {
    if (onLaunchModule) onLaunchModule(moduleId);
    navigate(`/workspace/${moduleId}`);
  };

  const handleNewProject = () => navigate("/app");

  // ============================================
  // PROJECT CONTEXT MENU (Figma §5.2)
  // ============================================
  const [projectMenuId, setProjectMenuId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const projectMenuRef = useRef<HTMLDivElement>(null);

  // Close project menu on outside click
  useEffect(() => {
    if (!projectMenuId) return;
    const handler = (e: MouseEvent) => {
      if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
        setProjectMenuId(null);
      }
    };
    const timer = setTimeout(() => document.addEventListener("click", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [projectMenuId]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!confirm("Delete this project permanently? This cannot be undone.")) return;
    try {
      const token = await getToken();
      if (token) {
        await ProjectService.deleteProject(projectId, token);
        setCloudProjects(prev => prev.filter(p => p._id !== projectId));
      }
    } catch (err) {
      console.error("[Dashboard] Delete failed:", err);
      setProjectsError("Failed to delete project.");
    }
    setProjectMenuId(null);
  }, [getToken]);

  const handleDuplicateProject = useCallback(async (projectId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      const source = await ProjectService.getProject(projectId, token);
      await ProjectService.createProject(
        { name: `${source.name} (Copy)`, data: source.data },
        token,
      );
      fetchProjects(); // Refresh list
    } catch (err) {
      console.error("[Dashboard] Duplicate failed:", err);
      setProjectsError("Failed to duplicate project.");
    }
    setProjectMenuId(null);
  }, [getToken, fetchProjects]);

  const handleRenameProject = useCallback(async (projectId: string, newName: string) => {
    if (!newName.trim()) { setRenamingProjectId(null); return; }
    try {
      const token = await getToken();
      if (token) {
        await ProjectService.updateProject(projectId, { name: newName.trim() }, token);
        setCloudProjects(prev =>
          prev.map(p => p._id === projectId ? { ...p, name: newName.trim() } : p),
        );
      }
    } catch (err) {
      console.error("[Dashboard] Rename failed:", err);
      setProjectsError("Failed to rename project.");
    }
    setRenamingProjectId(null);
  }, [getToken]);

  const handleExportProject = useCallback(async (projectId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      const project = await ProjectService.getProject(projectId, token);
      const blob = new Blob([JSON.stringify(project.data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${project.name}.beamlab.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("[Dashboard] Export failed:", err);
    }
    setProjectMenuId(null);
  }, [getToken]);

  /** Renders the dropdown context menu for a project card */
  const ProjectCardMenu: FC<{ projectId: string }> = ({ projectId }) => {
    if (projectMenuId !== projectId) return null;
    const cloudProject = cloudProjects.find(p => p._id === projectId);
    return (
      <div
        ref={projectMenuRef}
        role="menu"
        className="absolute top-10 left-2 z-50 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl py-1 animate-[scaleIn_100ms_ease-out] origin-top-left"
      >
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); setRenameValue(cloudProject?.name || ""); setRenamingProjectId(projectId); setProjectMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
          <Edit className="w-3.5 h-3.5 text-slate-500" /> Rename
        </button>
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); handleDuplicateProject(projectId); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
          <Copy className="w-3.5 h-3.5 text-slate-500" /> Duplicate
        </button>
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); handleExportProject(projectId); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
          <Download className="w-3.5 h-3.5 text-slate-500" /> Export JSON
        </button>
        <div className="my-1 h-px bg-slate-200 dark:bg-slate-700" />
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); handleDeleteProject(projectId); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
          <Trash2 className="w-3.5 h-3.5" /> Delete
        </button>
      </div>
    );
  };

  // Greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Convert cloud projects for display & filter
  const displayProjects: Project[] = cloudProjects.map(cloudToDisplayProject);
  const filteredProjects = displayProjects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const getTypeIcon = (type: Project["type"]) => {
    switch (type) {
      case "Frame":
        return "apartment";
      case "Truss":
        return "grid_on";
      case "Beam":
        return "straighten";
      case "Slab":
        return "layers";
      default:
        return "deployed_code";
    }
  };

  // Tabs Config
  const tabs = [
    {
      id: "projects",
      label: "My Projects",
      icon: <Folder className="w-4 h-4" />,
    },
    {
      id: "templates",
      label: "Templates",
      icon: <Layout className="w-4 h-4" />,
    },
    { id: "shared", label: "Shared", icon: <Users className="w-4 h-4" /> },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 flex font-sans">
      {/* ================================================
                SIDEBAR (Updated with Avatar)
                ================================================ */}
      <aside className="w-[220px] bg-slate-50 dark:bg-slate-900/80 border-r border-white/[0.06] flex flex-col backdrop-blur-xl">
        <div className="h-16 flex items-center px-6 border-b border-white/[0.06]">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/20">
              <span
                className="material-symbols-outlined"
                style={{ fontSize: "20px" }}
              >
                architecture
              </span>
            </div>
            <span className="text-lg font-bold text-white tracking-tight">
              BeamLab
            </span>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={`
                                w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                ${
                                  activeTab === tab.id
                                    ? "bg-blue-500/[0.12] text-blue-400 border-l-2 border-blue-500 shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-white/[0.04] hover:text-slate-700 dark:hover:text-slate-200 border-l-2 border-transparent"
                                }
                            `}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}

          {/* Favorites & Trash - per Figma §5.1 */}
          <Button variant="ghost" disabled className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent opacity-60 cursor-not-allowed" title="Coming soon">
            <Star className="w-4 h-4" />
            Favorites
          </Button>
          <Button variant="ghost" disabled className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white border border-transparent opacity-60 cursor-not-allowed" title="Coming soon">
            <Trash2 className="w-4 h-4" />
            Trash
          </Button>

          <div className="pt-4 mt-4 border-t border-white/[0.06]">
            <Button variant="ghost" disabled className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white opacity-60 cursor-not-allowed" title="Coming soon">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
            <Button variant="ghost" disabled className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white opacity-60 cursor-not-allowed" title="Coming soon">
              <FileSpreadsheet className="w-4 h-4" />
              Reports
            </Button>
          </div>

          <div className="pt-4 mt-4 border-t border-white/[0.06]">
            <Button variant="ghost" onClick={() => navigate('/settings')} className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white">
              <Settings className="w-4 h-4" />
              Settings
            </Button>
            <Link
              to="/ui-showcase"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:bg-slate-800 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <Layout className="w-4 h-4" />
              UI Showcase
            </Link>
          </div>
        </nav>

        {/* New Project button fixed at bottom - per Figma §5.1 */}
        <div className="px-3 pb-2">
          <Button
            onClick={handleNewProject}
            className="w-full gap-2 shadow-lg shadow-blue-500/20"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        <div className="p-4 border-t border-white/[0.06] bg-white dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <Avatar
              name={userName}
              size="md"
              status="online"
              className="bg-blue-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {userName}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400 truncate">
                {userEmail}
              </p>
            </div>
            {isSignedIn && !isClerkEnabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="h-8 w-8 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
            {isSignedIn && isClerkEnabled && <UserButton afterSignOutUrl="/" />}
          </div>
        </div>
      </aside>

      {/* ================================================
                MAIN CONTENT (Updated with New Components)
                ================================================ */}
      <main className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-950">
        {/* Header */}
        <header className="h-16 bg-slate-50 dark:bg-slate-900/60 backdrop-blur-xl border-b border-white/[0.06] flex items-center justify-between px-6 sticky top-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <div className="relative max-w-md flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-600 dark:text-slate-400" />
              <input
                type="text"
                placeholder="Search projects, templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-white dark:bg-slate-950/60 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)] transition-all duration-300"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Grid/List Toggle - per Figma §5.1 */}
            <div className="flex items-center border border-slate-200 dark:border-white/[0.08] rounded-lg overflow-hidden">
              <button type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${viewMode === "grid" ? "bg-blue-500/10 text-blue-400" : "text-slate-400 hover:text-slate-200"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${viewMode === "list" ? "bg-blue-500/10 text-blue-400" : "text-slate-400 hover:text-slate-200"}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Bell - per Figma §5.6 */}
            <div className="relative">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative h-9 w-9 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              >
                <Bell className="w-4 h-4" />
              </Button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-11 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-900 dark:text-white text-sm">Notifications</h3>
                  </div>
                  <div className="px-4 py-8 text-center">
                    <Bell className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">No notifications yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">You'll be notified about analysis results, shares, and updates</p>
                  </div>
                </div>
              )}
            </div>

            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/app?tool=import')}>
              <Upload className="w-4 h-4" />
              Import
            </Button>
            <Button
              onClick={handleNewProject}
              size="sm"
              className="gap-2 shadow-lg shadow-blue-500/20"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
        </header>

        <PageTransition className="flex-1 overflow-auto p-6">
          {/* Welcome Section */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-slate-600 dark:text-slate-400">
              Here's what's happening with your projects today.
            </p>
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-100 text-sm flex items-start gap-3">
              <span className="material-symbols-outlined text-base leading-5">
                info
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-amber-50">
                  Engineering decision support
                </p>
                <p>
                  Results are provided for review and validation only and are
                  not a stamped deliverable. Please verify against code
                  provisions and project requirements.
                </p>
              </div>
            </div>
          </div>

          {/* Stats Row */}
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <StaggerItem>
              <StatCard
                title="Total Projects"
                value={String(cloudProjects.length)}
                icon={<Folder className="w-4 h-4" />}
                color="blue"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Analyzed"
                value={String(
                  displayProjects.filter((p) => p.status === "Analyzed").length,
                )}
                icon={<Grid className="w-4 h-4" />}
                color="green"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Drafts"
                value={String(
                  displayProjects.filter((p) => p.status === "Draft").length,
                )}
                icon={<FileText className="w-4 h-4" />}
                color="purple"
              />
            </StaggerItem>
            <StaggerItem>
              <StatCard
                title="Shared With Me"
                value="0"
                icon={<Users className="w-4 h-4" />}
                color="yellow"
              />
            </StaggerItem>
          </StaggerContainer>

          {/* Quick Start */}
          <div className="mb-10">
            <h2 className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-4">
              Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {MODULE_LAUNCHERS.map((module) => (
                <Button
                  key={module.id}
                  variant="ghost"
                  onClick={() => handleLaunchModule(module.id)}
                  className="group h-auto bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] rounded-xl p-5 text-left flex-col items-start hover:border-blue-500/30 hover:bg-slate-100 dark:hover:bg-slate-800/40 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bgColor} group-hover:scale-105 transition-transform duration-300`}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: "24px" }}
                    >
                      {module.icon}
                    </span>
                  </div>
                  <h3 className="font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-400 transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 font-normal">
                    {module.subtitle}
                  </p>
                </Button>
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
          <TabPanel isActive={activeTab === "projects"}>
            {/* Error banner */}
            {projectsError && (
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-400 text-sm">
                <span>{projectsError}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchProjects}
                  className="ml-auto flex items-center gap-1 text-red-400 hover:text-red-300"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </Button>
              </div>
            )}

            {/* Loading state */}
            {isLoadingProjects ? (
              <div role="status" aria-label="Loading projects" className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading your projects...</p>
              </div>
            ) : filteredProjects.length > 0 ? (
              <>
              {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProjects.map((project) => (
                  <motion.div
                    layout
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className={`group bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden cursor-pointer hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 hover:shadow-[0_12px_40px_rgba(59,130,246,0.08)] transition-all duration-300 ${isLoadingOne === project.id ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <div className="aspect-[4/3] bg-white dark:bg-slate-950 relative grid-pattern flex items-center justify-center">
                      {isLoadingOne === project.id ? (
                        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
                      ) : (
                        <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-blue-500/40 transition-colors">
                          {getTypeIcon(project.type)}
                        </span>
                      )}
                      <div className="absolute top-3 right-3 flex items-center gap-2">
                        <Badge
                          variant={
                            project.status === "Final"
                              ? "success"
                              : project.status === "Analyzed"
                                ? "info"
                                : "outline"
                          }
                        >
                          {project.status}
                        </Badge>
                      </div>
                      {/* Context Menu Button - per Figma §5.2 */}
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setProjectMenuId(projectMenuId === project.id ? null : project.id); }}
                        className="absolute top-3 left-3 w-7 h-7 rounded-md bg-slate-900/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-slate-300 hover:text-white hover:bg-slate-900/80"
                        title="Project actions"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <ProjectCardMenu projectId={project.id} />
                    </div>
                    <div className="p-4">
                      {renamingProjectId === project.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameProject(project.id, renameValue)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameProject(project.id, renameValue); if (e.key === "Escape") setRenamingProjectId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-2 py-1 -mx-2 -my-1 text-sm font-bold bg-white dark:bg-slate-800 border border-blue-500 rounded outline-none text-slate-900 dark:text-white"
                        />
                      ) : (
                        <h3 className="font-bold text-slate-900 dark:text-white truncate mb-1 group-hover:text-blue-400 transition-colors">
                          {project.name}
                        </h3>
                      )}
                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <span>{project.nodeCount} Nodes</span>
                        <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        <span>{project.memberCount} Members</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">
                          schedule
                        </span>
                        {project.lastModified}
                      </p>
                    </div>
                  </motion.div>
                ))}

                {/* Add New Card */}
                <Button
                  variant="ghost"
                  onClick={handleNewProject}
                  className="group h-auto border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl flex flex-col items-center justify-center gap-3 p-8 hover:border-blue-500/30 hover:bg-blue-500/[0.03] transition-all duration-300 min-h-[240px]"
                >
                  <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 group-hover:text-blue-500 group-hover:bg-blue-500/20 transition-colors">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400 group-hover:text-blue-500">
                    Create New Project
                  </span>
                </Button>
              </div>
              ) : (
              /* List View - per Figma §5.5 */
              <div className="border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[1fr_120px_80px_120px_40px] gap-4 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-white/[0.06]">
                  <span>Name</span>
                  <span>Type</span>
                  <span>Members</span>
                  <span>Last Modified</span>
                  <span></span>
                </div>
                {filteredProjects.map((project, i) => (
                  <div
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className={`grid grid-cols-[1fr_120px_80px_120px_40px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors text-sm ${
                      i % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-900/30" : ""
                    } ${isLoadingOne === project.id ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 relative">
                      <span className="material-symbols-outlined text-xl text-slate-500">{getTypeIcon(project.type)}</span>
                      {renamingProjectId === project.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameProject(project.id, renameValue)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameProject(project.id, renameValue); if (e.key === "Escape") setRenamingProjectId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-0.5 text-sm font-medium bg-white dark:bg-slate-800 border border-blue-500 rounded outline-none text-slate-900 dark:text-white"
                        />
                      ) : (
                        <span className="font-medium text-slate-900 dark:text-white truncate">{project.name}</span>
                      )}
                      <Badge variant={project.status === "Analyzed" ? "info" : "outline"} className="flex-shrink-0">
                        {project.status}
                      </Badge>
                    </div>
                    <span className="text-slate-500">{project.type}</span>
                    <span className="text-slate-500">{project.memberCount}</span>
                    <span className="text-slate-500 text-xs">{project.lastModified}</span>
                    <div className="relative">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setProjectMenuId(projectMenuId === project.id ? null : project.id); }} className="text-slate-400 hover:text-slate-700 dark:hover:text-white transition-colors">
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      <ProjectCardMenu projectId={project.id} />
                    </div>
                  </div>
                ))}
              </div>
              )}
              </>
            ) : (
              <EmptyState
                title="No projects yet"
                description="Start your structural engineering journey — create your first project to begin analyzing frames, trusses, and beams."
                icon={<Folder className="w-8 h-8" />}
                action={
                  <Button onClick={handleNewProject} className="mt-4 gap-2 shadow-lg shadow-blue-500/20">
                    <Plus className="w-4 h-4" />
                    Create Your First Project
                  </Button>
                }
              />
            )}
          </TabPanel>

          <TabPanel isActive={activeTab === "templates"}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {TEMPLATES.map((tpl) => (
                <Button
                  key={tpl.id}
                  variant="ghost"
                  onClick={handleNewProject}
                  className="group h-auto bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden text-left flex-col items-stretch p-0 hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                >
                  <div className="aspect-[4/3] bg-white dark:bg-slate-950 relative grid-pattern flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-blue-500/40 transition-colors">
                      {tpl.icon}
                    </span>
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline">{tpl.category}</Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 dark:text-white truncate mb-1 group-hover:text-blue-400 transition-colors">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 font-normal">
                      {tpl.description}
                    </p>
                  </div>
                </Button>
              ))}
            </div>
          </TabPanel>

          <TabPanel isActive={activeTab === "shared"}>
            {SHARED_PROJECTS.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {SHARED_PROJECTS.map((project) => (
                  <motion.div
                    layout
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="group bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-white/[0.06] rounded-xl overflow-hidden cursor-pointer hover:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/5 transition-all duration-300"
                  >
                    <div className="aspect-[4/3] bg-white dark:bg-slate-950 relative grid-pattern flex items-center justify-center">
                      <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-blue-500/40 transition-colors">
                        {getTypeIcon(project.type)}
                      </span>
                      <div className="absolute top-3 left-3">
                        <Badge variant="info">{project.sharedBy}</Badge>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-slate-900 dark:text-white truncate mb-1 group-hover:text-blue-400 transition-colors">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                        <span>{project.nodeCount} Nodes</span>
                        <span className="w-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full" />
                        <span>{project.memberCount} Members</span>
                      </div>
                      <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">
                          schedule
                        </span>
                        {project.lastModified}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="No shared projects"
                description="Projects shared with you by collaborators will appear here."
                icon={<Users className="w-8 h-8" />}
              />
            )}
          </TabPanel>
        </PageTransition>

        {/* Bottom Bar - per Figma §5.1 */}
        <footer className="h-8 bg-slate-50 dark:bg-slate-900/60 border-t border-white/[0.06] flex items-center justify-between px-6 text-xs text-slate-500">
          <span>Plan: Professional</span>
          <span>Storage: {cloudProjects.length > 0 ? `${(cloudProjects.length * 0.5).toFixed(1)}` : "0"}/5 GB</span>
          <Link to="/settings" className="text-blue-400 hover:text-blue-300">Upgrade Plan →</Link>
        </footer>
      </main>
    </div>
  );
};

// ============================================
// DATA
// ============================================

const MODULE_LAUNCHERS = [
  {
    id: "structural-3d",
    title: "3D Frame",
    subtitle: "Multi-storey frames & portals",
    icon: "deployed_code",
    bgColor: "bg-blue-500/20 text-blue-400",
  },
  {
    id: "truss",
    title: "New Truss",
    subtitle: "Pratt, Warren, Howe trusses",
    icon: "grid_on",
    bgColor: "bg-cyan-500/20 text-cyan-400",
  },
  {
    id: "building",
    title: "New Building",
    subtitle: "Multi-storey RC/Steel buildings",
    icon: "apartment",
    bgColor: "bg-indigo-500/20 text-indigo-400",
  },
  {
    id: "ai-generate",
    title: "AI Generate",
    subtitle: "Describe → auto-model",
    icon: "smart_toy",
    bgColor: "bg-purple-500/20 text-purple-400",
  },
  {
    id: "import",
    title: "Import",
    subtitle: "STAAD, IFC, DXF, E2K",
    icon: "upload_file",
    bgColor: "bg-orange-500/20 text-orange-400",
  },
  {
    id: "template",
    title: "Template",
    subtitle: "Start from a template",
    icon: "content_copy",
    bgColor: "bg-teal-500/20 text-teal-400",
  },
  {
    id: "quick-calc",
    title: "Quick Calc",
    subtitle: "Beam, section, connection",
    icon: "calculate",
    bgColor: "bg-green-500/20 text-green-400",
  },
  {
    id: "docs",
    title: "Docs",
    subtitle: "Guides & documentation",
    icon: "menu_book",
    bgColor: "bg-slate-500/20 text-slate-400",
  },
];

interface SharedProject extends Project {
  sharedBy: string;
}

const SHARED_PROJECTS: SharedProject[] = [
  // Shared projects will also be fetched from API in a future iteration
];

const TEMPLATES = [
  {
    id: "t1",
    name: "Simply Supported Beam",
    category: "Beam",
    icon: "straighten",
    description:
      "Single span beam with point and UDL loads. Great for quick checks.",
  },
  {
    id: "t2",
    name: "2-Bay 3-Storey Frame",
    category: "Frame",
    icon: "apartment",
    description:
      "Typical reinforced concrete frame with gravity + lateral loads.",
  },
  {
    id: "t3",
    name: "Pratt Truss – 12 m",
    category: "Truss",
    icon: "grid_on",
    description: "Standard Pratt truss with panel loads for roof or bridge.",
  },
  {
    id: "t4",
    name: "Propped Cantilever",
    category: "Beam",
    icon: "straighten",
    description: "Cantilever beam with roller support at free end.",
  },
  {
    id: "t5",
    name: "Portal Frame – Pinned Base",
    category: "Frame",
    icon: "deployed_code",
    description: "Single bay portal frame with pinned column bases.",
  },
  {
    id: "t6",
    name: "Continuous Beam – 3 Span",
    category: "Beam",
    icon: "straighten",
    description: "Three-span continuous beam for moment distribution practice.",
  },
];

export default Dashboard;
