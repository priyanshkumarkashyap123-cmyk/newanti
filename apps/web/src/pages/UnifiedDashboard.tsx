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
  id: String(p._id ?? p.id ?? ""),
  name: p.name || "Untitled Project",
  type: inferProjectType(p),
  thumbnail: p.thumbnail,
  lastModified: new Date(p.updatedAt || p.createdAt || Date.now()),
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
  { bg: string; text: string; dot: string; border: string }
> = {
  draft: {
    bg: "bg-[#2d3449]/40",
    text: "text-[#8c909f]",
    dot: "bg-[#8c909f] shadow-[0_0_8px_rgba(140,144,159,0.5)]",
    border: "border-[#424754]/30",
  },
  analyzed: { 
    bg: "bg-[#4d8eff]/20", 
    text: "text-[#adc6ff]", 
    dot: "bg-[#adc6ff] shadow-[0_0_8px_rgba(173,198,255,0.8)]",
    border: "border-[#4d8eff]/30",
  },
  designed: {
    bg: "bg-[#00a572]/20",
    text: "text-[#6ffbbe]",
    dot: "bg-[#4edea3] shadow-[0_0_8px_rgba(78,222,163,0.8)]",
    border: "border-[#00a572]/30",
  },
  complete: {
    bg: "bg-[#00a572]/20",
    text: "text-[#6ffbbe]",
    dot: "bg-[#4edea3] shadow-[0_0_8px_rgba(78,222,163,0.8)]",
    border: "border-[#00a572]/30",
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
    accent: "group-hover:text-[#adc6ff]",
  },
  {
    id: "templates",
    title: "Templates",
    subtitle: "Pre-built structures",
    icon: <Layers className="w-5 h-5" />,
    route: "/app?panel=templates",
    accent: "group-hover:text-[#4edea3]",
  },
  {
    id: "import",
    title: "Import",
    subtitle: "DXF / STAAD / SAP",
    icon: <Upload className="w-5 h-5" />,
    route: "/app?tool=import",
    accent: "group-hover:text-[#ffb2b7]",
  },
  {
    id: "learn",
    title: "Learn",
    subtitle: "Tutorials & guides",
    icon: <GraduationCap className="w-5 h-5" />,
    route: "/learning",
    accent: "group-hover:text-[#dae2fd]",
  },
  {
    id: "ai",
    title: "AI Architect",
    subtitle: "Generate with AI",
    icon: <Sparkles className="w-5 h-5" />,
    route: "/app?mode=ai",
    accent: "group-hover:text-[#db2777]",
    badge: "AI",
  },
];

