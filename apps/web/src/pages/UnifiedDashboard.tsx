/**
 * UnifiedDashboard.tsx — BeamLab Command Center
 *
 * Modern glass-morphism dashboard with:
 * - Real project data from API
 * - Refined dark aesthetic
 * - Subtle depth via layered surfaces
 * - Purposeful micro-interactions
 */

import React from "react";
import {
  FC,
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  memo,
} from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FolderOpen,
  Search,
  Clock,
  Star,
  BarChart3,
  Box,
  Triangle,
  Building2,
  Columns,
  Settings,
  ChevronRight,
  Upload,
  Zap,
  Layers,
  Grid3X3,
  ArrowUpRight,
  LayoutDashboard,
  FileText,
  LogOut,
  Cpu,
  Activity as ActivityIcon,
  Sparkles,
  Users,
} from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { useAuth, isUsingClerk } from "../providers/AuthProvider";
import { useUserRegistration } from "../hooks/useUserRegistration";
import { useConfirm } from "../components/ui/ConfirmDialog";
const beamLabLogo = '/branding/beamlab_icon_colored.svg';
import {
  ProjectService,
  Project as APIProject,
} from "../services/ProjectService";
import { TemplateExplorer } from "../components/learning/TemplateExplorer";

// ============================================
// TYPES
// ============================================

interface Project {
  id: string;
  name: string;
  type: "frame" | "truss" | "beam" | "slab" | "bridge";
  thumbnail?: string;
  lastModified: Date;
  nodeCount: number;
  memberCount: number;
  status: "draft" | "analyzed" | "designed" | "complete";
  starred: boolean;
}

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  route: string;
  accent: string;
  badge?: string;
}

interface Template {
  id: string;
  name: string;
  type: string;
  icon: React.ReactNode;
}

// ============================================
// API → DASHBOARD MAPPING
// ============================================

const inferProjectType = (p: APIProject): Project["type"] => {
  const name = (p.name || "").toLowerCase();
  if (name.includes("truss")) return "truss";
  if (name.includes("bridge")) return "bridge";
  if (name.includes("beam")) return "beam";
  if (name.includes("slab")) return "slab";
  return "frame";
};

const inferProjectStatus = (p: APIProject): Project["status"] => {
  const d = p.data;
  if (!d) return "draft";
  if (d.designResults || d.designed) return "designed";
  if (d.analysisResults || d.analyzed) return "analyzed";
  if (d.complete) return "complete";
  return "draft";
};

const mapAPIProject = (p: APIProject): Project => ({
  id: p._id || p.id || "",
  name: p.name || "Untitled Project",
  type: inferProjectType(p),
  thumbnail: p.thumbnail,
  lastModified: new Date(p.updatedAt || p.createdAt),
  nodeCount: p.data?.nodes?.length || 0,
  memberCount: p.data?.members?.length || p.data?.elements?.length || 0,
  status: inferProjectStatus(p),
  starred: false,
});

// ============================================
// UTILITIES
// ============================================

const formatDate = (date: Date): string => {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

const STATUS_STYLES: Record<
  Project["status"],
  { bg: string; text: string; dot: string }
> = {
  draft: {
    bg: "bg-slate-500/10",
    text: "text-slate-600 dark:text-slate-400",
    dot: "bg-slate-400",
  },
  analyzed: { bg: "bg-blue-500/10", text: "text-blue-400", dot: "bg-blue-400" },
  designed: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    dot: "bg-amber-400",
  },
  complete: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    dot: "bg-emerald-400",
  },
};

const TYPE_ICON: Record<Project["type"], React.ReactNode> = {
  frame: <Building2 className="w-4 h-4" />,
  truss: <Triangle className="w-4 h-4" />,
  beam: <Box className="w-4 h-4" />,
  slab: <Grid3X3 className="w-4 h-4" />,
  bridge: <Columns className="w-4 h-4" />,
};

// ============================================
// DATA
// ============================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "space-planning",
    title: "Space Planning",
    subtitle: "House design & layouts",
    icon: <Building2 className="w-5 h-5" />,
    route: "/space-planning",
    accent: "group-hover:text-green-400",
    badge: "New",
  },
  {
    id: "new",
    title: "New Project",
    subtitle: "Blank canvas",
    icon: <Plus className="w-5 h-5" />,
    route: "/app",
    accent: "group-hover:text-blue-400",
  },
  {
    id: "ai",
    title: "AI Architect",
    subtitle: "Generate with AI",
    icon: <Sparkles className="w-5 h-5" />,
    route: "/app?mode=ai",
    accent: "group-hover:text-purple-400",
    badge: "AI",
  },
  {
    id: "templates",
    title: "Templates",
    subtitle: "Pre-built structures",
    icon: <Layers className="w-5 h-5" />,
    route: "/app?panel=templates",
    accent: "group-hover:text-emerald-400",
  },
  {
    id: "import",
    title: "Import",
    subtitle: "DXF / STAAD / SAP",
    icon: <Upload className="w-5 h-5" />,
    route: "/app?tool=import",
    accent: "group-hover:text-orange-400",
  },
  {
    id: "collaborate",
    title: "Collaborate",
    subtitle: "Team workspace",
    icon: <Users className="w-5 h-5" />,
    route: "/collaboration",
    accent: "group-hover:text-cyan-400",
  },
];

