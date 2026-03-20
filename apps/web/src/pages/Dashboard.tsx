/**
 * Dashboard - BeamLab Projects Dashboard
 * Modern project hub with BeamLab Branding & New UI System
 */

import { FC, useState, useEffect, useCallback, useRef, memo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UserButton } from "@clerk/clerk-react";
import { useAuth, isUsingClerk } from "../providers/AuthProvider";
import { logger } from '../lib/logging/logger';
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
import { useSubscription } from "../hooks/useSubscription";
import {
  ProjectService,
  Project as CloudProject,
} from "../services/ProjectService";
import { useModelStore } from "../store/model";
import { useConfirm } from "../components/ui/ConfirmDialog";

// ============================================
// FAVORITES TAB COMPONENT
// ============================================

interface FavoritesTabProps {
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  onOpenProject: (id: string) => void;
  onToggleFavorite: (id: string) => Promise<void>;
}

const FavoritesTab: FC<FavoritesTabProps> = ({ isSignedIn, getToken, onOpenProject, onToggleFavorite }) => {
  const [favorites, setFavorites] = useState<CloudProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFavorites = useCallback(() => {
    if (!isSignedIn) return;
    setIsLoading(true);
    setError(null);
    getToken().then((token) => {
      if (!token) return;
      return ProjectService.listFavoriteProjects(token);
    }).then((projects) => {
      if (projects) setFavorites(projects);
    }).catch(() => {
      setError('Failed to load favorites. Check your connection.');
    }).finally(() => setIsLoading(false));
  }, [isSignedIn, getToken]);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#4d8eff]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-[#ffb4ab]">{error}</p>
        <button type="button" onClick={loadFavorites} className="flex items-center gap-1.5 text-sm text-[#adc6ff] hover:text-[#adc6ff] transition-colors">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <EmptyState
        title="No favorite projects yet"
        description="Star your most-used projects for quick access. Click the star icon on any project card."
        icon={<Star className="w-8 h-8" />}
      />
    );
  }

  return (
    <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {favorites.map((project) => (
        <StaggerItem
          layout
          key={project._id}
          onClick={() => onOpenProject(project._id)}
          className="group bg-[#131b2e]/60 border border-[#424754]/15 rounded-xl overflow-hidden cursor-pointer hover:border-yellow-500/30 hover:shadow-lg hover:shadow-yellow-500/10 transition-all duration-300"
        >
          <div className="aspect-[4/3] bg-[#131b2e] relative grid-pattern flex items-center justify-center">
            <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-[#ffb2b7]/40 transition-colors">
              architecture
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(project._id); setFavorites((prev) => prev.filter((p) => p._id !== project._id)); }}
              className="absolute top-3 right-3 text-[#ffb2b7] hover:text-yellow-300"
              title="Remove from favorites"
              aria-label={`Remove ${project.name} from favorites`}
            >
              <Star className="w-4 h-4 fill-current" />
            </button>
          </div>
          <div className="p-4">
            <h3 className="font-bold text-[#dae2fd] truncate mb-1 group-hover:text-[#ffb2b7] transition-colors">
              {project.name}
            </h3>
            <p className="text-xs text-[#869ab8]">{timeAgo(project.updatedAt)}</p>
          </div>
          </StaggerItem>
        ))}
      </StaggerContainer>
    );
};
// ============================================
// TRASH TAB COMPONENT
// ============================================

interface TrashTabProps {
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  onPermanentDelete: (id: string) => Promise<void>;
}