const BUNDLE_META: Record<string, BundleCardMeta> = {
  workspace: {
    icon: <Layers className="w-5 h-5" />,
    accent: "text-[#adc6ff]",
  },
  analysis: {
    icon: <BarChart3 className="w-5 h-5" />,
    accent: "text-[#adc6ff]",
  },
  design: {
    icon: <Building2 className="w-5 h-5" />,
    accent: "text-[#4edea3]",
  },
  review: {
    icon: <FileText className="w-5 h-5" />,
    accent: "text-[#ffb2b7]",
  },
  tools: {
    icon: <Wrench className="w-5 h-5" />,
    accent: "text-[#dae2fd]",
  },
  ai: {
    icon: <Sparkles className="w-5 h-5" />,
    accent: "text-[#db2777]",
  },
  civil: {
    icon: <Columns className="w-5 h-5" />,
    accent: "text-[#adc6ff]",
  },
  enterprise: {
    icon: <Users className="w-5 h-5" />,
    accent: "text-[#dae2fd]",
  },
  learning: {
    icon: <BookOpen className="w-5 h-5" />,
    accent: "text-[#4edea3]",
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
  <div className="flex items-center gap-5 rounded-2xl ui-surface-strong px-6 py-5 backdrop-blur-md shadow-lg shadow-black/20 transition-all hover:border-[#adc6ff]/20 group">
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#0b1326] text-[#dae2fd] group-hover:bg-[#4d8eff]/15 group-hover:text-[#adc6ff] group-hover:scale-110 transition-all duration-300">
      {icon}
    </div>
    <div className="min-w-0">
      <div className="flex items-baseline gap-3">
        <div className="text-2xl font-black text-white tabular-nums tracking-tight font-['Manrope']">
          {value}
        </div>
        {trend && (
          <span className={`text-[10px] font-bold px-2 py-1 rounded border ${trend.positive ? 'bg-[#4edea3]/25 border-[#6ffbbe]/50 text-[#4edea3]' : 'bg-[#ffb4ab]/20 border-[#ffb4ab]/50 text-[#ffb4ab]'}`}>
            {trend.value}
          </span>
        )}
      </div>
      <div className="text-xs font-semibold text-[#a9bcde] uppercase tracking-widest font-['Inter'] mt-1">{label}</div>
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
    ? { label: 'Enterprise', bg: 'bg-[#00285d]', text: 'text-[#adc6ff]', border: 'border-[#4d8eff]/30', icon: <Crown className="w-3 h-3" /> }
    : category.planRequired === 'pro'
      ? { label: 'Pro', bg: 'bg-[#5b0017]', text: 'text-[#ffb2b7]', border: 'border-[#92002a]/30', icon: <Zap className="w-3 h-3" /> }
      : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group rounded-xl ui-surface p-6 text-left transition-all hover:border-[#adc6ff]/50 hover:bg-[#222a3d] hover:shadow-lg hover:shadow-blue-500/10 shadow-black/20"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className={`inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[#060e20] border border-[#424754]/50 ${meta.accent}`}>
            {meta.icon}
          </div>
          <div className="mt-5 flex items-center gap-3">
            <h3 className="text-sm font-bold text-[#dae2fd] font-['Manrope']">
              {category.label}
            </h3>
            {planBadge && (
              <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-bold tracking-wide uppercase ${planBadge.bg} ${planBadge.text} ${planBadge.border}`}>
                {planBadge.icon}
                {planBadge.label}
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-[#a9bcde] leading-relaxed font-medium tracking-wide">
            {category.description}
          </p>
        </div>
        <ChevronRight className="mt-1 h-5 w-5 text-[#a9bcde] transition-all group-hover:translate-x-1 group-hover:text-[#dae2fd]" />
      </div>
      <div className="mt-6 flex flex-wrap gap-3 pt-5 border-t border-[#424754]/20">
        {preview.map((feature) => (
          <span
            key={feature.id}
            className="rounded bg-[#0b1326] border border-[#424754]/30 px-3 py-1.5 text-[10px] font-semibold tracking-wide text-[#c2c6d6]"
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
      className="group ui-surface-strong rounded-xl overflow-hidden hover:border-[#adc6ff]/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 relative cursor-pointer"
      onClick={onClick}
    >
      {/* Thumbnail area with Blueprint Pattern */}
      <div className="aspect-[16/10] bg-[#060e20] flex items-center justify-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.2]"
          style={{
            backgroundImage:
              "linear-gradient(#adc6ff 1px, transparent 1px), linear-gradient(90deg, #adc6ff 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#222a3d] to-transparent z-10" />
        
        <div className="relative z-10 text-[#a9bcde]/50 group-hover:text-[#dae2fd] transition-all duration-500 scale-125 group-hover:scale-150 group-hover:rotate-12">
          {TYPE_ICON[project.type]}
        </div>
        
        {project.starred && (
          <div className="absolute top-4 left-4 z-20">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
          </div>
        )}
        
        {/* Hover Action Sheet */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 z-30">
           <div className="bg-[#adc6ff] px-4 py-2 rounded shadow-lg text-xs font-bold text-[#002e6a] flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
             Open Project <ArrowUpRight className="w-3.5 h-3.5" />
           </div>
        </div>
      </div>

      {/* Info Body */}
      <div className="p-5 space-y-4 relative z-20 bg-[#222a3d]">
        <div className="flex items-start justify-between">
          <h3 className="text-[15px] font-bold text-[#dae2fd] truncate group-hover:text-[#adc6ff] transition-colors font-['Manrope']">
            {project.name}
          </h3>
        </div>
        
        <div className="flex items-center gap-3 text-[11px] font-medium tracking-wide text-[#c2c6d6] font-['Inter']">
          <span className="flex items-center gap-1.5 bg-[#131b2e] border border-[#424754]/20 px-2.5 py-1.5 rounded">
            <Clock className="w-3 h-3" />
            {formatDate(project.lastModified)}
          </span>
          <span className="flex items-center gap-1.5 bg-[#131b2e] border border-[#424754]/20 px-2.5 py-1.5 rounded flex-1 justify-center font-['Roboto_Mono'] tracking-tight">
            <Layers className="w-3 h-3" />
            {project.nodeCount} nodes
          </span>
        </div>

        <div className="flex items-center justify-between pt-4 mt-2 border-t border-[#424754]/20">
          <div className="absolute top-4 right-4 z-20">
            <span
              className={`px-2.5 py-1.5 rounded text-[10px] font-bold uppercase tracking-tighter border flex items-center gap-1.5 backdrop-blur-md ${st.bg} ${st.text} ${st.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${st.dot} shadow-[0_0_8px_rgba(78,222,163,0.8)]`} />
              {project.status === "complete" || project.status === "designed" ? "PASS" : project.status}
            </span>
          </div>
          <p className="text-xs text-[#8c909f] font-mono">ID: {project.id.slice(0,6)}</p>
          <ChevronRight className="w-4 h-4 text-[#8c909f] group-hover:text-[#adc6ff] transition-colors" />
        </div>
      </div>

      {/* Delete button (stop propagation) */}
      <button type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-4 left-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity
            p-1 rounded bg-[#060e20]/80 backdrop-blur-sm text-[#8c909f] hover:text-[#ffb4ab] text-xs border border-[#424754]/50"
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
  const primaryBundles = useMemo(
    () =>
      bundleCollections.primary.filter((category) => {
        if (category.id === 'analysis') return false;
        if ((journey !== 'advanced' && !showAdvanced) && category.id === 'ai') return false;
        return true;
      }),
    [bundleCollections.primary, journey, showAdvanced],
  );
  const secondaryBundles = useMemo(
    () => bundleCollections.secondary.filter((category) => category.id !== 'analysis'),
    [bundleCollections.secondary],
  );
  const advancedBundles = useMemo(
    () => bundleCollections.advanced.filter((category) => category.id !== 'analysis'),
    [bundleCollections.advanced],
  );
  const dashboardQuickActions = useMemo(() => {
    const essentials = QUICK_ACTIONS.filter((action) => action.id !== 'ai');
    const aiAction = QUICK_ACTIONS.find((action) => action.id === 'ai');
    const shouldShowAdvancedActions = journey === 'advanced' || showAdvanced;

    if (shouldShowAdvancedActions && aiAction) {
      return [...essentials, aiAction];
    }

    return essentials;
  }, [journey, showAdvanced]);

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
    <div className="text-token bg-canvas min-h-[100dvh] relative font-['Inter']" style={{ backgroundImage: 'radial-gradient(rgba(100,116,139,0.16) 1px, transparent 1px)', backgroundSize: '32px 32px' }}>
      {/* ======== MAIN ======== */}
      <main className="mx-auto max-w-[1360px] px-8 sm:px-10 lg:px-12 py-8 sm:py-10 space-y-10 sm:space-y-12 relative z-10">

        {/* ---- Post-upgrade Welcome Banner ---- */}
        {showUpgradeBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative flex items-start gap-4 rounded-xl border border-[#00a572]/30 bg-[#00a572]/10 px-5 py-4 pr-10"
          >
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#4edea3]" />
            <div className="flex-1">
              <p className="text-[15px] font-bold text-[#6ffbbe] font-['Manrope'] mb-1">
                {subscription.tier === 'enterprise' ? 'Welcome to Enterprise!' : `Welcome to ${subscription.tier === 'pro' ? 'Pro' : 'BeamLab'}!`}
                {' '}Your plan is now active.
              </p>
              <p className="text-[13px] text-[#8c909f]">
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
                    className="rounded bg-[#0b1326] border border-[#424754]/30 px-3 py-1.5 text-xs font-semibold text-[#adc6ff] transition-colors hover:bg-[#131b2e] hover:border-[#adc6ff]/30"
                  >
                    {item.label} →
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowUpgradeBanner(false)}
              className="absolute right-3 top-3 rounded p-1 text-[#8c909f] hover:text-[#dae2fd] hover:bg-[#131b2e] transition-colors"
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
            className="relative flex items-start gap-4 rounded-xl border border-[#4d8eff]/40 bg-[#4d8eff]/15 px-5 py-4 pr-10"
          >
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-[#adc6ff]" />
            <div className="flex-1">
              <p className="text-[15px] font-bold text-white font-['Manrope'] mb-1">{personalizedNudge.headline}</p>
              <p className="text-[13px] text-[#9bb0d5]">{personalizedNudge.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {personalizedNudge.ctas.map((cta) => (
                  <button
                    key={cta.path}
                    type="button"
                    onClick={() => { dismissNudge(); navigate(cta.path); }}
                    className="rounded bg-[#0b1326] border border-[#424754]/30 px-3 py-1.5 text-xs font-semibold text-[#adc6ff] transition-colors hover:bg-[#131b2e] hover:border-[#adc6ff]/30"
                  >
                    {cta.label} →
                  </button>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={dismissNudge}
              className="absolute right-3 top-3 rounded p-1 text-[#8c909f] hover:text-[#dae2fd] hover:bg-[#131b2e] transition-colors"
              aria-label="Dismiss"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </motion.div>
        )}

        {/* ---- Welcome Row ---- */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight font-['Manrope'] mb-1">
              {greeting}, {userName}
            </h1>
            <p className="text-sm font-medium tracking-wide text-[#a9bcde] font-['Inter']"> 
              {projects.length > 0
                ? `${projects.length} project${projects.length !== 1 ? "s" : ""} in your workspace`
                : "Your workspace is empty — create your first project"}
            </p>
          </div>
          <button type="button"
            onClick={() => navigate("/app")}
            className="flex items-center gap-2 rounded bg-gradient-to-b from-[#4d8eff] to-[#3b82f6] px-5 py-2.5 text-sm font-bold text-white transition-all shadow-[0_4px_12px_rgba(59,130,246,0.3)] hover:shadow-[0_6px_16px_rgba(59,130,246,0.4)] hover:-translate-y-0.5 border border-[#adc6ff]/30 backdrop-blur-sm"
          >
            <Plus className="w-5 h-5 font-bold" />
            New Project
          </button>
        </div>

        {/* ---- Engineered User Journey ---- */}
        <section className="rounded-2xl ui-surface-strong p-6 sm:p-8 shadow-xl shadow-black/20 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-8 pb-6 border-b ui-divider">
            <div>
              <h2 className="text-lg font-bold text-[#dae2fd] tracking-tight font-['Manrope'] mb-1">Your engineering flow</h2>
              <p className="text-[13px] font-medium tracking-wide text-[#8c909f]">
                {journey === 'newbie'
                  ? 'Beginner path: follow these steps to complete your first analysis faster.'
                  : journey === 'advanced'
                    ? 'Power-user path: jump straight to model, analyze, and deliverables.'
                    : 'Professional path: from project setup to verified analysis output.'}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {JOURNEY_STEPS.map((step) => (
              <button
                key={step.title}
                type="button"
                onClick={() => navigate(step.path)}
                className="group relative text-left rounded-xl ui-surface hover:bg-[#222a3d] p-4 sm:p-5 transition-all hover:border-[#adc6ff]/50 hover:shadow-lg hover:shadow-blue-500/10 shadow-black/20 focus:outline-none focus:ring-1 focus:ring-[#adc6ff]"
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#0b1326] text-[#dae2fd] border border-[#2d3d5a] group-hover:scale-110 group-hover:bg-[#4d8eff]/15 group-hover:text-[#adc6ff] transition-all duration-300">
                    {step.icon}
                  </div>
                  <span className="text-[10px] font-bold tracking-widest uppercase text-[#a9bcde]">Step</span>
                </div>
                <h3 className="text-[15px] font-bold mb-2 text-white group-hover:text-[#dae2fd] transition-colors font-['Manrope']"> {step.title}</h3>
                <p className="text-[13px] text-[#a9bcde] mb-4 leading-relaxed font-medium tracking-wide">{step.description}</p>
                <div className="flex items-center gap-1 text-[13px] font-bold text-[#dae2fd] group-hover:text-white group-hover:gap-2 transition-all">
                  Open
                  <ArrowUpRight className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {journey === 'newbie' && (
          <section className="rounded-2xl ui-surface p-6 sm:p-8 shadow-xl shadow-black/20">
            <h2 className="text-[15px] font-bold text-white font-['Manrope']">Getting started (recommended)</h2>
            <p className="mt-2 text-[13px] text-[#a9bcde]">
              These three actions are optimized for first-time users.
            </p>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { title: 'Open Learning Center', subtitle: '2-minute guided intro', route: '/learning' },
                { title: 'Try a Template', subtitle: 'Start from a proven model', route: '/app?panel=templates' },
                { title: 'Run First Analysis', subtitle: 'Go from model to results', route: '/app' },
              ].map((item) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => navigate(item.route)}
                  className="text-left rounded-xl ui-surface p-4 transition-all hover:border-[#adc6ff]/50 hover:bg-[#222a3d] group"
                >
                  <h3 className="text-sm font-bold text-white group-hover:text-[#dae2fd] transition-colors font-['Manrope']">{item.title}</h3>
                  <p className="mt-1 text-xs font-medium tracking-wide text-[#9bb0d5]">{item.subtitle}</p>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---- Stats Row ---- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
          <StatPill
            label="Projects"
            value={projects.length}
            icon={<FolderOpen className="w-5 h-5" />}
          />
          <StatPill
            label="Analyses"
            value={analysedCount}
            icon={<BarChart3 className="w-5 h-5" />}
          />
          <StatPill
            label="Members"
            value={totalMembers.toLocaleString()}
            icon={<Cpu className="w-5 h-5" />}
          />
          <StatPill
            label="Nodes"
            value={totalNodes.toLocaleString()}
            icon={<ActivityIcon className="w-5 h-5" />}
          />
        </div>

        {/* ---- Quick Actions ---- */}
        <div>
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#8c909f] font-['Inter']">
              Quick Actions
            </h2>
            <span className="text-[10px] uppercase font-bold text-[#7a8bb0]">Shortcuts</span>
          </div>
          <div className={`grid grid-cols-2 sm:grid-cols-3 ${dashboardQuickActions.length >= 5 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-5`}>
            {dashboardQuickActions.map((a) => (
              <button type="button"
                key={a.id}
                onClick={() => navigate(a.route)}
                className="group relative flex flex-col items-start rounded-xl ui-surface-strong px-4 py-4 text-left transition-all hover:border-[#adc6ff]/50 hover:bg-[#131b2e] hover:shadow-lg hover:shadow-blue-500/10 shadow-black/20"
              >
                <div
                  className={`h-11 w-11 flex items-center justify-center rounded-xl bg-[#0b1326] border border-[#424754]/50 
                  transition-all group-hover:scale-110 group-hover:bg-[#4d8eff]/10`}
                >
                  <div className={`transition-colors ${a.accent}`}>
                    {a.icon}
                  </div>
                </div>
                <div className="flex-1 mt-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[13px] font-bold text-white group-hover:text-[#dae2fd] transition-colors font-['Manrope']"> 
                      {a.title}
                    </span>
                    {a.badge && (
                      <span className="rounded bg-[#5b0017] px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#ffb2b7] border border-[#92002a]/30 uppercase">
                        {a.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-medium tracking-wide text-[#a9bcde]">
                    {a.subtitle}
                  </span>
                </div>
                <div className="absolute top-4 right-4">
                   <ChevronRight className="w-4 h-4 text-[#a9bcde] opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-white transition-all" />
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-6 text-[11px] font-bold uppercase tracking-widest text-[#8c909f] font-['Inter']">
            Explore by Workflow
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
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
            <div className="mb-6 flex items-center justify-between gap-6">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#8c909f] font-['Inter']">
                Specialist Suites
              </h2>
              {(journey === 'newbie' || journey === 'professional') && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="text-xs font-bold text-[#adc6ff] hover:text-[#dae2fd] transition-colors hover:underline rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#adc6ff]"
                >
                  {showAdvanced ? 'Hide advanced' : 'Show advanced'}
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
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
            <div className="rounded-xl border border-[#424754]/30 bg-[#131b2e] p-4 shadow-xl shadow-black/20">
              <p className="text-[13px] text-[#8c909f]">
                Advanced suites are hidden in guided mode.
              </p>
              <button
                type="button"
                onClick={() => setShowAdvanced(true)}
                className="mt-2 text-xs font-bold text-[#adc6ff] hover:text-[#dae2fd] transition-colors hover:underline rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#adc6ff]"
              >
                Show advanced suites
              </button>
            </div>
          )
        )}

        {(journey === 'advanced' || showAdvanced) && advancedBundles.length > 0 && (
          <div>
            <div className="mb-6 flex items-center justify-between gap-6">
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-[#8c909f] font-['Inter']">
                Advanced Suites
              </h2>
              {journey !== 'advanced' && (
                <button
                  type="button"
                  onClick={() => setShowAdvanced(false)}
                  className="text-xs font-bold text-[#adc6ff] hover:text-[#dae2fd] transition-colors hover:underline rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#adc6ff]"
                >
                  Hide advanced
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {advancedBundles.map((category) => (
                <BundleCard
                  key={category.id}
                  category={category}
                  onOpen={() => {
                    track(ANALYTICS_EVENTS.BUNDLE_CARD_OPENED, { categoryId: category.id, prominence: 'advanced' });
                    navigate(category.features[0]?.path ?? '/stream');
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ---- Content Grid ---- */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 lg:gap-10">
          {/* Left: Projects */}
          <div>
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 mb-8">
              <h2 className="text-[15px] font-bold text-[#dae2fd] font-['Manrope'] flex-1">
                Recent Projects
              </h2>
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8c909f]" />
                  <input
                    type="text"
                    placeholder="Filter by name…"
                    aria-label="Search projects"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-40 sm:w-48 ui-input-control py-2 pl-9 pr-3 text-[13px] font-medium tracking-wide text-[#dae2fd]
                      placeholder-[#8c909f] focus:outline-none focus:border-[#adc6ff]/50 focus:ring-1 focus:ring-[#adc6ff]/50
                      transition-colors"
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="ui-input-control px-3 py-2 text-[13px] font-medium tracking-wide text-[#dae2fd]
                    focus:outline-none focus:border-[#adc6ff]/50 focus:ring-1 focus:ring-[#adc6ff]/50"
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {projectsLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-[#424754]/30 bg-[#222a3d] animate-pulse min-h-[220px]"
                  >
                    <div className="aspect-[16/9] bg-[#131b2e] border-b border-[#424754]/20" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 w-3/4 rounded bg-[#424754]/40" />
                      <div className="h-3 w-1/2 rounded bg-[#424754]/20" />
                    </div>
                  </div>
                ))
              ) : projectsError ? (
                <div className="col-span-full rounded-xl border border-red-500/20 bg-red-500/5 p-8 text-center">
                  <p className="text-sm text-red-400 mb-3">{projectsError}</p>
                  <button type="button"
                    onClick={fetchProjects}
                    className="rounded-lg border border-red-500/20 px-4 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40"
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
                <div className="col-span-full mt-6 px-4 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#424754]/50 bg-[#131b2e]/50 py-14 sm:py-20 text-center">
                  <div className="h-16 w-16 rounded-xl bg-[#060e20] border border-[#424754]/30 flex items-center justify-center mb-5">
                    <FolderOpen className="w-8 h-8 text-[#adc6ff]" />
                  </div>
                  <h3 className="text-[15px] font-bold text-[#dae2fd] font-['Manrope'] mb-2">
                    {searchQuery ? "No matching projects" : "No projects yet"}
                  </h3>
                  <p className="text-[13px] text-[#8c909f] mb-6 max-w-sm leading-relaxed">
                    {searchQuery
                      ? `Nothing matches "${searchQuery}". Try a different search.`
                      : "Create your first structural analysis project."}
                  </p>
                  <button type="button"
                    onClick={() => navigate("/app")}
                    className="inline-flex items-center gap-2 rounded bg-[#0b1326] border border-[#424754]/30 hover:border-[#adc6ff]/50 px-5 py-2.5 text-[13px] font-bold text-[#adc6ff] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#adc6ff]"
                  >
                    <Plus className="w-4 h-4" /> Create Project
                  </button>
                </div>
              )}
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <TemplateExplorer
              onStartTemplate={(templateId) =>
                navigate(`/space-planning?template=${encodeURIComponent(templateId)}`)
              }
            />

            {/* Keyboard shortcuts */}
            <div className="rounded-xl ui-surface-strong p-5 shadow-lg shadow-black/20 backdrop-blur-md">
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-[#8c909f] font-['Inter'] mb-4">
                Keyboard Shortcuts
              </h3>
              <div className="space-y-3.5 text-[11px] font-bold text-[#c2c6d6] font-['Inter']">
                <div className="flex items-center gap-3">
                  <kbd className="shrink-0 ui-kbd px-2 py-1 text-[10px] font-['Roboto_Mono'] shadow-inner">
                    N
                  </kbd>
                  <span>New node</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="shrink-0 ui-kbd px-2 py-1 text-[10px] font-['Roboto_Mono'] shadow-inner">
                    M
                  </kbd>
                  <span>New member</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="shrink-0 ui-kbd px-2 py-1 text-[10px] font-['Roboto_Mono'] shadow-inner">
                    F5
                  </kbd>
                  <span>Run analysis</span>
                </div>
                <div className="flex items-center gap-3">
                  <kbd className="shrink-0 ui-kbd px-2 py-1 text-[10px] font-['Roboto_Mono'] shadow-inner">
                    Ctrl+S
                  </kbd>
                  <span>Save project</span>
                </div>
              </div>
            </div>

            {/* Version info */}
            <div className="rounded ui-surface px-3.5 py-3 text-center">
              <p className="text-[10px] font-bold text-[#8c909f] uppercase tracking-wider font-['Inter']">BeamLab v2.0</p>
              <p className="text-[9px] font-medium tracking-wide text-[#424754] mt-1">&copy; {new Date().getFullYear()} BeamLab. All rights reserved.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default UnifiedDashboard;