const TEMPLATES: Template[] = [
  {
    id: "frame",
    name: "3D Frame",
    type: "Building",
    icon: <Building2 className="w-4 h-4" />,
  },
  {
    id: "truss",
    name: "Pratt Truss",
    type: "Roof",
    icon: <Triangle className="w-4 h-4" />,
  },
  {
    id: "portal",
    name: "Portal Frame",
    type: "Industrial",
    icon: <Columns className="w-4 h-4" />,
  },
  {
    id: "beam",
    name: "Continuous Beam",
    type: "Multi-span",
    icon: <Box className="w-4 h-4" />,
  },
];

// ============================================
// SUB-COMPONENTS
// ============================================

/* ---- Stat Pill ---- */
const StatPill: FC<{
  label: string;
  value: string | number;
  icon: React.ReactNode;
}> = memo(({ label, value, icon }) => (
  <div className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 backdrop-blur-sm">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-slate-600 dark:text-slate-400">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-lg font-semibold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">
        {value}
      </div>
      <div className="text-[11px] text-slate-500 leading-tight">{label}</div>
    </div>
  </div>
));
StatPill.displayName = "StatPill";

/* ---- Project Card ---- */
const ProjectCard: FC<{
  project: Project;
  onClick: () => void;
  onDelete: () => void;
}> = memo(({ project, onClick, onDelete }) => {
  const st = STATUS_STYLES[project.status];
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      whileHover={{ y: -2 }}
      className="group relative rounded-xl border border-white/[0.06] bg-white/[0.02] backdrop-blur-sm
          hover:border-white/[0.12] hover:bg-white/[0.04] transition-colors cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* Thumbnail area */}
      <div className="aspect-[16/9] bg-white dark:bg-slate-950/60 flex items-center justify-center relative overflow-hidden">
        {/* Subtle grid background */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="text-slate-700 group-hover:text-slate-500 transition-colors scale-150">
          {TYPE_ICON[project.type]}
        </div>
        {project.starred && (
          <Star className="absolute top-2.5 right-2.5 w-3.5 h-3.5 text-amber-400 fill-amber-400" />
        )}
        {/* Hover overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2.5">
          <div className="rounded-full bg-white/10 backdrop-blur-sm p-1.5 border border-white/10">
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="px-3.5 py-3 space-y-2">
        <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate group-hover:text-slate-900 dark:hover:text-white transition-colors">
          {project.name}
        </h3>
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <Clock className="w-3 h-3" />
          <span>{formatDate(project.lastModified)}</span>
          <span className="text-slate-700">·</span>
          <span>
            {project.nodeCount}N · {project.memberCount}M
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${st.bg} ${st.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {project.status}
          </span>
        </div>
      </div>

      {/* Delete button (stop propagation) */}
      <button type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity
            p-1 rounded-md bg-black/40 backdrop-blur-sm text-slate-600 dark:text-slate-400 hover:text-red-400 text-xs"
        title="Delete project"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
      </button>
    </motion.div>
  );
});
ProjectCard.displayName = "ProjectCard";

// ============================================
// MAIN COMPONENT
// ============================================