const TrashTab: FC<TrashTabProps> = ({ isSignedIn, getToken, onPermanentDelete }) => {
  const [trashProjects, setTrashProjects] = useState<CloudProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTrash = useCallback(() => {
    if (!isSignedIn) return;
    setIsLoading(true);
    setError(null);
    getToken().then((token) => {
      if (!token) return;
      return ProjectService.listDeletedProjects(token);
    }).then((projects) => {
      if (projects) setTrashProjects(projects);
    }).catch(() => {
      setError('Failed to load trash. Check your connection.');
    }).finally(() => setIsLoading(false));
  }, [isSignedIn, getToken]);

  useEffect(() => { loadTrash(); }, [loadTrash]);

  const handlePermanentDelete = async (projectId: string) => {
    await onPermanentDelete(projectId);
    setTrashProjects((prev) => prev.filter((p) => p._id !== projectId));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-[#4d8eff]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-sm text-[#ffb4ab]">{error}</p>
        <button type="button" onClick={loadTrash} className="flex items-center gap-1.5 text-sm text-[#adc6ff] hover:text-[#adc6ff] transition-colors">
          <RefreshCw className="w-4 h-4" /> Retry
        </button>
      </div>
    );
  }

  if (trashProjects.length === 0) {
    return (
      <EmptyState
        title="Trash is empty"
        description="Deleted projects will appear here. You can restore them within 30 days."
        icon={<Trash2 className="w-8 h-8" />}
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-[#869ab8] mb-4">
        Projects in trash will be permanently deleted after 30 days.
      </p>
      {trashProjects.map((project) => (
        <div
          key={project._id}
          className="flex items-center justify-between p-4 bg-[#131b2e]/60 border border-[#424754]/15 rounded-xl shadow-sm"
        >
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-[#869ab8]">architecture</span>
            <div>
              <p className="font-medium tracking-wide tracking-wide text-[#dae2fd]">{project.name}</p>
              <p className="text-xs text-[#869ab8]">Deleted {project.deletedAt ? timeAgo(project.deletedAt) : 'recently'}</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handlePermanentDelete(project._id)}
            className="text-[#ffb4ab] hover:text-[#ffb4ab] hover:bg-red-500/10 gap-1.5"
          >
            <Trash2 className="w-4 h-4" />
            Delete permanently
          </Button>
        </div>
      ))}
    </div>
  );
};

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
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showNotifications, setShowNotifications] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const { subscription } = useSubscription();
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(() => {
    try { return localStorage.getItem('beamlab_upgrade_banner_dismissed') === '1'; } catch { return false; }
  });
  const handleDismissUpgradeBanner = () => {
    setUpgradeBannerDismissed(true);
    try { localStorage.setItem('beamlab_upgrade_banner_dismissed', '1'); } catch { /* noop */ }
  };

  useEffect(() => {
    document.title = 'Dashboard - BeamLab';
  }, []);

  // Contexts
  const { isSignedIn, user, signOut, getToken } = useAuth();
  const isClerkEnabled = isUsingClerk();
  const userName = isSignedIn && user?.firstName ? user.firstName : "Engineer";
  const userEmail =
    (isSignedIn && (user as any)?.emailAddresses?.[0]?.emailAddress) ||
    "info@beamlabultimate.tech";

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
      logger.error("[Dashboard] Failed to load projects", { error: err instanceof Error ? err.message : String(err) });
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
        logger.error("[Dashboard] Failed to open project", { error: err instanceof Error ? err.message : String(err) });
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
  const notificationRef = useRef<HTMLDivElement>(null);

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

  // Close notification dropdown on outside click
  useEffect(() => {
    if (!showNotifications) return;
    const handler = (e: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener("click", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("click", handler); };
  }, [showNotifications]);

  const handleDeleteProject = useCallback(async (projectId: string) => {
    if (!(await confirm({ title: 'Delete Project', message: 'Delete this project permanently? This cannot be undone.', variant: 'danger' }))) return;
    try {
      const token = await getToken();
      if (token) {
        await ProjectService.deleteProject(projectId, token);
        setCloudProjects(prev => prev.filter(p => p._id !== projectId));
      }
    } catch (err) {
      logger.error("[Dashboard] Delete failed", { error: err instanceof Error ? err.message : String(err) });
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
      logger.error("[Dashboard] Duplicate failed", { error: err instanceof Error ? err.message : String(err) });
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
      logger.error("[Dashboard] Rename failed", { error: err instanceof Error ? err.message : String(err) });
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
      logger.error("[Dashboard] Export failed", { error: err instanceof Error ? err.message : String(err) });
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
        className="absolute top-10 left-2 z-50 w-48 bg-[#131b2e] border border-[#424754] rounded-lg shadow-xl py-1 animate-[scaleIn_100ms_ease-out] origin-top-left"
      >
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); setRenameValue(cloudProject?.name || ""); setRenamingProjectId(projectId); setProjectMenuId(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#adc6ff] hover:bg-[#424754]/60 transition-colors">
          <Edit className="w-3.5 h-3.5 text-[#869ab8]" /> Rename
        </button>
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); handleDuplicateProject(projectId); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#adc6ff] hover:bg-[#424754]/60 transition-colors">
          <Copy className="w-3.5 h-3.5 text-[#869ab8]" /> Duplicate
        </button>
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); handleExportProject(projectId); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#adc6ff] hover:bg-[#424754]/60 transition-colors">
          <Download className="w-3.5 h-3.5 text-[#869ab8]" /> Export JSON
        </button>
        <div className="my-1 h-px bg-slate-200 bg-slate-700" />
        <button type="button" role="menuitem" onClick={(e) => { e.stopPropagation(); handleDeleteProject(projectId); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 text-[#ffb4ab] hover:bg-[#ffb4ab]/10 transition-colors">
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
    <div className="min-h-screen bg-[#131b2e] flex font-sans">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* ================================================
                SIDEBAR (Updated with Avatar)
                ================================================ */}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-40
        w-[220px] bg-[#131b2e]/80 border-r border-[#424754]/15 flex flex-col backdrop-blur-xl
        transform transition-transform duration-200 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="h-16 flex items-center px-6 border-b border-[#424754]/10">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg shadow-[#4d8eff]/20">
              <span
                className="material-symbols-outlined text-xl"
              >
                architecture
              </span>
            </div>
            <span className="text-lg font-bold text-[#dae2fd] tracking-tight">
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
                                w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide transition-all duration-200
                                ${
                                  activeTab === tab.id
                                    ? "bg-[#4d8eff]/10 text-[#adc6ff] border-l-2 border-[#4d8eff] shadow-sm"
                                    : "text-[#869ab8] text-[#869ab8] hover:bg-[#424754]/20 hover:text-[#adc6ff] hover:text-[#dae2fd] border-l-2 border-transparent"
                                }
                            `}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}

          {/* Favorites & Trash - filter views */}
          <Button variant="ghost" onClick={() => setActiveTab('favorites')} className={`w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide border-l-2 transition-colors ${
            activeTab === 'favorites'
              ? 'bg-[#4d8eff]/10 text-[#adc6ff] border-[#4d8eff]'
              : 'text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] hover:text-[#dae2fd] hover:text-white border-transparent'
          }`}>
            <Star className="w-4 h-4" />
            Favorites
          </Button>
          <Button variant="ghost" onClick={() => setActiveTab('trash')} className={`w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide border-l-2 transition-colors ${
            activeTab === 'trash'
              ? 'bg-[#4d8eff]/10 text-[#adc6ff] border-[#4d8eff]'
              : 'text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] hover:text-[#dae2fd] hover:text-white border-transparent'
          }`}>
            <Trash2 className="w-4 h-4" />
            Trash
          </Button>

          <div className="pt-4 mt-4 border-t border-[#424754]/10">
            <Button variant="ghost" onClick={() => navigate('/space-planning')} className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] hover:text-[#dae2fd] hover:text-white">
              <Building2 className="w-4 h-4" />
              Space Planning
            </Button>
            <Button variant="ghost" onClick={() => navigate('/app')} className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] hover:text-[#dae2fd] hover:text-white">
              <Construction className="w-4 h-4" />
              Structural Modeler
            </Button>
            <Button variant="ghost" onClick={() => navigate('/analytics')} className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] hover:text-[#dae2fd] hover:text-white">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </Button>
            <Button variant="ghost" onClick={() => navigate('/export')} className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] hover:text-[#dae2fd] hover:text-white">
              <FileSpreadsheet className="w-4 h-4" />
              Reports
            </Button>
          </div>

          <div className="pt-4 mt-4 border-t border-[#424754]/10">
            <Button variant="ghost" onClick={() => navigate('/settings')} className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] hover:text-[#dae2fd] hover:text-white">
              <Settings className="w-4 h-4" />
              Account Settings
            </Button>
            <Link
              to="/ui-showcase"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium tracking-wide tracking-wide text-[#869ab8] text-[#869ab8] hover:bg-border hover:text-[#dae2fd] hover:text-white transition-colors"
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
            className="w-full gap-2 shadow-lg shadow-[#4d8eff]/20"
          >
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        </div>

        <div className="p-4 border-t border-[#424754]/10 bg-[#131b2e]">
          <div className="flex items-center gap-3">
            <Avatar
              name={userName}
              size="md"
              status="online"
              className="bg-blue-600"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium tracking-wide tracking-wide text-[#dae2fd] truncate">
                {userName}
              </p>
              <p className="text-xs text-[#869ab8] text-[#869ab8] truncate">
                {userEmail}
              </p>
            </div>
            {isSignedIn && !isClerkEnabled && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="h-8 w-8 text-[#869ab8] text-[#869ab8] hover:text-[#dae2fd] hover:text-white"
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
      <main className="flex-1 flex flex-col overflow-hidden bg-[#131b2e]">
        {/* Header */}
        <header className="h-16 bg-[#131b2e]/60 backdrop-blur-xl border-b border-[#424754]/15 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-3 md:gap-4 flex-1">
            {/* Mobile sidebar toggle */}
            <button
              type="button"
              className="md:hidden p-2 -ml-1 rounded-lg text-[#869ab8] text-[#869ab8] hover:bg-[#1a2333] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="relative max-w-md flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#869ab8] text-[#869ab8]" />
              <input
                type="text"
                placeholder="Search projects, templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 pl-10 pr-4 bg-[#131b2e] border border-[#424754]/15 rounded-xl text-sm text-[#dae2fd] placeholder-slate-400 placeholder-slate-500 focus:outline-none focus:border-[#4d8eff]/50 focus:ring-2 focus:ring-[#4d8eff]/20 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.08)] transition-all duration-300"
                aria-label="Search projects and templates"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Grid/List Toggle - per Figma §5.1 */}
            <div className="flex items-center border border-[#424754]/15 rounded-lg overflow-hidden">
              <button type="button"
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${viewMode === "grid" ? "bg-blue-500/10 text-[#adc6ff]" : "text-[#869ab8] hover:text-[#dae2fd]"}`}
                title="Grid view"
                aria-label="Grid view"
                aria-pressed={viewMode === "grid"}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${viewMode === "list" ? "bg-blue-500/10 text-[#adc6ff]" : "text-[#869ab8] hover:text-[#dae2fd]"}`}
                title="List view"
                aria-label="List view"
                aria-pressed={viewMode === "list"}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            {/* Notification Bell - per Figma §5.6 */}
            <div className="relative" ref={notificationRef}>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative h-9 w-9 text-[#869ab8] text-[#869ab8] hover:text-[#dae2fd] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                aria-label="Notifications"
                aria-expanded={showNotifications}
              >
                <Bell className="w-4 h-4" />
              </Button>

              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 top-11 w-80 bg-[#131b2e] border border-[#424754] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-[#424754]">
                    <h3 className="font-semibold text-[#dae2fd] text-sm">Notifications</h3>
                  </div>
                  <div className="px-4 py-8 text-center">
                    <Bell className="w-8 h-8 text-[#adc6ff] text-[#869ab8] mx-auto mb-2" />
                    <p className="text-sm text-[#869ab8]">No notifications yet</p>
                    <p className="text-xs text-[#869ab8] mt-1">You'll be notified about analysis results, shares, and updates</p>
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
              className="gap-2 shadow-lg shadow-[#4d8eff]/20"
            >
              <Plus className="w-4 h-4" />
              New Project
            </Button>
          </div>
        </header>

        <PageTransition className="flex-1 overflow-auto p-4 sm:p-6">
          {/* Upgrade banner for free-tier users (Req 3.5) */}
          {subscription.tier === 'free' && !upgradeBannerDismissed && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-[#4d8eff]/40 bg-blue-500/10 px-4 py-3 text-sm">
              <span className="text-[#adc6ff]">
                You're on the Free plan. Upgrade to Pro for unlimited projects and analysis.
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button size="sm" onClick={() => navigate('/pricing')} className="gap-1.5 shadow-lg shadow-[#4d8eff]/20">
                  Upgrade to Pro
                </Button>
                <button
                  type="button"
                  onClick={handleDismissUpgradeBanner}
                  className="p-1 text-[#869ab8] hover:text-[#dae2fd] transition-colors rounded"
                  aria-label="Dismiss upgrade banner"
                >
                  ✕
                </button>
              </div>
            </div>
          )}
          {/* Welcome Section */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-3xl font-bold text-[#dae2fd] mb-2">
              {getGreeting()}, {userName}
            </h1>
            <p className="text-[#869ab8] text-[#869ab8]">
              Here's what's happening with your projects today.
            </p>
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-amber-800 text-amber-100 text-sm flex items-start gap-3">
              <span className="material-symbols-outlined text-base leading-5">
                info
              </span>
              <div className="space-y-1">
                <p className="font-semibold text-amber-900 text-amber-50">
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
          <StaggerContainer className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 sm:mb-8">
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
          <div className="mb-8 sm:mb-10">
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-xs font-bold uppercase tracking-widest text-[#869ab8] text-[#869ab8]">
                Quick Actions
              </h2>
              <span className="text-[10px] text-[#869ab8]">Workflow shortcuts</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 sm:gap-3.5">
              {MODULE_LAUNCHERS.map((module) => (
                <Button
                  key={module.id}
                  variant="ghost"
                  onClick={() => handleLaunchModule(module.id)}
                  className="group h-auto bg-[#131b2e]/60 border border-[#424754]/15 rounded-xl p-4 sm:p-5 text-left flex-col items-start hover:border-[#4d8eff]/30 hover:bg-[#1a2333]/40 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
                >
                  <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${module.bgColor} group-hover:scale-105 transition-transform duration-300`}
                  >
                    <span
                      className="material-symbols-outlined text-2xl"
                    >
                      {module.icon}
                    </span>
                  </div>
                  <h3 className="font-bold text-[#dae2fd] mb-1 group-hover:text-[#adc6ff] transition-colors">
                    {module.title}
                  </h3>
                  <p className="text-sm text-[#869ab8] text-[#869ab8] font-normal">
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
              <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-[#ffb4ab] text-sm">
                <span>{projectsError}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={fetchProjects}
                  className="ml-auto flex items-center gap-1 text-[#ffb4ab] hover:text-[#ffb4ab]"
                >
                  <RefreshCw className="w-4 h-4" /> Retry
                </Button>
              </div>
            )}

            {/* Loading state */}
            {isLoadingProjects ? (
              <div role="status" aria-label="Loading projects" className="flex flex-col items-center justify-center py-20 text-[#869ab8]">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading your projects...</p>
              </div>
            ) : filteredProjects.length > 0 ? (
              <>
              {viewMode === "grid" ? (
              <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
                {filteredProjects.map((project) => (
                  <StaggerItem
                    layout
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className={`group bg-[#131b2e]/60 border border-[#424754]/15 rounded-xl overflow-hidden cursor-pointer hover:border-[#4d8eff]/30 hover:shadow-lg hover:shadow-blue-500/10 hover:shadow-[0_12px_40px_rgba(59,130,246,0.08)] transition-all duration-300 ${isLoadingOne === project.id ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <div className="aspect-[4/3] bg-[#131b2e] relative grid-pattern flex items-center justify-center">
                      {isLoadingOne === project.id ? (
                        <Loader2 className="w-10 h-10 animate-spin text-[#4d8eff]" />
                      ) : (
                        <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-[#4d8eff]/40 transition-colors">
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
                        className="absolute top-3 left-3 w-7 h-7 rounded-md bg-slate-900/60 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[#adc6ff] hover:text-white hover:bg-slate-900/80 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                        title="Project actions"
                        aria-label={`Project actions for ${project.name}`}
                        aria-haspopup="menu"
                        aria-expanded={projectMenuId === project.id}
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
                          className="w-full px-2 py-1 -mx-2 -my-1 text-sm font-bold bg-[#0b1326] border border-[#4d8eff] rounded outline-none text-[#dae2fd]"
                          aria-label="Rename project"
                        />
                      ) : (
                        <h3 className="font-bold text-[#dae2fd] truncate mb-1 group-hover:text-[#adc6ff] transition-colors">
                          {project.name}
                        </h3>
                      )}
                      <div className="flex items-center gap-3 text-xs text-[#869ab8] text-[#869ab8]">
                        <span>{project.nodeCount} Nodes</span>
                        <span className="w-1 h-1 bg-slate-200 bg-slate-700 rounded-full" />
                        <span>{project.memberCount} Members</span>
                      </div>
                      <p className="text-xs text-[#869ab8] mt-3 flex items-center gap-1">
                        <span className="material-symbols-outlined text-[10px]">
                          schedule
                        </span>
                        {project.lastModified}
                      </p>
                    </div>
                  </StaggerItem>
                ))}

                {/* Add New Card */}
                <Button
                  variant="ghost"
                  onClick={handleNewProject}
                  className="group h-auto border-2 border-dashed border-slate-200 border-white/[0.10] rounded-xl flex flex-col items-center justify-center gap-3 p-8 hover:border-[#4d8eff]/30 hover:bg-blue-500/[0.03] transition-all duration-300 min-h-[240px]"
                >
                  <div className="w-12 h-12 rounded-full bg-border flex items-center justify-center text-[#869ab8] text-[#869ab8] group-hover:text-[#4d8eff] group-hover:bg-blue-500/20 transition-colors">
                    <Plus className="w-6 h-6" />
                  </div>
                  <span className="text-sm font-medium tracking-wide tracking-wide text-[#869ab8] text-[#869ab8] group-hover:text-[#4d8eff]">
                    Create New Project
                  </span>
                </Button>
              </StaggerContainer>
              ) : (
              /* List View - per Figma §5.5 */
              <div className="border border-slate-200 border-[#424754]/10 rounded-xl overflow-x-auto">
                <div className="grid grid-cols-[1fr_120px_80px_120px_40px] gap-4 px-4 py-2.5 bg-[#0b1326]/50 text-xs font-semibold text-[#869ab8] uppercase tracking-wider border-b border-slate-200 border-[#424754]/10">
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
                    className={`grid grid-cols-[1fr_120px_80px_120px_40px] gap-4 px-4 py-3 items-center cursor-pointer hover:bg-border/40 transition-colors text-sm ${
                      i % 2 === 1 ? "bg-slate-50/50 bg-slate-900/30" : ""
                    } ${isLoadingOne === project.id ? "opacity-60 pointer-events-none" : ""}`}
                  >
                    <div className="flex items-center gap-3 min-w-0 relative">
                      <span className="material-symbols-outlined text-xl text-[#869ab8]">{getTypeIcon(project.type)}</span>
                      {renamingProjectId === project.id ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameProject(project.id, renameValue)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleRenameProject(project.id, renameValue); if (e.key === "Escape") setRenamingProjectId(null); }}
                          onClick={(e) => e.stopPropagation()}
                          className="flex-1 px-2 py-0.5 text-sm font-medium tracking-wide tracking-wide bg-[#0b1326] border border-[#4d8eff] rounded outline-none text-[#dae2fd]"
                          aria-label="Rename project"
                        />
                      ) : (
                        <span className="font-medium tracking-wide tracking-wide text-[#dae2fd] truncate">{project.name}</span>
                      )}
                      <Badge variant={project.status === "Analyzed" ? "info" : "outline"} className="flex-shrink-0">
                        {project.status}
                      </Badge>
                    </div>
                    <span className="text-[#869ab8]">{project.type}</span>
                    <span className="text-[#869ab8]">{project.memberCount}</span>
                    <span className="text-[#869ab8] text-xs">{project.lastModified}</span>
                    <div className="relative">
                      <button type="button" onClick={(e) => { e.stopPropagation(); setProjectMenuId(projectMenuId === project.id ? null : project.id); }} className="text-[#869ab8] hover:text-[#adc6ff] hover:text-white transition-colors rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40" aria-label={`Project actions for ${project.name}`} aria-haspopup="menu" aria-expanded={projectMenuId === project.id}>
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
                  <Button onClick={handleNewProject} className="mt-4 gap-2 shadow-lg shadow-[#4d8eff]/20">
                    <Plus className="w-4 h-4" />
                    Create Your First Project
                  </Button>
                }
              />
            )}
          </TabPanel>

          <TabPanel isActive={activeTab === "templates"}>
            <StaggerContainer className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
              {TEMPLATES.map((tpl) => (
                <StaggerItem key={tpl.id}>
                  <Button
                    variant="ghost"
                    onClick={handleNewProject}
                    className="group w-full h-auto bg-[#131b2e]/60 border border-[#424754]/15 rounded-xl overflow-hidden text-left flex-col items-stretch p-0 hover:border-[#4d8eff]/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
                  >
                  <div className="aspect-[4/3] bg-[#131b2e] relative grid-pattern flex items-center justify-center">
                    <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-[#4d8eff]/40 transition-colors">
                      {tpl.icon}
                    </span>
                    <div className="absolute top-3 right-3">
                      <Badge variant="outline">{tpl.category}</Badge>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-bold text-[#dae2fd] truncate mb-1 group-hover:text-[#adc6ff] transition-colors">
                      {tpl.name}
                    </h3>
                    <p className="text-xs text-[#869ab8] text-[#869ab8] line-clamp-2 font-normal">
                      {tpl.description}
                    </p>
                  </div>
                </Button>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </TabPanel>

          <TabPanel isActive={activeTab === "shared"}>
            {SHARED_PROJECTS.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-3.5">
                {SHARED_PROJECTS.map((project) => (
                  <motion.div
                    layout
                    key={project.id}
                    onClick={() => handleOpenProject(project.id)}
                    className="group bg-[#131b2e]/60 border border-[#424754]/15 rounded-xl overflow-hidden cursor-pointer hover:border-[#4d8eff]/30 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300"
                  >
                    <div className="aspect-[4/3] bg-[#131b2e] relative grid-pattern flex items-center justify-center">
                      <span className="material-symbols-outlined text-5xl text-slate-800 group-hover:text-[#4d8eff]/40 transition-colors">
                        {getTypeIcon(project.type)}
                      </span>
                      <div className="absolute top-3 left-3">
                        <Badge variant="info">{project.sharedBy}</Badge>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-[#dae2fd] truncate mb-1 group-hover:text-[#adc6ff] transition-colors">
                        {project.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-[#869ab8] text-[#869ab8]">
                        <span>{project.nodeCount} Nodes</span>
                        <span className="w-1 h-1 bg-slate-200 bg-slate-700 rounded-full" />
                        <span>{project.memberCount} Members</span>
                      </div>
                      <p className="text-xs text-[#869ab8] mt-3 flex items-center gap-1">
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

          {/* Favorites - shows favorite projects */}
          <TabPanel isActive={activeTab === "favorites"}>
            <FavoritesTab
              isSignedIn={isSignedIn}
              getToken={getToken}
              onOpenProject={handleOpenProject}
              onToggleFavorite={async (projectId) => {
                try {
                  const token = await getToken();
                  if (token) {
                    await ProjectService.toggleFavorite(projectId, token);
                    fetchProjects();
                  }
                } catch (err) {
                  logger.error("[Dashboard] Toggle favorite failed", { error: err instanceof Error ? err.message : String(err) });
                }
              }}
            />
          </TabPanel>

          {/* Trash - shows deleted projects */}
          <TabPanel isActive={activeTab === "trash"}>
            <TrashTab
              isSignedIn={isSignedIn}
              getToken={getToken}
              onPermanentDelete={async (projectId) => {
                try {
                  const token = await getToken();
                  if (token) {
                    await ProjectService.permanentlyDeleteProject(projectId, token);
                  }
                } catch (err) {
                  logger.error("[Dashboard] Permanent delete failed", { error: err instanceof Error ? err.message : String(err) });
                }
              }}
            />
          </TabPanel>
        </PageTransition>

        {/* Bottom Bar - per Figma §5.1 */}
        <footer className="h-8 bg-[#131b2e]/60 border-t border-[#424754]/15 hidden sm:flex items-center justify-between px-6 text-xs text-[#869ab8]">
          <span>Plan: {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}</span>
          <span>Storage: {cloudProjects.length > 0 ? `${(cloudProjects.length * 0.5).toFixed(1)}` : "0"}/5 GB</span>
          <Link to="/settings" className="text-[#adc6ff] hover:text-[#adc6ff]">Upgrade Plan →</Link>
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
    bgColor: "bg-blue-500/20 text-[#adc6ff]",
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
    bgColor: "bg-slate-500/20 text-[#869ab8]",
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

export default memo(Dashboard);
