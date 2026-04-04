/**
 * SpacePlanningPage.tsx - Complete House/Building Space Planning
 *
 * Professional multi-disciplinary planning page:
 * - Architectural floor plan generation (room placement, doors, windows)
 * - Structural layout (columns, beams, foundations)
 * - Electrical plan (circuits, fixtures, panels, load calc)
 * - Plumbing plan (supply, drainage, fixtures, rainwater)
 * - HVAC plan (AC sizing, ventilation, exhaust)
 * - Vastu Shastra / Astrological compliance
 * - Sunlight & shadow analysis
 * - Cross ventilation & airflow study
 * - 4 Elevation views (Front, Rear, Left, Right)
 * - 2 Cross-sections (A-A, B-B)
 * - Color & material recommendations
 * - DXF/PDF export support
 *
 * Built with 35+ years multi-disciplinary engineering wisdom.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2,
  LayoutGrid,
  Compass,
  Zap,
  Droplets,
  Wind,
  Sun,
  Eye,
  FileDown,
  Layers,
  Ruler,
  Palette,
  AlertTriangle,
  CheckCircle2,
  Table2,
  Settings2,
  Thermometer,
  PanelTopOpen,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Trophy,
  RefreshCw,
  Loader2,
  List,
} from 'lucide-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { useSubscription } from '../hooks/useSubscription';
import { PanelErrorBoundary, PanelFallback } from '../components/ui/PanelErrorBoundary';
import { FloorPlanRenderer, OverlayMode } from '../components/space-planning/FloorPlanRenderer';
import { ElevationSectionViewer } from '../components/space-planning/ElevationSectionViewer';
import { VastuCompass } from '../components/space-planning/VastuCompass';
import { RoomConfigWizard, WizardConfig } from '../components/space-planning/RoomConfigWizard';
import { ConstraintScorecard } from '../components/space-planning/ConstraintScorecard';
import { CandidateComparison } from '../components/space-planning/CandidateComparison';
import { VariantSelector } from '../components/space-planning/VariantSelector';
import { VariantComparison } from '../components/space-planning/VariantComparison';
import { VariantDetail } from '../components/space-planning/VariantDetail';
import { MasterDataGrid, type MasterDataGridColumnConfig } from '../components/MasterDataGrid';
import type { VariantResponse } from './space-planning/spacePlanningWorkflow';
import type { HousePlanProject, ColorScheme } from '../services/space-planning/types';
import { getLearningProgress, saveLearningProgress, completeTemplate } from '../services/learning/progressTracker';
import { checkMilestoneUnlocks, applyMilestoneUnlocks } from '../services/learning/milestoneUnlocker';
import { recordSessionEnd, recordTemplateCompletion } from '../services/learning/analyticsTracker';
import {
  PLAN_TABS,
  buildConstraintReportPdfHtml,
  downloadBlob,
  getOverlayForTab,
  type PlanTab,
} from './spacePlanningPageUtils';
import { useSpacePlanningGeneration } from './space-planning/useSpacePlanningGeneration';
import { FloorSelector, OverlaySelector } from '../components/space-planning/FloorAndOverlaySelectors';
import { RoomDetailsPanel } from '../components/space-planning/RoomDetailsPanel';
import {
  StructuralSummary,
  ElectricalSummary,
  PlumbingSummary,
  HVACSummary,
} from '../components/space-planning/MEPSummaryComponents';
import {
  ElectricalDetailingPanel,
  PlumbingDetailingPanel,
  HVACDetailingPanel,
} from '../components/space-planning/MEPDetailingPanels';
import {
  SimulationCompliancePanel,
  SunlightAnalysisPanel,
  AirflowAnalysisPanel,
} from '../components/space-planning/AnalysisPanels';
import { ColorSchemePanel } from '../components/space-planning/ColorSchemePanel';
import { SchedulePanel } from '../components/space-planning/SchedulePanel';

// ============================================
// MAIN COMPONENT
// ============================================

export function SpacePlanningPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isSignedIn } = useAuth();
  const { subscription } = useSubscription();
  const templateId = searchParams.get('template') || undefined;
  const [activeTab, setActiveTab] = useState<PlanTab>('wizard');
  const [selectedFloor, setSelectedFloor] = useState(0);
  const [overlayMode, setOverlayMode] = useState<OverlayMode>('none');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sessionStartRef = useRef<number>(Date.now());

  const handleTemplateCompletion = useCallback(() => {
    if (!templateId) return;

    let progressState = getLearningProgress();
    progressState = completeTemplate(progressState, templateId);
    saveLearningProgress(progressState);

    recordTemplateCompletion();
    const sessionDurationMs = Date.now() - sessionStartRef.current;
    recordSessionEnd(sessionStartRef.current, Math.floor(sessionDurationMs / 60000));

    const unlockResult = checkMilestoneUnlocks(progressState, 'Learner');
    if (unlockResult.unlockedMilestones.length > 0) {
      progressState = applyMilestoneUnlocks(progressState, unlockResult);
      saveLearningProgress(progressState);

      if (import.meta.env.DEV) console.log('Milestones unlocked:', unlockResult.unlockedMilestones);
    }
  }, [templateId]);

  const {
    project,
    isGenerating,
    isGeneratingVariants,
    constraintReport,
    solverPlacements,
    multiCandidateResult,
    selectedCandidateId,
    showCandidates,
    generationMode,
    setGenerationMode,
    solverError,
    solverBackendState,
    solverBackendMessage,
    lastWizardConfig,
    layoutVariantsResult,
    selectedVariantId,
    showVariants,
    runSolverHealthCheck,
    handleGenerate,
    handleSelectCandidate,
    handleGenerateVariants,
    handleSelectVariant,
    handleRegenerate,
  } = useSpacePlanningGeneration({
    templateId,
    onTemplateCompletion: handleTemplateCompletion,
    onProjectGenerated: () => {
      setActiveTab('floor_plan');
      setSelectedFloor(0);
    },
  });

  const handleExportVariant = useCallback(
    (variant: VariantResponse) => {
      const payload = {
        export_type: 'space_planning_variant',
        exported_at: new Date().toISOString(),
        variant,
        recommendation: layoutVariantsResult?.recommendation ?? null,
        selected_floor: selectedFloor,
        wizard_config: lastWizardConfig,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const safeName = variant.strategy_name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      downloadBlob(blob, `space-plan-variant-${safeName || variant.variant_id}.json`);
    },
    [layoutVariantsResult, selectedFloor, lastWizardConfig],
  );

  const handleExportConstraintJson = useCallback(() => {
    if (!constraintReport) return;
    const payload = {
      export_type: 'space_planning_constraint_report',
      exported_at: new Date().toISOString(),
      selected_floor: selectedFloor,
      report: constraintReport,
      placements: solverPlacements ?? [],
      wizard_config: lastWizardConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `constraint-report-floor-${selectedFloor}.json`);
  }, [constraintReport, selectedFloor, solverPlacements, lastWizardConfig]);

  const handleExportConstraintPdf = useCallback(() => {
    if (!constraintReport) return;
    const html = buildConstraintReportPdfHtml(constraintReport, selectedFloor);

    const win = window.open('', '_blank', 'noopener,noreferrer,width=960,height=720');
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
  }, [constraintReport, selectedFloor]);

  useEffect(() => {
    document.title = 'Space Planning | BeamLab';
    // Record session start
    sessionStartRef.current = Date.now();
  }, []);

  useEffect(() => {
    // Warm check backend once so retry banner has immediate diagnostics
    runSolverHealthCheck();
  }, [runSolverHealthCheck]);

  // ── Handle violation click → highlight room on canvas ──
  const handleViolationClick = useCallback((roomIds: string[]) => {
    if (roomIds.length > 0) {
      setSelectedRoomId(roomIds[0]);
      setActiveTab('floor_plan');
    }
  }, []);

  const currentFloorPlan =
    project?.floorPlans.find((fp) => fp.floor === selectedFloor) || project?.floorPlans[0];

  // Floor-aware MEP filtering so overlays and summaries reflect selected floor only
  const floorRoomIdSet = useMemo(() => {
    return new Set((currentFloorPlan?.rooms || []).map((r) => r.id));
  }, [currentFloorPlan]);

  const floorElectrical = useMemo(() => {
    if (!project || !currentFloorPlan) return null;
    const fixtures = project.electrical.fixtures.filter((f) => floorRoomIdSet.has(f.roomId));
    const fixtureSet = new Set(fixtures.map((f) => f.id));
    const fixtureWattById = new Map(fixtures.map((f) => [f.id, f.wattage]));
    const circuits = project.electrical.circuits
      .map((c) => ({ ...c, fixtures: c.fixtures.filter((id) => fixtureSet.has(id)) }))
      .filter((c) => c.fixtures.length > 0);
    const panels = project.electrical.panels.filter((p) => floorRoomIdSet.has(p.roomId));
    const connectedLoad = fixtures.reduce((sum, f) => sum + f.wattage, 0) / 1000;

    const diversity: Record<'lighting' | 'power' | 'ac' | 'kitchen' | 'geyser' | 'motor', number> = {
      lighting: 0.9,
      power: 0.6,
      ac: 0.8,
      kitchen: 0.7,
      geyser: 0.9,
      motor: 1.0,
    };

    const demandLoad = circuits.reduce((sum, c) => {
      const circuitKw =
        c.fixtures.reduce((w, fixtureId) => w + (fixtureWattById.get(fixtureId) ?? 0), 0) / 1000;
      return sum + circuitKw * (diversity[c.type] ?? 0.72);
    }, 0);

    return {
      ...project.electrical,
      fixtures,
      circuits,
      panels,
      connectedLoad,
      mainLoad: connectedLoad,
      demandLoad,
    };
  }, [project, currentFloorPlan, floorRoomIdSet]);

  const floorPlumbing = useMemo(() => {
    if (!project || !currentFloorPlan) return null;
    const fixtures = project.plumbing.fixtures.filter((f) => floorRoomIdSet.has(f.roomId));
    const pipes = project.plumbing.pipes.filter((p) => p.floor === currentFloorPlan.floor);
    return {
      ...project.plumbing,
      fixtures,
      pipes,
    };
  }, [project, currentFloorPlan, floorRoomIdSet]);

  const floorHVAC = useMemo(() => {
    if (!project || !currentFloorPlan) return null;
    const equipment = project.hvac.equipment.filter((e) => floorRoomIdSet.has(e.roomId));
    const roomSet = new Set(equipment.map((e) => e.roomId));
    const ventilationPaths = project.hvac.ventilationPaths.filter(
      (v) => roomSet.has(v.startRoomId) || (!!v.endRoomId && roomSet.has(v.endRoomId)),
    );
    const ductRoutes = project.hvac.ductRoutes.filter((d) => d.floor === currentFloorPlan.floor);
    return {
      ...project.hvac,
      equipment,
      ventilationPaths,
      ductRoutes,
      coolingLoad:
        equipment
          .filter((e) => ['split_ac', 'window_ac', 'vrf_unit', 'cassette_ac'].includes(e.type))
          .reduce((sum, e) => sum + (typeof e.capacity === 'number' ? e.capacity : 0), 0),
    };
  }, [project, currentFloorPlan, floorRoomIdSet]);

  const selectedRoom = currentFloorPlan?.rooms.find((r) => r.id === selectedRoomId);

  return (
    <div ref={containerRef} className="min-h-screen bg-canvas flex flex-col">
      {/* Header */}
      <header className="bg-canvas border-b border-border px-4 py-2.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-dim hover:text-token transition-colors"
            aria-label="Back to Dashboard"
          >
            ← Back
          </button>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200">Space Planning</h1>
          </div>
          {project && (
            <span className="text-[10px] text-slate-400 bg-surface px-2 py-0.5 rounded">
              {project.plot.width}m × {project.plot.depth}m | {project.floorPlans.length} floor(s)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {project && (
            <>
              {/* Constraint solver score badge */}
              {constraintReport && (
                <button
                  type="button"
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold cursor-pointer ${
                    constraintReport.score >= 85
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : constraintReport.score >= 70
                        ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  }`}
                  onClick={() => setActiveTab('floor_plan')}
                  aria-label={`Constraint compliance score: ${constraintReport.score}%. Click to view details`}
                >
                  {constraintReport.score >= 85 ? (
                    <ShieldCheck className="w-3 h-3" />
                  ) : constraintReport.score >= 70 ? (
                    <ShieldAlert className="w-3 h-3" />
                  ) : (
                    <ShieldX className="w-3 h-3" />
                  )}
                  Solver: {constraintReport.score}%
                </button>
              )}
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold ${
                  project.vastu.overallScore >= 80
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : project.vastu.overallScore >= 60
                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                }`}
              >
                <Compass className="w-3 h-3" />
                Vastu: {project.vastu.overallScore}%
              </div>
              {/* Regenerate button */}
              {lastWizardConfig && (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isGenerating}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 disabled:opacity-50"
                  title="Re-solve with different seed"
                  aria-label="Re-solve with different seed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
              )}
              <button
                onClick={() => setActiveTab('wizard')}
                className="px-2.5 py-1.5 text-xs font-medium tracking-wide text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                Edit Config
              </button>
            </>
          )}
          {/* User info (Req 3.3) */}
          {isSignedIn && user && (
            <div className="flex items-center gap-2 ml-2 pl-2 border-l border-border">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">
                {(user.firstName?.[0] ?? user.email?.[0] ?? '?').toUpperCase()}
              </div>
              <span className="text-xs text-dim hidden sm:block">{user.firstName ?? user.email}</span>
              <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                subscription.tier === 'free'
                  ? 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  : subscription.tier === 'pro'
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                    : 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300'
              }`}>
                {subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)}
              </span>
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar tabs */}
        <nav className="w-44 bg-canvas border-r border-border overflow-y-auto flex-shrink-0 hidden md:block">
          {(
            [
              'Setup',
              'Architectural',
              'Structural',
              'MEP',
              'Analysis',
              'Drawings',
              'Finishes',
              'Documents',
            ] as const
          ).map((group) => {
            const groupTabs = PLAN_TABS.filter((t) => t.group === group);
            if (groupTabs.length === 0) return null;
            return (
              <div key={group}>
                <div className="px-3 pt-3 pb-1 text-[9px] font-semibold uppercase tracking-wider text-slate-400">
                  {group}
                </div>
                {groupTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.key;
                  const isDisabled = tab.key !== 'wizard' && !project;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => !isDisabled && setActiveTab(tab.key)}
                      disabled={isDisabled}
                      className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-medium tracking-wide transition-colors ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-r-2 border-blue-600'
                          : isDisabled
                            ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed'
                            : 'text-[#869ab8] hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Mobile tab bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-canvas border-t border-border flex overflow-x-auto px-2 py-1 gap-0.5">
          {PLAN_TABS.filter((t) => t.key === 'wizard' || project)
            .slice(0, 8)
            .map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded text-[9px] min-w-[48px] ${
                    activeTab === tab.key
                      ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                      : 'text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
        </div>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:pb-4">
          {/* CSP Solver progress indicator — shown during solve (Req 14.2) */}
          {isGenerating && (
            <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg px-4 py-3 flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  {isGeneratingVariants ? 'Generating 5 design variants…' : 'Running CSP solver…'}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  Optimizing room placements and resolving constraints
                </p>
              </div>
              <div className="w-32 h-1.5 bg-blue-200 dark:bg-blue-800 rounded-full overflow-hidden flex-shrink-0">
                <div className="h-full bg-blue-600 rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
            >
              {/* ======================== WIZARD ======================== */}
              {activeTab === 'wizard' && (
                <div className="max-w-2xl mx-auto space-y-4">
                  {/* Generation Mode Selector */}
                  <div className="bg-surface rounded-lg border border-border p-4">
                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3">
                      Generation Mode
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => setGenerationMode('single')}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          generationMode === 'single'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-border hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200">
                          Single
                        </div>
                        <div className="text-xs text-dim mt-1">
                          One optimized layout
                        </div>
                      </button>
                      <button
                        onClick={() => setGenerationMode('multi')}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          generationMode === 'multi'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-border hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Trophy className="w-4 h-4" />
                          Compare
                        </div>
                        <div className="text-xs text-dim mt-1">
                          3 candidate solutions
                        </div>
                      </button>
                      <button
                        onClick={() => setGenerationMode('variants')}
                        className={`p-3 rounded-lg border-2 transition-all text-left ${
                          generationMode === 'variants'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                            : 'border-border hover:border-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1">
                          <Layers className="w-4 h-4" />
                          Variants
                        </div>
                        <div className="text-xs text-dim mt-1">
                          5 design strategies
                        </div>
                      </button>
                    </div>
                    {generationMode === 'variants' && (
                      <div className="mt-3 p-2 bg-purple-50 dark:bg-purple-900/10 rounded border border-border/30">
                        <p className="text-xs text-purple-700 dark:text-purple-400">
                          💡 Workflow-aware planning: Generates 5 competing design philosophies with quality scoring.
                        </p>
                      </div>
                    )}
                  </div>

                  <RoomConfigWizard
                    initialTemplateId={templateId}
                    onGenerate={generationMode === 'variants' ? handleGenerateVariants : handleGenerate}
                    isGenerating={isGenerating}
                    className=""
                  />
                </div>
              )}

              {/* ======================== FLOOR PLAN ======================== */}
              {activeTab === 'floor_plan' && project && currentFloorPlan && (
                <div className="space-y-4">
                  {/* Solver error banner */}
                  {solverError && (
                    <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-900/10 border border-border/30 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] text-amber-700 dark:text-amber-400">{solverError}</p>
                        {solverBackendMessage && (
                          <p className="text-[10px] text-amber-600/90 dark:text-amber-400/80 mt-0.5">
                            {solverBackendMessage}
                          </p>
                        )}
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            onClick={async () => {
                              const health = await runSolverHealthCheck();
                              if (health.ok && lastWizardConfig) {
                                handleRegenerate();
                              }
                            }}
                            disabled={isGenerating || solverBackendState === 'checking'}
                            className="text-[10px] text-amber-700 underline hover:text-amber-900 disabled:opacity-60"
                          >
                            {solverBackendState === 'checking'
                              ? 'Checking service...'
                              : 'Check service & retry'}
                          </button>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              solverBackendState === 'online'
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : solverBackendState === 'offline'
                                  ? 'bg-red-100 text-red-700 border-red-200'
                                  : solverBackendState === 'checking'
                                    ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
                                    : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            Optimizer: {solverBackendState}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <FloorSelector
                      floors={project.floorPlans}
                      selected={selectedFloor}
                      onChange={setSelectedFloor}
                    />
                    <div className="flex items-center gap-2">
                      {/* Generation mode toggle */}
                      <div className="flex items-center gap-1 bg-surface rounded-lg p-0.5">
                        <button
                          onClick={() => setGenerationMode('single')}
                          className={`px-2 py-1 text-[10px] font-medium tracking-wide rounded-md transition-colors ${
                            generationMode === 'single'
                              ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          Single
                        </button>
                        <button
                          onClick={() => setGenerationMode('multi')}
                          className={`px-2 py-1 text-[10px] font-medium tracking-wide rounded-md transition-colors flex items-center gap-1 ${
                            generationMode === 'multi'
                              ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Trophy className="w-3 h-3" />
                          Compare
                        </button>
                        <button
                          onClick={() => setGenerationMode('variants')}
                          className={`px-2 py-1 text-[10px] font-medium tracking-wide rounded-md transition-colors flex items-center gap-1 ${
                            generationMode === 'variants'
                              ? 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 shadow-sm'
                              : 'text-slate-400 hover:text-slate-600'
                          }`}
                        >
                          <Layers className="w-3 h-3" />
                          Variants
                        </button>
                      </div>
                      <OverlaySelector current={overlayMode} onChange={setOverlayMode} />
                    </div>
                  </div>

                  {/* Main floor plan + scorecard layout */}
                  <div className="flex gap-4">
                    {/* Floor plan (left/main) */}
                    <div className="flex-1 min-w-0">
                      <PanelErrorBoundary fallback={<PanelFallback name="Floor Plan" />}>
                      <FloorPlanRenderer
                        floorPlan={currentFloorPlan}
                        plot={project.plot}
                        constraints={project.constraints}
                        orientation={project.orientation}
                        structural={overlayMode === 'structural' ? project.structural : undefined}
                        electrical={overlayMode === 'electrical' ? project.electrical : undefined}
                        plumbing={overlayMode === 'plumbing' ? project.plumbing : undefined}
                        hvac={overlayMode === 'hvac' ? project.hvac : undefined}
                        overlayMode={overlayMode}
                        sectionLines={project.sectionLines}
                        selectedRoomId={selectedRoomId}
                        onRoomSelect={setSelectedRoomId}
                        showGrid
                        showDimensions
                        showCompass
                        showLabels
                        className="h-[600px]"
                        constraintReport={constraintReport ?? undefined}
                        solverPlacements={solverPlacements ?? undefined}
                        onViolationClick={(roomId, _domain) => handleViolationClick([roomId])}
                      />
                      </PanelErrorBoundary>
                    </div>

                    {/* Constraint scorecard (right rail) */}
                    {constraintReport && (
                      <div className="w-72 flex-shrink-0 hidden lg:block space-y-3 overflow-y-auto max-h-[600px]">
                        <ConstraintScorecard
                          report={constraintReport}
                          onViolationClick={handleViolationClick}
                          onExportJson={handleExportConstraintJson}
                          onExportPdf={handleExportConstraintPdf}
                        />
                      </div>
                    )}
                  </div>

                  {/* Mobile constraint scorecard (below floor plan) */}
                  {constraintReport && (
                    <div className="lg:hidden">
                      <ConstraintScorecard
                        report={constraintReport}
                        onViolationClick={handleViolationClick}
                        onExportJson={handleExportConstraintJson}
                        onExportPdf={handleExportConstraintPdf}
                        collapsed
                      />
                    </div>
                  )}

                  {/* Multi-candidate comparison panel */}
                  {multiCandidateResult && showCandidates && (
                    <CandidateComparison
                      result={multiCandidateResult}
                      onSelectCandidate={handleSelectCandidate}
                      selectedCandidateId={selectedCandidateId || undefined}
                    />
                  )}

                  {/* Workflow-aware variant panels */}
                  {layoutVariantsResult && showVariants && (
                    <div className="space-y-4">
                      {/* Variant selector with cards */}
                      <VariantSelector
                        variants={layoutVariantsResult.variants}
                        selectedVariantId={selectedVariantId}
                        onSelectVariant={handleSelectVariant}
                        isLoading={isGeneratingVariants}
                      />

                      {/* Variant comparison table */}
                      {layoutVariantsResult.variants.length > 1 && (
                        <VariantComparison
                          variants={layoutVariantsResult.variants}
                          selectedVariantId={selectedVariantId}
                        />
                      )}

                      {/* Selected variant detail */}
                      {selectedVariantId && (
                        <VariantDetail
                          variant={
                            layoutVariantsResult.variants.find(
                              (v) => v.variant_id === selectedVariantId
                            )!
                          }
                          onExport={handleExportVariant}
                        />
                      )}
                    </div>
                  )}

                  {/* Room details panel */}
                  {selectedRoom && <RoomDetailsPanel room={selectedRoom} project={project} />}

                  {/* Room list — all rooms on current floor (Req 14.1) */}
                  {currentFloorPlan && currentFloorPlan.rooms.length > 0 && (
                    <div className="bg-surface rounded-lg border border-border">
                      <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
                        <List className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Room List — Floor {selectedFloor} ({currentFloorPlan.rooms.length} rooms)
                        </span>
                      </div>
                      <div
                        className="cursor-pointer"
                        onClick={() => setSelectedRoomId(selectedRoomId)}
                      >
                      <MasterDataGrid
                        config={{
                          id: 'space-planning-room-list',
                          title: undefined,
                          density: 'compact',
                          rowKey: 'id',
                          pagination: false,
                          selectable: false,
                          editable: false,
                          data: currentFloorPlan.rooms.map((room) => ({
                            id: room.id,
                            room: room.spec.name,
                            width: room.width,
                            depth: room.height,
                            area: room.width * room.height,
                            position: `(${room.x.toFixed(1)}, ${room.y.toFixed(1)})`,
                          })),
                          columns: [
                            { key: 'room', header: 'Room', type: 'text', sortable: true, searchable: true, filterable: true, align: 'left' },
                            { key: 'width', header: 'W (m)', type: 'number', sortable: true, searchable: false, filterable: true, align: 'right' },
                            { key: 'depth', header: 'D (m)', type: 'number', sortable: true, searchable: false, filterable: true, align: 'right' },
                            { key: 'area', header: 'Area (m²)', type: 'number', sortable: true, searchable: false, filterable: true, align: 'right' },
                            { key: 'position', header: 'Position', type: 'text', sortable: true, searchable: true, filterable: true, align: 'left' },
                          ] as MasterDataGridColumnConfig[],
                          tableClassName: 'w-full text-xs',
                        }}
                      />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ======================== STRUCTURAL ======================== */}
              {activeTab === 'structural' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-blue-500" /> Structural Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    structural={project.structural}
                    overlayMode="structural"
                    sectionLines={project.sectionLines}
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <StructuralSummary structural={project.structural} />
                </div>
              )}

              {/* ======================== ELECTRICAL ======================== */}
              {activeTab === 'electrical' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-500" /> Electrical Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    electrical={floorElectrical || project.electrical}
                    overlayMode="electrical"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <ElectricalSummary electrical={floorElectrical || project.electrical} />
                  <ElectricalDetailingPanel electrical={floorElectrical || project.electrical} />
                </div>
              )}

              {/* ======================== PLUMBING ======================== */}
              {activeTab === 'plumbing' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-blue-500" /> Plumbing Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    plumbing={floorPlumbing || project.plumbing}
                    overlayMode="plumbing"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <PlumbingSummary plumbing={floorPlumbing || project.plumbing} />
                  <PlumbingDetailingPanel plumbing={floorPlumbing || project.plumbing} />
                </div>
              )}

              {/* ======================== HVAC ======================== */}
              {activeTab === 'hvac' && project && currentFloorPlan && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Wind className="w-4 h-4 text-purple-500" /> HVAC & Ventilation Plan
                  </h2>
                  <FloorPlanRenderer
                    floorPlan={currentFloorPlan}
                    plot={project.plot}
                    constraints={project.constraints}
                    orientation={project.orientation}
                    hvac={floorHVAC || project.hvac}
                    overlayMode="hvac"
                    showGrid
                    showDimensions
                    showCompass
                    showLabels
                    className="h-[500px]"
                  />
                  <HVACSummary hvac={floorHVAC || project.hvac} />
                  <HVACDetailingPanel hvac={floorHVAC || project.hvac} />
                </div>
              )}

              {/* ======================== VASTU ======================== */}
              {activeTab === 'vastu' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-500" /> Vastu Shastra Analysis
                  </h2>
                  <VastuCompass analysis={project.vastu} />
                </div>
              )}

              {/* ======================== SUNLIGHT ======================== */}
              {activeTab === 'sunlight' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Sun className="w-4 h-4 text-amber-500" /> Sunlight & Shadow Analysis
                  </h2>
                  <SunlightAnalysisPanel
                    sunlight={project.sunlight}
                    rooms={project.floorPlans.flatMap((fp) => fp.rooms)}
                  />
                  <SimulationCompliancePanel
                    sunlight={project.sunlight}
                    airflow={project.airflow}
                    rooms={project.floorPlans.flatMap((fp) => fp.rooms)}
                  />
                </div>
              )}

              {/* ======================== AIRFLOW ======================== */}
              {activeTab === 'airflow' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-green-500" /> Airflow & Ventilation
                    Analysis
                  </h2>
                  <AirflowAnalysisPanel
                    airflow={project.airflow}
                    rooms={project.floorPlans.flatMap((fp) => fp.rooms)}
                  />
                </div>
              )}

              {/* ======================== ELEVATIONS ======================== */}
              {activeTab === 'elevations' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-500" /> Elevation Views
                  </h2>
                  <PanelErrorBoundary fallback={<PanelFallback name="Elevations" />}>
                    <ElevationSectionViewer views={project.elevations} className="min-h-[400px]" />
                  </PanelErrorBoundary>
                </div>
              )}

              {/* ======================== SECTIONS ======================== */}
              {activeTab === 'sections' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <PanelTopOpen className="w-4 h-4 text-red-500" /> Cross-Section Views
                  </h2>
                  <PanelErrorBoundary fallback={<PanelFallback name="Sections" />}>
                    <ElevationSectionViewer views={project.sections} className="min-h-[400px]" />
                  </PanelErrorBoundary>
                </div>
              )}

              {/* ======================== COLORS ======================== */}
              {activeTab === 'colors' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-pink-500" /> Color & Material Recommendations
                  </h2>
                  <ColorSchemePanel schemes={project.colorSchemes} />
                </div>
              )}

              {/* ======================== SCHEDULE ======================== */}
              {activeTab === 'schedule' && project && (
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                    <Table2 className="w-4 h-4 text-slate-500" /> Room & Door/Window Schedule
                  </h2>
                  <SchedulePanel project={project} />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

// Sub-components are now maintained in separate files under /components/space-planning/

export default SpacePlanningPage;
