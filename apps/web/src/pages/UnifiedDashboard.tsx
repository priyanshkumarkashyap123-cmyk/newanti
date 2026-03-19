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
  useDeferredValue,
  memo,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  ChevronRight,
  Upload,
  Zap,
  Layers,
  Grid3X3,
  ArrowUpRight,
  Cpu,
  Activity as ActivityIcon,
  Sparkles,
  Wrench,
  FileText,
  Users,
  BookOpen,
  Crown,
  Lock,
  X as XIcon,
  CheckCircle,
  GraduationCap,
} from "lucide-react";
import { useAuth } from "../providers/AuthProvider";
import { useAnalytics, ANALYTICS_EVENTS } from "../providers/AnalyticsProvider";
import { useSubscription } from "../hooks/useSubscription";
import { useConfirm } from "../components/ui/ConfirmDialog";
import {
  ProjectService,
  Project as APIProject,
} from "../services/ProjectService";
import { TemplateExplorer } from "../components/learning/TemplateExplorer";
import { useJourney } from "../hooks/useJourney";
import {
  getBundleCollections,
  type AppFeatureCategory,
} from "../config/appRouteMeta";

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

interface BundleCardMeta {
  icon: React.ReactNode;
  accent: string;
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
    id: "learn",
    title: "Learn",
    subtitle: "Tutorials & guides",
    icon: <GraduationCap className="w-5 h-5" />,
    route: "/learning",
    accent: "group-hover:text-lime-400",
  },
];

const BUNDLE_META: Record<string, BundleCardMeta> = {
  workspace: {
    icon: <Layers className="w-5 h-5" />,
    accent: "from-blue-500/15 to-cyan-500/10 text-blue-600 dark:text-blue-400",
  },
  analysis: {
    icon: <BarChart3 className="w-5 h-5" />,
    accent: "from-violet-500/15 to-purple-500/10 text-violet-600 dark:text-violet-400",
  },
  design: {
    icon: <Building2 className="w-5 h-5" />,
    accent: "from-emerald-500/15 to-teal-500/10 text-emerald-600 dark:text-emerald-400",
  },
  review: {
    icon: <FileText className="w-5 h-5" />,
    accent: "from-amber-500/15 to-orange-500/10 text-amber-600 dark:text-amber-400",
  },
  tools: {
    icon: <Wrench className="w-5 h-5" />,
    accent: "from-slate-500/15 to-slate-400/10 text-slate-600 dark:text-slate-300",
  },
  ai: {
    icon: <Sparkles className="w-5 h-5" />,
    accent: "from-fuchsia-500/15 to-pink-500/10 text-fuchsia-600 dark:text-fuchsia-400",
  },
  civil: {
    icon: <Columns className="w-5 h-5" />,
    accent: "from-cyan-500/15 to-sky-500/10 text-cyan-600 dark:text-cyan-400",
  },
  enterprise: {
    icon: <Users className="w-5 h-5" />,
    accent: "from-indigo-500/15 to-blue-500/10 text-indigo-600 dark:text-indigo-400",
  },
  learning: {
    icon: <BookOpen className="w-5 h-5" />,
    accent: "from-lime-500/15 to-emerald-500/10 text-lime-600 dark:text-lime-400",
  },
};

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

const JOURNEY_STEPS: Array<{
  title: string;
  description: string;
  path: string;
  icon: React.ReactNode;
}> = [
  {
    title: '1. Create / Open Project',
    description: 'Start from blank canvas or resume an existing model.',
    path: '/app',
    icon: <FolderOpen className="w-4 h-4" />,
  },
  {
    title: '2. Model & Define Loads',
    description: 'Set nodes, members, supports, and load combinations.',
    path: '/app',
    icon: <Box className="w-4 h-4" />,
  },
  {
    title: '3. Analyze & Review',
    description: 'Run analysis and export deliverables from reports.',
    path: '/reports',
    icon: <FileText className="w-4 h-4" />,
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
  trend?: { value: string; positive: boolean };
}> = memo(({ label, value, icon, trend }) => (
  <div className="flex items-center gap-4 rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/70 dark:bg-slate-900/40 px-5 py-4 backdrop-blur-md shadow-sm transition-all hover:shadow-md hover:border-blue-500/20 group">
    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/[0.05] text-slate-600 dark:text-blue-400 group-hover:bg-blue-500/10 group-hover:scale-110 transition-all duration-300">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums tracking-tight">
          {value}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${trend.positive ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
            {trend.value}
          </span>
        )}
      </div>
      <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</div>
    </div>
  </div>
));
StatPill.displayName = "StatPill";

