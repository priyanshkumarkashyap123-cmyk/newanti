/**
 * Dashboard - BeamLab Ultimate Projects Dashboard
 * Modern project hub with BeamLab Branding & New UI System
 */

import { FC, useState, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { UserButton } from "@clerk/clerk-react";
import { useAuth, isUsingClerk } from "../providers/AuthProvider";
import { useUserRegistration } from "../hooks/useUserRegistration";
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
import type { Node, Member } from "../store/model";

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

  useEffect(() => {
    document.title = 'Dashboard - BeamLab';
  }, []);

  // Register user
  useUserRegistration();

  // Contexts
  const { isSignedIn, user, signOut, getToken } = useAuth();
  const isClerkEnabled = isUsingClerk();
  const userName = isSignedIn && user?.firstName ? user.firstName : "Engineer";
  const userEmail =
    (isSignedIn && (user as any)?.emailAddresses?.[0]?.emailAddress) ||
    "engineer@beamlab.io";

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
          // Reconstruct Maps from serialised arrays
          const nodesMap = new Map<string, Node>(
            data.nodes as [string, Node][],
          );
          const membersMap = new Map<string, Member>(
            data.members as [string, Member][],
          );

          useModelStore.setState({
            projectInfo: {
              ...(data.projectInfo || {}),
              cloudId: fullProject._id,
            },
            nodes: nodesMap,
            members: membersMap,
            loads: data.loads || [],
            memberLoads: data.memberLoads || [],
            analysisResults: null,
            selectedIds: new Set(),
            isAnalyzing: false,
          });
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
      <aside className="w-64 bg-slate-50 dark:bg-slate-900/80 border-r border-white/[0.06] flex flex-col backdrop-blur-xl">
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

        <nav className="flex-1 px-3 py-4 space-y-1">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => setActiveTab(tab.id)}
              className={`
                                w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                                ${
                                  activeTab === tab.id
                                    ? "bg-blue-500/[0.12] text-blue-400 border border-blue-500/20 shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-white/[0.04] hover:text-slate-700 dark:hover:text-slate-200 border border-transparent"
                                }
                            `}
            >
              {tab.icon}
              {tab.label}
            </Button>
          ))}
          <div className="pt-4 mt-4 border-t border-white/[0.06]">
            <Button variant="ghost" className="w-full justify-start gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white">
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
            <Button variant="outline" size="sm" className="gap-2">
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
              Quick Start
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      <div className="absolute top-3 right-3">
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
    id: "beam",
    title: "Beam Tool",
    subtitle: "Continuous & cantilever beams",
    icon: "straighten",
    bgColor: "bg-orange-500/20 text-orange-400",
  },
  {
    id: "rc-design",
    title: "RC Design",
    subtitle: "IS 456 / ACI 318 checks",
    icon: "apartment",
    bgColor: "bg-green-500/20 text-green-400",
  },
  {
    id: "steel-design",
    title: "Steel Design",
    subtitle: "IS 800 / AISC 360 checks",
    icon: "construction",
    bgColor: "bg-purple-500/20 text-purple-400",
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