export const UnifiedDashboard: FC<{
  onLaunchModule?: (m: string) => void;
}> = () => {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useUserRegistration();

  useEffect(() => { document.title = 'Dashboard | BeamLab'; }, []);

  const { isSignedIn, user, signOut, getToken } = useAuth();
  const isClerkEnabled = isUsingClerk();
  const userName = isSignedIn && user?.firstName ? user.firstName : "Engineer";

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    try {
      setProjectsLoading(true);
      setProjectsError(null);
      const token = await getToken();
      if (!token) {
        setProjects([]);
        setProjectsLoading(false);
        return;
      }
      const apiProjects = await ProjectService.listProjects(token);
      setProjects(apiProjects.map(mapAPIProject));
    } catch (err) {
      console.error("[Dashboard] Failed to load projects:", err);
      setProjectsError(
        err instanceof Error ? err.message : "Failed to load projects",
      );
      setProjects([]);
    } finally {
      setProjectsLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (isSignedIn) fetchProjects();
    else {
      setProjects([]);
      setProjectsLoading(false);
    }
  }, [isSignedIn, fetchProjects]);

  // Greeting
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  }, []);

  // Filters
  const filteredProjects = useMemo(
    () =>
      projects.filter((p) => {
        const matchSearch = p.name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        const matchStatus = filterStatus === "all" || p.status === filterStatus;
        return matchSearch && matchStatus;
      }),
    [searchQuery, filterStatus, projects],
  );

  // Stats
  const analysedCount = useMemo(
    () =>
      projects.filter((p) =>
        ["analyzed", "designed", "complete"].includes(p.status),
      ).length,
    [projects],
  );
  const totalMembers = useMemo(
    () => projects.reduce((a, p) => a + p.memberCount, 0),
    [projects],
  );
  const totalNodes = useMemo(
    () => projects.reduce((a, p) => a + p.nodeCount, 0),
    [projects],
  );

  const handleDeleteProject = useCallback(
    async (projectId: string) => {
      if (!(await confirm({ title: 'Delete Project', message: 'Delete this project? This cannot be undone.', variant: 'danger' }))) return;
      try {
        const token = await getToken();
        if (!token) return;
        await ProjectService.deleteProject(projectId, token);
        setProjects((prev) => prev.filter((p) => p.id !== projectId));
      } catch (err) {
        console.error("[Dashboard] Delete failed:", err);
      }
    },
    [getToken],
  );

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-screen bg-[#0a0e17] text-slate-700 dark:text-slate-200">
      {/* ---- Ambient glow (top-left) ---- */}
      <div className="pointer-events-none fixed -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-blue-600/[0.04] blur-[120px]" />
      <div className="pointer-events-none fixed -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-purple-600/[0.03] blur-[120px]" />

      {/* ======== HEADER ======== */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0e17]/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1360px] items-center justify-between px-6 py-3">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-7">
            <Link to="/" className="flex items-center gap-2.5">
              <img src={beamLabLogo} alt="BeamLab" className="h-7 w-7 object-contain" />
              <span className="text-[15px] font-bold tracking-tight text-slate-900 dark:text-white">
                BeamLab
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-0.5">
              {[
                {
                  to: "/stream",
                  label: "Dashboard",
                  icon: <LayoutDashboard className="w-3.5 h-3.5" />,
                  active: true,
                },
                {
                  to: "/app",
                  label: "Analysis",
                  icon: <Box className="w-3.5 h-3.5" />,
                },
                {
                  to: "/steel-design",
                  label: "Design",
                  icon: <Columns className="w-3.5 h-3.5" />,
                },
                {
                  to: "/reports",
                  label: "Reports",
                  icon: <FileText className="w-3.5 h-3.5" />,
                },
                {
                  to: "/space-planning",
                  label: "Space Planning",
                  icon: <Building2 className="w-3.5 h-3.5" />,
                },
                {
                  to: "/collaboration",
                  label: "Collaborate",
                  icon: <Users className="w-3.5 h-3.5" />,
                },
                {
                  to: "/capabilities",
                  label: "All Tools",
                  icon: <Sparkles className="w-3.5 h-3.5" />,
                },
              ].map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors
                    ${n.active ? "text-slate-900 dark:text-white bg-white/[0.06]" : "text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-white/[0.03]"}`}
                >
                  {n.icon} {n.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Right: User */}
          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="rounded-lg p-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-white/[0.04] transition-colors"
            >
              <Settings className="w-4 h-4" />
            </Link>
            <div className="h-5 w-px bg-white/[0.08]" />
            {isClerkEnabled ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">{userName}</span>
                <button type="button"
                  onClick={() => signOut()}
                  className="rounded-lg p-2 text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-white/[0.04] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ======== MAIN ======== */}
      <main className="mx-auto max-w-[1360px] px-6 py-8 space-y-8 relative">
        {/* ---- Welcome Row ---- */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
              {greeting}, {userName}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {projects.length > 0
                ? `${projects.length} project${projects.length !== 1 ? "s" : ""} in your workspace`
                : "Your workspace is empty — create your first project"}
            </p>
          </div>
          <button type="button"
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white
              hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20 shrink-0"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>

        {/* ---- Stats Row ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatPill
            label="Projects"
            value={projects.length}
            icon={<FolderOpen className="w-4.5 h-4.5" />}
          />
          <StatPill
            label="Analyses"
            value={analysedCount}
            icon={<BarChart3 className="w-4.5 h-4.5" />}
          />
          <StatPill
            label="Members"
            value={totalMembers.toLocaleString()}
            icon={<Cpu className="w-4.5 h-4.5" />}
          />
          <StatPill
            label="Nodes"
            value={totalNodes.toLocaleString()}
            icon={<ActivityIcon className="w-4.5 h-4.5" />}
          />
        </div>

        {/* ---- Quick Actions ---- */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {QUICK_ACTIONS.map((a) => (
              <button type="button"
                key={a.id}
                onClick={() => navigate(a.route)}
                className="group flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02]
                  px-4 py-3.5 text-left transition-all hover:border-white/[0.12] hover:bg-white/[0.04]"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]
                  text-slate-600 dark:text-slate-400 transition-colors ${a.accent}`}
                >
                  {a.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                      {a.title}
                    </span>
                    {a.badge && (
                      <span className="rounded bg-purple-500/20 px-1.5 py-[1px] text-[9px] font-bold text-purple-400">
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {a.subtitle}
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0" />
              </button>
            ))}
          </div>
        </div>

        {/* ---- Content Grid ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Left: Projects */}
          <div>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-4">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex-1">
                Recent Projects
              </h2>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Search..."
                    aria-label="Search projects"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 rounded-lg border border-white/[0.06] bg-white/[0.02] py-1.5 pl-8 pr-3 text-xs text-slate-700 dark:text-slate-300
                      placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20
                      transition-colors"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-400
                    focus:outline-none focus:border-blue-500/40"
                >
                  <option value="all">All</option>
                  <option value="draft">Draft</option>
                  <option value="analyzed">Analyzed</option>
                  <option value="designed">Designed</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>

            {/* Project Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {projectsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-white/[0.04] bg-white/[0.01] animate-pulse"
                  >
                    <div className="aspect-[16/9] bg-white/[0.02]" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-white/[0.04]" />
                      <div className="h-3 w-1/2 rounded bg-white/[0.03]" />
                    </div>
                  </div>
                ))
              ) : projectsError ? (
                <div className="col-span-full rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
                  <p className="text-sm text-red-400 mb-3">{projectsError}</p>
                  <button type="button"
                    onClick={fetchProjects}
                    className="rounded-lg border border-red-500/20 px-4 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <AnimatePresence mode="popLayout">
                  {filteredProjects.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onClick={() => navigate(`/app?project=${project.id}`)}
                      onDelete={() => handleDeleteProject(project.id)}
                    />
                  ))}
                </AnimatePresence>
              )}
            </div>

            {/* Empty State */}
            {!projectsLoading &&
              !projectsError &&
              filteredProjects.length === 0 && (
                <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.08] py-16 text-center">
                  <FolderOpen className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-4" />
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {searchQuery ? "No matching projects" : "No projects yet"}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-5 max-w-xs">
                    {searchQuery
                      ? `Nothing matches "${searchQuery}". Try a different search.`
                      : "Create your first structural analysis project."}
                  </p>
                  <button type="button"
                    onClick={() => navigate("/app")}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-500 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Create Project
                  </button>
                </div>
              )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-5">
            <TemplateExplorer
              onStartTemplate={(templateId) =>
                navigate(`/space-planning?template=${encodeURIComponent(templateId)}`)
              }
            />

            {/* Templates */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                Templates
              </h3>
              <div className="space-y-1">
                {TEMPLATES.map((t) => (
                  <button type="button"
                    key={t.id}
                    onClick={() => navigate(`/app?template=${t.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left
                      hover:bg-white/[0.04] transition-colors group"
                  >
                    <div
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-slate-500
                      group-hover:text-slate-700 dark:text-slate-300 transition-colors"
                    >
                      {t.icon}
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {t.name}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">{t.type}</div>
                    </div>
                    <ChevronRight className="ml-auto w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors" />
                  </button>
                ))}
              </div>
            </div>

            {/* Keyboard shortcuts / tips */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                Quick Tips
              </h3>
              <div className="space-y-2.5 text-[11px] text-slate-500">
                <div className="flex items-start gap-2">
                  <kbd className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                    N
                  </kbd>
                  <span>New node in modeler</span>
                </div>
                <div className="flex items-start gap-2">
                  <kbd className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                    M
                  </kbd>
                  <span>New member between selected</span>
                </div>
                <div className="flex items-start gap-2">
                  <kbd className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                    F5
                  </kbd>
                  <span>Run analysis</span>
                </div>
                <div className="flex items-start gap-2">
                  <kbd className="shrink-0 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-600 dark:text-slate-400 font-mono">
                    Ctrl+S
                  </kbd>
                  <span>Save project</span>
                </div>
              </div>
            </div>

            {/* Version info */}
            <div className="text-center text-[10px] text-slate-500 dark:text-slate-500 py-2">
              BeamLab v2.0 &middot; &copy; {new Date().getFullYear()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UnifiedDashboard;