const BundleCard: FC<{
  category: AppFeatureCategory;
  onOpen: () => void;
}> = memo(({ category, onOpen }) => {
  const meta = BUNDLE_META[category.id] ?? BUNDLE_META.workspace;
  const preview = category.features.slice(0, 3);
  const planBadge = category.planRequired === 'enterprise'
    ? { label: 'Enterprise', bg: 'bg-indigo-500/20', text: 'text-indigo-400', icon: <Crown className="w-3 h-3" /> }
    : category.planRequired === 'pro'
      ? { label: 'Pro', bg: 'bg-amber-500/20', text: 'text-amber-400', icon: <Zap className="w-3 h-3" /> }
      : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-white/[0.02] p-4 text-left transition-all hover:border-slate-300 dark:hover:border-blue-500/30 hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:shadow-md hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 shadow-sm dark:shadow-none"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${meta.accent}`}>
            {meta.icon}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
              {category.label}
            </h3>
            {planBadge && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${planBadge.bg} ${planBadge.text}`}>
                {planBadge.icon}
                {planBadge.label}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            {category.description}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {preview.map((feature) => (
          <span
            key={feature.id}
            className="rounded-full bg-slate-100 dark:bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium text-slate-600 dark:text-slate-300"
          >
            {feature.label}
          </span>
        ))}
      </div>
    </button>
  );
});
BundleCard.displayName = "BundleCard";

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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className="group relative rounded-2xl border border-slate-200/60 dark:border-white/[0.08] bg-white/80 dark:bg-slate-900/40 backdrop-blur-xl
          hover:border-blue-500/40 dark:hover:border-blue-500/30 transition-all duration-300 cursor-pointer overflow-hidden shadow-sm shadow-slate-200/40 dark:shadow-none"
      onClick={onClick}
    >
      {/* Thumbnail area with Blueprint Pattern */}
      <div className="aspect-[16/10] bg-slate-100 dark:bg-slate-950/80 flex items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1]"
          style={{
            backgroundImage:
              "linear-gradient(#4f46e5 1px, transparent 1px), linear-gradient(90deg, #4f46e5 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
        
        <div className="relative z-10 text-slate-400 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-all duration-500 scale-125 group-hover:scale-150 group-hover:rotate-12">
          {TYPE_ICON[project.type]}
        </div>
        
        {project.starred && (
          <div className="absolute top-3 right-3 z-20 bg-amber-400/10 backdrop-blur-md rounded-full p-1 border border-amber-400/20">
            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
          </div>
        )}
        
        {/* Hover Action Sheet */}
        <div className="absolute inset-0 bg-black/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
           <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg text-xs font-bold text-blue-600 flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
             Open Project <ArrowUpRight className="w-3.5 h-3.5" />
           </div>
        </div>
      </div>

      {/* Info Body */}
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <h3 className="text-[15px] font-bold text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {project.name}
          </h3>
        </div>
        
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.04] px-2 py-1 rounded-md">
            <Clock className="w-3 h-3" />
            {formatDate(project.lastModified)}
          </span>
          <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/[0.04] px-2 py-1 rounded-md">
            <Layers className="w-3 h-3" />
            {project.nodeCount} nodes
          </span>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-white/[0.04]">
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${st.bg} ${st.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${st.dot}`} />
            {project.status}
          </span>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors" />
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
// ONBOARDING PREFS HELPER
// ============================================

interface UserPrefs {
  role?: 'student' | 'professional' | 'enterprise' | null;
  experience?: 'beginner' | 'intermediate' | 'expert' | null;
  journey?: 'newbie' | 'professional' | 'advanced';
  timestamp?: number;
  primaryUse?: string[];
  designCodes?: string[];
}

interface PersonalizedNudge {
  headline: string;
  description: string;
  ctas: { label: string; path: string }[];
}

const getPersonalizedNudge = (prefs: UserPrefs): PersonalizedNudge => {
  if (prefs.role === 'student' || prefs.experience === 'beginner') {
    return {
      headline: 'New to structural analysis?',
      description: 'Start with hands-on tutorials and pre-built templates — no blank-canvas anxiety.',
      ctas: [
        { label: 'Learning Center', path: '/learning' },
        { label: 'Template Gallery', path: '/app?panel=templates' },
      ],
    };
  }
  if (prefs.role === 'enterprise') {
    return {
      headline: 'Ready to collaborate?',
      description: 'Set up team workspaces, BIM integrations, and API connections.',
      ctas: [
        { label: 'Collaboration Hub', path: '/collaboration' },
        { label: 'Enterprise Integrations', path: '/integrations/api-dashboard' },
      ],
    };
  }
  // default professional
  return {
    headline: 'Your workspace is ready',
    description: 'Jump straight into advanced 3D analysis, design codes, and PDF reports.',
    ctas: [
      { label: 'Start 3D Analysis', path: '/app' },
      { label: 'Design Codes', path: '/design' },
    ],
  };
};

// ============================================
// MAIN COMPONENT
// ============================================

export const UnifiedDashboard: FC<{
  onLaunchModule?: (m: string) => void;
}> = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const confirm = useConfirm();
  const { track } = useAnalytics();
  const { subscription } = useSubscription();
  const { journey, showAdvanced, setShowAdvanced } = useJourney();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  // Post-upgrade welcome banner
  const [showUpgradeBanner, setShowUpgradeBanner] = useState(
    () => searchParams.get('upgraded') === 'true',
  );

  // Personalized onboarding nudge (shown once per session if onboarding complete)
  const [personalizedNudge] = useState<PersonalizedNudge | null>(() => {
    try {
      const done = localStorage.getItem('beamlab_onboarding_complete');
      const dismissed = sessionStorage.getItem('beamlab_prefs_nudge_dismissed');
      if (!done || dismissed) return null;
      const raw = localStorage.getItem('beamlab_user_preferences');
      if (!raw) return null;
      const prefs: UserPrefs = JSON.parse(raw);
      return getPersonalizedNudge(prefs);
    } catch {
      return null;
    }
  });
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const dismissNudge = useCallback(() => {
    setNudgeDismissed(true);
    try { sessionStorage.setItem('beamlab_prefs_nudge_dismissed', '1'); } catch { /* ignore */ }
  }, []);

  // Project state
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  useEffect(() => { document.title = 'Dashboard | BeamLab'; }, []);

  // Fire analytics event and strip query param once banner is shown
  useEffect(() => {
    if (showUpgradeBanner) {
      track(ANALYTICS_EVENTS.POST_UPGRADE_BANNER_SEEN, { tier: subscription.tier });
      const next = new URLSearchParams(searchParams);
      next.delete('upgraded');
      setSearchParams(next, { replace: true });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showUpgradeBanner]);

  const { isSignedIn, user, getToken } = useAuth();
  const userName = isSignedIn && user?.firstName ? user.firstName : "Engineer";
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const bundleCollections = useMemo(
    () =>
      getBundleCollections({
        tier: subscription.tier,
        includeLocked: true,
        journey,
        showAdvanced,
      }),
    [subscription.tier, journey, showAdvanced],
  );
  const primaryBundles = bundleCollections.primary;
  const secondaryBundles = useMemo(
    () => [...bundleCollections.secondary, ...bundleCollections.advanced],
    [bundleCollections.secondary, bundleCollections.advanced],
  );

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
          .includes(deferredSearchQuery.toLowerCase());
        const matchStatus = filterStatus === "all" || p.status === filterStatus;
        return matchSearch && matchStatus;
      }),
    [deferredSearchQuery, filterStatus, projects],
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
    <div className="text-slate-700 dark:text-slate-200">
      {/* ======== MAIN ======== */}
      <main className="mx-auto max-w-[1360px] px-6 py-8 space-y-8 relative">

        {/* ---- Post-upgrade Welcome Banner ---- */}
        {showUpgradeBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex items-start gap-4 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] px-5 py-4 pr-10"
          >
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-300">
                {subscription.tier === 'enterprise' ? 'Welcome to Enterprise!' : `Welcome to ${subscription.tier === 'pro' ? 'Pro' : 'BeamLab'}!`}
                {' '}Your plan is now active.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Unlock advanced workflows below — AI planning, 3D analysis, advanced design codes, and more.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: '3D Analysis', path: '/app' },
                  { label: 'AI Dashboard', path: '/ai-dashboard' },
                  { label: 'Export Reports', path: '/reports' },
                ].map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      track(ANALYTICS_EVENTS.WELCOME_WORKFLOW_CLICKED, { path: item.path, tier: subscription.tier });
                      navigate(item.path);
                    }}
                    className="rounded-lg border border-emerald-500/30 px-3 py-1 text-xs text-emerald-300 hover:bg-emerald-500/10 transition-colors"
                  >
                    {item.label} →
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowUpgradeBanner(false)}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* ---- Personalized profile nudge ---- */}
        {personalizedNudge && !nudgeDismissed && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex items-start gap-4 rounded-xl border border-blue-500/20 bg-blue-500/[0.06] px-5 py-4 pr-10"
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-300">{personalizedNudge.headline}</p>
              <p className="mt-0.5 text-xs text-slate-400">{personalizedNudge.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {personalizedNudge.ctas.map((cta) => (
                  <button
                    key={cta.path}
                    type="button"
                    onClick={() => { dismissNudge(); navigate(cta.path); }}
                    className="rounded-lg border border-blue-500/30 px-3 py-1 text-xs text-blue-300 hover:bg-blue-500/10 transition-colors"
                  >
                    {cta.label} →
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissNudge}
              className="absolute right-3 top-3 rounded-md p-1 text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
              aria-label="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </motion.div>
        )}

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

        {/* ---- Engineered User Journey ---- */}
        <section className="rounded-2xl border border-blue-200/60 dark:border-blue-500/15 bg-gradient-to-br from-blue-50 via-white to-indigo-50 dark:from-blue-500/[0.12] dark:via-slate-900/50 dark:to-indigo-500/[0.08] p-6 shadow-sm dark:shadow-none">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Your engineering flow</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                {journey === 'newbie'
                  ? 'Beginner path: follow these steps to complete your first analysis faster.'
                  : journey === 'advanced'
                    ? 'Power-user path: jump straight to model, analyze, and deliverables.'
                    : 'Professional path: from project setup to verified analysis output.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {JOURNEY_STEPS.map((step) => (
              <button
                key={step.title}
                type="button"
                onClick={() => navigate(step.path)}
                className="group relative text-left rounded-xl border border-slate-200 dark:border-blue-500/20 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 p-5 transition-all hover:shadow-md hover:shadow-blue-500/5 dark:hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    {step.icon}
                  </div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500 dark:text-slate-400">Step</span>
                </div>
                <h3 className="text-sm font-bold mb-2 text-slate-900 dark:text-white">{step.title}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">{step.description}</p>
                <div className="flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300 group-hover:gap-2 transition-all">
                  Open
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {journey === 'newbie' && (
          <section className="rounded-xl border border-emerald-300/40 dark:border-emerald-700/40 bg-emerald-50 dark:bg-emerald-900/15 p-5">
            <h2 className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Getting started (recommended)</h2>
            <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-200/90">
              These three actions are optimized for first-time users.
            </p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { title: 'Open Learning Center', subtitle: '2-minute guided intro', route: '/learning' },
                { title: 'Try a Template', subtitle: 'Start from a proven model', route: '/app?panel=templates' },
                { title: 'Run First Analysis', subtitle: 'Go from model to results', route: '/app' },
              ].map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => navigate(item.route)}
                  className="text-left rounded-lg border border-emerald-300/50 dark:border-emerald-700/40 bg-white/90 dark:bg-slate-900/40 p-3.5 hover:bg-white dark:hover:bg-slate-900/60 transition-colors"
                >
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{item.subtitle}</p>
                </button>
              ))}
            </div>
          </section>
        )}

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
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
              Quick Actions
            </h2>
            <span className="text-[10px] text-slate-500 dark:text-slate-500">Shortcuts</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {QUICK_ACTIONS.map((a) => (
              <button type="button"
                key={a.id}
                onClick={() => navigate(a.route)}
                className="group relative flex flex-col items-start rounded-xl border border-slate-200 dark:border-blue-500/20 bg-white dark:bg-slate-900/60 hover:bg-slate-50 dark:hover:bg-slate-800/60
                  px-3.5 py-3.5 text-left transition-all hover:shadow-md hover:shadow-blue-500/5 dark:hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm dark:shadow-none"
              >
                <div
                  className={`h-10 w-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-slate-200 to-slate-100 dark:from-blue-500/20 dark:to-blue-500/10
                  text-slate-600 dark:text-slate-400 transition-all group-hover:scale-110 ${a.accent}`}
                >
                  {a.icon}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      {a.title}
                    </span>
                    {a.badge && (
                      <span className="rounded-full bg-purple-500/20 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-purple-400">
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {a.subtitle}
                  </span>
                </div>
                <ChevronRight className="absolute top-3.5 right-3.5 w-4 h-4 text-slate-300 dark:text-slate-500 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all shrink-0" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
            Explore by Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {primaryBundles.map((category) => (
              <BundleCard
                key={category.id}
                category={category}
                onOpen={() => {
                  track(ANALYTICS_EVENTS.BUNDLE_CARD_OPENED, { categoryId: category.id, prominence: 'primary' });
                  navigate(category.features[0]?.path ?? '/stream');
                }}
              />
            ))}
          </div>
        </div>

        {secondaryBundles.length > 0 ? (
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                Specialist Suites
              </h2>
              {(journey === 'newbie' || journey === 'professional') && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-medium text-blue-600 dark:text-blue-300 hover:underline"
                >
                  {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
              {secondaryBundles.map((category) => (
                <BundleCard
                  key={category.id}
                  category={category}
                  onOpen={() => {
                    track(ANALYTICS_EVENTS.BUNDLE_CARD_OPENED, { categoryId: category.id, prominence: 'secondary' });
                    navigate(category.features[0]?.path ?? '/stream');
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          (journey === 'newbie' || journey === 'professional') && (
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-4">
              <p className="text-xs text-slate-600 dark:text-slate-300">
                Advanced suites are hidden in guided mode.
              </p>
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-300 hover:underline"
              >
                Show advanced suites
              </button>
            </div>
          )
        )}

        {/* ---- Content Grid ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Left: Projects */}
          <div>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-5">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex-1">
                Recent Projects
              </h2>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filter by name…"
                    aria-label="Search projects"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-48 rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-slate-900/40 py-2 pl-9 pr-3 text-xs text-slate-700 dark:text-slate-300
                      placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30
                      transition-colors"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="rounded-lg border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] px-3 py-2 text-xs text-slate-700 dark:text-slate-400
                    focus:outline-none focus:border-blue-500/60 focus:ring-2 focus:ring-blue-500/30"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {projectsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-200/60 dark:border-white/[0.04] bg-slate-100 dark:bg-white/[0.01] animate-pulse"
                  >
                    <div className="aspect-[16/9] bg-slate-200/60 dark:bg-white/[0.02]" />
                    <div className="p-3.5 space-y-2">
                      <div className="h-3.5 w-3/4 rounded bg-slate-200 dark:bg-white/[0.04]" />
                      <div className="h-3 w-1/2 rounded bg-slate-200/60 dark:bg-white/[0.03]" />
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
                <div className="col-span-full mt-6 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600/40 py-20 text-center">
                  <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center mb-5">
                    <FolderOpen className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                  </div>
                  <h3 className="text-base font-bold text-slate-700 dark:text-slate-300 mb-2">
                    {searchQuery ? "No matching projects" : "No projects yet"}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 max-w-sm leading-relaxed">
                    {searchQuery
                      ? `Nothing matches "${searchQuery}". Try a different search.`
                      : "Create your first structural analysis project."}
                  </p>
                  <button type="button"
                    onClick={() => navigate("/app")}
                    className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-600/20"
                  >
                    <Plus className="w-4 h-4" /> Create Project
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

            {/* Keyboard shortcuts */}
            <div className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-slate-900/40 p-5 shadow-sm">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-3">
                Keyboard Shortcuts
              </h3>
              <div className="space-y-3 text-[11px] text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2.5">
                  <kbd className="shrink-0 rounded-md bg-slate-900 dark:bg-slate-800 px-2 py-1 text-[9px] text-slate-100 dark:text-slate-200 font-mono border border-slate-700 dark:border-slate-600 font-semibold">
                    N
                  </kbd>
                  <span>New node</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <kbd className="shrink-0 rounded-md bg-slate-900 dark:bg-slate-800 px-2 py-1 text-[9px] text-slate-100 dark:text-slate-200 font-mono border border-slate-700 dark:border-slate-600 font-semibold">
                    M
                  </kbd>
                  <span>New member</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <kbd className="shrink-0 rounded-md bg-slate-900 dark:bg-slate-800 px-2 py-1 text-[9px] text-slate-100 dark:text-slate-200 font-mono border border-slate-700 dark:border-slate-600 font-semibold">
                    F5
                  </kbd>
                  <span>Run analysis</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <kbd className="shrink-0 rounded-md bg-slate-900 dark:bg-slate-800 px-2 py-1 text-[9px] text-slate-100 dark:text-slate-200 font-mono border border-slate-700 dark:border-slate-600 font-semibold">
                    Ctrl+S
                  </kbd>
                  <span>Save project</span>
                </div>
              </div>
            </div>

            {/* Version info */}
            <div className="rounded-lg border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-slate-900/30 px-3.5 py-3 text-center">
              <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">BeamLab v2.0</p>
              <p className="text-[9px] text-slate-400 dark:text-slate-600 mt-1">&copy; {new Date().getFullYear()} BeamLab. All rights reserved.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UnifiedDashboard;
